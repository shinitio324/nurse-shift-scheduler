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

// ─── ユーティリティ ─────────────────────────────────────────
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

  const result: string[] = [];
  for (let i = 1; i <= days; i++) {
    const d = formatDate(new Date(year, month - 1, i));
    if (d) result.push(d);
  }
  return result;
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

// ─── DBパターン補完 ─────────────────────────────────────────
async function ensurePatternsInDB(): Promise<void> {
  try {
    const existing = await db.shiftPatterns.toArray();
    const nameSet = new Set(existing.map((p: ShiftPattern) => p.name));

    for (const def of DEFAULT_SHIFT_PATTERNS) {
      if (nameSet.has(def.name)) continue;
      try {
        await db.shiftPatterns.add(def as ShiftPattern);
        console.log(`[SG] パターン補完追加: ${def.name}`);
      } catch (e) {
        console.warn(`[SG] パターン補完失敗 (${def.name}):`, e);
      }
    }
  } catch (e) {
    console.warn('[SG] ensurePatternsInDB 失敗:', e);
  }
}

// ─── DB取得 ─────────────────────────────────────────────────
async function fetchPatterns(): Promise<ShiftPattern[]> {
  try {
    const raw = safeArray<ShiftPattern>(await db.shiftPatterns.toArray());
    return raw.map((p: ShiftPattern) => ({
      ...p,
      id: toNumericId(p.id) ?? p.id ?? undefined,
    }));
  } catch (e) {
    console.error('[DB] shiftPatterns 取得失敗:', e);
    return [];
  }
}

async function fetchStaff(): Promise<Staff[]> {
  try {
    const raw = safeArray<Staff>(await db.staff.toArray());
    return raw.map((s) => ({
      ...s,
      canWorkNightShift: s?.canWorkNightShift !== false,
      minWorkDaysPerMonth: safeNumber(s?.minWorkDaysPerMonth, 0),
      maxNightShiftsPerMonth: safeNumber(s?.maxNightShiftsPerMonth, 0),
      qualifications: Array.isArray(s?.qualifications) ? s.qualifications : [],
    }));
  } catch (e) {
    console.error('[DB] staff 取得失敗:', e);
    return [];
  }
}

async function fetchRequests(): Promise<ShiftRequest[]> {
  try {
    const tbl = (db as any).shiftRequests;
    if (!tbl || typeof tbl.toArray !== 'function') return [];
    return safeArray<ShiftRequest>(await tbl.toArray());
  } catch (e) {
    console.error('[DB] shiftRequests 取得失敗:', e);
    return [];
  }
}

async function fetchConstraints(): Promise<ScheduleConstraints> {
  const defaults: ScheduleConstraints = {
    maxConsecutiveWorkDays: 5,
    minRestDaysBetweenNights: 1,
    minWorkDaysPerMonth: 20,
    exactRestDaysPerMonth: 8,
    restAfterAke: true,
    maxNightShiftsPerMonth: 8,
    preferMixedGenderNightShift: true,
  };

  try {
    const tbl = (db as any).constraints;
    if (!tbl || typeof tbl.toArray !== 'function') {
      console.warn('[DB] constraints テーブルなし → デフォルト使用');
      return defaults;
    }

    const all = await tbl.toArray();
    if (!Array.isArray(all) || all.length === 0) return defaults;

    return {
      ...defaults,
      ...(all[all.length - 1] as ScheduleConstraints),
    };
  } catch (e) {
    console.error('[DB] constraints 取得失敗:', e);
    return defaults;
  }
}

async function fetchPrevDayShifts(dateStr: string): Promise<GeneratedShift[]> {
  try {
    if (!dateStr) return [];
    const tbl = (db as any).generatedSchedules;
    if (!tbl || typeof tbl.where !== '
