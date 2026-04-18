import Dexie, { type Table } from 'dexie';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
} from '../types';

// ── DB クラス ───────────────────────────────────────────────
export class NurseSchedulerDB extends Dexie {
  shiftPatterns!: Table<ShiftPattern, number>;
  shiftRequests!: Table<ShiftRequest, number>;
  constraints!: Table<ScheduleConstraints, number>;
  generatedSchedules!: Table<GeneratedShift, number>;

  // 既存テーブル
  staff!: Table<Staff, string>;
  shifts!: Table<any, any>;
  scheduleConstraints!: Table<any, any>;

  constructor() {
    super('NurseSchedulerDB');

    this.version(1).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
    });

    this.version(2).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: 'id, name, shortName, sortOrder, createdAt',
    });

    this.version(3).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: 'id, name, shortName, sortOrder, createdAt',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
    });

    this.version(4)
      .stores({
        staff: 'id, name, position, employmentType, createdAt',
        shifts: 'id, staffId, date, shiftType, createdAt',
        shiftPatterns: '++id, name',
        scheduleConstraints: 'id, name, isActive, priority, createdAt',
        shiftRequests: '++id, staffId, date, patternId',
        constraints: '++id',
        generatedSchedules: '++id, staffId, date, patternId',
      })
      .upgrade((trans) => {
        return (trans as any)
          .table('shiftPatterns')
          .clear()
          .catch(() => {
            console.warn('[DB] v4 upgrade: shiftPatterns.clear() スキップ');
          });
      });

    this.version(5).stores({
      staff: 'id, name, position, employmentType, minWorkDaysPerMonth, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: '++id, name',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests: '++id, staffId, date, patternId',
      constraints: '++id',
      generatedSchedules: '++id, staffId, date, patternId',
    });

    this.version(6).stores({
      staff: 'id, name, position, employmentType, gender, minWorkDaysPerMonth, maxNightShiftsPerMonth, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: '++id, name',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests: '++id, staffId, date, patternId',
      constraints: '++id',
      generatedSchedules: '++id, staffId, date, patternId',
    });

    this.version(7).stores({
      staff: 'id, name, position, employmentType, gender, canWorkNightShift, minWorkDaysPerMonth, maxNightShiftsPerMonth, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: '++id, name',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests: '++id, staffId, date, patternId',
      constraints: '++id',
      generatedSchedules: '++id, staffId, date, patternId',
    });
  }
}

export const db = new NurseSchedulerDB();

// ── デフォルト勤務パターン ───────────────────────────────────
export const DEFAULT_PATTERNS = [
  {
    name: '日勤',
    startTime: '08:30',
    endTime: '17:00',
    color: '#bfdbfe',
    isNight: false,
    isAke: false,
    isVacation: false,
    requiredStaff: 5,
    isWorkday: true,
    shortName: '日',
    sortOrder: 1,
  },
  {
    name: '夜勤',
    startTime: '16:30',
    endTime: '09:00',
    color: '#c4b5fd',
    isNight: true,
    isAke: false,
    isVacation: false,
    requiredStaff: 2,
    isWorkday: true,
    shortName: '夜',
    sortOrder: 2,
  },
  {
    name: '明け',
    startTime: '00:00',
    endTime: '00:00',
    color: '#93c5fd',
    isNight: false,
    isAke: true,
    isVacation: false,
    requiredStaff: 0,
    isWorkday: false,
    shortName: '明',
    sortOrder: 3,
  },
  {
    name: '有給',
    startTime: '00:00',
    endTime: '00:00',
    color: '#86efac',
    isNight: false,
    isAke: false,
    isVacation: true,
    requiredStaff: 0,
    isWorkday: false,
    shortName: '有',
    sortOrder: 4,
  },
  {
    name: '休み',
    startTime: '00:00',
    endTime: '00:00',
    color: '#d1d5db',
    isNight: false,
    isAke: false,
    isVacation: false,
    requiredStaff: 0,
    isWorkday: false,
    shortName: '休',
    sortOrder: 5,
  },
] as const;

// ── 制約デフォルト ───────────────────────────────────────────
export const DEFAULT_CONSTRAINTS: Omit<ScheduleConstraints, 'id'> = {
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

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function normalizePatternName(value: unknown): string {
  return safeString(value);
}

function samePatternName(a: unknown, b: unknown): boolean {
  return normalizePatternName(a) === normalizePatternName(b);
}

function toPatternId(value: unknown): number | null {
  const num = safeNumber(value, Number.NaN);
  return Number.isFinite(num) ? num : null;
}

function parseDateLike(value: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return Number.MAX_SAFE_INTEGER;
}

function patternCompletenessScore(pattern: Partial<ShiftPattern>): number {
  let score = 0;

  if (safeString(pattern.name)) score += 1;
  if (safeString(pattern.shortName)) score += 1;
  if (safeString(pattern.startTime)) score += 1;
  if (safeString(pattern.endTime)) score += 1;
  if (safeString(pattern.color)) score += 1;
  if (typeof pattern.isNight === 'boolean') score += 1;
  if (typeof pattern.isAke === 'boolean') score += 1;
  if (typeof pattern.isVacation === 'boolean') score += 1;
  if (typeof pattern.isWorkday === 'boolean') score += 1;
  if (typeof pattern.requiredStaff === 'number') score += 1;
  if (typeof pattern.sortOrder === 'number') score += 1;

  return score;
}

function chooseCanonicalPattern(group: ShiftPattern[]): ShiftPattern {
  return [...group].sort((a, b) => {
    const aCreated = parseDateLike(a.createdAt);
    const bCreated = parseDateLike(b.createdAt);
    if (aCreated !== bCreated) return aCreated - bCreated;

    const aScore = patternCompletenessScore(a);
    const bScore = patternCompletenessScore(b);
    if (aScore !== bScore) return bScore - aScore;

    const aId = safeNumber(a.id, Number.MAX_SAFE_INTEGER);
    const bId = safeNumber(b.id, Number.MAX_SAFE_INTEGER);
    return aId - bId;
  })[0];
}

function buildCanonicalPatternPatch(
  canonical: ShiftPattern,
  group: ShiftPattern[]
): Partial<ShiftPattern> {
  const defaultPattern = DEFAULT_PATTERNS.find((p) => samePatternName(p.name, canonical.name));
  const donor = [...group].sort((a, b) => {
    const aScore = patternCompletenessScore(a);
    const bScore = patternCompletenessScore(b);
    if (aScore !== bScore) return bScore - aScore;
    return safeNumber(a.id, Number.MAX_SAFE_INTEGER) - safeNumber(b.id, Number.MAX_SAFE_INTEGER);
  })[0];

  const desiredName = normalizePatternName(canonical.name) || normalizePatternName(donor?.name);
  const desiredShortName =
    safeString(canonical.shortName) ||
    safeString(donor?.shortName) ||
    safeString(defaultPattern?.shortName) ||
    desiredName;

  const desiredStartTime =
    safeString(canonical.startTime) ||
    safeString(donor?.startTime) ||
    safeString(defaultPattern?.startTime) ||
    '00:00';

  const desiredEndTime =
    safeString(canonical.endTime) ||
    safeString(donor?.endTime) ||
    safeString(defaultPattern?.endTime) ||
    '00:00';

  const desiredColor =
    safeString(canonical.color) ||
    safeString(donor?.color) ||
    safeString(defaultPattern?.color) ||
    '#d1d5db';

  const desiredRequiredStaff =
    typeof canonical.requiredStaff === 'number'
      ? canonical.requiredStaff
      : typeof donor?.requiredStaff === 'number'
        ? donor.requiredStaff
        : typeof defaultPattern?.requiredStaff === 'number'
          ? defaultPattern.requiredStaff
          : 0;

  const desiredIsNight =
    typeof canonical.isNight === 'boolean'
      ? canonical.isNight
      : typeof donor?.isNight === 'boolean'
        ? donor.isNight
        : defaultPattern?.isNight ?? false;

  const desiredIsAke =
    typeof canonical.isAke === 'boolean'
      ? canonical.isAke
      : typeof donor?.isAke === 'boolean'
        ? donor.isAke
        : defaultPattern?.isAke ?? false;

  const desiredIsVacation =
    typeof canonical.isVacation === 'boolean'
      ? canonical.isVacation
      : typeof donor?.isVacation === 'boolean'
        ? donor.isVacation
        : defaultPattern?.isVacation ?? false;

  const desiredIsWorkday =
    typeof canonical.isWorkday === 'boolean'
      ? canonical.isWorkday
      : typeof donor?.isWorkday === 'boolean'
        ? donor.isWorkday
        : defaultPattern?.isWorkday ?? !(desiredIsAke || desiredIsVacation);

  const desiredSortOrder =
    typeof canonical.sortOrder === 'number'
      ? canonical.sortOrder
      : typeof donor?.sortOrder === 'number'
        ? donor.sortOrder
        : typeof defaultPattern?.sortOrder === 'number'
          ? defaultPattern.sortOrder
          : 0;

  const patch: Partial<ShiftPattern> = {};

  if (desiredName && desiredName !== canonical.name) patch.name = desiredName;
  if (desiredShortName !== canonical.shortName) patch.shortName = desiredShortName;
  if (desiredStartTime !== canonical.startTime) patch.startTime = desiredStartTime;
  if (desiredEndTime !== canonical.endTime) patch.endTime = desiredEndTime;
  if (desiredColor !== canonical.color) patch.color = desiredColor;
  if (desiredRequiredStaff !== canonical.requiredStaff) patch.requiredStaff = desiredRequiredStaff;
  if (desiredIsNight !== canonical.isNight) patch.isNight = desiredIsNight;
  if (desiredIsAke !== canonical.isAke) patch.isAke = desiredIsAke;
  if (desiredIsVacation !== canonical.isVacation) patch.isVacation = desiredIsVacation;
  if (desiredIsWorkday !== canonical.isWorkday) patch.isWorkday = desiredIsWorkday;
  if (desiredSortOrder !== canonical.sortOrder) patch.sortOrder = desiredSortOrder;

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = new Date();
  }

  return patch;
}

export interface DuplicateShiftPatternCleanupDetail {
  name: string;
  keptId: number;
  removedIds: number[];
}

export interface DuplicateShiftPatternCleanupResult {
  groupsMerged: number;
  patternsDeleted: number;
  shiftRequestRefsUpdated: number;
  generatedScheduleRefsUpdated: number;
  details: DuplicateShiftPatternCleanupDetail[];
}

async function runCleanupDuplicateShiftPatterns(): Promise<DuplicateShiftPatternCleanupResult> {
  return db.transaction(
    'rw',
    db.shiftPatterns,
    db.shiftRequests,
    db.generatedSchedules,
    async () => {
      const [allPatterns, allShiftRequests, allGeneratedSchedules] = await Promise.all([
        db.shiftPatterns.toArray().catch(() => []),
        db.shiftRequests.toArray().catch(() => []),
        db.generatedSchedules.toArray().catch(() => []),
      ]);

      const grouped = new Map<string, ShiftPattern[]>();

      for (const pattern of allPatterns) {
        const name = normalizePatternName(pattern?.name);
        if (!name) continue;

        const list = grouped.get(name) ?? [];
        list.push(pattern);
        grouped.set(name, list);
      }

      const result: DuplicateShiftPatternCleanupResult = {
        groupsMerged: 0,
        patternsDeleted: 0,
        shiftRequestRefsUpdated: 0,
        generatedScheduleRefsUpdated: 0,
        details: [],
      };

      for (const [name, group] of grouped.entries()) {
        if (group.length <= 1) continue;

        const canonical = chooseCanonicalPattern(group);
        const canonicalId = toPatternId(canonical.id);

        if (canonicalId === null) continue;

        const patch = buildCanonicalPatternPatch(canonical, group);
        if (Object.keys(patch).length > 0) {
          await db.shiftPatterns.update(canonicalId, patch as any);
        }

        const duplicates = group.filter(
          (pattern) => safeNumber(pattern.id, -1) !== canonicalId
        );

        if (duplicates.length === 0) continue;

        const removedIds: number[] = [];

        for (const duplicate of duplicates) {
          const duplicateId = toPatternId(duplicate.id);
          if (duplicateId === null || duplicateId === canonicalId) continue;

          for (const req of allShiftRequests as any[]) {
            if (String(req?.patternId ?? '') !== String(duplicateId)) continue;
            if (!isDefined(req?.id)) continue;

            await db.shiftRequests.update(req.id, {
              patternId: canonicalId,
              updatedAt: new Date(),
            } as any);

            result.shiftRequestRefsUpdated += 1;
          }

          for (const row of allGeneratedSchedules as any[]) {
            if (String(row?.patternId ?? '') !== String(duplicateId)) continue;
            if (!isDefined(row?.id)) continue;

            await db.generatedSchedules.update(row.id, {
              patternId: canonicalId,
              updatedAt: new Date(),
            } as any);

            result.generatedScheduleRefsUpdated += 1;
          }

          await db.shiftPatterns.delete(duplicateId);
          removedIds.push(duplicateId);
          result.patternsDeleted += 1;
        }

        if (removedIds.length > 0) {
          result.groupsMerged += 1;
          result.details.push({
            name,
            keptId: canonicalId,
            removedIds,
          });
        }
      }

      return result;
    }
  );
}

export async function cleanupDuplicateShiftPatterns(): Promise<DuplicateShiftPatternCleanupResult> {
  try {
    return await runCleanupDuplicateShiftPatterns();
  } catch (error) {
    console.error('[DB] cleanupDuplicateShiftPatterns エラー:', error);
    return {
      groupsMerged: 0,
      patternsDeleted: 0,
      shiftRequestRefsUpdated: 0,
      generatedScheduleRefsUpdated: 0,
      details: [],
    };
  }
}

let initializationPromise: Promise<void> | null = null;

async function runEnsureDefaultPatterns(): Promise<void> {
  try {
    const existingPatterns = await db.shiftPatterns.toArray().catch(() => []);

    const patternsByName = new Map<string, any>();
    for (const pattern of existingPatterns as any[]) {
      const name = normalizePatternName(pattern?.name);
      if (!name) continue;
      if (!patternsByName.has(name)) {
        patternsByName.set(name, pattern);
      }
    }

    for (const def of DEFAULT_PATTERNS) {
      const old = patternsByName.get(def.name);

      if (old) {
        if (
          old.startTime === undefined ||
          old.endTime === undefined ||
          old.color === undefined ||
          old.isNight === undefined ||
          old.isAke === undefined ||
          old.isVacation === undefined ||
          old.requiredStaff === undefined ||
          old.isWorkday === undefined ||
          old.shortName === undefined ||
          old.sortOrder === undefined
        ) {
          await db.shiftPatterns
            .update(old.id, {
              startTime: def.startTime,
              endTime: def.endTime,
              color: def.color,
              requiredStaff: def.requiredStaff,
              isNight: def.isNight,
              isAke: def.isAke,
              isVacation: def.isVacation,
              isWorkday: def.isWorkday,
              shortName: def.shortName,
              sortOrder: def.sortOrder,
              updatedAt: new Date(),
            })
            .catch((e) => console.warn(`[DB] パターン更新失敗 (${def.name}):`, e));

          console.log(`[DB] パターン更新: ${def.name}`);
        }

        continue;
      }

      try {
        const id = await db.shiftPatterns.add({
          ...def,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
        patternsByName.set(def.name, { id, ...def });
        console.log(`[DB] パターン追加: ${def.name}`);
      } catch (e) {
        console.warn(`[DB] パターン追加失敗 (${def.name}):`, e);
      }
    }

    const cleanupResult = await cleanupDuplicateShiftPatterns();
    if (cleanupResult.patternsDeleted > 0) {
      console.log('[DB] 重複勤務パターンを整理しました:', cleanupResult);
    }

    try {
      const allConstraints = await db.constraints.toArray().catch(() => []);

      if (allConstraints.length === 0) {
        await db.constraints.add({
          ...DEFAULT_CONSTRAINTS,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
        console.log('[DB] デフォルト制約を追加しました');
      } else {
        const latest = allConstraints[allConstraints.length - 1] as any;

        if (latest?.id != null) {
          await db.constraints.update(latest.id as number, {
            maxConsecutiveWorkDays:
              latest.maxConsecutiveWorkDays === undefined
                ? DEFAULT_CONSTRAINTS.maxConsecutiveWorkDays
                : latest.maxConsecutiveWorkDays,

            minRestDaysBetweenNights:
              latest.minRestDaysBetweenNights === undefined
                ? DEFAULT_CONSTRAINTS.minRestDaysBetweenNights
                : latest.minRestDaysBetweenNights,

            minWorkDaysPerMonth:
              latest.minWorkDaysPerMonth === undefined
                ? DEFAULT_CONSTRAINTS.minWorkDaysPerMonth
                : latest.minWorkDaysPerMonth,

            minRestDaysPerMonth:
              latest.minRestDaysPerMonth === undefined
                ? (
                    latest.exactRestDaysPerMonth ??
                    DEFAULT_CONSTRAINTS.minRestDaysPerMonth
                  )
                : latest.minRestDaysPerMonth,

            exactRestDaysPerMonth:
              latest.exactRestDaysPerMonth === undefined
                ? (
                    latest.minRestDaysPerMonth ??
                    DEFAULT_CONSTRAINTS.exactRestDaysPerMonth
                  )
                : latest.exactRestDaysPerMonth,

            restAfterAke:
              latest.restAfterAke === undefined
                ? DEFAULT_CONSTRAINTS.restAfterAke
                : latest.restAfterAke,

            maxNightShiftsPerMonth:
              latest.maxNightShiftsPerMonth === undefined
                ? DEFAULT_CONSTRAINTS.maxNightShiftsPerMonth
                : latest.maxNightShiftsPerMonth,

            preferMixedGenderNightShift:
              latest.preferMixedGenderNightShift === undefined
                ? DEFAULT_CONSTRAINTS.preferMixedGenderNightShift
                : latest.preferMixedGenderNightShift,

            sunHolidayDayStaffRequired:
              latest.sunHolidayDayStaffRequired === undefined
                ? DEFAULT_CONSTRAINTS.sunHolidayDayStaffRequired
                : latest.sunHolidayDayStaffRequired,

            updatedAt: new Date(),
          });

          console.log('[DB] 制約不足項目を補完しました');
        }
      }
    } catch (e) {
      console.warn('[DB] 制約追加失敗:', e);
    }

    const staffCnt = await db.staff.count().catch(() => 0);
    const patCnt = await db.shiftPatterns.count().catch(() => 0);
    const conCnt = await db.constraints.count().catch(() => 0);

    console.log(
      `[DB] スタッフ: ${staffCnt}名, パターン: ${patCnt}種類, 制約: ${conCnt}件`
    );
    console.log('[DB] データベース初期化完了');
  } catch (err) {
    console.error('[DB] ensureDefaultPatterns エラー:', err);
  }
}

export function ensureDefaultPatterns(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = runEnsureDefaultPatterns();
  }
  return initializationPromise;
}

export const initializeDatabase = ensureDefaultPatterns;
