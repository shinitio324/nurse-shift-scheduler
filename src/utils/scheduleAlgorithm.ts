// =============================================================
// src/utils/scheduleAlgorithm.ts  ── 完全修正版
// Bug A: applyAkeForDate を assignDailyShifts の「前」に実行
// Bug B: calcStatistics を ScheduleStatistics 型に完全準拠
// Bug C: isNightShift がパターンの isNight フラグも参照
// Bug D: 月初1日の前月末夜勤を IndexedDB から取得
// Bug E: 有給リクエストが明け予定日に入らないよう Pass1 でスキップ
// =============================================================

import { db } from '../db';
import type {
  Staff, ShiftPattern, ScheduleConstraints,
  ScheduleGenerationParams, GeneratedSchedule,
  ConstraintViolation, ScheduleGenerationResult,
  ScheduleStatistics, StaffWorkloadStat,
  ShiftTypeDistributionStat, ShiftRequest,
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
    this.staff        = staff;
    this.allPatterns  = allPatterns;
    this.constraints  = constraints;
    this.requests     = requests;
    this.params       = params;

    this.akePattern         = allPatterns.find(p => p.isAke      === true || p.name === AKE_NAME);
    this.hasAkePattern      = !!this.akePattern;
    this.vacationPattern    = allPatterns.find(p => p.isVacation === true || p.name === VACATION_NAME);
    this.hasVacationPattern = !!this.vacationPattern;

    console.log(
      `[SG] 明けパターン: ${this.hasAkePattern ? '✅' : '❌'}  ` +
      `有給パターン: ${this.hasVacationPattern ? '✅' : '❌'}`,
    );
  }

  private async loadPrevMonthNightStaff(): Promise<void> {
    if (!this.hasAkePattern) return;
    const { year, month } = this.params;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const lastDate  = formatDate(prevYear, prevMonth, getDaysInMonth(prevYear, prevMonth));
    try {
      const rows = await db.generatedSchedules.where('date').equals(lastDate).toArray();
      this.prevMonthNightStaffIds = new Set(
        rows.filter(s => this.isNightShift(s.shiftType)).map(s => s.staffId),
      );
      console.log(`[SG] 前月末夜勤スタッフ (${lastDate}):`, this.prevMonthNightStaffIds.size, '名');
    } catch (e) {
      console.warn('[SG] 前月末夜勤ロード失敗:', e);
    }
  }

  async generate(): Promise<ScheduleGenerationResult> {
    await this.loadPrevMonthNightStaff();
    const { year, month } = this.params;
    const dates = getMonthDates(year, month);

    // Pass 1: 有給先行確定（明け予定日スキップ）
    this.pass1_vacationRequests(dates);

    // Pass 2: 日次割当て ★ 明けが先、通常が後
    for (const date of dates) {
      if (this.hasAkePattern) this.applyAkeForDate(date);
      this.assignDailyShifts(date);
    }

    // Pass 3: 休み日数調整
    this.pass3_adjustRestDays(dates);

    // Pass 4: 最低勤務日数保証
    this.pass4_enforceMinWorkDays(dates);

    return {
      schedules:   this.schedules,
      violations:  this.violations,
      statistics:  this.calcStatistics(dates),
      generatedAt: new Date().toISOString(),
      year,
      month,
    };
  }

  private pass1_vacationRequests(dates: string[]): void {
    if (!this.hasVacationPattern || !this.vacationPattern) return;
    const vacReqs = this.requests.filter(
      r => r.shiftType === VACATION_NAME || r.patternId === this.vacationPattern!.id,
    );
    for (const req of vacReqs) {
      const d = req.date.slice(0, 10);
      if (!dates.includes(d)) continue;
      if (this.willBeAke(req.staffId, d)) {
        console.log(`[P1] ${req.staffId} ${d} 明け予定のため有給スキップ`);
        continue;
      }
      if (!this.getSch(req.staffId, d)) this.push(req.staffId, d, VACATION_NAME);
    }
  }

  private willBeAke(staffId: number | string, dateStr: string): boolean {
    if (!this.hasAkePattern) return false;
    const { year, month } = this.params;
    if (dateStr === formatDate(year, month, 1)) {
      return this.prevMonthNightStaffIds.has(staffId);
    }
    const prevSch = this.getSch(staffId, addDays(dateStr, -1));
    return !!(prevSch && this.isNightShift(prevSch.shiftType));
  }

  // ★ 明け付与: 必ず assignDailyShifts の前に呼ぶ
  private applyAkeForDate(date: string): void {
    const { year, month } = this.params;
    const isFirstDay = date === formatDate(year, month, 1);
    const prevDate   = addDays(date, -1);

    for (const st of this.staff) {
      if (this.getSch(st.id, date)) continue; // 有給等で確定済み

      const prevWasNight = isFirstDay
        ? this.prevMonthNightStaffIds.has(st.id as number)
        : (() => {
            const ps = this.getSch(st.id, prevDate);
            return !!(ps && this.isNightShift(ps.shiftType));
          })();

      if (prevWasNight) {
        this.push(st.id, date, AKE_NAME);
        console.log(`[applyAke] ✅ ${st.name} ${date} → 明け付与`);
      }
    }
  }

  private assignDailyShifts(date: string): void {
    for (const req of this.requests.filter(r => r.date.slice(0, 10) === date)) {
      if (this.getSch(req.staffId, date)) continue;
      if (req.shiftType === VACATION_NAME) continue;
      if (this.canAssign(req.staffId, date, req.shiftType)) {
        this.push(req.staffId, date, req.shiftType);
      }
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
          date: formatDate(this.params.year, this.params.month, 1),
          type: 'warning',
          message: `${st.name}: 最低勤務日数 ${min}日 を ${deficit}日 達成できませんでした`,
        });
      }
    }
  }

  private canWork(staffId: number | string, date: string): boolean {
    const max = this.getActiveConstraint()?.maxConsecutiveWorkDays ?? 3;
    let consec = 0;
    let d = addDays(date, -1);
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
      const { year, month } = this.params;
      const isFirst = date === formatDate(year, month, 1);
      const prevWasNight = isFirst
        ? this.prevMonthNightStaffIds.has(staffId)
        : (() => {
            const ps = this.getSch(staffId, addDays(date, -1));
            return !!(ps && this.isNightShift(ps.shiftType));
          })();
      if (prevWasNight) return shiftType === AKE_NAME;
    }
    return true;
  }

  private getActiveConstraint(): ScheduleConstraints | undefined {
    return [...this.constraints]
      .filter(c => c.isActive)
      .sort((a, b) => b.priority - a.priority)[0];
  }

  private calcStatistics(dates: string[]): ScheduleStatistics {
    const staffWorkload: StaffWorkloadStat[] = this.staff.map(st => {
      const workDays  = this.countWork(st.id, dates);
      const restDays  = this.countRest(st.id, dates);
      const akeDays   = dates.filter(d => this.getSch(st.id, d)?.shiftType === AKE_NAME).length;
      const vacDays   = dates.filter(d => this.getSch(st.id, d)?.shiftType === VACATION_NAME).length;
      const nightDays = dates.filter(d => {
        const s = this.getSch(st.id, d);
        return s ? this.isNightShift(s.shiftType) : false;
      }).length;
      let maxConsec = 0, cur = 0;
      for (const d of dates) {
        const s = this.getSch(st.id, d);
        if (s && this.isWorkShift(s.shiftType)) { cur++; maxConsec = Math.max(maxConsec, cur); }
        else cur = 0;
      }
      let totalHours = 0;
      for (const d of dates) {
        const s = this.getSch(st.id, d);
        if (!s || !this.isWorkShift(s.shiftType)) continue;
        const pat = this.allPatterns.find(p => p.name === s.shiftType);
        if (pat) totalHours += this.calcShiftHours(pat.startTime, pat.endTime);
      }
      return {
        staffId: String(st.id), staffName: st.name,
        totalDays: dates.length, workDays, restDays,
        akeDays, vacationDays: vacDays, nightShiftDays: nightDays,
        maxConsecutiveWorkDays: maxConsec, totalWorkHours: totalHours,
      } satisfies StaffWorkloadStat;
    });

    const distMap = new Map<string, number>();
    for (const s of this.schedules) {
      distMap.set(s.shiftType, (distMap.get(s.shiftType) ?? 0) + 1);
    }
    const shiftTypeDistribution: ShiftTypeDistributionStat[] = Array.from(distMap.entries())
      .map(([shiftType, count]) => ({ shiftType, count }));

    return {
      totalDays:              dates.length,
      totalShifts:            this.schedules.filter(s => this.isWorkShift(s.shiftType)).length,
      staffWorkload,
      shiftTypeDistribution,
      maxConsecutiveWorkDays: staffWorkload.reduce((a, s) => Math.max(a, s.maxConsecutiveWorkDays), 0),
      totalWorkHours:         staffWorkload.reduce((a, s) => a + s.totalWorkHours, 0),
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
    const i = this.schedules.findIndex(
      s => String(s.staffId) === String(staffId) && s.date === date,
    );
    if (i >= 0) this.schedules[i] = { ...this.schedules[i], shiftType };
  }

  private countWork(staffId: number | string, dates: string[]): number {
    return dates.filter(d => {
      const s = this.getSch(staffId, d);
      return s && this.isWorkShift(s.shiftType);
    }).length;
  }

  private countRest(staffId: number | string, dates: string[]): number {
    return dates.filter(d => this.getSch(staffId, d)?.shiftType === REST_NAME).length;
  }
}
