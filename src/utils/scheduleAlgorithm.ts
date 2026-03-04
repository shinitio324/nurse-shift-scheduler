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

export const AKE_NAME = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME = '休み';

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}
function safeNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}
function getDaysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return new Date(year, month, 0).getDate();
}
function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  if (days <= 0) return [];
  const result: string[] = [];
  for (let i = 1; i <= days; i++) {
    const d = formatDate(new Date(year, month - 1, i));
    if (d) result.push(d);
  }
  return result;
}
function makeEmptyResult(warnings: string[] = []): ScheduleGenerationResult {
  return {
    schedule: [],
    statistics: { totalDays: 0, totalShifts: 0, staffWorkload: [], shiftTypeDistribution: {} },
    warnings,
  };
}

async function fetchPatterns(): Promise<ShiftPattern[]> {
  try { return safeArray<ShiftPattern>(await db.shiftPatterns.toArray()); }
  catch (e) { console.error('[DB] shiftPatterns 取得失敗:', e); return []; }
}
async function fetchStaff(): Promise<Staff[]> {
  try { return safeArray<Staff>(await db.staff.toArray()); }
  catch (e) { console.error('[DB] staff 取得失敗:', e); return []; }
}
async function fetchRequests(): Promise<ShiftRequest[]> {
  try { return safeArray<ShiftRequest>(await db.shiftRequests.toArray()); }
  catch (e) { console.error('[DB] shiftRequests 取得失敗:', e); return []; }
}
async function fetchConstraints(): Promise<ScheduleConstraints> {
  try {
    // db.constraints 自体が存在するか確認
    if (!db.constraints || typeof db.constraints.orderBy !== 'function') {
      console.warn('[DB] constraints テーブルが存在しません');
      return {};
    }
    const result = await db.constraints.orderBy('id').last();
    return (result && typeof result === 'object') ? result : {};
  } catch (e) {
    console.error('[DB] constraints 取得失敗:', e);
    return {};
  }
}
async function fetchPrevDayShifts(dateStr: string): Promise<GeneratedShift[]> {
  try {
    if (!dateStr) return [];
    return safeArray<GeneratedShift>(await db.generatedSchedules.where('date').equals(dateStr).toArray());
  }
  catch (e) { console.warn('[DB] 前日シフト取得失敗:', e); return []; }
}

export class ScheduleGenerator {
  private year: number;
  private month: number;
  private akePatternId: number | null;
  private vacationPatternId: number | null;
  private restPatternId: number | null;
  private prevNightStaffIds: Set<number>;

  constructor(params: ScheduleGenerationParams) {
    const p = (params ?? {}) as any;
    this.year = safeNumber(p.year ?? p.targetYear, new Date().getFullYear());
    this.month = safeNumber(p.month ?? p.targetMonth, new Date().getMonth() + 1);
    this.akePatternId = null;
    this.vacationPatternId = null;
    this.restPatternId = null;
    this.prevNightStaffIds = new Set();
    console.log(`[SG] new ScheduleGenerator year=${this.year} month=${this.month}`);
  }

  async generate(): Promise<ScheduleGenerationResult> {
    try {
      console.log('[SG] generate() 開始');
      const [patterns, staff, requests, constraints] = await Promise.all([
        fetchPatterns(), fetchStaff(), fetchRequests(), fetchConstraints(),
      ]);
      console.log(`[SG] DB取得完了 patterns=${patterns.length} staff=${staff.length} requests=${requests.length}`);

      const akePat   = patterns.find(p => p?.isAke === true || p?.name === AKE_NAME) ?? null;
      const vacPat   = patterns.find(p => p?.isVacation === true || p?.name === VACATION_NAME) ?? null;
      const restPat  = patterns.find(p => p?.name === REST_NAME) ?? null;
      this.akePatternId      = akePat?.id  != null ? Number(akePat.id)  : null;
      this.vacationPatternId = vacPat?.id  != null ? Number(vacPat.id)  : null;
      this.restPatternId     = restPat?.id != null ? Number(restPat.id) : null;
      console.log(`[SG] 明け:${this.akePatternId ?? '❌'} 有給:${this.vacationPatternId ?? '❌'} 休み:${this.restPatternId ?? '❌'}`);

      const dates = getMonthDates(this.year, this.month);
      console.log(`[SG] 対象日数: ${dates.length}`);
      if (dates.length === 0) return makeEmptyResult(['year/month が不正です']);
      if (staff.length === 0) return makeEmptyResult(['スタッフが登録されていません']);

      await this.loadPrevNightStaff(patterns);

      const schedule: GeneratedShift[] = [];

      // Pass1: 有給
      for (const req of requests) {
        if (!req || req.patternId !== this.vacationPatternId) continue;
        if (!dates.includes(req.date)) continue;
        if (this.hasEntry(schedule, req.staffId, req.date)) continue;
        this.pushEntry(schedule, req.staffId, req.date, req.patternId, false);
      }
      console.log(`[SG] Pass1完了 有給=${schedule.length}件`);

      // Pass2: 日次割当
      for (const dateStr of dates) {
        try { await this.applyAke(dateStr, schedule, staff, patterns); }
        catch (e) { console.error(`[SG] applyAke ${dateStr}:`, e); }
        try { this.assignDay(dateStr, schedule, staff, requests, patterns); }
        catch (e) { console.error(`[SG] assignDay ${dateStr}:`, e); }
      }
      console.log(`[SG] Pass2完了 total=${schedule.length}件`);

      // Pass3: 休み調整
      try { this.adjustRest(schedule, staff, constraints); }
      catch (e) { console.error('[SG] adjustRest:', e); }

      // Pass4: 最低勤務チェック
      const warnings: string[] = [];
      try { this.checkMinWork(schedule, staff, constraints, patterns, warnings); }
      catch (e) { console.error('[SG] checkMinWork:', e); }

      // 統計
      let statistics: ScheduleStatistics;
      try { statistics = this.calcStats(schedule, staff, patterns, dates); }
      catch (e) {
        console.error('[SG] calcStats:', e);
        statistics = { totalDays: dates.length, totalShifts: schedule.length, staffWorkload: [], shiftTypeDistribution: {} };
      }

      console.log(`[SG] ✅ 生成完了 ${schedule.length}件 warnings=${warnings.length}`);
      return { schedule, statistics, warnings };
    } catch (err) {
      console.error('[SG] generate() 致命的エラー:', err);
      return makeEmptyResult(['スケジュール生成中に致命的なエラーが発生しました']);
    }
  }

  private async loadPrevNightStaff(patterns: ShiftPattern[]): Promise<void> {
    try {
      const pm = this.month === 1 ? 12 : this.month - 1;
      const py = this.month === 1 ? this.year - 1 : this.year;
      const last = getDaysInMonth(py, pm);
      if (last <= 0) return;
      const prevDate = formatDate(new Date(py, pm - 1, last));
      const prevShifts = await fetchPrevDayShifts(prevDate);
      for (const s of prevShifts) {
        if (!s || s.staffId == null) continue;
        const pat = patterns.find(p => p?.id === s.patternId);
        if (pat && this.isNight(pat)) this.prevNightStaffIds.add(s.staffId);
      }
      console.log(`[SG] 前月末夜勤: ${this.prevNightStaffIds.size}人`);
    } catch (e) { console.warn('[SG] loadPrevNightStaff 失敗（無視）:', e); }
  }

  private async applyAke(dateStr: string, schedule: GeneratedShift[], staff: Staff[], patterns: ShiftPattern[]): Promise<void> {
    if (!this.akePatternId) return;
    const isFirst = new Date(dateStr).getDate() === 1;
    const prevStr = formatDate(addDays(new Date(dateStr), -1));
    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      let needsAke = false;
      if (isFirst) {
        needsAke = this.prevNightStaffIds.has(mid);
      } else {
        const prev = schedule.find(s => s?.staffId === mid && s?.date === prevStr);
        if (prev) {
          const pat = patterns.find(p => p?.id === prev.patternId);
          needsAke = !!(pat && this.isNight(pat));
        }
      }
      if (!needsAke) continue;
      this.overwriteEntry(schedule, mid, dateStr, this.akePatternId, false);
    }
  }

  private assignDay(dateStr: string, schedule: GeneratedShift[], staff: Staff[], requests: ShiftRequest[], patterns: ShiftPattern[]): void {
    const workPats = patterns.filter(p => p && !p.isAke && !p.isVacation && p.name !== REST_NAME && p.id != null);
    if (workPats.length === 0) return;
    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      if (this.hasEntry(schedule, mid, dateStr)) continue;
      const req = requests.find(r => r?.staffId === mid && r?.date === dateStr);
      const pid = req?.patternId != null ? req.patternId : workPats[0].id!;
      this.pushEntry(schedule, mid, dateStr, pid, !!req);
    }
  }

  private adjustRest(schedule: GeneratedShift[], staff: Staff[], constraints: ScheduleConstraints): void {
    if (!this.restPatternId) return;
    const target = safeNumber((constraints as any)?.exactRestDaysPerMonth, 0);
    if (target <= 0) return;
    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      const mine = schedule.filter(s => s?.staffId === mid);
      const restCount = mine.filter(s => s?.patternId === this.restPatternId).length;
      const diff = target - restCount;
      if (diff <= 0) continue;
      const changeable = mine.filter(s =>
        s?.patternId !== this.restPatternId &&
        s?.patternId !== this.akePatternId &&
        s?.patternId !== this.vacationPatternId
      );
      for (let i = 0; i < diff && i < changeable.length; i++) {
        const idx = schedule.indexOf(changeable[i]);
        if (idx >= 0) schedule[idx] = { ...schedule[idx], patternId: this.restPatternId! };
      }
    }
  }

  private checkMinWork(schedule: GeneratedShift[], staff: Staff[], constraints: ScheduleConstraints, patterns: ShiftPattern[], warnings: string[]): void {
    const minDays = safeNumber((constraints as any)?.minWorkDaysPerMonth, 0);
    if (minDays <= 0) return;
    for (const member of staff) {
      if (member?.id == null) continue;
      const workDays = schedule.filter(s => {
        if (s?.staffId !== member.id) return false;
        const p = patterns.find(x => x?.id === s.patternId);
        return !!(p && !p.isAke && !p.isVacation && p.name !== REST_NAME);
      }).length;
      if (workDays < minDays) {
        const msg = `${member.name ?? 'スタッフ'}: 勤務${workDays}日 < 最低${minDays}日`;
        console.warn(`[SG] ⚠️ ${msg}`);
        warnings.push(msg);
      }
    }
  }

  private calcStats(schedule: GeneratedShift[], staff: Staff[], patterns: ShiftPattern[], dates: string[]): ScheduleStatistics {
    const safeS  = safeArray<GeneratedShift>(schedule);
    const safeSt = safeArray<Staff>(staff);
    const safeP  = safeArray<ShiftPattern>(patterns);
    const safeD  = safeArray<string>(dates);

    const staffWorkload: StaffWorkloadStat[] = safeSt.map(member => {
      const mid  = member?.id ?? -1;
      const mine = safeS.filter(s => s?.staffId === mid);
      const cnt  = (fn: (p: ShiftPattern) => boolean): number =>
        mine.filter(s => {
          const p = safeP.find(x => x?.id === s?.patternId);
          return p ? fn(p) : false;
        }).length;
      return {
        staffId:      mid,
        staffName:    member?.name ?? '',
        workDays:     cnt(p => !p.isAke && !p.isVacation && p.name !== REST_NAME),
        restDays:     cnt(p => p.name === REST_NAME),
        akeDays:      cnt(p => !!p.isAke),
        vacationDays: cnt(p => !!p.isVacation),
        nightDays:    cnt(p => this.isNight(p)),
        totalDays:    mine.length,
      };
    });

    const dist: Record<string, number> = {};
    for (const s of safeS) {
      if (!s) continue;
      const p = safeP.find(x => x?.id === s.patternId);
      if (p?.name) dist[p.name] = (dist[p.name] ?? 0) + 1;
    }

    return { totalDays: safeD.length, totalShifts: safeS.length, staffWorkload, shiftTypeDistribution: dist };
  }

  private isNight(p: ShiftPattern): boolean {
    if (!p) return false;
    if (p.isNight === true) return true;
    const n = p.name ?? '';
    return n.includes('夜勤') || n.includes('夜') || n === '深夜';
  }
  private hasEntry(schedule: GeneratedShift[], staffId: number, date: string): boolean {
    return schedule.some(s => s?.staffId === staffId && s?.date === date);
  }
  private pushEntry(schedule: GeneratedShift[], staffId: number, date: string, patternId: number, isManual: boolean): void {
    schedule.push({ staffId, date, patternId, isManual });
  }
  private overwriteEntry(schedule: GeneratedShift[], staffId: number, date: string, patternId: number, isManual: boolean): void {
    const idx = schedule.findIndex(s => s?.staffId === staffId && s?.date === date);
    const entry: GeneratedShift = { staffId, date, patternId, isManual };
    if (idx >= 0) schedule[idx] = entry; else schedule.push(entry);
  }
}
