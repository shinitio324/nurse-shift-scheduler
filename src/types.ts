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

// シフトの型定義
export interface Shift {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  shiftType: '日勤' | '早番' | '遅番' | '夜勤' | '休み' | '希望休';
  createdAt: Date;
  updatedAt: Date;
}

// シフト種別の型
export type ShiftType = '日勤' | '早番' | '遅番' | '夜勤' | '休み' | '希望休';

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
  name: string; // シフト名（例: 日勤、早番、遅番、夜勤、休み）
  shortName: string; // 略称（例: 日、早、遅、夜、休）
  startTime: string; // 開始時刻（例: "08:30"）
  endTime: string; // 終了時刻（例: "17:00"）
  requiredStaff: number; // 必要人数
  color: string; // カレンダー表示用の色（例: "#3B82F6"）
  isWorkday: boolean; // 勤務日かどうか（休みはfalse）
  sortOrder: number; // 表示順序
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
  date: string; // YYYY-MM-DD
  shiftPatternId: string; // どのシフトパターンか
  createdAt: Date;
  updatedAt: Date;
}
// シフト希望
export interface ShiftRequest {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  requestedShiftPatternId: string | null; // 希望するシフト（nullは希望休）
  priority: 'high' | 'medium' | 'low'; // 優先度
  note: string; // 備考
  status: 'pending' | 'approved' | 'rejected'; // 承認状態
  createdAt: Date;
  updatedAt: Date;
}
// ========================================
// Phase 3-2: 制約条件とバリデーション
// ========================================

/**
 * スケジュール制約条件
 */
export interface ScheduleConstraints {
  id: string;
  name: string;
  description: string;
  
  // 連続勤務制約
  maxConsecutiveWorkDays: number;        // 最大連続勤務日数
  maxConsecutiveNightShifts: number;     // 最大連続夜勤回数
  
  // 休日制約
  minRestDaysPerWeek: number;            // 週あたりの最低休日数
  minRestDaysPerMonth: number;           // 月あたりの最低休日数
  
  // 夜勤制約
  maxNightShiftsPerWeek: number;         // 週あたりの最大夜勤回数
  maxNightShiftsPerMonth: number;        // 月あたりの最大夜勤回数
  
  // 勤務時間制約
  maxWorkHoursPerWeek: number;           // 週あたりの最大勤務時間
  maxWorkHoursPerMonth: number;          // 月あたりの最大勤務時間
  
  // その他
  isActive: boolean;                     // 有効/無効
  priority: number;                      // 優先度（1-10）
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 制約条件フォームデータ
 */
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

/**
 * シフトリクエストの状態
 */
export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * 拡張版シフトリクエスト（Shift型を拡張）
 */
export interface ShiftRequest extends Shift {
  staffName?: string;                    // スタッフ名（結合用）
  status: ShiftRequestStatus;            // リクエスト状態
  note?: string;                         // 備考
  requestedAt: Date;                     // リクエスト日時
}

/**
 * シフトリクエストフォームデータ
 */
export interface ShiftRequestFormData {
  staffId: string;
  date: string;
  shiftType: ShiftType;
  note?: string;
}

/**
 * カレンダー日付情報
 */
export interface CalendarDate {
  date: Date;
  dateString: string;                    // YYYY-MM-DD形式
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  shiftRequests: ShiftRequest[];         // その日のシフトリクエスト
}

/**
 * スタッフのシフト統計
 */
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
// Phase 3-3: 自動スケジュール生成
// ========================================

/**
 * 生成されたスケジュール（1日分）
 */
export interface GeneratedSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  staffName: string;
  shiftType: string;
  isManuallyAdjusted: boolean;
  constraintViolations: string[]; // 違反した制約のリスト
  createdAt: Date;
  updatedAt: Date;
}

/**
 * スケジュール生成パラメータ
 */
export interface ScheduleGenerationParams {
  targetYear: number;
  targetMonth: number;
  constraintIds: string[]; // 適用する制約条件のID
  prioritizeRequests: boolean; // シフト希望を優先するか
  balanceWorkload: boolean; // 勤務配分を均等化するか
  balanceNightShifts: boolean; // 夜勤を均等配分するか
}

/**
 * スケジュール生成結果
 */
export interface ScheduleGenerationResult {
  schedules: GeneratedSchedule[];
  statistics: ScheduleStatistics;
  violations: ConstraintViolation[];
  generatedAt: Date;
}

/**
 * スケジュール統計情報
 */
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

/**
 * 制約違反情報
 */
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
