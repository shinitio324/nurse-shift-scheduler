// src/db/index.ts
import Dexie, { Table } from 'dexie';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
} from '../types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff, number>;
  shiftPatterns!: Table<ShiftPattern, number>;
  shiftRequests!: Table<ShiftRequest, number>;
  constraints!: Table<ScheduleConstraints, number>;
  generatedSchedules!: Table<GeneratedShift, number>;

  constructor() {
    super('NurseSchedulerDB');

    // ⚠️ version(1) は既存ユーザーのために残す
    this.version(1).stores({
      staff:              '++id, name, role',
      shiftPatterns:      '++id, name',
      shiftRequests:      '++id, staffId, date, patternId',
      generatedSchedules: '++id, staffId, date, patternId',
    });

    // ✅ version(2) で constraints テーブルを追加
    this.version(2).stores({
      staff:              '++id, name, role',
      shiftPatterns:      '++id, name',
      shiftRequests:      '++id, staffId, date, patternId',
      constraints:        '++id',
      generatedSchedules: '++id, staffId, date, patternId',
    });
  }
}

export const db = new NurseSchedulerDB();

export async function ensureDefaultPatterns(): Promise<void> {
  try {
    // --- シフトパターン ---
    const existing = await db.shiftPatterns.toArray();
    const names = existing.map(p => p.name);
    const defaults: Omit<ShiftPattern, 'id'>[] = [];

    if (!names.includes('日勤')) {
      defaults.push({
        name: '日勤', startTime: '09:00', endTime: '17:00',
        color: '#bfdbfe', isAke: false, isVacation: false, isNight: false, requiredStaff: 2,
      });
    }
    if (!names.includes('夜勤')) {
      defaults.push({
        name: '夜勤', startTime: '17:00', endTime: '09:00',
        color: '#c4b5fd', isAke: false, isVacation: false, isNight: true, requiredStaff: 1,
      });
    }
    if (!names.includes('明け')) {
      defaults.push({
        name: '明け', startTime: '00:00', endTime: '00:00',
        color: '#93c5fd', isAke: true, isVacation: false, isNight: false, requiredStaff: 0,
      });
    }
    if (!names.includes('有給')) {
      defaults.push({
        name: '有給', startTime: '00:00', endTime: '00:00',
        color: '#86efac', isAke: false, isVacation: true, isNight: false, requiredStaff: 0,
      });
    }
    if (!names.includes('休み')) {
      defaults.push({
        name: '休み', startTime: '00:00', endTime: '00:00',
        color: '#d1d5db', isAke: false, isVacation: false, isNight: false, requiredStaff: 0,
      });
    }
    if (defaults.length > 0) {
      await db.shiftPatterns.bulkAdd(defaults as ShiftPattern[]);
      console.log(`[DB] デフォルトパターン ${defaults.length}件 追加`);
    } else {
      console.log('[DB] 勤務パターンは既に初期化されています');
    }

    // --- 制約 ---
    const constraintCount = await db.constraints.count();
    if (constraintCount === 0) {
      await db.constraints.add({
        maxConsecutiveWorkDays: 5,
        minRestDaysBetweenNights: 1,
        minWorkDaysPerMonth: 20,
        exactRestDaysPerMonth: 8,
      } as ScheduleConstraints);
      console.log('[DB] デフォルト制約を追加しました');
    } else {
      console.log('[DB] 制約条件は既に初期化されています');
    }

    const staffCount = await db.staff.count();
    console.log(`[DB] スタッフを読み込みました: ${staffCount} 名`);
    console.log('[DB] データベースの初期化が完了しました');

  } catch (err) {
    console.error('[DB] ensureDefaultPatterns エラー:', err);
  }
}
