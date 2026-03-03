// src/types/index.ts

// ============================================================
// スタッフ
// ============================================================
export interface Staff {
  id: string;
  name: string;
  position: string;
  employmentType: string;
  qualifications: string[];
  /**
   * 月の最低勤務日数（0 = 制約なし）
   * 休み・明け・有給はカウント対象外
   */
  minWorkDaysPerMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffFormData {
  name: string;
  position: string;
  employmentType: string;
  qualifications: string[];
  /** 月の最低勤務日数（0 = 制約なし） */
  minWorkDaysPerMonth: number;
}

// ============================================================
// シフト（保存レコード）
// ============================================================
export interface Shift {
  id: string;
  staffId: string;
  date: string;       // 'YYYY-MM-DD'
  shiftType: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// シフトパターン
// ============================================================
export interface ShiftPattern {
  id: string;
  name: string;
  shortName: string;
  color: string;
  startTime?: string;
  endTime?: string;
  isWorkday: boolean;
  /** 明けシフトフラグ（夜勤翌日専用。休み日数カウント対象外） */
  isAke?: boolean;
  /** 有給フラグ（休み日数カウント対象外） */
  isVacation?: boolean;
  requiredStaff: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// シフト希望
// ============================================================
export interface ShiftRequest {
  id: string;
  staffId: string;
  staffName?: string;
  date: string;
  shiftType: string;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  requestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftRequestFormData {
  staffId: string;
  date: string;
  shiftType: string;
  note?: string;
}

// ============================================================
// スケジュール制約条件
// ============================================================
export interface ScheduleConstraints {
  id: string;
  name: string;
  description: string;

  // ─── 連続勤務 ───
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightShifts: number;

  // ─── 夜勤後 ───
  nightShiftNextDayOff: boolean;

  // ─── 休日 ───
  minRestDaysPerWeek: number;
  minRestDaysPerMonth: number;
  /** 月の純休み日数を固定（0=無効） */
  exactRestDaysPerMonth: number;

  // ─── 夜勤回数 ───
  maxNightShiftsPerWeek: number;
  maxNightShiftsPerMonth: number;

  // ─── 勤務時間 ───
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;

  // ─── メタ ───
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ConstraintsFormData = Omit<ScheduleConstraints, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================
// スケジュール生成
// ============================================================
export interface ScheduleGenerationParams {
  targetYear: number;
  targetMonth: number;
  constraintIds: string[];
  prioritizeRequests: boolean;
  balanceWorkload: boolean;
  balanceNightShifts: boolean;
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
  violationType: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface StaffWorkloadStat {
  staffId: string;
  staffName: string;
  totalShifts: number;
  nightShifts: number;
  restDays: number;
  akeDays: number;
  vacationDays: number;
  consecutiveWorkDays: number;
  totalWorkHours: number;
}

export interface ShiftTypeDistributionStat {
  shiftType: string;
  count: number;
  requiredStaff: number;
  actualStaff: number;
}

export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: StaffWorkloadStat[];
  shiftTypeDistribution: ShiftTypeDistributionStat[];
}

export interface ScheduleGenerationResult {
  schedules: GeneratedSchedule[];
  statistics: ScheduleStatistics;
  violations: ConstraintViolation[];
  generatedAt: Date;
}

// ============================================================
// カレンダー日付
// ============================================================
export interface CalendarDate {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  shiftRequests: ShiftRequest[];
}

// ============================================================
// 統計パネル用
// ============================================================
export interface StaffShiftStats {
  staffId: string;
  staffName: string;
  position: string;
  totalShifts: number;
  workDays: number;
  restDays: number;
  akeDays: number;
  vacationDays: number;
  nightShifts: number;
  totalWorkHours: number;
}
