// src/types.ts
// ============================================================
// ★ 完全修正版 ★
// scheduleAlgorithm.ts / db/index.ts / useScheduleGenerator.ts
// / SchedulePreview.tsx すべてと整合させた型定義
// ============================================================

// ── スタッフ ────────────────────────────────────────────────
export interface Staff {
  id: string;
  name: string;
  position: '正看護師' | '准看護師' | '看護助手' | 'その他';
  employmentType: '常勤' | '非常勤' | 'パート';
  qualifications: string[];
  minWorkDaysPerMonth?: number; // 個人別最低勤務日数（0 = 制約なし）
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffFormData {
  name: string;
  position: Staff['position'];
  employmentType: Staff['employmentType'];
  qualifications: string[];
  minWorkDaysPerMonth?: number;
}

// ── 勤務パターン（新旧両対応）────────────────────────────────
export interface ShiftPattern {
  id?: number | string;   // ++id 自動採番（数値）or 旧UUID文字列
  name: string;
  shortName?: string;     // 旧互換
  startTime: string;
  endTime: string;
  requiredStaff: number;
  color: string;
  isNight?: boolean;      // 夜勤フラグ ★追加
  isAke?: boolean;        // 明けフラグ ★追加
  isVacation?: boolean;   // 有給フラグ ★追加
  isWorkday?: boolean;    // 旧互換
  sortOrder?: number;     // 旧互換
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShiftPatternFormData {
  name: string;
  shortName?: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  color: string;
  isNight?: boolean;
  isAke?: boolean;
  isVacation?: boolean;
  isWorkday?: boolean;
}

// ── シフト（旧 shifts テーブル）──────────────────────────────
export interface Shift {
  id: string;
  staffId: string;
  date: string;       // YYYY-MM-DD
  shiftType: string;
  createdAt: Date;
  updatedAt: Date;
}
export type ShiftType = string;

// ── シフトリクエスト ──────────────────────────────────────────
export interface ShiftRequest extends Shift {
  patternId?: number | string; // スケジュール生成用パターンID
  staffName?: string;
  status: ShiftRequestStatus;
  note?: string;
  requestedAt: Date;
}
export interface ShiftRequestFormData {
  staffId: string;
  date: string;
  shiftType: string;
  note?: string;
}
export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// ── 生成済みシフト（generatedSchedules テーブル）★新規追加
export interface GeneratedShift {
  id?: number;
  staffId: string | number; // 実行時は UUID 文字列
  date: string;             // YYYY-MM-DD
  patternId: number;
  isManual: boolean;
}

// ── スケジュール制約（constraints テーブル）★修正
export interface ScheduleConstraints {
  id?: number | string;
  // ▼ scheduleAlgorithm.ts が使用するフィールド
  maxConsecutiveWorkDays?: number;
  minRestDaysBetweenNights?: number;
  minWorkDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;
  restAfterAke?: boolean; 
  
  name?: string;
  description?: string;
  maxConsecutiveNightShifts?: number;
  minRestDaysPerWeek?: number;
  minRestDaysPerMonth?: number;
  maxNightShiftsPerWeek?: number;
  maxNightShiftsPerMonth?: number;
  maxWorkHoursPerWeek?: number;
  maxWorkHoursPerMonth?: number;
  isActive?: boolean;
  priority?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConstraintsFormData {
  maxConsecutiveWorkDays: number;
  minRestDaysBetweenNights: number;
  minWorkDaysPerMonth: number;
  exactRestDaysPerMonth: number;
}

// ── スケジュール生成パラメータ ★修正（旧新両対応）────────────
export interface ScheduleGenerationParams {
  year?: number;        // 新フィールド
  month?: number;       // 新フィールド
  targetYear?: number;  // 旧互換
  targetMonth?: number; // 旧互換
  constraintIds?: string[];
  prioritizeRequests?: boolean;
  balanceWorkload?: boolean;
  balanceNightShifts?: boolean;
}

// ── スタッフ別集計 ★新規追加 ─────────────────────────────────
export interface StaffWorkloadStat {
  staffId: string | number;
  staffName: string;
  workDays: number;
  nightDays: number;
  akeDays: number;
  vacationDays: number;
  restDays: number;
  totalDays: number;
}

// ── スケジュール統計 ★修正 ────────────────────────────────────
export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: StaffWorkloadStat[];
  shiftTypeDistribution: Record<string, number>; // ★ 配列→オブジェクト
}

// ── スケジュール生成結果 ★完全修正 ────────────────────────────
export interface ScheduleGenerationResult {
  schedule: GeneratedShift[];  // ★ schedules → schedule
  statistics: ScheduleStatistics;
  warnings: string[];          // ★ violations → warnings
}

// ── カレンダー ────────────────────────────────────────────────
export interface CalendarDate {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  shiftRequests: ShiftRequest[];
}

// ── 旧互換型（削除すると他コンポーネントが壊れる可能性のあるもの）
export interface StaffShift {
  id: string;
  staffId: string;
  date: string;
  shiftPatternId: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface StaffShiftStats {
  staffId: string;
  staffName: string;
  totalShifts: number;
  workDays: number;
  restDays: number;
  nightShifts: number;
  totalWorkHours: number;
  consecutiveWorkDays: number;
}
export interface GeneratedSchedule {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  shiftType: string;
  isManuallyAdjusted: boolean;
  constraintViolations: string[];
  createdAt: Date;
  updatedAt: Date;
}
export interface ConstraintViolation {
  date: string;
  staffId: string;
  staffName: string;
  constraintName: string;
  violationType:
    | 'consecutive_work' | 'consecutive_night' | 'rest_days'
    | 'night_shifts'     | 'work_hours'         | 'required_staff';
  severity: 'error' | 'warning';
  message: string;
}
// 旧 ScheduleConstraintRule（db/index.ts が import している）
export type ScheduleConstraintRule = ScheduleConstraints;
