// src/types/index.ts
// ⚠️ このファイルは「型定義のみ」— ランタイムコードは一切書かない

// ─────────────────────────────────────────────
// スタッフ
// ─────────────────────────────────────────────
export interface Staff {
  id?: number;
  name: string;
  role: string;
  minWorkDaysPerMonth?: number;
  maxConsecutiveWorkDays?: number;
}

// ─────────────────────────────────────────────
// シフトパターン
// ─────────────────────────────────────────────
export interface ShiftPattern {
  id?: number;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  requiredStaff: number;
  isAke?: boolean;       // 明けフラグ
  isVacation?: boolean;  // 有給フラグ
  isNight?: boolean;     // 夜勤フラグ
}

// ─────────────────────────────────────────────
// シフトリクエスト
// ─────────────────────────────────────────────
export interface ShiftRequest {
  id?: number;
  staffId: number;
  date: string;        // "YYYY-MM-DD"
  patternId: number;
  note?: string;
}

// ─────────────────────────────────────────────
// 制約
// ─────────────────────────────────────────────
export interface ScheduleConstraints {
  id?: number;
  maxConsecutiveWorkDays?: number;
  minRestDaysBetweenNights?: number;
  minWorkDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;
}

// ─────────────────────────────────────────────
// 生成済みシフト
// ─────────────────────────────────────────────
export interface GeneratedShift {
  id?: number;
  staffId: number;
  date: string;        // "YYYY-MM-DD"
  patternId: number;
  isManual: boolean;
}

// ─────────────────────────────────────────────
// スケジュール生成パラメータ
// ─────────────────────────────────────────────
export interface ScheduleGenerationParams {
  year?: number;
  month?: number;
  targetYear?: number;   // フォームからの互換用
  targetMonth?: number;  // フォームからの互換用
}

// ─────────────────────────────────────────────
// スタッフ別ワークロード統計
// ─────────────────────────────────────────────
export interface StaffWorkloadStat {
  staffId: number;
  staffName: string;
  workDays: number;
  restDays: number;
  akeDays: number;
  vacationDays: number;
  nightDays: number;
  totalDays: number;
}

// ─────────────────────────────────────────────
// スケジュール統計
// ─────────────────────────────────────────────
export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: StaffWorkloadStat[];
  shiftTypeDistribution: Record<string, number>;
}

// ─────────────────────────────────────────────
// 生成結果
// ─────────────────────────────────────────────
export interface ScheduleGenerationResult {
  schedule: GeneratedShift[];
  statistics: ScheduleStatistics;
  warnings: string[];
}
