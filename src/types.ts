// ============================================================
// 完全修正版 types.ts
// scheduleAlgorithm.ts / db/index.ts / useScheduleGenerator.ts
// / SchedulePreview.tsx / App.tsx と整合
// ============================================================

// ── スタッフ ────────────────────────────────────────────────
export interface Staff {
  id: string;
  name: string;
  position: '正看護師' | '准看護師' | '看護助手' | 'その他';
  employmentType: '常勤' | '非常勤' | 'パート';
  qualifications: string[];
  minWorkDaysPerMonth?: number;
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

// ── 勤務パターン ───────────────────────────────────────────
export interface ShiftPattern {
  id?: number | string;
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
  sortOrder?: number;
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

// ── シフト（旧 shifts テーブル）────────────────────────────
export interface Shift {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  shiftType: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftType = string;

// ── シフトリクエスト ───────────────────────────────────────
export interface ShiftRequest extends Shift {
  patternId?: number | string;
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

export type ShiftRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

// ── 生成済みシフト ─────────────────────────────────────────
export interface GeneratedShift {
  id?: number;
  staffId: string | number;
  date: string; // YYYY-MM-DD
  patternId: number;
  isManual: boolean;
}

// ── スケジュール制約 ───────────────────────────────────────
export interface ScheduleConstraints {
  id?: number | string;

  maxConsecutiveWorkDays?: number;
  minRestDaysBetweenNights?: number;
  minWorkDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;
  restAfterAke?: boolean;

  // 旧互換
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
  restAfterAke?: boolean;
}

// ── スケジュール生成パラメータ ─────────────────────────────
export interface ScheduleGenerationParams {
  year?: number;
  month?: number;
  targetYear?: number;
  targetMonth?: number;
  constraintIds?: string[];
  prioritizeRequests?: boolean;
  balanceWorkload?: boolean;
  balanceNightShifts?: boolean;
}

// ── 統計 ───────────────────────────────────────────────────
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

export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: StaffWorkloadStat[];
  shiftTypeDistribution: Record<string, number>;
}

export interface ScheduleGenerationResult {
  schedule: GeneratedShift[];
  statistics: ScheduleStatistics;
  warnings: string[];
}

// ── カレンダー ─────────────────────────────────────────────
export interface CalendarDate {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  shiftRequests: ShiftRequest[];
}

// ── 旧互換型 ───────────────────────────────────────────────
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
    | 'consecutive_work'
    | 'consecutive_night'
    | 'rest_days'
    | 'night_shifts'
    | 'work_hours'
    | 'required_staff';
  severity: 'error' | 'warning';
  message: string;
}

export type ScheduleConstraintRule = ScheduleConstraints;
