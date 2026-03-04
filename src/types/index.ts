// src/types/index.ts

// ─── スタッフ ───────────────────────────────────────────────────
export interface Staff {
  id?: number;
  name: string;
  role: string;
  minWorkDaysPerMonth?: number;
  maxConsecutiveWorkDays?: number;
}

// ─── シフトパターン ──────────────────────────────────────────────
export interface ShiftPattern {
  id?: number;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  requiredStaff: number;
  isAke?: boolean;
  isVacation?: boolean;
  isNight?: boolean;
}

// ─── シフト希望 ──────────────────────────────────────────────────
export interface ShiftRequest {
  id?: number;
  staffId: number;
  date: string;
  patternId: number;
  note?: string;
}

// ─── 制約条件（シンプル版・自動生成用） ─────────────────────────
export interface ScheduleConstraints {
  id?: number;
  maxConsecutiveWorkDays?: number;
  minRestDaysBetweenNights?: number;
  minWorkDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;
}

// ─── 制約条件（詳細版・ConstraintSettings用） ────────────────────
export interface ScheduleConstraintRule {
  id: string;
  name: string;
  description: string;
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightShifts: number;
  nightShiftNextDayOff: boolean;
  minRestDaysPerWeek: number;
  minRestDaysPerMonth: number;
  exactRestDaysPerMonth: number;
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
  nightShiftNextDayOff: boolean;
  minRestDaysPerWeek: number;
  minRestDaysPerMonth: number;
  exactRestDaysPerMonth: number;
  maxNightShiftsPerWeek: number;
  maxNightShiftsPerMonth: number;
  maxWorkHoursPerWeek: number;
  maxWorkHoursPerMonth: number;
  isActive: boolean;
  priority: number;
}

// ─── 生成済みシフト ──────────────────────────────────────────────
export interface GeneratedShift {
  id?: number;
  staffId: number;
  date: string;
  patternId: number;
  isManual: boolean;
}

// ─── スケジュール生成パラメータ ──────────────────────────────────
export interface ScheduleGenerationParams {
  year?: number;
  month?: number;
  targetYear?: number;
  targetMonth?: number;
}

// ─── 統計 ────────────────────────────────────────────────────────
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
