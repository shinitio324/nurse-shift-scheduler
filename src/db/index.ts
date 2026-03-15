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
  // ── スケジュール生成用テーブル（新・自動採番ID）──────────────
  shiftPatterns!:     Table<ShiftPattern,      number>;
  shiftRequests!:     Table<ShiftRequest,       number>;
  constraints!:       Table<ScheduleConstraints, number>;
  generatedSchedules!:Table<GeneratedShift,     number>;

  // ── 既存テーブル（旧UUID文字列ID・互換性のため保持）─────────
  staff!:             Table<any, any>;   // useStaff.ts 向け
  shifts!:            Table<any, any>;   // useShiftRequests.ts 向け
  scheduleConstraints!:Table<any, any>;  // 旧テーブル保持

  constructor() {
    super('NurseSchedulerDB');

    // ─────────────────────────────────────────────────────────────
    // v1〜v3: 元の src/db.ts と完全一致させる
    //   → ユーザーのブラウザに既存データ(スタッフ等)が残っている場合に
    //     テーブル再作成なしで正確にアップグレードできる
    // ─────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────
    // v4: スケジュール生成に必要な変更を適用
    //   ① shiftPatterns を '++id, name'（自動採番）に変更
    //      → 旧UUIDパターンをクリアし、数値IDで再登録できる状態にする
    //   ② 新テーブルを追加: shiftRequests, constraints, generatedSchedules
    //   ③ staff / shifts は v3 のスキーマのまま保持（データ消失なし）
    // ─────────────────────────────────────────────────────────────
    this.version(4).stores({
      staff:               'id, name, position, employmentType, createdAt',
      shifts:              'id, staffId, date, shiftType, createdAt',
      shiftPatterns:       '++id, name',            // ← PK変更で旧データ自動クリア
      scheduleConstraints: 'id, name, isActive, priority, createdAt',
      shiftRequests:       '++id, staffId, date, patternId',  // 新テーブル
      constraints:         '++id',                            // 新テーブル
      generatedSchedules:  '++id, staffId, date, patternId', // 新テーブル
    }).upgrade(trans => {
      // PK変更でDexieが自動再作成するが、念のため明示的にクリア
      return (trans as any)
        .table('shiftPatterns')
        .clear()
        .catch(() => {
          console.warn('[DB] v4 upgrade: shiftPatterns.clear() は無視（既に新スキーマ）');
        });
    });
  }
}

// ── シングルトンインスタンス（アプリ全体で1つだけ） ──────────
export const db = new NurseSchedulerDB();

// ── デフォルトパターン定義 ────────────────────────────────────
export const DEFAULT_PATTERNS: Omit<ShiftPattern, 'id'>[] = [
  { name: '日勤', startTime: '09:00', endTime: '17:00', color: '#bfdbfe',
    isAke: false, isVacation: false, isNight: false, requiredStaff: 2 },
  { name: '夜勤', startTime: '17:00', endTime: '09:00', color: '#c4b5fd',
    isAke: false, isVacation: false, isNight: true,  requiredStaff: 1 },
  { name: '明け', startTime: '00:00', endTime: '00:00', color: '#93c5fd',
    isAke: true,  isVacation: false, isNight: false, requiredStaff: 0 },
  { name: '有給', startTime: '00:00', endTime: '00:00', color: '#86efac',
    isAke: false, isVacation: true,  isNight: false, requiredStaff: 0 },
  { name: '休み', startTime: '00:00', endTime: '00:00', color: '#d1d5db',
    isAke: false, isVacation: false, isNight: false, requiredStaff: 0 },
];

// ── 起動時パターン/制約の初期補完 ────────────────────────────
export async function ensureDefaultPatterns(): Promise<void> {
  try {
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

    // constraints テーブルにデフォルト制約が無ければ追加
    try {
      const cnt = await db.constraints.count();
      if (cnt === 0) {
        await db.constraints.add({
          maxConsecutiveWorkDays:   5,
          minRestDaysBetweenNights: 1,
          minWorkDaysPerMonth:      20,
          exactRestDaysPerMonth:    8,
        } as ScheduleConstraints);
        console.log('[DB] デフォルト制約を追加しました');
      }
    } catch (e) {
      console.warn('[DB] 制約追加失敗:', e);
    }

    const staffCnt = await db.staff.count().catch(() => 0);
    const patCnt   = await db.shiftPatterns.count().catch(() => 0);
    console.log(`[DB] スタッフ: ${staffCnt}名, パターン: ${patCnt}種類`);
    console.log('[DB] データベース初期化完了');
  } catch (err) {
    console.error('[DB] ensureDefaultPatterns エラー:', err);
  }
}
// src/main.tsx との後方互換性のためのエイリアス
export const initializeDatabase = ensureDefaultPatterns;
