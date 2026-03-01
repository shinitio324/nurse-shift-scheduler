// スタッフの型定義
export interface Staff {
  id: string;
  name: string;
  position: '正看護師' | '准看護師' | '看護助手' | 'その他';
  employmentType: '常勤' | '非常勤' | 'パート';
  qualifications: string[];
  createdAt: Date;
  updatedAt: Date;
}

// シフトの型定義 ★ shiftType を string に変更（カスタムパターン対応）
export interface Shift {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  shiftType: string; // ★ 修正: 固定ユニオン → string（カスタムパターン対応）
  createdAt: Date;
  updatedAt: Date;
}

// シフト種別の型 ★ string に変更
export type ShiftType = string; // ★ 修正: カスタムパターンを許容

// スタッフフォームの入力値
export interface StaffFormData {
  name: string;
  position: Staff['position'];
  employmentType: Staff['employmentType'];
  qualifications: string[];
}

// 勤務パターンの型定義
export interface ShiftPattern {
  id: string;
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  color: string;
  isWorkday: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// 勤務パターンフォームの入力値
export interface ShiftPatternFormData {
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  color: string;
  isWorkday: boolean;
}

// スタッフのシフト割り当て
export interface StaffShift {
  id: string;
  staffId: string;
  date: string;
  shiftPatternId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ★ 修正: ShiftRequestを一本化（重複定義を削除、Shiftを拡張）
export interface ShiftRequest extends Shift {
  staffName?: string;
  status: ShiftRequestStatus;
  note?: string;
  requestedAt: Date;
}

// シフトリクエストフォームデータ
export interface ShiftRequestFormData {
  staffId: string;
  date: string;
  shiftType: string; // ★ 修正: string型
  note?: string;
}

// シフトリクエストの状態
export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// カレンダー日付情報
export interface CalendarDate {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  shiftRequests: ShiftRequest[];
}

// スタッフのシフト統計
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

// ========================================
// Phase 3-2: 制約条件とバリデーション
// ========================================
export interface ScheduleConstraints {
  id: string;
  name: string;
  description: string;
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightShifts: number;
  minRestDaysPerWeek: number;
  minRestDaysPerMonth: number;
  maxNightShiftsPerWeek: number;
  maxNightShiftsPerMonth: number;
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConstraintsFormData {
  name: string;
  description: string;
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightShifts: number;
  minRestDaysPerWeek: number;
  minRestDaysPerMonth: number;
  maxNightShiftsPerWeek: number;
  maxNightShiftsPerMonth: number;
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;
  isActive: boolean;
  priority: number;
}

// ========================================
// Phase 3-3: 自動スケジュール生成
// ========================================
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

export interface ScheduleGenerationParams {
  targetYear: number;
  targetMonth: number;
  constraintIds: string[];
  prioritizeRequests: boolean;
  balanceWorkload: boolean;
  balanceNightShifts: boolean;
}

export interface ScheduleGenerationResult {
  schedules: GeneratedSchedule[];
  statistics: ScheduleStatistics;
  violations: ConstraintViolation[];
  generatedAt: Date;
}

export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: {
    staffId: string;
    staffName: string;
    totalShifts: number;
    nightShifts: number;
    restDays: number;
    consecutiveWorkDays: number;
    totalWorkHours: number;
  }[];
  shiftTypeDistribution: {
    shiftType: string;
    count: number;
    requiredStaff: number;
    actualStaff: number;
  }[];
}

export interface ConstraintViolation {
  date: string;
  staffId: string;
  staffName: string;
  constraintName: string;
  violationType: 'consecutive_work' | 'consecutive_night' | 'rest_days' | 
                 'night_shifts' | 'work_hours' | 'required_staff';
  severity: 'error' | 'warning';
  message: string;
}
