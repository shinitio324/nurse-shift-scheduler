import { db } from '../db/index';
import type {
  Staff,
  ShiftPattern,
  ShiftRequest,
  ScheduleConstraints,
  GeneratedShift,
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  ScheduleStatistics,
  StaffWorkloadStat,
  StaffGender,
} from '../types';

export const AKE_NAME = '明け';
export const VACATION_NAME = '有給';
export const REST_NAME = '休み';

const DEFAULT_SHIFT_PATTERNS: Omit<ShiftPattern, 'id'>[] = [
  {
    name: '日勤',
    startTime: '08:30',
    endTime: '17:00',
    color: '#bfdbfe',
    isAke: false,
    isVacation: false,
    isNight: false,
    requiredStaff: 5,
    shortName: '日',
    isWorkday: true,
    sortOrder: 1,
  },
  {
    name: '夜勤',
    startTime: '16:30',
    endTime: '09:00',
    color: '#c4b5fd',
    isAke: false,
    isVacation: false,
    isNight: true,
    requiredStaff: 2,
    shortName: '夜',
    isWorkday: true,
    sortOrder: 2,
  },
  {
    name: '明け',
    startTime: '00:00',
    endTime: '00:00',
    color: '#93c5fd',
    isAke: true,
    isVacation: false,
    isNight: false,
    requiredStaff: 0,
    shortName: '明',
    isWorkday: false,
    sortOrder: 3,
  },
  {
    name: '有給',
    startTime: '00:00',
    endTime: '00:00',
    color: '#86efac',
    isAke: false,
    isVacation: true,
    isNight: false,
    requiredStaff: 0,
    shortName: '有',
    isWorkday: false,
    sortOrder: 4,
  },
  {
    name: '休み',
    startTime: '00:00',
    endTime: '00:00',
    color: '#d1d5db',
    isAke: false,
    isVacation: false,
    isNight: false,
    requiredStaff: 0,
    shortName: '休',
    isWorkday: false,
    sortOrder: 5,
  },
];

// ─────────────────────────────────────────────────────────────
// utility
// ─────────────────────────────────────────────────────────────

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function safeNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function sameId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function idKey(id: unknown): string {
  return String(id ?? '');
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function getDaysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return new Date(year, month, 0).getDate();
}

function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  if (days <= 0) return [];
  return Array.from({ length: days }, (_, i) =>
    formatDate(new Date(year, month - 1, i + 1))
  );
}

function makeEmptyResult(warnings: string[] = []): ScheduleGenerationResult {
  return {
    schedule: [],
    statistics: {
      totalDays: 0,
      totalShifts: 0,
      staffWorkload: [],
      shiftTypeDistribution: {},
    },
    warnings,
  };
}

function toNumericId(id: unknown): number | null {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function normalizeGender(gender: unknown): StaffGender | '未設定' {
  if (gender === '男性' || gender === '女性' || gender === 'その他') {
    return gender;
  }
  return '未設定';
}

function canWorkNight(member: Partial<Staff> | undefined | null): boolean {
  return member?.canWorkNightShift !== false;
}

function isActiveRequest(req: ShiftRequest | undefined | null): boolean {
  if (!req) return false;
  if (req.status === 'rejected' || req.status === 'cancelled') return false;
  return true;
}

function isDayLikePattern(p: ShiftPattern | undefined | null): boolean {
  if (!p) return false;
  if (p.isNight) return false;
  if (p.isAke) return false;
  if (p.isVacation) return false;
  if (p.name === REST_NAME) return false;
  return true;
