// =============================================================
// src/utils/scheduleAlgorithm.ts  ── 完全修正版
//
// 修正点:
//   [Bug A] applyAkeForDate を assignDailyShifts の「前」に呼ぶ
//   [Bug B] calcStatistics を ScheduleStatistics 型に完全準拠
//   [Bug C] isNightShift がパターンの isNight フラグも参照
//   [Bug D] 月初1日の前月末夜勤を IndexedDB から取得
//   [Bug E] 有給リクエストが明け予定日に入らないよう Pass1 でスキップ
//   [Bug F] params.year/month が undefined の場合 targetYear/targetMonth にフォールバック
// =============================================================

import { db } from '../db';
import type {
  Staff,
  ShiftPattern,
  ScheduleConstraints,
  ScheduleGenerationParams,
  GeneratedSchedule,
  ConstraintViolation,
  ScheduleGenerationResult,
  ScheduleStatistics,
  StaffWorkloadStat,
  ShiftTypeDistributionStat,
  ShiftRequest,
} from '../types';

const AKE_NAME      = '明け';
const VACATION_NAME = '有給';
const REST_NAME     = '休み';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  return Array.from({ length: days }, (_, i) => formatDate(year, month, i + 1));
}

export class ScheduleGenerator {
  private staff: Staff[];
  private allPatterns: ShiftPattern[];
  private constraints: ScheduleConstraints[];
  private requests: ShiftRequest[];
  private params: ScheduleGenerationParams;
  private schedules: GeneratedSchedule[] = [];
  private violations: ConstraintViolation[] = [];

  // ★ year/month を正規化して保持（targetYear/targetMonth にも対応）
  private readonly year: number;
  private readonly month: number;

  private hasAkePattern: boolean;
  private akePattern: ShiftPattern | undefined;
  private hasVacationPattern: boolean;
  private vacationPattern: ShiftPattern | undefined;
  private prevMonthNightStaffIds: Set<number | string> = new Set();

  constructor(
    staff: Staff[],
    allPatterns: ShiftPattern[],
    constraints: ScheduleConstraints[],
    requests: ShiftRequest[],
    params: ScheduleGenerationParams,
  ) {
    this.staff       = staff;
    this.allPatterns = allPatterns;
    this.constraints = constraints;
    this.requests    = requests;
    this.params      = params;

    // ★ フォールバック: targetYear/targetMonth → year/month
    this.year  = params.year  ?? params.targetYear  ?? new Date().getFullYear();
    this.month = params.month ?? params.targetMonth ?? (new Date().getMonth() + 1);

    this.akePattern         = allPatterns.find(p => p.isAke === true || p.name === AKE_NAME);
    this.hasAkePattern      = !!this.akePattern;
    this.vacationPattern    = allPatterns.find(p => p.isVacation === true || p.name === VACATION_NAME);
    this.hasVacationPattern = !!this.vacationPattern;

    console.log(
      `[SG] ${this.year}年${this.month}月  ` +
      `明けパターン: ${this.hasAkePattern ? '✅' : '❌'}  ` +
      `有給パターン: ${this.hasVacationPattern ? '✅' : '❌'}`,
    );
  }

  private async loadPrevMonthNightStaff(): Promise<void> {
    if (!this.hasAkePattern) return;
    const prevYear  = this.month === 1 ? this.year - 1 : this.year;
    const prevMonth = this.month === 1 ? 12 : this.month - 1;
    const lastDate  = formatDate(prevYear, prevMonth, getDaysInMonth(prevYear, prevMonth));
    try {
      const rows = await db.generatedSchedules.where('date').equals(lastDate).toArray();
      this.prevMonthNightStaffIds = new Set(
        rows.filter(s => this.isNightShift(s.shiftType)).map(s => s.staffId),
      );
      console.log(`[SG] 前月末夜勤 (${lastDate}):`, this.prevMonthNightStaffIds.size, '名');
    } catch (e) {
      console.warn('[SG] 前月末夜勤ロード失敗:', e);
    }
  }

  async generate(): Promise<ScheduleGenerationResult> {
    await this.loadPrevMonthNightStaff();
    const dates = getMonthDates(this.year, this.month);
    console.log(`[SG] 対象: ${dates.length}日 (${dates[0]} 〜 ${dates[dates.length - 1]})`);

    this.pass1_vacationRequests(dates);

    for (const date of dates) {
      if (this.hasAkePattern) this.applyAkeForDate(date); // ★ 通常割当ての前
      this.assignDailyShifts(date);
    }

    this.pass3_adjustRestDays(dates);
    this.pass4_enforceMinWorkDays(dates);

    console.log(`[SG] 完了: ${this.schedules.length}件 / 違反: ${this.violations.length}件`);

    return {
      schedules:   this.schedules,
      violations:  this.violations,
      statistics:  this.calcStatistics(dates),
      generatedAt: new Date().toISOString(),
      year:        this.year,
      month:       this.month,
    };
  }

  private pass1_vacationRequests(dates: string[]): void {
    if (!this.hasVacationPattern || !this.vacationPattern) return;
    const vacReqs = this.requests.filter(
      r => r.shiftType === VACATION_NAME || r.patternId === this.vacationPattern!.id,
    );
    for (const req of vacReqs) {
      const d = typeof req.date === 'string' ? req.date.slice(0, 10) : '';
      if (!d || !dates.includes(d)) continue;
      if (this.willBeAke(req.staffId, d)) continue;
      if (!this.getSch(req.staffId, d)) this.push(req.staffId, d, VACATION_NAME);
    }
  }

  private willBeAke(staffId: number | string, dateStr: string): boolean {
    if (!this.hasAkePattern) return false;
    if (dateStr === formatDate(this.year, this.month, 1)) {
      return this.prevMonthNightStaffIds.has(staffId);
    }
    const prevSch = this.getSch(staffId, addDays(dateStr, -1));
    return !!(prevSch && this.isNightShift(prevSch.shiftType));
  }

  private applyAkeForDate(date: string): void {
    const isFirstDay = date === formatDate(this.year, this.month, 1);
    const prevDate   = addDays(date, -1);
    for (const st of this.staff) {
      if (this.getSch(st.id, date)) continue;
      const prevWasNight = isFirstDay
        ? this.prevMonthNightStaffIds.has(st.id as number)
        : (() => { const ps = this.getSch(st.id, prevDate); return !!(ps && this.isNightShift(ps.shiftType)); })();
      if (prevWasNight) {
        this.push(st.id, date, AKE_NAME);
        console.log(`[applyAke] ✅ ${st.name} ${date} → 明け`);
      }
    }
  }

  private assignDailyShifts(date: string): void {
    for (const req of this.requests.filter(r => typeof r.date === 'string' && r.date.slice(0, 10) === date)) {
      if (this.getSch(req.staffId, date)) continue;
      if (req.shiftType === VACATION_NAME) continue;
      if (this.canAssign(req.staffId, date, req.shiftType)) this.push(req.staffId, date, req.shiftType);
    }
    for (const st of this.staff) {
      if (this.getSch(st.id, date)) continue;
      this.push(st.id, date, this.decideShift(st, date));
    }
  }

  private decideShift(st: Staff, date: string): string {
    if (!this.canWork(st.id, date)) return REST_NAME;
    const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
    return wp ? wp.name : REST_NAME;
  }

  private pass3_adjustRestDays(dates: string[]): void {
    const target = this.constraints[0]?.exactRestDaysPerMonth ?? 0;
    if (target <= 0) return;
    for (const st of this.staff) {
      const diff = target - this.countRest(st.id, dates);
      if (diff > 0) {
        let n = diff;
        for (const d of dates) {
          if (n <= 0) break;
          const s = this.getSch(st.id, d);
          if (s && this.isWorkShift(s.shiftType)) { this.overwrite(st.id, d, REST_NAME); n--; }
        }
      } else if (diff < 0) {
        let n = Math.abs(diff);
        for (const d of dates) {
          if (n <= 0) break;
          const s = this.getSch(st.id, d);
          if (s && s.shiftType === REST_NAME && this.canAssign(st.id, d, '勤務')) {
            const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
            if (wp) { this.overwrite(st.id, d, wp.name); n--; }
          }
        }
      }
    }
  }

  private pass4_enforceMinWorkDays(dates: string[]): void {
    for (const st of this.staff) {
      const min = st.minWorkDaysPerMonth ?? 0;
      if (min <= 0) continue;
      let deficit = min - this.countWork(st.id, dates);
      if (deficit <= 0) continue;
      console.log(`🔧 ${st.name} 最低勤務: ${min}日 / 現在: ${min - deficit}日 → ${deficit}日不足`);
      for (const d of dates) {
        if (deficit <= 0) break;
        const s = this.getSch(st.id, d);
        if (s && s.shiftType === REST_NAME && this.canAssign(st.id, d, '勤務')) {
          const wp = this.allPatterns.find(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
          if (wp) { this.overwrite(st.id, d, wp.name); deficit--; }
        }
      }
      if (deficit > 0) {
        this.violations.push({
          staffId: String(st.id), staffName: st.name,
          date: formatDate(this.year, this.month, 1), type: 'warning',
          message: `${st.name}: 最低勤務日数 ${min}日 を ${deficit}日 達成できませんでした`,
        });
      }
    }
  }

  private canWork(staffId: number | string, date: string): boolean {
    const max = this.getActiveConstraint()?.maxConsecutiveWorkDays ?? 3;
    let consec = 0, d = addDays(date, -1);
    for (let i = 0; i < max; i++) {
      const s = this.getSch(staffId, d);
      if (s && this.isWorkShift(s.shiftType)) { consec++; d = addDays(d, -1); }
      else break;
    }
    return consec < max;
  }

  private canAssign(staffId: number | string, date: string, shiftType: string): boolean {
    if (!this.canWork(staffId, date)) return false;
    if (this.hasAkePattern) {
      const isFirst = date === formatDate(this.year, this.month, 1);
      const prevWasNight = isFirst
        ? this.prevMonthNightStaffIds.has(staffId)
        : (() => { const ps = this.getSch(staffId, addDays(date, -1)); return !!(ps && this.isNightShift(ps.shiftType)); })();
      if (prevWasNight) return shiftType === AKE_NAME;
    }
    return true;
  }

  private getActiveConstraint(): ScheduleConstraints | undefined {
    return [...this.constraints].filter(c => c.isActive).sort((a, b) => b.priority - a.priority)[0];
  }

  private calcStatistics(dates: string[]): ScheduleStatistics {
    const staffWorkload: StaffWorkloadStat[] = this.staff.map(st => {
      const workDays  = this.countWork(st.id, dates);
      const restDays  = this.countRest(st.id, dates);
      const akeDays   = dates.filter(d => this.getSch(st.id, d)?.shiftType === AKE_NAME).length;
      const vacDays   = dates.filter(d => this.getSch(st.id, d)?.shiftType === VACATION_NAME).length;
      const nightDays = dates.filter(d => { const s = this.getSch(st.id, d); return s ? this.isNightShift(s.shiftType) : false; }).length;
      let maxConsec = 0, cur = 0;
      for (const d of dates) {
        const s = this.getSch(st.id, d);
        if (s && this.isWorkShift(s.shiftType)) { cur++; maxConsec = Math.max(maxConsec, cur); } else cur = 0;
      }
      let totalHours = 0;
      for (const d of dates) {
        const s = this.getSch(st.id, d);
        if (!s || !this.isWorkShift(s.shiftType)) continue;
        const pat = this.allPatterns.find(p => p.name === s.shiftType);
        if (pat) totalHours += this.calcShiftHours(pat.startTime, pat.endTime);
      }
      return {
        staffId: String(st.id), staffName: st.name, totalDays: dates.length,
        workDays, restDays, akeDays, vacationDays: vacDays,
        nightShiftDays: nightDays, maxConsecutiveWorkDays: maxConsec, totalWorkHours: totalHours,
      } satisfies StaffWorkloadStat;
    });

    const distMap = new Map<string, number>();
    for (const s of this.schedules) distMap.set(s.shiftType, (distMap.get(s.shiftType) ?? 0) + 1);
    const shiftTypeDistribution: ShiftTypeDistributionStat[] =
      Array.from(distMap.entries()).map(([shiftType, count]) => ({ shiftType, count }));

    return {
      totalDays: dates.length,
      totalShifts: this.schedules.filter(s => this.isWorkShift(s.shiftType)).length,
      staffWorkload, shiftTypeDistribution,
      maxConsecutiveWorkDays: staffWorkload.reduce((a, s) => Math.max(a, s.maxConsecutiveWorkDays), 0),
      totalWorkHours: staffWorkload.reduce((a, s) => a + s.totalWorkHours, 0),
    } satisfies ScheduleStatistics;
  }

  private calcShiftHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins / 60;
  }

  private isNightShift(shiftType: string): boolean {
    if (!shiftType) return false;
    const lower = shiftType.toLowerCase();
    if (lower.includes('夜勤') || lower.includes('night') || lower.includes('ナイト')) return true;
    return !!(this.allPatterns.find(p => p.name === shiftType)?.isNight);
  }

  private isWorkShift(shiftType: string): boolean {
    return shiftType !== REST_NAME && shiftType !== AKE_NAME && shiftType !== VACATION_NAME;
  }

  private getSch(staffId: number | string, date: string): GeneratedSchedule | undefined {
    return this.schedules.find(s => String(s.staffId) === String(staffId) && s.date === date);
  }

  private push(staffId: number | string, date: string, shiftType: string): void {
    const st = this.staff.find(s => String(s.id) === String(staffId));
    this.schedules.push({
      staffId, staffName: st?.name ?? String(staffId),
      date, shiftType, isGenerated: true, createdAt: new Date().toISOString(),
    } as GeneratedSchedule);
  }

  private overwrite(staffId: number | string, date: string, shiftType: string): void {
    const i = this.schedules.findIndex(s => String(s.staffId) === String(staffId) && s.date === date);
    if (i >= 0) this.schedules[i] = { ...this.schedules[i], shiftType };
  }

  private countWork(staffId: number | string, dates: string[]): number {
    return dates.filter(d => { const s = this.getSch(staffId, d); return s && this.isWorkShift(s.shiftType); }).length;
  }

  private countRest(staffId: number | string, dates: string[]): number {
    return dates.filter(d => this.getSch(staffId, d)?.shiftType === REST_NAME).length;
  }
}
