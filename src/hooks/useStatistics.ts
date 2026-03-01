// ★ 修正: useState/useEffect/useCallback → useLiveQuery に完全置き換え
// useLiveQuery は IndexedDB の変更を自動検知してリアクティブに再計算する
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks'; // ★ すでにインストール済み
import { db } from '../db';
import { ShiftPattern } from '../types';

// ========== 公開型定義（変更なし）==========

export interface StaffWorkload {
  staffId: string;
  staffName: string;
  position: string;
  totalShifts: number;
  workDays: number;
  restDays: number;
  nightShifts: number;
  totalWorkHours: number;
}

export interface ShiftTypeDistribution {
  shiftType: string;
  shortName: string;
  color: string;
  count: number;
  requiredStaff: number;
  avgPerDay: number;
}

export interface MonthlyStatsSummary {
  totalShifts: number;
  registeredStaff: number;
  activeStaff: number;
  avgWorkDaysPerStaff: number;
  avgNightShiftsPerStaff: number;
  avgWorkHoursPerStaff: number;
}

export interface StatisticsData {
  year: number;
  month: number;
  summary: MonthlyStatsSummary;
  staffWorkload: StaffWorkload[];
  shiftTypeDistribution: ShiftTypeDistribution[];
}

// ========== ヘルパー関数（変更なし）==========

function isNightShiftPattern(pattern: ShiftPattern): boolean {
  if (!pattern.isWorkday) return false;
  if (pattern.name.includes('夜')) return true;
  if (!pattern.startTime) return false;
  return pattern.startTime >= '20:00' || pattern.startTime <= '05:00';
}

function calculateWorkHours(pattern: ShiftPattern): number {
  if (!pattern.isWorkday || !pattern.startTime || !pattern.endTime) return 0;
  const [sh, sm] = pattern.startTime.split(':').map(Number);
  const [eh, em] = pattern.endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

// ========== フック本体（★ useLiveQuery に置き換え）==========

export function useStatistics(year: number, month: number) {
  // ★ 手動リフレッシュ用カウンター（「更新」ボタン押下時に強制再実行）
  const [refreshCounter, setRefreshCounter] = useState(0);

  const mm        = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate   = `${year}-${mm}-31`;

  // ★★★ useLiveQuery: IndexedDB (db.shifts / db.staff / db.shiftPatterns) の
  //       変更を自動検知し、スケジュール保存直後に統計を即時更新する
  const queryResult = useLiveQuery<StatisticsData | null>(
    async () => {
      try {
        const [allStaff, allPatterns, monthShifts] = await Promise.all([
          db.staff.toArray(),
          db.shiftPatterns.toArray(),
          db.shifts.where('date').between(startDate, endDate, true, true).toArray(),
        ]);

        const patternByName = new Map<string, ShiftPattern>(
          allPatterns.map(p => [p.name, p])
        );

        // ---- スタッフ別集計 ----
        const workloadMap = new Map<string, StaffWorkload>(
          allStaff.map(s => [s.id, {
            staffId: s.id,
            staffName: s.name,
            position: s.position,
            totalShifts: 0,
            workDays: 0,
            restDays: 0,
            nightShifts: 0,
            totalWorkHours: 0,
          }])
        );

        // ---- シフト種別集計 ----
        const shiftTypeMap = new Map<string, { count: number; pattern?: ShiftPattern }>();

        monthShifts.forEach(shift => {
          const w       = workloadMap.get(shift.staffId);
          const pattern = patternByName.get(shift.shiftType);

          if (w) {
            w.totalShifts++;
            if (pattern) {
              if (pattern.isWorkday) {
                w.workDays++;
                w.totalWorkHours += calculateWorkHours(pattern);
                if (isNightShiftPattern(pattern)) w.nightShifts++;
              } else {
                w.restDays++;
              }
            } else {
              w.workDays++; // 未知パターンは勤務日として扱う
            }
          }

          const existing = shiftTypeMap.get(shift.shiftType);
          if (existing) {
            existing.count++;
          } else {
            shiftTypeMap.set(shift.shiftType, { count: 1, pattern });
