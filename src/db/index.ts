// src/db/index.ts
import Dexie, { Table } from 'dexie';
import { Staff, Shift, ShiftPattern, ShiftRequest, ScheduleConstraints } from '../types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff>;
  shifts!: Table<Shift>;
  shiftPatterns!: Table<ShiftPattern>;
  shiftRequests!: Table<ShiftRequest>;
  scheduleConstraints!: Table<ScheduleConstraints>;

  constructor() {
    super('NurseSchedulerDB');

    // ─── v1 ───
    this.version(1).stores({
      staff:               '&id, name, position, employmentType',
      shifts:              '&id, staffId, date, shiftType',
      shiftPatterns:       '&id, name',
      shiftRequests:       '&id, staffId, date',
      scheduleConstraints: '&id, isActive, priority',
    });

    // ─── v2 ─── nightShiftNextDayOff 追加
    this.version(2).stores({
      staff:               '&id, name, position, employmentType',
      shifts:              '&id, staffId, date, shiftType',
      shiftPatterns:       '&id, name',
      shiftRequests:       '&id, staffId, date',
      scheduleConstraints: '&id, isActive, priority',
    }).upgrade(tx => {
      return tx.table('scheduleConstraints').toCollection().modify((rec: ScheduleConstraints) => {
        if (rec.nightShiftNextDayOff === undefined) rec.nightShiftNextDayOff = false;
      });
    });

    // ─── v3 ─── exactRestDaysPerMonth 追加 / ShiftPattern に isAke・isVacation 追加
    this.version(3).stores({
      staff:               '&id, name, position, employmentType',
      shifts:              '&id, staffId, date, shiftType',
      shiftPatterns:       '&id, name',
      shiftRequests:       '&id, staffId, date',
      scheduleConstraints: '&id, isActive, priority',
    }).upgrade(tx => {
      // 制約条件に exactRestDaysPerMonth = 0（無効）を補完
      tx.table('scheduleConstraints').toCollection().modify((rec: ScheduleConstraints) => {
        if (rec.exactRestDaysPerMonth === undefined) rec.exactRestDaysPerMonth = 0;
      });
      // シフトパターンに isAke / isVacation を補完
      tx.table('shiftPatterns').toCollection().modify((rec: ShiftPattern) => {
        if (rec.isAke === undefined) rec.isAke = false;
        if (rec.isVacation === undefined) rec.isVacation = false;
        // 既存「明け」パターンを自動識別（名前に「明」が含まれる）
        if (rec.name.includes('明') && !rec.isWorkday) rec.isAke = true;
        // 既存「有給」パターンを自動識別
        if ((rec.name.includes('有給') || rec.name.includes('年休')) && !rec.isWorkday) {
          rec.isVacation = true;
        }
      });
      return Promise.resolve();
    });
  }
}

export const db = new NurseSchedulerDB();

// ================================================================
// アプリ起動時に「明け」「有給」パターンが存在しなければ自動作成
// ================================================================
export async function ensureDefaultPatterns(): Promise<void> {
  const patterns = await db.shiftPatterns.toArray();

  const hasAke      = patterns.some(p => p.isAke || p.name === '明け');
  const hasVacation = patterns.some(p => p.isVacation || p.name === '有給');

  const toAdd: ShiftPattern[] = [];

  if (!hasAke) {
    toAdd.push({
      id: crypto.randomUUID(),
      name: '明け',
      shortName: '明',
      color: '#8B5CF6',   // 紫
      isWorkday: false,
      isAke: true,
      isVacation: false,
      requiredStaff: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ 「明け」パターンを自動作成しました');
  }

  if (!hasVacation) {
    toAdd.push({
      id: crypto.randomUUID(),
      name: '有給',
      shortName: '有',
      color: '#10B981',   // 緑
      isWorkday: false,
      isAke: false,
      isVacation: true,
      requiredStaff: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ 「有給」パターンを自動作成しました');
  }

  if (toAdd.length > 0) {
    await db.shiftPatterns.bulkAdd(toAdd);
  }
}
