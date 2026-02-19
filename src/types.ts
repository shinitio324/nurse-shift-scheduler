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
