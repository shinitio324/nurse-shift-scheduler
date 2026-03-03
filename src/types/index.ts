// =============================================================
// src/types/index.ts  ── 完全版
// =============================================================

export interface Staff {
  id?: number;
  name: string;
  position: string;
  employmentType: string;        // '常勤' | '非常勤' | 'パート'
  qualifications: string[];
  minWorkDaysPerMonth: number;   // 0 = 制約なし（休み・明け・有給はカウント外）
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffFormData {
  name: string;
  position: string;
  employmentType: string;
  qualifications: string[];
  minWorkDaysPerMonth: number;
}

export interface ShiftPattern {
  id?: number;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  isAke?: boolean;      // 明けシフトフラグ（休みカウント外）
  isVacation?: boolean; // 有給フラグ（休みカウント外）
  isNight?: boolean;    // 夜勤フラグ（名前に依存しない判定）
  createdAt?: string;
  updatedAt?: string;
}

export interface Shift {
  id?: number;
  staffId: number;
  staffName?: string;
  date: string;
  shiftType: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftRequest {
  id?: number;
  staffId: number | string;
  staffName?: string;
  date: string;
  shiftType: string;
  patternId?: number;
  status?: 'pending' | 'approved' | 'rejected';
  note?: string;
  requestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftRequestFormData {
  staffId: number | string;
  date: string;
  shiftType: string;
  patternId?: number;
  note?: string;
}

export interface ScheduleConstraints {
  id?: number;
  name: string;
  isActive: boolean;
  priority: number;
  maxConsecutiveWorkDays: number;
  maxNightShiftsPerMonth: number;
  maxNightShiftsPerWeek: number;
  maxConsecutiveNightShifts: number;
  nightShiftNextDayOff: boolean;
  exactRestDaysPerMonth: number;   // 0=なし（明け・有給除外）
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConstraintsFormData {
  name: string;
  isActive: boolean;
  priority: number;
  maxConsecutiveWorkDays: number;
  maxNightShiftsPerMonth: number;
  maxNightShiftsPerWeek: number;
  maxConsecutiveNightShifts: number;
  nightShiftNextDayOff: boolean;
  exactRestDaysPerMonth: number;
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;
}

export interface ScheduleGenerationParams {
  year: number;
  month: number;
  constraintIds: number[];
  prioritizeRequests: boolean;
  balanceWorkload: boolean;
  balanceNightShifts: boolean;
}

export interface GeneratedSchedule {
  id?: number;
  staffId: number | string;
  staffName: string;
  date: string;
  shiftType: string;
  isGenerated: boolean;
  note?: string;
  createdAt?: string;
}

export interface ConstraintViolation {
  staffId: string;
  staffName: string;
  date: string;
  type: 'error' | 'warning';
  message: string;
  constraintName?: string;
}

export interface StaffWorkloadStat {
  staffId: string;
  staffName: string;
  totalDays: number;
  workDays: number;
  restDays: number;
  akeDays: number;
  vacationDays: number;
  nightShiftDays: number;
  maxConsecutiveWorkDays: number;
  totalWorkHours: number;
}

export interface ShiftTypeDistributionStat {
  shiftType: string;
  count: number;
}

export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  staffWorkload: StaffWorkloadStat[];
  shiftTypeDistribution: ShiftTypeDistributionStat[];
  maxConsecutiveWorkDays: number;
  totalWorkHours: number;
}

export interface ScheduleGenerationResult {
  schedules: GeneratedSchedule[];
  violations: ConstraintViolation[];
  statistics: ScheduleStatistics;
  generatedAt: string;
  year: number;
  month: number;
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dateString: string;
}

export interface StaffShiftStats {
  staffId: number | string;
  staffName: string;
  totalRequests: number;
  shiftTypeCounts: Record<string, number>;
}
