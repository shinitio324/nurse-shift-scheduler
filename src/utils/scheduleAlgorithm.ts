// src/utils/scheduleAlgorithm.ts
import { db } from '../db';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  ScheduleStatistics,
  StaffWorkloadStat,
} from '../types';

export const AKE_NAME      = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME     = '休み';

// ─── ユーティリティ ───────────────────────────
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  return Array.from({ length: days }, (_, i) =>
    formatDate(new Date(year, month - 1, i + 1))
  );
}

// ─── ScheduleGenerator ───────────────────────
export class ScheduleGenerator {
  private year: number;
  private month: number;
  private akePatternId: number | null;
  private vacationPatternId: number | null;
  private restPatternId: number | null;
  private prevNightStaffIds: Set<number>;

  constructor(params: ScheduleGenerationParams) {
    const p = params as any;
    this.year  = Number(p.year  ?? p.targetYear  ?? new Date().getFullYear());
    this.month = Number(p.month ?? p.targetMonth ?? (new Date().getMonth() + 1));
    this.akePatternId      = null;
    this.vacationPatternId = null;
    this.restPatternId     = null;
    this.prevNightStaffIds = new Set();
  }

  async generate(): Promise<ScheduleGenerationResult> {
    // ── データ取得（全てnull安全）──────────────
    const patterns: ShiftPattern[]   = (await db.shiftPatterns.toArray())    ?? [];
    const staff: Staff[]             = (await db.staff.toArray())             ?? [];
    const requests: ShiftRequest[]   = (await db.shiftRequests.toArray())     ?? [];
    const rawConstraints             = await db.constraints.orderBy('id').last().catch(() => null);
    const constraints: ScheduleConstraints = rawConstraints ?? {};
    const dates: string[]            = getMonthDates(this.year, this.month)   ?? [];

    // ── パターンID解決 ────────────────────────
    const akePat      = patterns.find(p => p.isAke      === true || p.name === AKE_NAME);
    const vacationPat = patterns.find(p => p.isVacation === true || p.name === VACATION_NAME);
    const restPat     = patterns.find(p => p.name === REST_NAME);

    this.akePatternId      = akePat?.id      ?? null;
    this.vacationPatternId = vacationPat?.id  ?? null;
    this.restPatternId     = restPat?.id      ?? null;

    console.log(`[SG] ${this.year}年${this.month}月`);
    console.log(`[SG] 明け:${akePat ? '✅' : '❌'} 有給:${vacationPat ? '✅' : '❌'}`);
    console.log(`[SG] スタッフ:${staff.length}人 日数:${dates.length}日`);

    if (staff.length === 0) {
      console.warn('[SG] スタッフが0人です');
    }
    if (dates.length === 0) {
      console.warn('[SG] 対象日付が0件です（year/monthを確認）');
    }

    // ── 前月末夜勤スタッフ ────────────────────
    await this.loadPrevNightStaff(patterns);

    const schedule: GeneratedShift[] = [];

    // Pass1: 有給リクエスト
    this.applyVacationRequests(schedule, requests, dates);

    // Pass2: 日ごとに「明け → 通常シフト」
    for (const dateStr of dates) {
      await this.applyAkeForDate(dateStr, schedule, staff, patterns);
      this.assignDailyShifts(dateStr, schedule, staff, requests, patterns, constraints);
    }

    // Pass3: 休み日数調整
    this.adjustRestDays(schedule, staff, constraints, dates);

    // Pass4: 最低勤務日数チェック
    this.enforceMinWorkDays(schedule, staff, constraints, patterns);

    // ── 統計（null安全） ──────────────────────
    const statistics = this.calcStatistics(schedule, staff, patterns, dates);

    console.log(`[SG] 生成完了: ${schedule.length}件`);
    return { schedule, statistics, warnings: [] };
  }

  // ─────────────────────────────────────────
  private async loadPrevNightStaff(patterns: ShiftPattern[]): Promise<void> {
    try {
      const prevMonth = this.month === 1 ? 12 : this.month - 1;
      const prevYear  = this.month === 1 ? this.year - 1 : this.year;
      const lastDay   = getDaysInMonth(prevYear, prevMonth);
      const lastDate  = formatDate(new Date(prevYear, prevMonth - 1, lastDay));
      const prevShifts = await db.generatedSchedules.where('date').equals(lastDate).toArray() ?? [];
      for (const s of prevShifts) {
        const pat = patterns.find(p => p.id === s.patternId);
        if (pat && this.isNightShift(pat)) this.prevNightStaffIds.add(s.staffId);
      }
      console.log(`[SG] 前月末夜勤: ${this.prevNightStaffIds.size}人`);
    } catch { /* 無視 */ }
  }

  // ─────────────────────────────────────────
  private async applyAkeForDate(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[]
  ): Promise<void> {
    if (!this.akePatternId) return;
    const dateObj    = new Date(dateStr);
    const isFirstDay = dateObj.getDate() === 1;
    const prevDate   = formatDate(addDays(dateObj, -1));

    for (const member of staff) {
      if (member.id == null) continue;
      let needsAke = false;
      if (isFirstDay) {
        needsAke = this.prevNightStaffIds.has(member.id);
      } else {
        const prev = schedule.find(s => s.staffId === member.id && s.date === prevDate);
        if (prev) {
          const pat = patterns.find(p => p.id === prev.patternId);
          needsAke = !!pat && this.isNightShift(pat);
        }
      }
      if (!needsAke) continue;
      const entry: GeneratedShift = {
        staffId: member.id, date: dateStr,
        patternId: this.akePatternId, isManual: false,
      };
      const idx = schedule.findIndex(s => s.staffId === member.id && s.date === dateStr);
      if (idx >= 0) schedule[idx] = entry; else schedule.push(entry);
    }
  }

  // ─────────────────────────────────────────
  private applyVacationRequests(
    schedule: GeneratedShift[], requests: ShiftRequest[], dates: string[]
  ): void {
    if (!this.vacationPatternId) return;
    for (const req of requests) {
      if (req.patternId !== this.vacationPatternId) continue;
      if (!dates.includes(req.date)) continue;
      if (schedule.some(s => s.staffId === req.staffId && s.date === req.date)) continue;
      schedule.push({ staffId: req.staffId, date: req.date,
        patternId: this.vacationPatternId, isManual: false });
    }
  }

  // ─────────────────────────────────────────
  private assignDailyShifts(
    dateStr: string, schedule: GeneratedShift[], staff: Staff[],
    requests: ShiftRequest[], patterns: ShiftPattern[], constraints: ScheduleConstraints
  ): void {
    const workPats = patterns.filter(p => !p.isAke && !p.isVacation && p.name !== REST_NAME);
    if (workPats.length === 0) return;
    for (const member of staff) {
      if (member.id == null) continue;
      if (schedule.some(s => s.staffId === member.id && s.date === dateStr)) continue;
      const req = requests.find(r => r.staffId === member.id && r.date === dateStr);
      const patternId = req?.patternId ?? workPats[0].id!;
      schedule.push({ staffId: member.id, date: dateStr, patternId, isManual: !!req });
    }
  }

  // ─────────────────────────────────────────
  private adjustRestDays(
    schedule: GeneratedShift[], staff: Staff[],
    constraints: ScheduleConstraints, dates: string[]
  ): void {
    if (!this.restPatternId) return;
    const target = (constraints as any).exactRestDaysPerMonth as number | undefined;
    if (!target || target <= 0) return;
    for (const member of staff) {
      if (member.id == null) continue;
      const mine    = schedule.filter(s => s.staffId === member.id);
      const resting = mine.filter(s => s.patternId === this.restPatternId).length;
      const diff    = target - resting;
      if (diff <= 0) continue;
      const workable = mine.filter(s =>
        s.patternId !== this.restPatternId &&
        s.patternId !== this.akePatternId &&
        s.patternId !== this.vacationPatternId
      );
      for (let i = 0; i < diff && i < workable.length; i++) {
        const idx = schedule.indexOf(workable[i]);
        if (idx >= 0) schedule[idx].patternId = this.restPatternId!;
      }
    }
  }

  // ─────────────────────────────────────────
  private enforceMinWorkDays(
    schedule: GeneratedShift[], staff: Staff[],
    constraints: ScheduleConstraints, patterns: ShiftPattern[]
  ): void {
    const minDays = (constraints as any).minWorkDaysPerMonth as number | undefined;
    if (!minDays || minDays <= 0) return;
    for (const member of staff) {
      if (member.id == null) continue;
      const workDays = schedule.filter(s => {
        if (s.staffId !== member.id) return false;
        const p = patterns.find(x => x.id === s.patternId);
        return p && !p.isAke && !p.isVacation && p.name !== REST_NAME;
      }).length;
      if (workDays < minDays) {
        console.warn(`[SG] ⚠️ ${member.name} 勤務${workDays}日 < 最低${minDays}日`);
      }
    }
  }

  // ─────────────────────────────────────────
  // calcStatistics — 完全null安全
  // ─────────────────────────────────────────
  private calcStatistics(
    schedule: GeneratedShift[], staff: Staff[],
    patterns: ShiftPattern[], dates: string[]
  ): ScheduleStatistics {

    // staff / patterns / schedule / dates が undefined でも壊れないよう保護
    const safeStaff    = Array.isArray(staff)    ? staff    : [];
    const safePats     = Array.isArray(patterns) ? patterns : [];
    const safeSchedule = Array.isArray(schedule) ? schedule : [];
    const safeDates    = Array.isArray(dates)    ? dates    : [];

    const staffWorkload: StaffWorkloadStat[] = safeStaff.map(member => {
      const id   = member.id ?? -1;
      const mine = safeSchedule.filter(s => s.staffId === id);

      const count = (pred: (p: ShiftPattern) => boolean) =>
        mine.filter(s => {
          const p = safePats.find(x => x.id === s.patternId);
          return p ? pred(p) : false;
        }).length;

      return {
        staffId:     id,
        staffName:   member.name ?? '',
        workDays:    count(p => !p.isAke && !p.isVacation && p.name !== REST_NAME),
        restDays:    count(p => p.name === REST_NAME),
        akeDays:     count(p => !!p.isAke),
        vacationDays:count(p => !!p.isVacation),
        nightDays:   count(p => this.isNightShift(p)),
        totalDays:   mine.length,
      };
    });

    const shiftTypeDistribution: Record<string, number> = {};
    for (const s of safeSchedule) {
      const p = safePats.find(x => x.id === s.patternId);
      if (p?.name) {
        shiftTypeDistribution[p.name] = (shiftTypeDistribution[p.name] ?? 0) + 1;
      }
    }

    return {
      totalDays:            safeDates.length,
      totalShifts:          safeSchedule.length,
      staffWorkload,
      shiftTypeDistribution,
    };
  }

  // ─────────────────────────────────────────
  private isNightShift(p: ShiftPattern): boolean {
    if (p?.isNight === true) return true;
    const n = p?.name ?? '';
    return n.includes('夜勤') || n.includes('夜') || n === '深夜';
  }
}
