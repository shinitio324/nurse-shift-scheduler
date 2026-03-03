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

    // ─── v1 ─── 初期スキーマ
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

    // ─── v3 ─── exactRestDaysPerMonth / isAke / isVacation 追加
    this.version(3).stores({
      staff:               '&id, name, position, employmentType',
      shifts:              '&id, staffId, date, shiftType',
      shiftPatterns:       '&id, name',
      shiftRequests:       '&id, staffId, date',
      scheduleConstraints: '&id, isActive, priority',
    }).upgrade(tx => {
      tx.table('scheduleConstraints').toCollection().modify((rec: ScheduleConstraints) => {
        if (rec.exactRestDaysPerMonth === undefined) rec.exactRestDaysPerMonth = 0;
      });
      tx.table('shiftPatterns').toCollection().modify((rec: ShiftPattern) => {
        if (rec.isAke === undefined) rec.isAke = false;
        if (rec.isVacation === undefined) rec.isVacation = false;
        if (rec.name.includes('明') && !rec.isWorkday) rec.isAke = true;
        if ((rec.name.includes('有給') || rec.name.includes('年休')) && !rec.isWorkday) {
          rec.isVacation = true;
        }
      });
      return Promise.resolve();
    });

    // ─── v4 ─── Staff に minWorkDaysPerMonth / qualifications を追加 ★NEW
    this.version(4).stores({
      staff:               '&id, name, position, employmentType',
      shifts:              '&id, staffId, date, shiftType',
      shiftPatterns:       '&id, name',
      shiftRequests:       '&id, staffId, date',
      scheduleConstraints: '&id, isActive, priority',
    }).upgrade(tx => {
      return tx.table('staff').toCollection().modify((rec: Staff) => {
        // 既存レコードに minWorkDaysPerMonth = 0（制約なし）を補完
        if (rec.minWorkDaysPerMonth === undefined) rec.minWorkDaysPerMonth = 0;
        // qualifications が未定義の場合は空配列を補完
        if (!Array.isArray(rec.qualifications)) rec.qualifications = [];
      });
    });
  }
}

export const db = new NurseSchedulerDB();

// ================================================================
// 起動時に「明け」「有給」パターンが未登録なら自動作成
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
      color: '#8B5CF6',
      isWorkday: false,
      isAke: true,
      isVacation: false,
      requiredStaff: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  if (!hasVacation) {
    toAdd.push({
      id: crypto.randomUUID(),
      name: '有給',
      shortName: '有',
      color: '#10B981',
      isWorkday: false,
      isAke: false,
      isVacation: true,
      requiredStaff: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  if (toAdd.length > 0) {
    await db.shiftPatterns.bulkAdd(toAdd);
    console.log('✅ デフォルトパターンを追加しました:', toAdd.map(p => p.name));
  }
}
