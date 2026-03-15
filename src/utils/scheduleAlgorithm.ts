// src/utils/scheduleAlgorithm.ts
import { db, DEFAULT_PATTERNS } from '../db';
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

// ─── ユーティリティ ─────────────────────────────────────────────
function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}
function safeNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
/** IDが数値/文字列どちらでも安全に比較する */
function sameId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
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

// ─── パターンID → 数値 変換（NaN は null に） ──────────────────
function toNumericId(id: unknown): number | null {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// ─── DBパターンにないものをインメモリ補完しIDを振る ─────────────
async function ensurePatternsInDB(): Promise<void> {
  try {
    const existing = await db.shiftPatterns.toArray();
    const nameSet  = new Set(existing.map((p: ShiftPattern) => p.name));
    for (const def of DEFAULT_PATTERNS) {
      if (nameSet.has(def.name)) continue;
      try {
        await db.shiftPatterns.add(def as ShiftPattern);
        console.log(`[SG] パターン補完追加: ${def.name}`);
      } catch (e) {
        console.warn(`[SG] パターン補完失敗 (${def.name}):`, e);
      }
    }
  } catch (e) {
    console.warn('[SG] ensurePatternsInDB 失敗:', e);
  }
}

// ─── DB取得 ──────────────────────────────────────────────────────
async function fetchPatterns(): Promise<ShiftPattern[]> {
  try {
    const raw = safeArray<ShiftPattern>(await db.shiftPatterns.toArray());
    // IDを数値に正規化（文字列UUIDは除去してauto-idに任せる）
    return raw.map((p: ShiftPattern) => ({ ...p, id: toNumericId(p.id) ?? undefined }));
  }
  catch (e) { console.error('[DB] shiftPatterns 取得失敗:', e); return []; }
}
async function fetchStaff(): Promise<Staff[]> {
  try { return safeArray<Staff>(await db.staff.toArray()); }
  catch (e) { console.error('[DB] staff 取得失敗:', e); return []; }
}
async function fetchRequests(): Promise<ShiftRequest[]> {
  try {
    const tbl = (db as any).shiftRequests;
    if (!tbl || typeof tbl.toArray !== 'function') return [];
    return safeArray<ShiftRequest>(await tbl.toArray());
  }
  catch (e) { console.error('[DB] shiftRequests 取得失敗:', e); return []; }
}
async function fetchConstraints(): Promise<ScheduleConstraints> {
  try {
    const tbl = (db as any).constraints;
    if (!tbl || typeof tbl.toArray !== 'function') {
      console.warn('[DB] constraints テーブルなし → デフォルト使用');
      return { maxConsecutiveWorkDays: 5, minRestDaysBetweenNights: 1, minWorkDaysPerMonth: 20, exactRestDaysPerMonth: 8 };
    }
    const all = await tbl.toArray();
    if (!Array.isArray(all) || all.length === 0) {
      return { maxConsecutiveWorkDays: 5, minRestDaysBetweenNights: 1, minWorkDaysPerMonth: 20, exactRestDaysPerMonth: 8 };
    }
    return all[all.length - 1] as ScheduleConstraints;
  } catch (e) {
    console.error('[DB] constraints 取得失敗:', e);
    return { maxConsecutiveWorkDays: 5, minRestDaysBetweenNights: 1, minWorkDaysPerMonth: 20, exactRestDaysPerMonth: 8 };
  }
}
async function fetchPrevDayShifts(dateStr: string): Promise<GeneratedShift[]> {
  try {
    if (!dateStr) return [];
    const tbl = (db as any).generatedSchedules;
    if (!tbl || typeof tbl.where !== 'function') return [];
    return safeArray<GeneratedShift>(await tbl.where('date').equals(dateStr).toArray());
  }
  catch (e) { console.warn('[DB] 前日シフト取得失敗:', e); return []; }
}

// ─── ScheduleGenerator ──────────────────────────────────────────
export class ScheduleGenerator {
  private year: number;
  private month: number;
  private nightPatternId:    number | null = null;
  private akePatternId:      number | null = null;
  private vacationPatternId: number | null = null;
  private restPatternId:     number | null = null;
  private dayPatternId:      number | null = null;
  private prevNightStaffIds: Set<number>   = new Set();
  private nightCount:        Map<number, number> = new Map();
  private lastNightDate:     Map<number, string> = new Map();

  constructor(params: ScheduleGenerationParams) {
    const p = (params ?? {}) as any;
    this.year  = safeNumber(p.year  ?? p.targetYear,  new Date().getFullYear());
    this.month = safeNumber(p.month ?? p.targetMonth, new Date().getMonth() + 1);
    console.log(`[SG] new ScheduleGenerator year=${this.year} month=${this.month}`);
  }

  async generate(): Promise<ScheduleGenerationResult> {
    try {
      console.log('[SG] generate() 開始');

      // ── パターン補完（明け・有給が不足している場合に追加）──
      await ensurePatternsInDB();

      const [patterns, staff, requests, constraints] = await Promise.all([
        fetchPatterns(), fetchStaff(), fetchRequests(), fetchConstraints(),
      ]);
      console.log(`[SG] DB取得完了 patterns=${patterns.length} staff=${staff.length} requests=${requests.length}`);

      // ─── パターンID解決（名前ベース + sameId安全比較）───
      const nightPat = patterns.find(p => p?.isNight === true || p?.name === '夜勤') ?? null;
      const akePat   = patterns.find(p => p?.isAke   === true || p?.name === AKE_NAME) ?? null;
      const vacPat   = patterns.find(p => p?.isVacation === true || p?.name === VACATION_NAME) ?? null;
      const restPat  = patterns.find(p => p?.name === REST_NAME) ?? null;
      const dayPat   = patterns.find(p =>
        p != null &&
        p.name !== REST_NAME &&
        !p.isAke &&
        !p.isVacation &&
        !(p.isNight === true) &&
        p.name !== '夜勤'
      ) ?? null;

      this.nightPatternId    = toNumericId(nightPat?.id);
      this.akePatternId      = toNumericId(akePat?.id);
      this.vacationPatternId = toNumericId(vacPat?.id);
      this.restPatternId     = toNumericId(restPat?.id);
      this.dayPatternId      = toNumericId(dayPat?.id);

      console.log(
        `[SG] 日勤:${this.dayPatternId ?? '❌'} 夜勤:${this.nightPatternId ?? '❌'}` +
        ` 明け:${this.akePatternId ?? '❌'} 有給:${this.vacationPatternId ?? '❌'} 休み:${this.restPatternId ?? '❌'}`
      );

      // 日勤IDが null なら夜勤以外の最初の実働パターンで代替
      if (this.dayPatternId === null) {
        const fallback = patterns.find(p =>
          p?.id != null &&
          !sameId(p.id, this.nightPatternId) &&
          !p.isAke && !p.isVacation && p.name !== REST_NAME
        );
        this.dayPatternId = toNumericId(fallback?.id);
        if (this.dayPatternId !== null) {
          console.warn(`[SG] 日勤パターン未発見 → fallback id=${this.dayPatternId}`);
        }
      }

      const nightRequired = safeNumber(nightPat?.requiredStaff, 1);
      const dates = getMonthDates(this.year, this.month);
      if (dates.length === 0) return makeEmptyResult(['year/month が不正です']);
      if (staff.length === 0) return makeEmptyResult(['スタッフが登録されていません']);

      for (const m of staff) if (m?.id != null) this.nightCount.set(m.id, 0);

      await this.loadPrevNightStaff(patterns);

      const schedule: GeneratedShift[] = [];

      // ─── Pass1: 有給リクエスト確定 ───
      if (this.vacationPatternId !== null) {
        for (const req of requests) {
          if (!req) continue;
          if (!sameId(req.patternId, this.vacationPatternId)) continue;
          if (!dates.includes(req.date)) continue;
          if (this.hasEntry(schedule, req.staffId, req.date)) continue;
          this.pushEntry(schedule, req.staffId, req.date, this.vacationPatternId, true);
        }
      }
      console.log(`[SG] Pass1完了 有給=${schedule.filter(s => sameId(s.patternId, this.vacationPatternId)).length}件`);

      // ─── Pass2: 日次割当 ───
      const minRestBetweenNights = safeNumber((constraints as any)?.minRestDaysBetweenNights, 1);

      for (const dateStr of dates) {
        try { await this.applyAke(dateStr, schedule, staff, patterns); }
        catch (e) { console.error(`[SG] applyAke ${dateStr}:`, e); }

        if (this.nightPatternId !== null) {
          try { this.assignNight(dateStr, schedule, staff, requests, nightRequired, minRestBetweenNights); }
          catch (e) { console.error(`[SG] assignNight ${dateStr}:`, e); }
        }

        try { this.assignDay(dateStr, schedule, staff, requests, patterns); }
        catch (e) { console.error(`[SG] assignDay ${dateStr}:`, e); }
      }
      console.log(`[SG] Pass2完了 total=${schedule.length}件`);

      // ─── Pass3: 休み調整 ───
      try { this.adjustRest(schedule, staff, constraints); }
      catch (e) { console.error('[SG] adjustRest:', e); }

      // ─── Pass4: 最低勤務チェック ───
      const warnings: string[] = [];
      try { this.checkMinWork(schedule, staff, constraints, patterns, warnings); }
      catch (e) { console.error('[SG] checkMinWork:', e); }

      // ─── 統計 ───
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

  // ─── 前月末夜勤スタッフ読み込み ──────────────────────────────
  private async loadPrevNightStaff(patterns: ShiftPattern[]): Promise<void> {
    try {
      const pm   = this.month === 1 ? 12 : this.month - 1;
      const py   = this.month === 1 ? this.year - 1 : this.year;
      const last = getDaysInMonth(py, pm);
      if (last <= 0) return;
      const prevDate   = formatDate(new Date(py, pm - 1, last));
      const prevShifts = await fetchPrevDayShifts(prevDate);
      for (const s of prevShifts) {
        if (!s || s.staffId == null) continue;
        const pat = patterns.find(p => sameId(p?.id, s.patternId));
        if (pat && this.isNight(pat)) {
          this.prevNightStaffIds.add(s.staffId);
          this.lastNightDate.set(s.staffId, prevDate);
        }
      }
      console.log(`[SG] 前月末夜勤: ${this.prevNightStaffIds.size}人`);
    } catch (e) { console.warn('[SG] loadPrevNightStaff 失敗（無視）:', e); }
  }

  // ─── 明け適用 ──────────────────────────────────────────────────
  private async applyAke(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
  ): Promise<void> {
    if (this.akePatternId === null) return;
    const isFirst = new Date(dateStr).getDate() === 1;
    const prevStr = formatDate(addDays(new Date(dateStr), -1));

    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      if (this.hasEntry(schedule, mid, dateStr)) continue;

      let needsAke = false;
      if (isFirst) {
        needsAke = this.prevNightStaffIds.has(mid);
      } else {
        const prev = schedule.find(s => s?.staffId === mid && s?.date === prevStr);
        if (prev) {
          const pat = patterns.find(p => sameId(p?.id, prev.patternId));
          needsAke = !!(pat && this.isNight(pat));
        }
      }
      if (needsAke) {
        this.overwriteEntry(schedule, mid, dateStr, this.akePatternId, false);
      }
    }
  }

  // ─── 夜勤割り当て ──────────────────────────────────────────────
  private assignNight(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    required: number,
    minRestBetweenNights: number,
  ): void {
    if (this.nightPatternId === null) return;

    const busyIds = new Set(
      schedule.filter(s => s?.date === dateStr).map(s => s.staffId)
    );

    const nightRequesters = new Set(
      requests
        .filter(r => r?.date === dateStr && sameId(r?.patternId, this.nightPatternId) && !busyIds.has(r.staffId))
        .map(r => r.staffId)
    );

    const candidates = staff.filter(m => {
      if (m?.id == null) return false;
      const mid = m.id;
      if (busyIds.has(mid)) return false;
      if (minRestBetweenNights > 0) {
        const lastNight = this.lastNightDate.get(mid);
        if (lastNight) {
          const diff = (new Date(dateStr).getTime() - new Date(lastNight).getTime()) / 86400000;
          if (diff <= minRestBetweenNights) return false;
        }
      }
      return true;
    });

    candidates.sort((a, b) => {
      const aReq = nightRequesters.has(a.id!) ? 0 : 1;
      const bReq = nightRequesters.has(b.id!) ? 0 : 1;
      if (aReq !== bReq) return aReq - bReq;
      return (this.nightCount.get(a.id!) ?? 0) - (this.nightCount.get(b.id!) ?? 0);
    });

    for (const member of candidates.slice(0, required)) {
      const mid = member.id!;
      this.overwriteEntry(schedule, mid, dateStr, this.nightPatternId, false);
      this.nightCount.set(mid, (this.nightCount.get(mid) ?? 0) + 1);
      this.lastNightDate.set(mid, dateStr);
    }
  }

  // ─── 日勤割り当て（残りスタッフ）──────────────────────────────
  private assignDay(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[],
  ): void {
    const fallbackDayId = this.dayPatternId ??
      toNumericId(
        patterns.find(p =>
          p?.id != null &&
          !sameId(p.id, this.nightPatternId) &&
          !p.isAke && !p.isVacation && p.name !== REST_NAME
        )?.id
      );

    if (fallbackDayId === null) {
      console.warn('[SG] assignDay: 日勤パターンが見つかりません');
      return;
    }

    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;
      if (this.hasEntry(schedule, mid, dateStr)) continue;

      const req = requests.find(r => r?.staffId === mid && r?.date === dateStr);
      // 夜勤希望だが枠が埋まっている場合は日勤にフォールバック
      const pid = (req?.patternId != null && !sameId(req.patternId, this.nightPatternId))
        ? (toNumericId(req.patternId) ?? fallbackDayId)
        : fallbackDayId;
      this.pushEntry(schedule, mid, dateStr, pid, !!req && pid === toNumericId(req.patternId));
    }
  }

  // ─── 休み調整 ─────────────────────────────────────────────────
  private adjustRest(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
  ): void {
    if (this.restPatternId === null) return;
    const target = safeNumber((constraints as any)?.exactRestDaysPerMonth, 0);
    if (target <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;
      const mid   = member.id;
      const mine  = schedule.filter(s => s?.staffId === mid);
      const restCount = mine.filter(s => sameId(s?.patternId, this.restPatternId)).length;
      const diff  = target - restCount;
      if (diff <= 0) continue;

      // 日勤エントリを月末側から休みに変更
      const changeable = mine.filter(s =>
        !sameId(s?.patternId, this.restPatternId) &&
        !sameId(s?.patternId, this.akePatternId) &&
        !sameId(s?.patternId, this.vacationPatternId) &&
        !sameId(s?.patternId, this.nightPatternId)
      ).reverse();

      for (let i = 0; i < diff && i < changeable.length; i++) {
        const idx = schedule.indexOf(changeable[i]);
        if (idx >= 0) schedule[idx] = { ...schedule[idx], patternId: this.restPatternId! };
      }
    }
  }

  // ─── 最低勤務日数チェック ─────────────────────────────────────
  private checkMinWork(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[],
    warnings: string[],
  ): void {
    const minDays = safeNumber((constraints as any)?.minWorkDaysPerMonth, 0);
    if (minDays <= 0) return;
    for (const member of staff) {
      if (member?.id == null) continue;
      const workDays = schedule.filter(s => {
        if (s?.staffId !== member.id) return false;
        const p = patterns.find(x => sameId(x?.id, s.patternId));
        return !!(p && !p.isAke && !p.isVacation && p.name !== REST_NAME);
      }).length;
      if (workDays < minDays) {
        const msg = `${member.name ?? 'スタッフ'}: 勤務${workDays}日 < 最低${minDays}日`;
        console.warn(`[SG] ⚠️ ${msg}`);
        warnings.push(msg);
      }
    }
  }

  // ─── 統計計算 ─────────────────────────────────────────────────
  private calcStats(
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    dates: string[],
  ): ScheduleStatistics {
    const safeS  = safeArray<GeneratedShift>(schedule);
    const safeSt = safeArray<Staff>(staff);
    const safeP  = safeArray<ShiftPattern>(patterns);
    const safeD  = safeArray<string>(dates);

    const staffWorkload: StaffWorkloadStat[] = safeSt.map(member => {
      const mid  = member?.id ?? -1;
      const mine = safeS.filter(s => s?.staffId === mid);
      const cnt  = (fn: (p: ShiftPattern) => boolean): number =>
        mine.filter(s => {
          const p = safeP.find(x => sameId(x?.id, s?.patternId));
          return p ? fn(p) : false;
        }).length;
      return {
        staffId:      mid,
        staffName:    member?.name ?? '',
        workDays:     cnt(p => !p.isAke && !p.isVacation && p.name !== REST_NAME && !this.isNight(p)),
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
      const p = safeP.find(x => sameId(x?.id, s.patternId));
      if (p?.name) dist[p.name] = (dist[p.name] ?? 0) + 1;
    }

    return { totalDays: safeD.length, totalShifts: safeS.length, staffWorkload, shiftTypeDistribution: dist };
  }

  // ─── ヘルパー ─────────────────────────────────────────────────
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
