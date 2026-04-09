// =============================================================
// src/types/index.ts
// scheduleAlgorithm.ts / db/index.ts 完全整合版
// =============================================================

// ─────────────────────────────────────────────
// 基本型
// ─────────────────────────────────────────────

export type StaffId = string | number;
export type PatternId = string | number;

export type StaffGender = '男性' | '女性' | 'その他';
export type StaffGenderLike = StaffGender | '未設定';

// ─────────────────────────────────────────────
// スタッフ
// ─────────────────────────────────────────────

export interface Staff {
  id?: StaffId;
  name: string;
  position: string;
  employmentType: string; // 例: '常勤' | '非常勤' | 'パート'

  qualifications?: string[];

  gender?: StaffGenderLike;

  // 個別下限。0 または未設定は「個別制約なし」
  minWorkDaysPerMonth?: number;

  // 個別夜勤上限。0 または未設定は「全体制約を使う」
  maxNightShiftsPerMonth?: number;

  // false の場合は夜勤不可（日勤専従）
  canWorkNightShift?: boolean;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface StaffFormData {
  name: string;
  position: string;
  employmentType: string;
  qualifications: string[];
  gender?: StaffGenderLike;
  minWorkDaysPerMonth?: number;
  maxNightShiftsPerMonth?: number;
  canWorkNightShift?: boolean;
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

  isNight?: boolean;
  isAke?: boolean;
  isVacation?: boolean;

  // 日勤などの通常勤務なら true
  isWorkday?: boolean;

  // 必要人数（例: 日勤5, 夜勤2）
  requiredStaff?: number;

  shortName?: string;
  sortOrder?: number;

  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ShiftPatternFormData {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  isNight?: boolean;
  isAke?: boolean;
  isVacation?: boolean;
  isWorkday?: boolean;
  requiredStaff?: number;
  shortName?: string;
  sortOrder?: number;
}

// ─────────────────────────────────────────────
// 旧 shifts テーブル互換
// ─────────────────────────────────────────────

export interface Shift {
  id?: number | string;
  staffId: StaffId;
  staffName?: string;
  date: string;
  shiftType: string;
  note?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// ─────────────────────────────────────────────
// シフト希望
// ─────────────────────────────────────────────

export type ShiftRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ShiftRequest {
  id?: number;

  staffId: StaffId;
  staffName?: string;

  date: string;

  // 旧UI/旧テーブル互換
  shiftType: string;

  // 新方式
  patternId?: PatternId;

  status?: ShiftRequestStatus;
  note?: string;

  requestedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ShiftRequestFormData {
  staffId: StaffId;
  date: string;
  shiftType: string;
  patternId?: PatternId;
  note?: string;
}

// ─────────────────────────────────────────────
// スケジュール制約
// db/index.ts / scheduleAlgorithm.ts が実際に参照する項目
// ─────────────────────────────────────────────

export interface ScheduleConstraints {
  id?: number;

  // 最大連続勤務日数
  maxConsecutiveWorkDays: number;

  // 夜勤間の最低間隔（日数）
  minRestDaysBetweenNights: number;

  // 全体の最低勤務日数
  minWorkDaysPerMonth: number;

  // 互換維持用。月別公休日数の本体判定は
  // scheduleAlgorithm.ts の getRequiredRestDaysForMonth() を使う
  minRestDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;

  // 明け翌日を自動で休みにする
  restAfterAke: boolean;

  // 全体夜勤上限
  maxNightShiftsPerMonth: number;

  // 男女ペア夜勤優先
  preferMixedGenderNightShift: boolean;

  // 日曜・祝日の日勤必要人数
  sunHolidayDayStaffRequired: number;

  createdAt?: string | Date;
  updatedAt?: string | Date;

  // 旧UI/旧設計との互換用（必要なら残す）
  name?: string;
  isActive?: boolean;
  priority?: number;
}

export interface ConstraintsFormData {
  maxConsecutiveWorkDays: number;
  minRestDaysBetweenNights: number;
  minWorkDaysPerMonth: number;
  minRestDaysPerMonth?: number;
  exactRestDaysPerMonth?: number;
  restAfterAke: boolean;
  maxNightShiftsPerMonth: number;
  preferMixedGenderNightShift: boolean;
  sunHolidayDayStaffRequired: number;
}

// ─────────────────────────────────────────────
// スケジュール生成パラメータ
// ─────────────────────────────────────────────

export interface ScheduleGenerationParams {
  // どちらの命名でも受けられるようにする
  year?: number;
  month?: number;
  targetYear?: number;
  targetMonth?: number;

  // 旧UI互換
  constraintIds?: number[];
  prioritizeRequests?: boolean;
  balanceWorkload?: boolean;
  balanceNightShifts?: boolean;
}

// ─────────────────────────────────────────────
// 生成済みシフト
// scheduleAlgorithm.ts が直接返す1件単位
// ─────────────────────────────────────────────

export interface GeneratedShift {
  id?: number;
  staffId: StaffId;
  date: string;
  patternId: PatternId;
  isManual?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// 旧名称互換
export type GeneratedSchedule = GeneratedShift;

// ─────────────────────────────────────────────
// 制約違反 / 警告
// ─────────────────────────────────────────────

export interface ConstraintViolation {
  staffId?: StaffId;
  staffName?: string;
  date?: string;
  type: 'error' | 'warning';
  message: string;
  constraintName?: string;
}

// ─────────────────────────────────────────────
// 統計
// scheduleAlgorithm.ts の calcStats() に完全整合
// ─────────────────────────────────────────────

export interface StaffWorkloadStat {
  staffId?: StaffId;
  staffName?: string;

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

// ─────────────────────────────────────────────
// スケジュール生成結果
// scheduleAlgorithm.ts の generate() の戻り値に完全整合
// ─────────────────────────────────────────────

export interface ScheduleGenerationResult {
  schedule: GeneratedShift[];
  statistics: ScheduleStatistics;
  warnings: string[];
}

// ─────────────────────────────────────────────
// カレンダー表示用
// ─────────────────────────────────────────────

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dateString: string;
}

// ─────────────────────────────────────────────
// 希望集計用
// ─────────────────────────────────────────────

export interface StaffShiftStats {
  staffId: StaffId;
  staffName: string;
  totalRequests: number;
  shiftTypeCounts: Record<string, number>;
}
