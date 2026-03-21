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

async function fetchRequests(): Promise<ShiftRequest[]> {
  try {
    const tbl = (db as any).shiftRequests;
    if (!tbl || typeof tbl.toArray !== 'function') return [];
    return safeArray<ShiftRequest>(await tbl.toArray());
  } catch (e) {
    console.error('[DB] shiftRequests 取得失敗:', e);
    return [];
  }
}

async function fetchConstraints(): Promise<ScheduleConstraints> {
  const defaults: ScheduleConstraints = {
    maxConsecutiveWorkDays: 5,
    minRestDaysBetweenNights: 1,
    minWorkDaysPerMonth: 20,
    exactRestDaysPerMonth: 8,
    restAfterAke: true,
    maxNightShiftsPerMonth: 8,
    preferMixedGenderNightShift: true,
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

  constructor(params: ScheduleGenerationParams) {
    const p = (params ?? {}) as any;
    this.year = safeNumber(p.year ?? p.targetYear, new Date().getFullYear());
    this.month = safeNumber(p.month ?? p.targetMonth, new Date().getMonth() + 1);
  }

  async generate(): Promise<ScheduleGenerationResult> {
    try {
      await ensurePatternsInDB();

      const [patterns, staff, requests, constraints] = await Promise.all([
        fetchPatterns(),
        fetchStaff(),
        fetchRequests(),
        fetchConstraints(),
      ]);

      const nightPat =
        patterns.find((p) => p?.isNight === true || p?.name === '夜勤') ?? null;
      const akePat =
        patterns.find((p) => p?.isAke === true || p?.name === AKE_NAME) ?? null;
      const vacPat =
        patterns.find((p) => p?.isVacation === true || p?.name === VACATION_NAME) ?? null;
      const restPat = patterns.find((p) => p?.name === REST_NAME) ?? null;
      const dayPat =
        patterns.find(
          (p) =>
            p != null &&
            p.name !== REST_NAME &&
            !p.isAke &&
            !p.isVacation &&
            !p.isNight
        ) ?? null;

      this.nightPatternId = toNumericId(nightPat?.id);
      this.akePatternId = toNumericId(akePat?.id);
      this.vacationPatternId = toNumericId(vacPat?.id);
      this.restPatternId = toNumericId(restPat?.id);
      this.dayPatternId = toNumericId(dayPat?.id);

      if (this.dayPatternId === null) {
        const fallback = patterns.find(
          (p) =>
            p?.id != null &&
            !sameId(p.id, this.nightPatternId) &&
            !p.isAke &&
            !p.isVacation &&
            p.name !== REST_NAME
        );
        this.dayPatternId = toNumericId(fallback?.id);
      }

      const dates = getMonthDates(this.year, this.month);
      if (dates.length === 0) return makeEmptyResult(['year/month が不正です']);
      if (staff.length === 0) return makeEmptyResult(['スタッフが登録されていません']);

      const warnings: string[] = [];

      for (const member of staff) {
        if (member?.id != null) this.nightCount.set(idKey(member.id), 0);
      }

      await this.loadPrevMonthCarryOver(patterns);

      const schedule: GeneratedShift[] = [];

      if (this.vacationPatternId !== null) {
        for (const req of requests) {
          if (!req) continue;
          if (!dates.includes(req.date)) continue;
          if (!sameId(req.patternId, this.vacationPatternId)) continue;
          if (this.hasEntry(schedule, req.staffId, req.date)) continue;
          this.pushEntry(schedule, req.staffId, req.date, this.vacationPatternId, true);
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

        this.assignDay(dateStr, schedule, staff, requests, patterns);
      }

      this.adjustRest(schedule, staff, constraints);
      this.checkMinWork(schedule, staff, constraints, patterns, warnings);

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

  private async applyAke(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    patterns: ShiftPattern[]
  ): Promise<void> {
    if (this.akePatternId === null) return;

    const currentDate = new Date(dateStr);
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

    const currentDate = new Date(dateStr);
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
            sameId(r?.patternId, this.nightPatternId) &&
            r?.staffId != null
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
            (new Date(dateStr).getTime() - new Date(lastNight).getTime()) / 86400000;
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

      if (!chosen) chosen = remaining[0];
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

  private assignDay(
    dateStr: string,
    schedule: GeneratedShift[],
    staff: Staff[],
    requests: ShiftRequest[],
    patterns: ShiftPattern[]
  ): void {
    const fallbackDayId =
      this.dayPatternId ??
      toNumericId(
        patterns.find(
          (p) =>
            p?.id != null &&
            !sameId(p.id, this.nightPatternId) &&
            !p.isAke &&
            !p.isVacation &&
            p.name !== REST_NAME
        )?.id
      );

    if (fallbackDayId === null) return;

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;
      if (this.hasEntry(schedule, mid, dateStr)) continue;

      const req = requests.find((r) => sameId(r?.staffId, mid) && r?.date === dateStr);
      const requestedPatternId = toNumericId(req?.patternId);

      if (req?.patternId != null && !sameId(req.patternId, this.nightPatternId)) {
        const requestedPattern = patterns.find((p) => sameId(p?.id, req.patternId));
        if (requestedPattern && !requestedPattern.isNight) {
          this.pushEntry(
            schedule,
            mid,
            dateStr,
            requestedPatternId ?? fallbackDayId,
            true
          );
          continue;
        }
      }

      this.pushEntry(schedule, mid, dateStr, fallbackDayId, false);
    }
  }

  private adjustRest(
    schedule: GeneratedShift[],
    staff: Staff[],
    constraints: ScheduleConstraints
  ): void {
    if (this.restPatternId === null) return;

    const target = safeNumber(constraints.exactRestDaysPerMonth, 0);
    if (target <= 0) return;

    for (const member of staff) {
      if (member?.id == null) continue;

      const mid = member.id;
      const mine = schedule.filter((s) => sameId(s?.staffId, mid));
      const restCount = mine.filter((s) => sameId(s?.patternId, this.restPatternId)).length;
      const diff = target - restCount;
      if (diff <= 0) continue;

      const changeable = mine
        .filter(
          (s) =>
            !sameId(s?.patternId, this.restPatternId) &&
            !sameId(s?.patternId, this.akePatternId) &&
            !sameId(s?.patternId, this.vacationPatternId) &&
            !sameId(s?.patternId, this.nightPatternId)
        )
        .reverse();

      for (let i = 0; i < diff && i < changeable.length; i++) {
        const idx = schedule.indexOf(changeable[i]);
        if (idx >= 0) {
          schedule[idx] = {
            ...schedule[idx],
            patternId: this.restPatternId,
          };
        }
      }
    }
  }

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
        if (!p) return false;
        return !p.isAke && !p.isVacation && p.name !== REST_NAME;
      }).length;

      if (workDays < minDays) {
        warnings.push(
          `${member.name ?? 'スタッフ'}: 勤務${workDays}日 < 最低${minDays}日`
        );
      }
    }
  }

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
