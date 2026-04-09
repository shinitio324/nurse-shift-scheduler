import { db } from '../db/index';
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
  StaffGender,
} from '../types';

export const AKE_NAME = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME = '休み';

const DEFAULT_SHIFT_PATTERNS: Omit<ShiftPattern, 'id'>[] = [
  {
    name: '日勤',
    startTime: '08:30',
    endTime: '17:00',
    color: '#bfdbfe',
    isAke: false,
    isVacation: false,
    isNight: false,
    requiredStaff: 5,
    shortName: '日',
    isWorkday: true,
    sortOrder: 1,
  },
  {
    name: '夜勤',
    startTime: '16:30',
    endTime: '09:00',
    color: '#c4b5fd',
    isAke: false,
    isVacation: false,
    isNight: true,
    requiredStaff: 2,
    shortName: '夜',
    isWorkday: true,
    sortOrder: 2,
  },
  {
    name: '明け',
    startTime: '00:00',
    endTime: '00:00',
    color: '#93c5fd',
    isAke: true,
    isVacation: false,
    isNight: false,
    requiredStaff: 0,
    shortName: '明',
    isWorkday: false,
    sortOrder: 3,
  },
  {
    name: '有給',
    startTime: '00:00',
    endTime: '00:00',
    color: '#86efac',
    isAke: false,
    isVacation: true,
    isNight: false,
    requiredStaff: 0,
    shortName: '有',
    isWorkday: false,
    sortOrder: 4,
  },
  {
    name: '休み',
    startTime: '00:00',
    endTime: '00:00',
    color: '#d1d5db',
    isAke: false,
    isVacation: false,
    isNight: false,
    requiredStaff: 0,
    shortName: '休',
    isWorkday: false,
    sortOrder: 5,
  },
];

// ─────────────────────────────────────────────────────────────
// utility
// ─────────────────────────────────────────────────────────────

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function safeNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function sameId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function idKey(id: unknown): string {
  return String(id ?? '');
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
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  if (days <= 0) return [];
  return Array.from({ length: days }, (_, i) =>
    formatDate(new Date(year, month - 1, i + 1))
  );
}

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

function toNumericId(id: unknown): number | null {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function normalizeGender(gender: unknown): StaffGender | '未設定' {
  if (gender === '男性' || gender === '女性' || gender === 'その他') {
    return gender;
  }
  return '未設定';
}

function canWorkNight(member: Partial<Staff> | undefined | null): boolean {
  return member?.canWorkNightShift !== false;
}

function isActiveRequest(req: ShiftRequest | undefined | null): boolean {
  if (!req) return false;
  if (req.status === 'rejected' || req.status === 'cancelled') return false;
  return true;
}

function isDayLikePattern(p: ShiftPattern | undefined | null): boolean {
  if (!p) return false;
  if (p.isNight) return false;
  if (p.isAke) return false;
  if (p.isVacation) return false;
  if (p.name === REST_NAME) return false;
  return true;
}

function isWorkPattern(p: ShiftPattern | undefined | null): boolean {
  if (!p) return false;
  if (p.isAke) return false;
  if (p.isVacation) return false;
  if (p.name === REST_NAME) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────
// 日本の祝日計算
// ─────────────────────────────────────────────────────────────

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number
): number {
  const first = new Date(year, month - 1, 1);
  const offset = (7 + weekday - first.getDay()) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function vernalEquinoxDay(year: number): number {
  return Math.floor(
    20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
  );
}

function autumnEquinoxDay(year: number): number {
  return Math.floor(
    23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
  );
}

function buildJapaneseHolidaySet(year: number): Set<string> {
  const set = new Set<string>();

  const add = (month: number, day: number) => {
    if (day < 1 || day > getDaysInMonth(year, month)) return;
    set.add(formatDate(new Date(year, month - 1, day)));
  };

  // 固定祝日
  add(1, 1); // 元日
  add(2, 11); // 建国記念の日
  add(2, 23); // 天皇誕生日
  add(4, 29); // 昭和の日
  add(5, 3); // 憲法記念日
  add(5, 4); // みどりの日
  add(5, 5); // こどもの日
  add(8, 11); // 山の日
  add(11, 3); // 文化の日
  add(11, 23); // 勤労感謝の日

  // ハッピーマンデー系
  add(1, nthWeekdayOfMonth(year, 1, 1, 2)); // 成人の日
  add(7, nthWeekdayOfMonth(year, 7, 1, 3)); // 海の日
  add(9, nthWeekdayOfMonth(year, 9, 1, 3)); // 敬老の日
  add(10, nthWeekdayOfMonth(year, 10, 1, 2)); // スポーツの日

  // 春分・秋分
  add(3, vernalEquinoxDay(year));
  add(9, autumnEquinoxDay(year));

  // 振替休日
  const baseHolidays = Array.from(set).sort();
  const substitutes: string[] = [];

  for (const key of baseHolidays) {
    const d = parseDateString(key);
    if (d.getDay() !== 0) continue;

    let sub = addDays(d, 1);
    while (set.has(formatDate(sub))) {
      sub = addDays(sub, 1);
    }
    substitutes.push(formatDate(sub));
  }

  for (const key of substitutes) {
    set.add(key);
  }

  // 国民の休日（祝日に挟まれた平日）
  for (let month = 1; month <= 12; month++) {
    const end = getDaysInMonth(year, month);
    for (let day = 2; day < end; day++) {
      const current = new Date(year, month - 1, day);
      const currentKey = formatDate(current);
      if (set.has(currentKey)) continue;
      if (current.getDay() === 0) continue;

      const prevKey = formatDate(addDays(current, -1));
      const nextKey = formatDate(addDays(current, 1));
      if (set.has(prevKey) && set.has(nextKey)) {
        set.add(currentKey);
      }
    }
  }

  return set;
}

// ─────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────

async function ensurePatternsInDB(): Promise<void> {
  try {
    const existing = await db.shiftPatterns.toArray();
    const nameSet = new Set(existing.map((p) => p.name));

    for (const def of DEFAULT_SHIFT_PATTERNS) {
      if (nameSet.has(def.name)) continue;
      await db.shiftPatterns.add(def as ShiftPattern);
      console.log(`[SG] パターン補完追加: ${def.name}`);
    }
  } catch (e) {
    console.warn('[SG] ensurePatternsInDB 失敗:', e);
  }
}

async function fetchPatterns(): Promise<ShiftPattern[]> {
  try {
    const raw = safeArray<ShiftPattern>(await db.shiftPatterns.toArray());
    return raw.map((p) => ({
      ...p,
      id: toNumericId(p.id) ?? p.id ?? undefined,
    }));
  } catch (e) {
    console.error('[DB] shiftPatterns 取得失敗:', e);
    return [];
  }
}

async function fetchStaff(): Promise<Staff[]> {
  try {
    const raw = safeArray<Staff>(await db.staff.toArray());
    return raw.map((s) => ({
      ...s,
      qualifications: Array.isArray(s?.qualifications) ? s.qualifications : [],
      minWorkDaysPerMonth: safeNumber(s?.minWorkDaysPerMonth, 0),
      maxNightShiftsPerMonth: safeNumber(s?.maxNightShiftsPerMonth, 0),
      canWorkNightShift: s?.canWorkNightShift !== false,
    }));
  } catch (e) {
    console.error('[DB] staff 取得失敗:', e);
    return [];
  }
}

async function fetchRequests(patterns: ShiftPattern[]): Promise<ShiftRequest[]> {
  try {
    const patternById = new Map<string, ShiftPattern>();
    const patternByName = new Map<string, ShiftPattern>();

    for (const pattern of patterns) {
      if (!pattern) continue;
      if (pattern.id != null) {
        patternById.set(String(pattern.id), pattern);
      }
      patternByName.set(String(pattern.name ?? ''), pattern);
    }

    const requestTable = (db as any).shiftRequests;
    const legacyTable = (db as any).shifts;

    const requestRows =
      requestTable && typeof requestTable.toArray === 'function'
        ? safeArray<any>(await requestTable.toArray())
        : [];

    const legacyRows =
      legacyTable && typeof legacyTable.toArray === 'function'
        ? safeArray<any>(await legacyTable.toArray())
        : [];

    const normalizedFromRequests: ShiftRequest[] = requestRows.map((row) => {
      const patternId = toNumericId(row?.patternId) ?? row?.patternId ?? undefined;
      const pattern = patternId != null ? patternById.get(String(patternId)) : undefined;
      return {
        ...(row as ShiftRequest),
        staffId: row?.staffId,
        date: String(row?.date ?? ''),
        shiftType: String(row?.shiftType ?? pattern?.name ?? ''),
        patternId,
        status: (row?.status ?? 'pending') as ShiftRequest['status'],
        requestedAt: row?.requestedAt ?? row?.createdAt ?? new Date(),
      };
    });

    const normalizedFromLegacy: ShiftRequest[] = legacyRows.map((row) => {
      const shiftType = String(row?.shiftType ?? '');
      const pattern = patternByName.get(shiftType);
      return {
        ...(row as any),
        staffId: row?.staffId,
        date: String(row?.date ?? ''),
        shiftType,
        patternId: toNumericId(pattern?.id) ?? pattern?.id ?? undefined,
        status: 'pending' as const,
        requestedAt: row?.createdAt ?? new Date(),
      } as ShiftRequest;
    });

    const merged = [...normalizedFromRequests, ...normalizedFromLegacy]
      .filter(isActiveRequest)
      .filter((req) => req.staffId != null && String(req.date ?? '').length > 0);

    const deduped: ShiftRequest[] = [];
    const seen = new Set<string>();

    for (const req of merged) {
      const key = `${idKey(req.staffId)}__${String(req.date)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(req);
    }

    return deduped;
  } catch (e) {
    console.error('[DB] shiftRequests / shifts 取得失敗:', e);
    return [];
  }
}

async function fetchConstraints(): Promise<ScheduleConstraints> {
  const defaults: ScheduleConstraints = {
    maxConsecutiveWorkDays: 5,
    minRestDaysBetweenNights: 1,
    minWorkDaysPerMonth: 20,
    minRestDaysPerMonth: 9,
    exactRestDaysPerMonth: 9,
    restAfterAke: true,
    maxNightShiftsPerMonth: 8,
    preferMixedGenderNightShift: true,
    sunHolidayDayStaffRequired: 3,
  };

  try {
    const tbl = (db as any).constraints;
    if (!tbl || typeof tbl.toArray !== 'function') return defaults;

    const all = await tbl.toArray();
    if (!Array.isArray(all) || all.length === 0) return defaults;

    return {
      ...defaults,
      ...(all[all.length - 1] as ScheduleConstraints),
    };
  } catch (e) {
    console.error('[DB] constraints 取得失敗:', e);
    return defaults;
  }
}

async function fetchPrevDayShifts(dateStr: string): Promise<GeneratedShift[]> {
  try {
    if (!dateStr) return [];
    const tbl = (db as any).generatedSchedules;
    if (!tbl || typeof tbl.where !== 'function') return [];
    return safeArray<GeneratedShift>(
      await tbl.where('date').equals(dateStr).toArray()
    );
  } catch (e) {
    console.warn('[DB] 前日シフト取得失敗:', e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// ScheduleGenerator
// ─────────────────────────────────────────────────────────────

export class ScheduleGenerator {
  private year: number;
  private month: number;

  private nightPatternId: number | null = null;
  private akePatternId: number | null = null;
  private vacationPatternId: number | null = null;
  private restPatternId: number | null = null;
  private dayPatternId: number | null = null;

  private prevNightStaffKeys: Set<string> = new Set();
  private prevAkeStaffKeys: Set<string> = new Set();
  private nightCount: Map<string, number> = new Map();
  private lastNightDate: Map<string, string> = new Map();
  private holidayCache: Map<number, Set<string>> = new Map();

  constructor(params: ScheduleGenerationParams) {
    const p = (params ?? {}) as any;
    this.year = safeNumber(p.year ?? p.targetYear, new Date().getFullYear());
    this.month = safeNumber(p.month ?? p.targetMonth, new Date().getMonth() + 1);
  }

  async generate(): Promise<ScheduleGenerationResult> {
    try {
      await ensurePatternsInDB();

      const [patterns, staff, constraints] = await Promise.all([
        fetchPatterns(),
        fetchStaff(),
        fetchConstraints(),
      ]);
      const requests = await fetchRequests(patterns);

      const nightPat =
        patterns.find((p) => p?.isNight === true || p?.name === '夜勤') ?? null;
      const akePat =
        patterns.find((p) => p?.isAke === true || p?.name === AKE_NAME) ?? null;
      const vacPat =
        patterns.find((p) => p?.isVacation === true || p?.name === VACATION_NAME) ?? null;
      const restPat = patterns.find((p) => p?.name === REST_NAME) ?? null;
      const dayPat = patterns.find((p) => isDayLikePattern(p)) ?? null;

      this.nightPatternId = toNumericId(nightPat?.id);
      this.akePatternId = toNumericId(akePat?.id);
      this.vacationPatternId = toNumericId(vacPat?.id);
      this.restPatternId = toNumericId(restPat?.id);
      this.dayPatternId = toNumericId(dayPat?.id);

      if (this.dayPatternId === null) {
        const fallback = patterns.find((p) => p?.id != null && isDayLikePattern(p));
        this.dayPatternId = toNumericId(fallback?.id);
      }

      const dates = getMonthDates(this.year, this.month);
      if (dates.length === 0) return makeEmptyResult(['year/month が不正です']);
      if (staff.length === 0) return makeEmptyResult(['スタッフが登録されていません']);
      if (this.dayPatternId === null) {
        return makeEmptyResult(['日勤パターンが見つかりません']);
      }

      const warnings: string[] = [];

      for (const member of staff) {
        if (member?.id != null) {
          this.nightCount.set(idKey(member.id), 0);
        }
      }

      await this.loadPrevMonthCarryOver(patterns);

      const schedule: GeneratedShift[] = [];

      // Pass1: 有給希望・休み希望を先に確定
      const fixedRequestPatternIds = new Set<number>();
      if (this.vacationPatternId !== null) fixedRequestPatternIds.add(this.vacationPatternId);
      if (this.restPatternId !== null) fixedRequestPatternIds.add(this.restPatternId);

      if (fixedRequestPatternIds.size > 0) {
        for (const req of requests) {
          if (!req) continue;
          if (!dates.includes(req.date)) continue;

          const reqPatternId = toNumericId(req.patternId);
          if (reqPatternId === null) continue;
          if (!fixedRequestPatternIds.has(reqPatternId)) continue;
          if (this.hasEntry(schedule, req.staffId, req.date)) continue;

          this.pushEntry(schedule, req.staffId, req.date, reqPatternId, true);
        }
      }

      const nightRequired = safeNumber(nightPat?.requiredStaff, 1);
      const restAfterAke = constraints.restAfterAke !== false;
      const minRestBetweenNights = safeNumber(constraints.minRestDaysBetweenNights, 1);
      const globalMaxNightShiftsPerMonth = safeNumber(
        constraints.maxNightShiftsPerMonth,
        0
      );
      const preferMixedGenderNightShift =
        constraints.preferMixedGenderNightShift !== false;

      // 明け → 明け翌日休み → 夜勤 → 計画休み → 日勤 → 未割当は休み
      for (const dateStr of dates) {
        await this.applyAke(dateStr, schedule, staff, patterns);

        if (restAfterAke) {
          this.applyRestAfterAke(dateStr, schedule, staff, patterns, requests);
        }

        if (this.nightPatternId !== null) {
          this.assignNight(
            dateStr,
            schedule,
            staff,
            requests,
            nightRequired,
            minRestBetweenNights,
            globalMaxNightShiftsPerMonth,
            preferMixedGenderNightShift,
            warnings
          );
        }

        this.assignPlannedRest(
          dateStr,
          schedule,
          staff,
          requests,
          patterns,
          constraints
        );

        this.assignDay(
          dateStr,
          schedule,
          staff,
          requests,
          patterns,
          constraints,
          warnings
        );

        this.fillUnassignedWithRest(dateStr, schedule, staff);
      }

      this.adjustRest(schedule, staff, constraints, patterns);
      this.checkMinWork(schedule, staff, constraints, patterns, warnings);
      this.checkRestQuota(schedule, staff, constraints, warnings);
      this.checkConsecutiveWork(schedule, staff, constraints, patterns, warnings);
      this.checkDayStaffing(schedule, patterns, constraints, dates, warnings);

      const statistics = this.calcStats(schedule, staff, patterns, dates);

      return {
        schedule,
        statistics,
        warnings,
      };
    } catch (err) {
      console.error('[SG] generate() 致命的エラー:', err);
      return makeEmptyResult(['スケジュール生成中に致命的なエラーが発生しました']);
    }
  }

  // ─────────────────────────────────────────────────────────
  // holiday helpers
  // ─────────────────────────────────────────────────────────

  private getHolidaySet(year: number): Set<string> {
    const cached = this.holidayCache.get(year);
    if (cached) return cached;

    const set = buildJapaneseHolidaySet(year);
    this.holidayCache.set(year, set);
    return set;
  }

  private isJapaneseHoliday(date: Date): boolean {
    return this.getHolidaySet(date.getFullYear()).has(formatDate(date));
  }

  private isSundayOrHoliday(dateStr: string): boolean {
    const d = parseDateString(dateStr);
    return d.getDay() === 0 || this.isJapaneseHoliday(d);
  }

  private getRequiredDayStaffCount(
    dateStr: string,
    dayPattern: ShiftPattern | null,
    constraints: ScheduleConstraints
  ): number {
    const normalDayRequired = safeNumber(dayPattern?.requiredStaff, 5);
    const sunHolidayRequired = safeNumber(
      constraints.sunHolidayDayStaffRequired,
      3
    );

    if (this.isSundayOrHoliday(dateStr)) {
      return sunHolidayRequired;
    }

    return normalDayRequired;
  }

  private getRequiredRestDaysForMonth(): number {
    const monthlyRestDaysMap: Record<number, number> = {
      1: 10,
      2: 8,
      3: 9,
      4: 9,
      5: 10,
      6: 9,
      7: 9,
      8: 10,
      9: 9,
      10: 9,
      11: 9,
      12: 9,
    };

    return monthlyRestDaysMap[this.month] ?? 9;
  }

  // ─────────────────────────────────────────────────────────
  // carry over
  // ─────────────────────────────────────────────────────────

  private async loadPrevMonthCarryOver(patterns: ShiftPattern[]): Promise<void> {
    try {
      const pm = this.month === 1 ? 12 : this.month - 1;
      const py = this.month === 1 ? this.year - 1 : this.year;
      const last = getDaysInMonth(py, pm);
      if (last <= 0) return;

      const prevDate = formatDate(new Date(py, pm - 1, last));
      const prevShifts = await fetchPrevDayShifts(prevDate);

      for (const s of prevShifts) {
        if (!s || s.staffId == null) continue;

        const key = idKey(s.staffId);
        const pat = patterns.find((p) => sameId(p?.id, s.patternId));
        if (!pat) continue;

        if (this.isNight(pat)) {
          this.prevNightStaffKeys.add(key);
          this.lastNightDate.set(key, prevDate);
        }

        if (pat.isAke || pat.name === AKE_NAME) {
          this.prevAkeStaffKeys.add(key);
        }
      }
    } catch (e) {
      console.warn('[SG] loadPrevMonthCarryOver 失敗:', e);
    }
  }

  // ─────────────────────────────────────────────────────────
  // apply AKE / rest after AKE
  // ─────────────────────────────────────────────────────────

  private async applyAke(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[]
  ): Promise<void> {
    if (this.akePatternId === null) return;

    const currentDate = parseDateString(dateStr);
    const isFirst = currentDate.getDate() === 1;
    const prevStr = formatDate(addDays(currentDate, -1));

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;
      const key = idKey(mid);

      if (this.hasEntry(schedule, mid, dateStr)) continue;

      let needsAke = false;

      if (isFirst) {
        needsAke = this.prevNightStaffKeys.has(key);
      } else {
        const prev = this.findEntry(schedule, mid, prevStr);
        if (prev) {
          const pat = patterns.find((p) => sameId(p?.id, prev.patternId));
          needsAke = !!(pat && this.isNight(pat));
        }
      }

      if (needsAke) {
        this.overwriteEntry(schedule, mid, dateStr, this.akePatternId, false);
      }
    }
  }

  private applyRestAfterAke(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    requests: ShiftRequest[]
  ): void {
    if (this.restPatternId === null || this.akePatternId === null) return;

    const currentDate = parseDateString(dateStr);
    const isFirst = currentDate.getDate() === 1;
    const prevStr = formatDate(addDays(currentDate, -1));

    const requestedStaffKeys = new Set(
      requests
        .filter((r) => r?.date === dateStr && r?.staffId != null)
        .map((r) => idKey(r.staffId))
    );

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;
      const key = idKey(mid);

      if (this.hasEntry(schedule, mid, dateStr)) continue;
      if (requestedStaffKeys.has(key)) continue;

      let needsRest = false;

      if (isFirst) {
        needsRest = this.prevAkeStaffKeys.has(key);
      } else {
        const prev = this.findEntry(schedule, mid, prevStr);
        if (prev) {
          const pat = patterns.find((p) => sameId(p?.id, prev.patternId));
          needsRest = !!(pat && (pat.isAke || pat.name === AKE_NAME));
        }
      }

      if (needsRest) {
        this.overwriteEntry(schedule, mid, dateStr, this.restPatternId, false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // night assignment
  // ─────────────────────────────────────────────────────────

  private assignNight(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    required: number,
    minRestBetweenNights: number,
    globalMaxNightShiftsPerMonth: number,
    preferMixedGenderNightShift: boolean,
    warnings: string[]
  ): void {
    if (this.nightPatternId === null) return;

    const busyKeys = new Set(
      schedule.filter((s) => s?.date === dateStr).map((s) => idKey(s.staffId))
    );

    const requestMap = new Map<string, ShiftRequest>();
    for (const req of requests) {
      if (!req || req.date !== dateStr || req.staffId == null) continue;
      requestMap.set(idKey(req.staffId), req);
    }

    const nightRequesters = new Set(
      requests
        .filter(
          (r) =>
            r?.date === dateStr &&
            r?.staffId != null &&
            sameId(r.patternId, this.nightPatternId)
        )
        .map((r) => idKey(r.staffId))
    );

    const candidates = staff.filter((m) => {
      if (m?.id == null) return false;
      const key = idKey(m.id);

      if (!canWorkNight(m)) return false;
      if (busyKeys.has(key)) return false;

      const req = requestMap.get(key);
      if (req && req.patternId != null && !sameId(req.patternId, this.nightPatternId)) {
        return false;
      }

      if (minRestBetweenNights > 0) {
        const lastNight = this.lastNightDate.get(key);
        if (lastNight) {
          const diff =
            (parseDateString(dateStr).getTime() - parseDateString(lastNight).getTime()) /
            86400000;
          if (diff <= minRestBetweenNights) return false;
        }
      }

      const currentNightCount = this.nightCount.get(key) ?? 0;
      const personalMax = safeNumber(m.maxNightShiftsPerMonth, 0);
      const effectiveMax =
        personalMax > 0
          ? personalMax
          : globalMaxNightShiftsPerMonth > 0
          ? globalMaxNightShiftsPerMonth
          : Number.POSITIVE_INFINITY;

      if (currentNightCount >= effectiveMax) return false;

      return true;
    });

    const sortBase = (list: Staff[]): Staff[] => {
      return [...list].sort((a, b) => {
        const aKey = idKey(a.id);
        const bKey = idKey(b.id);

        const aReq = nightRequesters.has(aKey) ? 0 : 1;
        const bReq = nightRequesters.has(bKey) ? 0 : 1;
        if (aReq !== bReq) return aReq - bReq;

        const aNight = this.nightCount.get(aKey) ?? 0;
        const bNight = this.nightCount.get(bKey) ?? 0;
        if (aNight !== bNight) return aNight - bNight;

        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja');
      });
    };

    const selected: Staff[] = [];
    const selectedKeys = new Set<string>();

    while (selected.length < required) {
      const remaining = sortBase(
        candidates.filter((c) => !selectedKeys.has(idKey(c.id)))
      );
      if (remaining.length === 0) break;

      let chosen: Staff | undefined;

      if (preferMixedGenderNightShift && required >= 2 && selected.length > 0) {
        const selectedGenders = new Set(
          selected.map((s) => normalizeGender(s.gender))
        );

        if (selectedGenders.size === 1) {
          const onlyGender = Array.from(selectedGenders)[0];
          if (onlyGender === '男性' || onlyGender === '女性') {
            const targetGender: StaffGender =
              onlyGender === '男性' ? '女性' : '男性';

            const mixedCandidates = remaining.filter(
              (c) => normalizeGender(c.gender) === targetGender
            );

            if (mixedCandidates.length > 0) {
              chosen = mixedCandidates[0];
            }
          }
        }
      }

      if (!chosen) {
        chosen = remaining[0];
      }
      if (!chosen) break;

      selected.push(chosen);
      selectedKeys.add(idKey(chosen.id));
    }

    for (const member of selected) {
      const mid = member.id!;
      const key = idKey(mid);

      this.overwriteEntry(schedule, mid, dateStr, this.nightPatternId, false);
      this.nightCount.set(key, (this.nightCount.get(key) ?? 0) + 1);
      this.lastNightDate.set(key, dateStr);
    }

    if (selected.length < required) {
      warnings.push(
        `${dateStr}: 夜勤必要人数 ${required} 人に対して ${selected.length} 人しか割り当てできませんでした`
      );
    }
  }

  // ─────────────────────────────────────────────────────────
  // rest planning
  // ─────────────────────────────────────────────────────────

  private countRestDaysForStaff(
    schedule: GeneratedShift[],
    staffId: string | number
  ): number {
    if (this.restPatternId === null) return 0;
    return schedule.filter(
      (s) => sameId(s?.staffId, staffId) && sameId(s?.patternId, this.restPatternId)
    ).length;
  }

  private countAssignedWorkDays(
    schedule: GeneratedShift[],
    staffId: string | number,
    patterns: ShiftPattern[]
  ): number {
    return schedule.filter((s) => {
      if (!sameId(s?.staffId, staffId)) return false;
      const p = patterns.find((x) => sameId(x?.id, s.patternId));
      return isWorkPattern(p);
    }).length;
  }

  private getConsecutiveWorkDaysBefore(
    dateStr: string,
    staffId: string | number,
    schedule: GeneratedShift[],
    patterns: ShiftPattern[]
  ): number {
    let count = 0;
    let cursor = addDays(parseDateString(dateStr), -1);

    while (
      cursor.getFullYear() === this.year &&
      cursor.getMonth() + 1 === this.month
    ) {
      const ds = formatDate(cursor);
      const entry = this.findEntry(schedule, staffId, ds);
      if (!entry) break;

      const pat = patterns.find((p) => sameId(p?.id, entry.patternId));
      if (!isWorkPattern(pat)) break;

      count += 1;
      cursor = addDays(cursor, -1);
    }

    return count;
  }

  private assignPlannedRest(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints
  ): void {
    if (this.restPatternId === null) return;

    const targetRest = this.getRequiredRestDaysForMonth();
    const maxConsecutive = safeNumber(constraints.maxConsecutiveWorkDays, 0);
    const totalDays = getDaysInMonth(this.year, this.month);
    const dayOfMonth = parseDateString(dateStr).getDate();

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;

      if (this.hasEntry(schedule, mid, dateStr)) continue;

      const req = requests.find(
        (r) => sameId(r?.staffId, mid) && r?.date === dateStr
      );
      if (req?.patternId != null) continue;

      const restCount = this.countRestDaysForStaff(schedule, mid);
      const consecutiveWork = this.getConsecutiveWorkDaysBefore(
        dateStr,
        mid,
        schedule,
        patterns
      );

      const remainingDaysIncludingToday = totalDays - dayOfMonth + 1;
      const remainingRestNeeded = Math.max(0, targetRest - restCount);

      const idealRestByToday =
        targetRest > 0 ? Math.floor((dayOfMonth * targetRest) / totalDays) : 0;

      const forceByConsecutive =
        maxConsecutive > 0 && consecutiveWork >= maxConsecutive;

      const forceByQuota =
        targetRest > 0 && remainingRestNeeded >= remainingDaysIncludingToday;

      const paceByQuota =
        targetRest > 0 &&
        restCount < idealRestByToday &&
        consecutiveWork >= 2;

      if (forceByConsecutive || forceByQuota || paceByQuota) {
        this.overwriteEntry(schedule, mid, dateStr, this.restPatternId, false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // day assignment
  // ─────────────────────────────────────────────────────────

  private countDayLikeEntriesOnDate(
    schedule: GeneratedShift[],
    dateStr: string,
    patterns: ShiftPattern[]
  ): number {
    return schedule.filter((s) => {
      if (s?.date !== dateStr) return false;
      const p = patterns.find((x) => sameId(x?.id, s.patternId));
      return isDayLikePattern(p);
    }).length;
  }

  private assignDay(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints,
    warnings: string[]
  ): void {
    if (this.dayPatternId === null) return;

    const dayPattern =
      patterns.find((p) => sameId(p?.id, this.dayPatternId)) ?? null;

    const required = this.getRequiredDayStaffCount(
      dateStr,
      dayPattern,
      constraints
    );

    // 1) 夜勤以外の希望を先に反映
    for (const member of staff) {
      if (member?.id == null) continue;
      const mid = member.id;

      if (this.hasEntry(schedule, mid, dateStr)) continue;

      const req = requests.find(
        (r) => sameId(r?.staffId, mid) && r?.date === dateStr
      );
      if (!req?.patternId) continue;

      const requestedPattern = patterns.find((p) => sameId(p?.id, req.patternId));
      if (!requestedPattern) continue;

      if (!requestedPattern.isNight) {
        const requestedPatternId = toNumericId(req.patternId) ?? this.dayPatternId;
        this.pushEntry(schedule, mid, dateStr, requestedPatternId, true);
      }
    }

    // 2) 足りない分だけ日勤を入れる
    let currentDayCount = this.countDayLikeEntriesOnDate(schedule, dateStr, patterns);
    const maxConsecutive = safeNumber(constraints.maxConsecutiveWorkDays, 0);

    if (currentDayCount < required) {
      const remaining = staff.filter((member) => {
        if (member?.id == null) return false;
        if (this.hasEntry(schedule, member.id, dateStr)) return false;
        return true;
      });

      const preferred = remaining.filter((member) => {
        if (maxConsecutive <= 0) return true;
        const consecutive = this.getConsecutiveWorkDaysBefore(
          dateStr,
          member.id,
          schedule,
          patterns
        );
        return consecutive < maxConsecutive;
      });

      const pool = preferred.length >= required - currentDayCount ? preferred : remaining;

      const sorted = [...pool].sort((a, b) => {
        const aConsecutive = this.getConsecutiveWorkDaysBefore(
          dateStr,
          a.id,
          schedule,
          patterns
        );
        const bConsecutive = this.getConsecutiveWorkDaysBefore(
          dateStr,
          b.id,
          schedule,
          patterns
        );
        if (aConsecutive !== bConsecutive) return aConsecutive - bConsecutive;

        const aWork = this.countAssignedWorkDays(schedule, a.id, patterns);
        const bWork = this.countAssignedWorkDays(schedule, b.id, patterns);
        if (aWork !== bWork) return aWork - bWork;

        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja');
      });

      for (const member of sorted) {
        if (currentDayCount >= required) break;
        if (this.hasEntry(schedule, member.id, dateStr)) continue;

        this.pushEntry(schedule, member.id, dateStr, this.dayPatternId, false);
        currentDayCount += 1;
      }
    }

    const afterCount = this.countDayLikeEntriesOnDate(schedule, dateStr, patterns);

    if (afterCount < required) {
      warnings.push(
        `${dateStr}: 日勤必要人数 ${required} 人に対して ${afterCount} 人しか割り当てできませんでした`
      );
    }
  }

  private fillUnassignedWithRest(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[]
  ): void {
    const fallbackPatternId = this.restPatternId ?? this.dayPatternId;
    if (fallbackPatternId == null) return;

    for (const member of staff) {
      if (member?.id == null) continue;
      if (this.hasEntry(schedule, member.id, dateStr)) continue;
      this.pushEntry(schedule, member.id, dateStr, fallbackPatternId, false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // post adjustment
  // ─────────────────────────────────────────────────────────

  private canConvertDayToRestSafely(
    schedule: GeneratedShift[],
    dateStr: string,
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints
  ): boolean {
    const dayPattern =
      patterns.find((p) => sameId(p?.id, this.dayPatternId)) ?? null;
    const required = this.getRequiredDayStaffCount(dateStr, dayPattern, constraints);
    const current = this.countDayLikeEntriesOnDate(schedule, dateStr, patterns);
    return current > required;
  }

  private canConvertRestToDaySafely(
    schedule: GeneratedShift[],
    dateStr: string,
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints
  ): boolean {
    // 公休超過を解消するため、休み→日勤への変換は許可する
    // （日勤必要人数は最低人数として扱い、超過自体は不正とはしない）
    return this.dayPatternId !== null;
  }

  private isProtectedRestAfterAke(
    schedule: GeneratedShift[],
    staffId: string | number,
    dateStr: string
  ): boolean {
    if (this.akePatternId === null) return false;
    const prevDate = formatDate(addDays(parseDateString(dateStr), -1));
    const prev = this.findEntry(schedule, staffId, prevDate);
    return sameId(prev?.patternId, this.akePatternId);
  }

  private adjustRest(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[]
  ): void {
    if (this.restPatternId === null || this.dayPatternId === null) return;

    const target = this.getRequiredRestDaysForMonth();
    if (target <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;

      const mine = schedule
        .filter((s) => sameId(s?.staffId, mid))
        .sort((a, b) => a.date.localeCompare(b.date));

      let restCount = mine.filter((s) =>
        sameId(s?.patternId, this.restPatternId)
      ).length;

      // 公休が不足している場合、日勤などから休みに変換
      if (restCount < target) {
        const need = target - restCount;

        const candidates = mine
          .filter((s) => {
            if (s.isManual) return false;
            const p = patterns.find((x) => sameId(x?.id, s.patternId));
            if (!isDayLikePattern(p)) return false;
            return this.canConvertDayToRestSafely(schedule, s.date, patterns, constraints);
          })
          .sort((a, b) => {
            const aScore = this.getConsecutiveWorkDaysBefore(
              a.date,
              mid,
              schedule,
              patterns
            );
            const bScore = this.getConsecutiveWorkDaysBefore(
              b.date,
              mid,
              schedule,
              patterns
            );
            return bScore - aScore || b.date.localeCompare(a.date);
          });

        for (let i = 0; i < need && i < candidates.length; i++) {
          const idx = schedule.indexOf(candidates[i]);
          if (idx >= 0) {
            schedule[idx] = {
              ...schedule[idx],
              patternId: this.restPatternId,
            };
            restCount += 1;
          }
        }
      }

      // 公休が多すぎる場合、保護対象でない休みを日勤へ戻す
      if (restCount > target) {
        let over = restCount - target;

        const candidates = mine
          .filter((s) => {
            if (!sameId(s?.patternId, this.restPatternId)) return false;
            if (s.isManual) return false;
            if (this.isProtectedRestAfterAke(schedule, mid, s.date)) return false;
            return this.canConvertRestToDaySafely(schedule, s.date, patterns, constraints);
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        for (const entry of candidates) {
          if (over <= 0) break;
          const idx = schedule.indexOf(entry);
          if (idx >= 0) {
            schedule[idx] = {
              ...schedule[idx],
              patternId: this.dayPatternId,
            };
            over -= 1;
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // validation / warnings
  // ─────────────────────────────────────────────────────────

  private checkMinWork(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[],
    warnings: string[]
  ): void {
    const globalMinDays = safeNumber(constraints.minWorkDaysPerMonth, 0);

    for (const member of staff) {
      if (member?.id == null) continue;

      const personalMin = safeNumber(member.minWorkDaysPerMonth, 0);
      const minDays = personalMin > 0 ? personalMin : globalMinDays;
      if (minDays <= 0) continue;

      const workDays = schedule.filter((s) => {
        if (!sameId(s?.staffId, member.id)) return false;
        const p = patterns.find((x) => sameId(x?.id, s.patternId));
        return isWorkPattern(p);
      }).length;

      if (workDays < minDays) {
        warnings.push(
          `${member.name ?? 'スタッフ'}: 勤務${workDays}日 < 最低${minDays}日`
        );
      }
    }
  }

  private checkRestQuota(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    warnings: string[]
  ): void {
    if (this.restPatternId === null) return;

    const target = this.getRequiredRestDaysForMonth();
    if (target <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;

      const restCount = schedule.filter(
        (s) =>
          sameId(s?.staffId, member.id) &&
          sameId(s?.patternId, this.restPatternId)
      ).length;

      if (restCount < target) {
        warnings.push(
          `${member.name ?? 'スタッフ'}: 公休不足 ${restCount}/${target}`
        );
      }

      if (restCount > target) {
        warnings.push(
          `${member.name ?? 'スタッフ'}: 公休超過 ${restCount}/${target}`
        );
      }
    }
  }

  private checkConsecutiveWork(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints,
    patterns: ShiftPattern[],
    warnings: string[]
  ): void {
    const maxConsecutive = safeNumber(constraints.maxConsecutiveWorkDays, 0);
    if (maxConsecutive <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;

      const mine = schedule
        .filter((s) => sameId(s?.staffId, member.id))
        .sort((a, b) => a.date.localeCompare(b.date));

      let streak = 0;
      let streakStart = '';
      let warnedForThisStreak = false;

      for (const entry of mine) {
        const pat = patterns.find((p) => sameId(p?.id, entry.patternId));
        const isWork = isWorkPattern(pat);

        if (isWork) {
          streak += 1;
          if (streak === 1) streakStart = entry.date;

          if (streak > maxConsecutive && !warnedForThisStreak) {
            warnings.push(
              `${member.name ?? 'スタッフ'}: ${streakStart} から連続勤務が ${streak} 日以上あります`
            );
            warnedForThisStreak = true;
          }
        } else {
          streak = 0;
          streakStart = '';
          warnedForThisStreak = false;
        }
      }
    }
  }

  private checkDayStaffing(
    schedule: GeneratedShift[],
    patterns: ShiftPattern[],
    constraints: ScheduleConstraints,
    dates: string[],
    warnings: string[]
  ): void {
    const dayPattern =
      patterns.find((p) => sameId(p?.id, this.dayPatternId)) ?? null;

    for (const dateStr of dates) {
      const required = this.getRequiredDayStaffCount(dateStr, dayPattern, constraints);
      const current = this.countDayLikeEntriesOnDate(schedule, dateStr, patterns);

      if (current < required) {
        warnings.push(
          `${dateStr}: 日勤人数不足 ${current}/${required}`
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // statistics
  // ─────────────────────────────────────────────────────────

  private calcStats(
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[],
    dates: string[]
  ): ScheduleStatistics {
    const staffWorkload: StaffWorkloadStat[] = staff.map((member) => {
      const mine = schedule.filter((s) => sameId(s?.staffId, member.id));

      const countBy = (fn: (p: ShiftPattern) => boolean) =>
        mine.filter((s) => {
          const p = patterns.find((x) => sameId(x?.id, s.patternId));
          return p ? fn(p) : false;
        }).length;

      return {
        staffId: member.id,
        staffName: member.name,
        workDays: countBy(
          (p) => !p.isAke && !p.isVacation && p.name !== REST_NAME && !this.isNight(p)
        ),
        nightDays: countBy((p) => this.isNight(p)),
        akeDays: countBy((p) => !!p.isAke),
        vacationDays: countBy((p) => !!p.isVacation),
        restDays: countBy((p) => p.name === REST_NAME),
        totalDays: mine.length,
      };
    });

    const shiftTypeDistribution: Record<string, number> = {};
    for (const s of schedule) {
      const p = patterns.find((x) => sameId(x?.id, s.patternId));
      const key = p?.name ?? '不明';
      shiftTypeDistribution[key] = (shiftTypeDistribution[key] ?? 0) + 1;
    }

    return {
      totalDays: dates.length,
      totalShifts: schedule.length,
      staffWorkload,
      shiftTypeDistribution,
    };
  }

  // ─────────────────────────────────────────────────────────
  // misc helpers
  // ─────────────────────────────────────────────────────────

  private isNight(p: ShiftPattern): boolean {
    if (!p) return false;
    if (p.isNight === true) return true;
    const name = p.name ?? '';
    return name.includes('夜勤') || name === '夜';
  }

  private findEntry(
    schedule: GeneratedShift[],
    staffId: string | number,
    date: string
  ): GeneratedShift | undefined {
    return schedule.find((s) => sameId(s?.staffId, staffId) && s?.date === date);
  }

  private hasEntry(
    schedule: GeneratedShift[],
    staffId: string | number,
    date: string
  ): boolean {
    return schedule.some((s) => sameId(s?.staffId, staffId) && s?.date === date);
  }

  private pushEntry(
    schedule: GeneratedShift[],
    staffId: string | number,
    date: string,
    patternId: number,
    isManual: boolean
  ): void {
    schedule.push({
      staffId,
      date,
      patternId,
      isManual,
    });
  }

  private overwriteEntry(
    schedule: GeneratedShift[],
    staffId: string | number,
    date: string,
    patternId: number,
    isManual: boolean
  ): void {
    const idx = schedule.findIndex(
      (s) => sameId(s?.staffId, staffId) && s?.date === date
    );

    const nextEntry: GeneratedShift = {
      staffId,
      date,
      patternId,
      isManual,
    };

    if (idx >= 0) {
      schedule[idx] = nextEntry;
    } else {
      schedule.push(nextEntry);
    }
  }
}
