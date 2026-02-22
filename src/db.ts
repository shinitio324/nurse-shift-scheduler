import Dexie, { Table } from 'dexie';
import { Staff, ShiftPattern, StaffShift, ShiftRequest } from './types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff>;
  shiftPatterns!: Table<ShiftPattern>;
  staffShifts!: Table<StaffShift>;
  shiftRequests!: Table<ShiftRequest>;

  constructor() {
    super('NurseSchedulerDB');
    
    // バージョン1: 初期テーブル
    this.version(1).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt'
    });

    // バージョン2: 新しいテーブルを追加
    this.version(2).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shiftPatterns: 'id, name, sortOrder, isWorkday, createdAt',
      staffShifts: 'id, staffId, date, shiftPatternId, createdAt',
      shiftRequests: 'id, staffId, date, requestedShiftPatternId, status, createdAt'
    }).upgrade(async (trans) => {
      // 既存の shifts テーブルからデータを移行（存在する場合）
      // 新規インストールの場合は何もしない
    });
  }
}

export const db = new NurseSchedulerDB();

// デフォルトのシフトパターンを初期化
export async function initializeDefaultShiftPatterns() {
  const count = await db.shiftPatterns.count();
  
  if (count === 0) {
    // デフォルトのシフトパターンを作成
    const defaultPatterns: ShiftPattern[] = [
      {
        id: crypto.randomUUID(),
        name: '日勤',
        shortName: '日',
        startTime: '08:30',
        endTime: '17:00',
        requiredStaff: 5,
        color: '#3B82F6', // 青
        isWorkday: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        name: '早番',
        shortName: '早',
        startTime: '07:00',
        endTime: '15:30',
        requiredStaff: 3,
        color: '#10B981', // 緑
        isWorkday: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        name: '遅番',
        shortName: '遅',
        startTime: '13:00',
        endTime: '21:30',
        requiredStaff: 3,
        color: '#F59E0B', // 黄
        isWorkday: true,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        name: '夜勤',
        shortName: '夜',
        startTime: '21:00',
        endTime: '09:00',
        requiredStaff: 2,
        color: '#8B5CF6', // 紫
        isWorkday: true,
        sortOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        name: '休み',
        shortName: '休',
        startTime: '',
        endTime: '',
        requiredStaff: 0,
        color: '#6B7280', // 灰色
        isWorkday: false,
        sortOrder: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await db.shiftPatterns.bulkAdd(defaultPatterns);
    console.log('Default shift patterns initialized');
  }
}
