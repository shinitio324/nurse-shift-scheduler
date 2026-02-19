import Dexie, { Table } from 'dexie';
import { Staff, Shift } from './types';

export class NurseSchedulerDB extends Dexie {
  staff!: Table<Staff>;
  shifts!: Table<Shift>;

  constructor() {
    super('NurseSchedulerDB');
    this.version(1).stores({
      staff: 'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt'
    });
  }
}

export const db = new NurseSchedulerDB();
