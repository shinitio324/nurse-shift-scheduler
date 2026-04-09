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

    // v7: canWorkNightShift を追加（日勤専従対応）
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

// ── デフォルトパターン ───────────────────────────────────────
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
// 重要:
// - 月別公休日数は scheduleAlgorithm.ts 側の
//   getRequiredRestDaysForMonth() で固定管理する
// - そのため minRestDaysPerMonth / exactRestDaysPerMonth は
//   互換維持用として残す（旧UI/旧データとの整合用）
// - 実際の公休判定は「休み」パターンのみを対象とし、有休・明けは含めない
export const DEFAULT_CONSTRAINTS: Omit<ScheduleConstraints, 'id'> = {
  maxConsecutiveWorkDays: 5,
  minRestDaysBetweenNights: 1,
  minWorkDaysPerMonth: 20,

  // 互換維持用: 生成本体は scheduleAlgorithm.ts の月別固定値を使用
  minRestDaysPerMonth: 9,
  exactRestDaysPerMonth: 9,

  restAfterAke: true,
  maxNightShiftsPerMonth: 8,
  preferMixedGenderNightShift: true,
  sunHolidayDayStaffRequired: 3,
};

// ── 初期補完 ────────────────────────────────────────────────
export async function ensureDefaultPatterns(): Promise<void> {
  try {
    // shiftPatterns 補完
    const existingPatterns = await db.shiftPatterns.toArray().catch(() => []);
    const patternNameSet = new Set(existingPatterns.map((p: any) => p.name));

    for (const def of DEFAULT_PATTERNS) {
      if (patternNameSet.has(def.name)) {
        const old = existingPatterns.find((p: any) => p.name === def.name);

        if (
          old &&
          (
            old.isNight === undefined ||
            old.isAke === undefined ||
            old.isVacation === undefined ||
            old.requiredStaff === undefined ||
            old.isWorkday === undefined ||
            old.shortName === undefined ||
            old.sortOrder === undefined
          )
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
            })
            .catch((e) => console.warn(`[DB] パターン更新失敗 (${def.name}):`, e));

          console.log(`[DB] パターン更新: ${def.name}`);
        }

        continue;
      }

      try {
        await db.shiftPatterns.add(def as any);
        console.log(`[DB] パターン追加: ${def.name}`);
      } catch (e) {
        console.warn(`[DB] パターン追加失敗 (${def.name}):`, e);
      }
    }

    // constraints 補完
    try {
      const allConstraints = await db.constraints.toArray().catch(() => []);

      if (allConstraints.length === 0) {
        await db.constraints.add(DEFAULT_CONSTRAINTS as any);
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

            // 互換維持用:
            // 実際の月別公休数は scheduleAlgorithm.ts 側で固定管理
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

export const initializeDatabase = ensureDefaultPatterns;
