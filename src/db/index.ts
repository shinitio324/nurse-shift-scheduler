// src/db/index.ts
import Dexie, { Table } from 'dexie';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  ScheduleConstraintRule,
  GeneratedShift,
} from '../types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff, number>;
  shiftPatterns!: Table<ShiftPattern, number>;
  shiftRequests!: Table<ShiftRequest, number>;
  constraints!: Table<ScheduleConstraints, number>;
  scheduleConstraints!: Table<ScheduleConstraintRule, string>;
  generatedSchedules!: Table<GeneratedShift, number>;

  constructor() {
    super('NurseSchedulerDB');

    this.version(1).stores({
      staff:              '++id, name, role',
      shiftPatterns:      '++id, name',
      shiftRequests:      '++id, staffId, date, patternId',
      generatedSchedules: '++id, staffId, date, patternId',
    });

    this.version(2).stores({
      staff:              '++id, name, role',
      shiftPatterns:      '++id, name',
      shiftRequests:      '++id, staffId, date, patternId',
      constraints:        '++id',
      generatedSchedules: '++id, staffId, date, patternId',
    });

    this.version(3).stores({
      staff:               '++id, name, role',
      shiftPatterns:       '++id, name',
      shiftRequests:       '++id, staffId, date, patternId',
      constraints:         '++id',
      scheduleConstraints: 'id, name, isActive, priority',
      generatedSchedules:  '++id, staffId, date, patternId',
    });

    // version(4): 既存データを保持しつつshiftPatternsのIDを正規化
    this.version(4).stores({
      staff:               '++id, name, role',
      shiftPatterns:       '++id, name',
      shiftRequests:       '++id, staffId, date, patternId',
      constraints:         '++id',
      scheduleConstraints: 'id, name, isActive, priority',
      generatedSchedules:  '++id, staffId, date, patternId',
    });
  }
}

export const db = new NurseSchedulerDB();

/** デフォルトパターン定義（インメモリ用） */
export const DEFAULT_PATTERNS: Omit<ShiftPattern, 'id'>[] = [
  { name: '日勤', startTime: '09:00', endTime: '17:00', color: '#bfdbfe', isAke: false, isVacation: false, isNight: false, requiredStaff: 2 },
  { name: '夜勤', startTime: '17:00', endTime: '09:00', color: '#c4b5fd', isAke: false, isVacation: false, isNight: true,  requiredStaff: 1 },
  { name: '明け', startTime: '00:00', endTime: '00:00', color: '#93c5fd', isAke: true,  isVacation: false, isNight: false, requiredStaff: 0 },
  { name: '有給', startTime: '00:00', endTime: '00:00', color: '#86efac', isAke: false, isVacation: true,  isNight: false, requiredStaff: 0 },
  { name: '休み', startTime: '00:00', endTime: '00:00', color: '#d1d5db', isAke: false, isVacation: false, isNight: false, requiredStaff: 0 },
];

export async function ensureDefaultPatterns(): Promise<void> {
  try {
    // ─── シフトパターン（個別addで確実に登録）───
    const existing = await db.shiftPatterns.toArray();
    const nameSet  = new Set(existing.map(p => p.name));

    for (const def of DEFAULT_PATTERNS) {
      if (nameSet.has(def.name)) continue;
      try {
        await db.shiftPatterns.add(def as ShiftPattern);
        console.log(`[DB] パターン追加: ${def.name}`);
      } catch (e) {
        console.warn(`[DB] パターン追加失敗 (${def.name}):`, e);
      }
    }

    // ─── シンプル制約 ───
    try {
      const constraintCount = await db.constraints.count();
      if (constraintCount === 0) {
        await db.constraints.add({
          maxConsecutiveWorkDays: 5,
          minRestDaysBetweenNights: 1,
          minWorkDaysPerMonth: 20,
          exactRestDaysPerMonth: 8,
        } as ScheduleConstraints);
        console.log('[DB] デフォルト制約を追加しました');
      }
    } catch (e) {
      console.warn('[DB] 制約追加失敗:', e);
    }

    const staffCount = await db.staff.count();
    const patCount   = await db.shiftPatterns.count();
    console.log(`[DB] スタッフを読み込みました: ${staffCount} 名`);
    console.log(`[DB] 読み込み成功: ${patCount} 種類`);
    console.log('[DB] データベースの初期化が完了しました');

  } catch (err) {
    console.error('[DB] ensureDefaultPatterns エラー:', err);
  }
}
