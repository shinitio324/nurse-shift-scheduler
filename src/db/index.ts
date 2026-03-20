// src/db/index.ts
import Dexie, { type Table } from 'dexie';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
} from '../types';

// ── DB クラス ─────────────────────────────────────────────────
export class NurseSchedulerDB extends Dexie {
  // ▼ スケジュール生成用テーブル（v4 自動採番 ID）
  shiftPatterns!:      Table<ShiftPattern,       number>;
  shiftRequests!:      Table<ShiftRequest,        number>;
  constraints!:        Table<ScheduleConstraints, number>;
  generatedSchedules!: Table<GeneratedShift,      number>;

  // ▼ 既存テーブル（旧UUID文字列ID・互換性保持）
  staff!:               Table<any, any>;
  shifts!:              Table<any, any>;
  scheduleConstraints!: Table<any, any>;

  constructor() {
    super('NurseSchedulerDB');

    // v1〜v3: 元の src/db.ts と完全一致（既存データ保護）
    this.version(1).stores({
      staff:  'id, name, position, employmentType, createdAt',
      shifts: 'id, staffId, date, shiftType, createdAt',
    });
    this.version(2).stores({
      staff:         'id, name, position, employmentType, createdAt',
      shifts:        'id, staffId, date, shiftType, createdAt',
      shiftPatterns: 'id, name, shortName, sortOrder, createdAt',
    });
    this.version(3).stores({
      staff:               'id, name, position, employmentType, createdAt',
      shifts:              'id, staffId, date, shiftType, createdAt',
      shiftPatterns:       'id, name, shortName, sortOrder, createdAt',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
    });

    // v4: shiftPatterns を ++id（自動採番）に変更 → 旧データ自動クリア
    //     shiftRequests / constraints / generatedSchedules 追加
    this.version(4).stores({
      staff:               'id, name, position, employmentType, createdAt',
      shifts:              'id, staffId, date, shiftType, createdAt',
      shiftPatterns:       '++id, name',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests:       '++id, staffId, date, patternId',
      constraints:         '++id',
      generatedSchedules:  '++id, staffId, date, patternId',
    }).upgrade(trans => {
      return (trans as any)
        .table('shiftPatterns')
        .clear()
        .catch(() => {
          console.warn('[DB] v4 upgrade: shiftPatterns.clear() スキップ');
        });
    });

    // v5: staff テーブルに minWorkDaysPerMonth インデックスを追加
    this.version(5).stores({
      staff:               'id, name, position, employmentType, minWorkDaysPerMonth, createdAt',
      shifts:              'id, staffId, date, shiftType, createdAt',
      shiftPatterns:       '++id, name',
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests:       '++id, staffId, date, patternId',
      constraints:         '++id',
      generatedSchedules:  '++id, staffId, date, patternId',
    });
  }
}

// ── シングルトンインスタンス ──────────────────────────────────
export const db = new NurseSchedulerDB();

// ── デフォルトパターン定義 ────────────────────────────────────
export const DEFAULT_PATTERNS = [
  {
    name: '日勤', startTime: '08:30', endTime: '17:00',
    color: '#bfdbfe', isNight: false, isAke: false, isVacation: false,
    requiredStaff: 5, isWorkday: true, shortName: '日', sortOrder: 1,
  },
  {
    name: '夜勤', startTime: '16:30', endTime: '09:00',
    color: '#c4b5fd', isNight: true,  isAke: false, isVacation: false,
    requiredStaff: 2, isWorkday: true, shortName: '夜', sortOrder: 2,
  },
  {
    name: '明け', startTime: '00:00', endTime: '00:00',
    color: '#93c5fd', isNight: false, isAke: true,  isVacation: false,
    requiredStaff: 0, isWorkday: false, shortName: '明', sortOrder: 3,
  },
  {
    name: '有給', startTime: '00:00', endTime: '00:00',
    color: '#86efac', isNight: false, isAke: false, isVacation: true,
    requiredStaff: 0, isWorkday: false, shortName: '有', sortOrder: 4,
  },
  {
    name: '休み', startTime: '00:00', endTime: '00:00',
    color: '#d1d5db', isNight: false, isAke: false, isVacation: false,
    requiredStaff: 0, isWorkday: false, shortName: '休', sortOrder: 5,
  },
] as const;

// ── 起動時パターン／制約の初期補完 ────────────────────────────
export async function ensureDefaultPatterns(): Promise<void> {
  try {
    // ── shiftPatterns 補完 ──────────────────────────────────
    const existing = await db.shiftPatterns.toArray().catch(() => []);
    const nameSet  = new Set(existing.map((p: any) => p.name));

    for (const def of DEFAULT_PATTERNS) {
      if (nameSet.has(def.name)) {
        // 既存パターンに isNight / isAke / isVacation がなければ更新
        const old = existing.find((p: any) => p.name === def.name);
        if (
          old &&
          (old.isNight === undefined ||
           old.isAke   === undefined ||
           old.isVacation === undefined)
        ) {
          await db.shiftPatterns
            .update(old.id, {
              isNight:    def.isNight,
              isAke:      def.isAke,
              isVacation: def.isVacation,
              isWorkday:  def.isWorkday,
            })
            .catch(e => console.warn(`[DB] パターン更新失敗 (${def.name}):`, e));
          console.log(`[DB] パターン更新: ${def.name}`);
        }
        continue;
      }
      // 新規追加
      try {
        await db.shiftPatterns.add(def as any);
        console.log(`[DB] パターン追加: ${def.name}`);
      } catch (e) {
        console.warn(`[DB] パターン追加失敗 (${def.name}):`, e);
      }
    }

    // ── constraints 補完 ────────────────────────────────────
    try {
      const cnt = await db.constraints.count();
      if (cnt === 0) {
        await db.constraints.add({
          maxConsecutiveWorkDays:   5,
          minRestDaysBetweenNights: 1,
          minWorkDaysPerMonth:      20,
          exactRestDaysPerMonth:    8,
          restAfterAke:　　 true,
        } as any);
        console.log('[DB] デフォルト制約を追加しました');
      }
    } catch (e) {
      console.warn('[DB] 制約追加失敗:', e);
    }

    // ── サマリーログ ─────────────────────────────────────────
    const staffCnt = await db.staff.count().catch(() => 0);
    const patCnt   = await db.shiftPatterns.count().catch(() => 0);
    const conCnt   = await db.constraints.count().catch(() => 0);
    console.log(`[DB] スタッフ: ${staffCnt}名, パターン: ${patCnt}種類, 制約: ${conCnt}件`);
    console.log('[DB] データベース初期化完了');
  } catch (err) {
    console.error('[DB] ensureDefaultPatterns エラー:', err);
  }
}

// src/main.tsx 後方互換エイリアス
export const initializeDatabase = ensureDefaultPatterns;
