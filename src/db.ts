import Dexie, { Table } from 'dexie';
import { Staff, Shift, ShiftPattern, ScheduleConstraints } from './types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff>;
  shifts!: Table<Shift>;
  shiftPatterns!: Table<ShiftPattern>;
  scheduleConstraints!: Table<ScheduleConstraints>;

  constructor() {
    super('NurseSchedulerDB');
    
    // バージョン1: 初期スキーマ（スタッフとシフト）
    this.version(1).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
    });

    // バージョン2: 勤務パターンテーブルを追加（Phase 3-1）
    this.version(2).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: 'id, name, shortName, sortOrder, createdAt',
    });

    // バージョン3: 制約条件テーブルを追加（Phase 3-2）
    this.version(3).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
      shiftPatterns: 'id, name, shortName, sortOrder, createdAt',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
    });
  }
}

export const db = new NurseSchedulerDB();

/**
 * デフォルト勤務パターンを初期化
 * Phase 3-1で実装
 */
export async function initializeDefaultShiftPatterns() {
  const existingPatterns = await db.shiftPatterns.toArray();
  
  if (existingPatterns.length > 0) {
    console.log('勤務パターンは既に初期化されています');
    return;
  }

  const defaultPatterns: ShiftPattern[] = [
    {
      id: crypto.randomUUID(),
      name: '日勤',
      shortName: '日',
      startTime: '08:30',
      endTime: '17:00',
      requiredStaff: 5,
      color: '#3B82F6',
      isWorkday: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '早番',
      shortName: '早',
      startTime: '07:00',
      endTime: '15:30',
      requiredStaff: 3,
      color: '#10B981',
      isWorkday: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '遅番',
      shortName: '遅',
      startTime: '13:00',
      endTime: '21:30',
      requiredStaff: 3,
      color: '#F59E0B',
      isWorkday: true,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '夜勤',
      shortName: '夜',
      startTime: '21:00',
      endTime: '09:00',
      requiredStaff: 2,
      color: '#8B5CF6',
      isWorkday: true,
      sortOrder: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '休み',
      shortName: '休',
      startTime: '',
      endTime: '',
      requiredStaff: 0,
      color: '#6B7280',
      isWorkday: false,
      sortOrder: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  try {
    await db.shiftPatterns.bulkAdd(defaultPatterns);
    console.log('デフォルト勤務パターンを初期化しました');
  } catch (error) {
    console.error('勤務パターンの初期化に失敗しました:', error);
  }
}

/**
 * デフォルト制約条件を初期化
 * Phase 3-2で実装
 */
export async function initializeDefaultConstraints() {
  const existingConstraints = await db.scheduleConstraints.toArray();
  
  if (existingConstraints.length > 0) {
    console.log('制約条件は既に初期化されています');
    return;
  }

  const defaultConstraints: ScheduleConstraints[] = [
    {
      id: crypto.randomUUID(),
      name: '標準制約（常勤看護師）',
      description: '正看護師・准看護師の標準的な勤務制約条件',
      
      // 連続勤務制約
      maxConsecutiveWorkDays: 5,           // 最大5日連続勤務
      maxConsecutiveNightShifts: 2,        // 最大2日連続夜勤
      
      // 休日制約
      minRestDaysPerWeek: 2,               // 週2日以上の休み
      minRestDaysPerMonth: 8,              // 月8日以上の休み
      
      // 夜勤制約
      maxNightShiftsPerWeek: 2,            // 週2回まで夜勤
      maxNightShiftsPerMonth: 8,           // 月8回まで夜勤
      
      // 勤務時間制約
      maxWorkHoursPerWeek: 40,             // 週40時間まで
      maxWorkHoursPerMonth: 160,           // 月160時間まで
      
      isActive: true,
      priority: 10,                        // 最高優先度
      
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '非常勤・パート制約',
      description: '非常勤・パートスタッフの勤務制約条件',
      
      // 連続勤務制約
      maxConsecutiveWorkDays: 3,           // 最大3日連続勤務
      maxConsecutiveNightShifts: 1,        // 最大1日夜勤
      
      // 休日制約
      minRestDaysPerWeek: 3,               // 週3日以上の休み
      minRestDaysPerMonth: 12,             // 月12日以上の休み
      
      // 夜勤制約
      maxNightShiftsPerWeek: 1,            // 週1回まで夜勤
      maxNightShiftsPerMonth: 4,           // 月4回まで夜勤
      
      // 勤務時間制約
      maxWorkHoursPerWeek: 20,             // 週20時間まで
      maxWorkHoursPerMonth: 80,            // 月80時間まで
      
      isActive: true,
      priority: 8,
      
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: '妊娠中スタッフ制約',
      description: '妊娠中のスタッフ向けの軽減された勤務制約',
      
      // 連続勤務制約
      maxConsecutiveWorkDays: 3,           // 最大3日連続勤務
      maxConsecutiveNightShifts: 0,        // 夜勤なし
      
      // 休日制約
      minRestDaysPerWeek: 2,               // 週2日以上の休み
      minRestDaysPerMonth: 10,             // 月10日以上の休み
      
      // 夜勤制約
      maxNightShiftsPerWeek: 0,            // 夜勤なし
      maxNightShiftsPerMonth: 0,           // 夜勤なし
      
      // 勤務時間制約
      maxWorkHoursPerWeek: 30,             // 週30時間まで
      maxWorkHoursPerMonth: 120,           // 月120時間まで
      
      isActive: false,                     // デフォルトは無効
      priority: 9,
      
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  try {
    await db.scheduleConstraints.bulkAdd(defaultConstraints);
    console.log('デフォルト制約条件を初期化しました');
  } catch (error) {
    console.error('制約条件の初期化に失敗しました:', error);
  }
}

/**
 * データベース全体を初期化
 */
export async function initializeDatabase() {
  try {
    await initializeDefaultShiftPatterns();
    await initializeDefaultConstraints();
    console.log('データベースの初期化が完了しました');
  } catch (error) {
    console.error('データベースの初期化に失敗しました:', error);
  }
}

/**
 * データベースのリセット（開発用）
 */
export async function resetDatabase() {
  try {
    await db.delete();
    console.log('データベースを削除しました');
    
    // 再作成
    const newDb = new NurseSchedulerDB();
    await initializeDatabase();
    console.log('データベースを再作成しました');
  } catch (error) {
    console.error('データベースのリセットに失敗しました:', error);
  }
}


    await db.shiftPatterns.bulkAdd(defaultPatterns);
    console.log('Default shift patterns initialized');
  }
}
