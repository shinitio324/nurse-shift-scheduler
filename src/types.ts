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
