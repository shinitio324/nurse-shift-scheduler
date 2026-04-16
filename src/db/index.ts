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

    // v7:
    // - gender を夜勤男女ペア判定で使用
    // - canWorkNightShift を日勤専従判定で使用
    // - maxNightShiftsPerMonth を個別夜勤上限で使用
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
//
// scheduleAlgorithm.ts と完全整合させるため、以下の5パターンを前提にする
// - 日勤
// - 夜勤
// - 明け
// - 有給
// - 休み
//
// 重要:
// - 「休み」だけが公休カウント対象
// - 「有給」「明け」は公休数に含めない
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
//
// scheduleAlgorithm.ts が実際に参照する制約だけを定義する。
//
// 優先順位の考え方:
// 1. 夜勤回数上限（個別 / 全体）
// 2. 連続勤務上限
// 3. そのうえで男女ペア夜勤は最終タイブレーク
//
// 重要:
// - minRestDaysPerMonth / exactRestDaysPerMonth は DB 互換維持用として残す
// - 実際の月別公休日数は scheduleAlgorithm.ts 側の
//   getRequiredRestDaysForMonth() に固定実装する
// - 公休として数えるのは「休み」パターンのみ
// - 「有給」「明け」は公休数に含めない
export const DEFAULT_CONSTRAINTS: Omit<ScheduleConstraints, 'id'> = {
  // 最大連続勤務日数
  maxConsecutiveWorkDays: 5,

  // 夜勤から次の夜勤まで最低何日あけるか
  minRestDaysBetweenNights: 1,

  // 最低勤務日数（個別 minWorkDaysPerMonth があればそちらを優先）
  minWorkDaysPerMonth: 20,

  // 互換維持用:
  // 公休の本体判定は scheduleAlgorithm.ts 側の月別固定値を使用
  minRestDaysPerMonth: 9,
  exactRestDaysPerMonth: 9,

  // 明け翌日を自動で休みにする
  restAfterAke: true,

  // 全体夜勤上限（個別 maxNightShiftsPerMonth があればそちらを優先）
  maxNightShiftsPerMonth: 8,

  // 男女ペア夜勤の希望
  // ただし scheduleAlgorithm.ts 側では
  // 夜勤回数上限・連続勤務上限を優先し、
  // この項目は最終タイブレーク扱い
  preferMixedGenderNightShift: true,

  // 日曜・祝日の日勤必要人数
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
            // 実際の公休日数は scheduleAlgorithm.ts 側の
            // getRequiredRestDaysForMonth() を使う
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
