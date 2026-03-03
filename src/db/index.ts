// =============================================================
// src/db/index.ts  ── 完全版 (Dexie v4)
// =============================================================

import Dexie, { type Table } from 'dexie';
import type {
  Staff, ShiftPattern, ShiftRequest,
  ScheduleConstraints, GeneratedSchedule,
} from '../types';

export class NurseShiftDB extends Dexie {
  staff!: Table<Staff, number>;
  shiftPatterns!: Table<ShiftPattern, number>;
  shiftRequests!: Table<ShiftRequest, number>;
  scheduleConstraints!: Table<ScheduleConstraints, number>;
  generatedSchedules!: Table<GeneratedSchedule, number>;

  constructor() {
    super('nurse-shift-db');

    this.version(1).stores({
      staff:               '++id, name, position, employmentType',
      shiftPatterns:       '++id, name',
      shiftRequests:       '++id, staffId, date, shiftType',
      scheduleConstraints: '++id, name, isActive',
      generatedSchedules:  '++id, staffId, date, shiftType',
    });

    this.version(2)
      .stores({
        staff:               '++id, name, position, employmentType',
        shiftPatterns:       '++id, name',
        shiftRequests:       '++id, staffId, date, shiftType',
        scheduleConstraints: '++id, name, isActive',
        generatedSchedules:  '++id, staffId, date, shiftType',
      })
      .upgrade(tx =>
        tx.table('scheduleConstraints').toCollection().modify((rec: ScheduleConstraints) => {
          if (rec.nightShiftNextDayOff === undefined) rec.nightShiftNextDayOff = false;
        }),
      );

    this.version(3)
      .stores({
        staff:               '++id, name, position, employmentType',
        shiftPatterns:       '++id, name',
        shiftRequests:       '++id, staffId, date, shiftType',
        scheduleConstraints: '++id, name, isActive',
        generatedSchedules:  '++id, staffId, date, shiftType',
      })
      .upgrade(tx => {
        tx.table('shiftPatterns').toCollection().modify((rec: ShiftPattern) => {
          if (rec.isAke      === undefined) rec.isAke      = false;
          if (rec.isVacation === undefined) rec.isVacation = false;
          if (rec.isNight    === undefined) rec.isNight    = false;
        });
        tx.table('scheduleConstraints').toCollection().modify((rec: ScheduleConstraints) => {
          if (rec.exactRestDaysPerMonth     === undefined) rec.exactRestDaysPerMonth     = 0;
          if (rec.maxNightShiftsPerWeek     === undefined) rec.maxNightShiftsPerWeek     = 0;
          if (rec.maxConsecutiveNightShifts === undefined) rec.maxConsecutiveNightShifts = 0;
          if (rec.maxWorkHoursPerWeek       === undefined) rec.maxWorkHoursPerWeek       = 0;
          if (rec.maxWorkHoursPerMonth      === undefined) rec.maxWorkHoursPerMonth      = 0;
        });
      });

    this.version(4)
      .stores({
        staff:               '++id, name, position, employmentType',
        shiftPatterns:       '++id, name',
        shiftRequests:       '++id, staffId, date, shiftType',
        scheduleConstraints: '++id, name, isActive',
        generatedSchedules:  '++id, staffId, date, shiftType',
      })
      .upgrade(tx =>
        tx.table('staff').toCollection().modify((rec: Staff) => {
          if (rec.minWorkDaysPerMonth === undefined) rec.minWorkDaysPerMonth = 0;
          if (!Array.isArray(rec.qualifications))    rec.qualifications      = [];
        }),
      );
  }
}

export const db = new NurseShiftDB();

export async function ensureDefaultPatterns(): Promise<void> {
  try {
    const patterns = await db.shiftPatterns.toArray();
    const now = new Date().toISOString();

    const hasAke      = patterns.some(p => p.isAke      === true || p.name === '明け');
    const hasVacation = patterns.some(p => p.isVacation === true || p.name === '有給');
    const hasRest     = patterns.some(p => p.name === '休み' && !p.isAke && !p.isVacation);

    if (!hasAke) {
      await db.shiftPatterns.add({
        name: '明け', startTime: '00:00', endTime: '00:00',
        color: '#9C27B0', isAke: true, isVacation: false, isNight: false,
        createdAt: now, updatedAt: now,
      });
      console.log('✅ 明けパターンを作成しました');
    }
    if (!hasVacation) {
      await db.shiftPatterns.add({
        name: '有給', startTime: '00:00', endTime: '00:00',
        color: '#4CAF50', isAke: false, isVacation: true, isNight: false,
        createdAt: now, updatedAt: now,
      });
      console.log('✅ 有給パターンを作成しました');
    }
    if (!hasRest) {
      await db.shiftPatterns.add({
        name: '休み', startTime: '00:00', endTime: '00:00',
        color: '#9E9E9E', isAke: false, isVacation: false, isNight: false,
        createdAt: now, updatedAt: now,
      });
      console.log('✅ 休みパターンを作成しました');
    }
  } catch (e) {
    console.error('ensureDefaultPatterns エラー:', e);
  }
}
