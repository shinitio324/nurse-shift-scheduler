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

/* ================================================================
   定数
================================================================ */
export const AKE_NAME      = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME     = '休み';

/* ================================================================
   ユーティリティ（モジュールレベル — params に一切触れない）
================================================================ */
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

/* ================================================================
   空の結果オブジェクト（クラッシュ時のフォールバック）
================================================================ */
function makeEmptyResult(warnings: string[] = []): ScheduleGenerationResult {
  return {
    schedule: [],
    statistics: {
      totalDays: 0,
      totalShifts: 0,
      staffWorkload: [],
      shiftTypeDistribution: {},
    },
    warnings,
  };
}

/* ================================================================
   DB ヘルパー（各テーブルアクセスを個別に try/catch）
================================================================ */
async function fetchPatterns(): Promise<ShiftPattern[]> {
  try {
    const result = await db.shiftPatterns.toArray();
    return safeArray<ShiftPattern>(result);
  } catch (e) {
    console.error('[DB] shiftPatterns 取得失敗:', e);
    return [];
  }
}

async function fetchStaff(): Promise<Staff[]> {
  try {
    const result = await db.staff.toArray();
    return safeArray<Staff>(result);
  } catch (e) {
    console.error('[DB] staff 取得失敗:', e);
    return [];
  }
}

async function fetchRequests(): Promise<ShiftRequest[]> {
  try {
    const result = await db.shiftRequests.toArray();
    return safeArray<ShiftRequest>(result);
  } catch (e) {
    console.error('[DB] shiftRequests 取得失敗:', e);
    return [];
  }
}

async function fetchConstraints(): Promise<ScheduleConstraints> {
  try {
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
    const result = await db.generatedSchedules.where('date').equals(dateStr).toArray();
    return safeArray<GeneratedShift>(result);
  } catch (e) {
    console.warn('[DB] 前日シフト取得失敗:', e);
    return [];
  }
}

/* ================================================================
   ScheduleGenerator
================================================================ */
export class ScheduleGenerator {
  // クラスフィールドは型宣言のみ（= で初期化しない）
  private year: number;
  private month: number;
  private akePatternId: number | null;
  private vacationPatternId: number | null;
  private restPatternId: number | null;
  private prevNightStaffIds: Set<number>;

  constructor(params: ScheduleGenerationParams) {
    // ★ params は constructor 内でのみ使用
    const raw = (params ?? {}) as any;
    this.year  = safeNumber(raw.year  ?? raw.targetYear,  new Date().getFullYear());
    this.month = safeNumber(raw.month ?? raw.targetMonth, new Date().getMonth() + 1);
    this.akePatternId      = null;
    this.vacationPatternId = null;
    this.restPatternId     = null;
    this.prevNightStaffIds = new Set();
    console.log(`[SG] new ScheduleGenerator year=${this.year} month=${this.month}`);
  }

  /* --------------------------------------------------------------
     generate() — 絶対にクラッシュしない完全防御実装
  -------------------------------------------------------------- */
  async generate(): Promise<ScheduleGenerationResult> {
    console.log('[SG] generate() 開始');

    // ── 1. データ取得（各テーブル独立して try/catch 済み） ──────
    const [patterns, staff, requests, constraints] = await Promise.all([
      fetchPatterns(),
      fetchStaff(),
      fetchRequests(),
      fetchConstraints(),
    ]);

    console.log(`[SG] 取得完了 patterns=${patterns.length} staff=${staff.length} requests=${requests.length}`);

    // ── 2. パターンID 解決 ──────────────────────────────────────
    const akePat      = patterns.find(p => p?.isAke      === true || p?.name === AKE_NAME)  ?? null;
    const vacationPat = patterns.find(p => p?.isVacation === true || p?.name === VACATION_NAME) ?? null;
    const restPat     = patterns.find(p => p?.name === REST_NAME) ?? null;

    this.akePatternId      = (akePat?.id      != null) ? Number(akePat.id)      : null;
    this.vacationPatternId = (vacationPat?.id  != null) ? Number(vacationPat.id)  : null;
    this.restPatternId     = (restPat?.id      != null) ? Number(restPat.id)      : null;

    console.log(`[SG] 明け:${this.akePatternId ?? '❌'} 有給:${this.vacationPatternId ?? '❌'} 休み:${this.restPatternId ?? '❌'}`);

    // ── 3. 対象日付リスト ────────────────────────────────────────
    const dates = getMonthDates(this.year, this.month);
    console.log(`[SG] 対象日数: ${dates.length} (year=${this.year} month=${this.month})`);

    if (dates.length === 0) {
      console.warn('[SG] 日付リストが空 → 空結果を返す');
      return makeEmptyResult(['year/month の値が不正のためスケジュールを生成できませんでした']);
    }
    if (staff.length === 0) {
      console.warn('[SG] スタッフが0人 → 空結果を返す');
      return makeEmptyResult(['スタッフが登録されていません']);
    }

    // ── 4. 前月末夜勤スタッフ取得 ───────────────────────────────
    await this.loadPrevNightStaff(patterns);

    // ── 5. スケジュール配列初期化 ────────────────────────────────
    const schedule: GeneratedShift[] = [];

    // ── 6. Pass1: 有給リクエストを先付け ────────────────────────
    for (const req of requests) {
      if (!req || req.patternId !== this.vacationPatternId) continue;
      if (!dates.includes(req.date)) continue;
      if (this.hasEntry(schedule, req.staffId, req.date)) continue;
      this.pushEntry(schedule, req.staffId, req.date, req.patternId, false);
    }
    console.log(`[SG] Pass1 完了: 有給 ${schedule.length}件`);

    // ── 7. Pass2: 日ごとに 明け → 通常シフト ────────────────────
    for (const dateStr of dates) {
      if (!dateStr) continue;

      // 明け判定
      try {
        await this.applyAke(dateStr, schedule, staff, patterns);
      } catch (e) {
        console.error(`[SG] applyAke エラー ${dateStr}:`, e);
      }

      // 通常シフト割当
      try {
        this.assignDay(dateStr, schedule, staff, requests, patterns);
      } catch (e) {
        console.error(`[SG] assignDay エラー ${dateStr}:`, e);
      }
    }
    console.log(`[SG] Pass2 完了: ${schedule.length}件`);

    // ── 8. Pass3: 休み日数調整 ───────────────────────────────────
    try {
      this.adjustRest(schedule, staff, constraints);
    } catch (e) {
      console.error('[SG] adjustRest エラー:', e);
    }

    // ── 9. Pass4: 最低勤務日数チェック ──────────────────────────
    const warnings: string[] = [];
    try {
      this.checkMinWork(schedule, staff, constraints, patterns, warnings);
    } catch (e) {
      console.error('[SG] checkMinWork エラー:', e);
    }

    // ── 10. 統計計算 ─────────────────────────────────────────────
    let statistics: ScheduleStatistics;
    try {
      statistics = this.calcStats(schedule, staff, patterns, dates);
    } catch (e) {
      console.error('[SG] calcStats エラー:', e);
      statistics = {
        totalDays: dates.length,
        totalShifts: schedule.length,
        staffWorkload: [],
        shiftTypeDistribution: {},
      };
    }

    console.log(`[SG] ✅ 生成完了: ${schedule.length}件 warnings=${warnings.length}`);
    return { schedule, statistics, warnings };
  }

  /* --------------------------------------------------------------
     前月末夜勤スタッフ取得
  -------------------------------------------------------------- */
  private async loadPrevNightStaff(patterns: ShiftPattern[]): Promise<void> {
    try {
      const pm   = this.month === 1 ? 12 : this.month - 1;
      const py   = this.month === 1 ? this.year - 1 : this.year;
      const last = getDaysInMonth(py, pm);
      if (last <= 0) return;
      const prevDate    = formatDate(new Date(py, pm - 1, last));
      const prevShifts  = await fetchPrevDayShifts(prevDate);
      for (const s of prevShifts) {
        if (!s || s.staffId == null) continue;
        const pat = patterns.find(p => p?.id === s.patternId);
        if (pat && this.isNight(pat)) this.prevNightStaffIds.add(s.staffId);
      }
      console.log(`[SG] 前月末夜勤スタッフ: ${this.prevNightStaffIds.size}人`);
    } catch (e) {
      console.warn('[SG] loadPrevNightStaff 失敗（無視）:', e);
    }
  }

  /* --------------------------------------------------------------
     明け割当
  -------------------------------------------------------------- */
  private async applyAke(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[]
  ): Promise<void> {
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
      console.log(`[applyAke] ✅ ${member.name} ${dateStr} 明け`);
    }
  }

  /* --------------------------------------------------------------
     日次シフト割当
  -------------------------------------------------------------- */
  private assignDay(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[]
  ): void {
    const workPats = patterns.filter(
      p => p && !p.isAke && !p.isVacation && p.name !== REST_NAME && p.id != null
    );
    if (workPats.length === 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      if (this.hasEntry(schedule, mid, dateStr)) continue;

      const req = requests.find(r => r?.staffId === mid && r?.date === dateStr);
      const pid = (req?.patternId != null) ? req.patternId : workPats[0].id!;
      this.pushEntry(schedule, mid, dateStr, pid, !!req);
    }
  }

  /* --------------------------------------------------------------
     Pass3: 休み日数調整
  -------------------------------------------------------------- */
  private adjustRest(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints
  ): void {
    if (!this.restPatternId) return;
    const target = safeNumber((constraints as any)?.exactRestDaysPerMonth, 0);
    if (target <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;
      const mid  = member.id;
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

  /* --------------------------------------------------------------
     Pass4: 最低勤務日数チェック
  -------------------------------------------------------------- */
  private checkMinWork(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[],
    warnings: string[]
  ): void {
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

  /* --------------------------------------------------------------
     統計計算
  -------------------------------------------------------------- */
  private calcStats(
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    dates: string[]
  ): ScheduleStatistics {
    const safeS = safeArray<GeneratedShift>(schedule);
    const safeSt = safeArray<Staff>(staff);
    const safeP = safeArray<ShiftPattern>(patterns);
    const safeD = safeArray<string>(dates);

    const staffWorkload: StaffWorkloadStat[] = safeSt.map(member => {
      const mid  = member?.id ?? -1;
      const mine = safeS.filter(s => s?.staffId === mid);

      const cnt = (fn: (p: ShiftPattern) => boolean): number =>
        mine.filter(s => {
          const p = safeP.find(x => x?.id === s?.patternId);
          return p ? fn(p) : false;
        }).length;

      return {
        staffId:     mid,
        staffName:   member?.name ?? '',
        workDays:    cnt(p => !p.isAke && !p.isVacation && p.name !== REST_NAME),
        restDays:    cnt(p => p.name === REST_NAME),
        akeDays:     cnt(p => !!p.isAke),
        vacationDays:cnt(p => !!p.isVacation),
        nightDays:   cnt(p => this.isNight(p)),
        totalDays:   mine.length,
      };
    });

    const dist: Record<string, number> = {};
    for (const s of safeS) {
      if (!s) continue;
      const p = safeP.find(x => x?.id === s.patternId);
      if (p?.name) dist[p.name] = (dist[p.name] ?? 0) + 1;
    }

    return {
      totalDays:            safeD.length,
      totalShifts:          safeS.length,
      staffWorkload,
      shiftTypeDistribution: dist,
    };
  }

  /* --------------------------------------------------------------
     ヘルパー
  -------------------------------------------------------------- */
  private isNight(p: ShiftPattern): boolean {
    if (!p) return false;
    if (p.isNight === true) return true;
    const n = p.name ?? '';
    return n.includes('夜勤') || n.includes('夜') || n === '深夜';
  }

  private hasEntry(schedule: GeneratedShift[], staffId: number, date: string): boolean {
    return schedule.some(s => s?.staffId === staffId && s?.date === date);
  }

  private pushEntry(
    schedule: GeneratedShift[], staffId: number, date: string,
    patternId: number, isManual: boolean
  ): void {
    schedule.push({ staffId, date, patternId, isManual });
  }

  private overwriteEntry(
    schedule: GeneratedShift[], staffId: number, date: string,
    patternId: number, isManual: boolean
  ): void {
    const idx = schedule.findIndex(s => s?.staffId === staffId && s?.date === date);
    const entry: GeneratedShift = { staffId, date, patternId, isManual };
    if (idx >= 0) schedule[idx] = entry;
    else schedule.push(entry);
  }
}
