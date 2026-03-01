import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ShiftPattern } from '../types';

// ========== 公開型定義 ==========

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

// ========== ヘルパー関数 ==========

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

// ========== フック本体 ==========

export function useStatistics(year: number, month: number) {
  // 「更新」ボタン押下時に強制再実行するためのカウンター
  const [refreshCounter, setRefreshCounter] = useState(0);

  const mm        = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate   = `${year}-${mm}-31`;

  // useLiveQuery: db.shifts / db.staff / db.shiftPatterns の変更を自動検知して即時再計算
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
            staffId:        s.id,
            staffName:      s.name,
            position:       s.position,
            totalShifts:    0,
            workDays:       0,
            restDays:       0,
            nightShifts:    0,
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
          }
        });

        // ---- 集計結果の整形 ----
        const daysInMonth = new Date(year, month, 0).getDate();

        const staffWorkload = Array.from(workloadMap.values())
          .filter(s => s.totalShifts > 0)
          .sort((a, b) => b.totalShifts - a.totalShifts);

        const shiftTypeDistribution: ShiftTypeDistribution[] = Array.from(shiftTypeMap.entries())
          .map(([shiftType, { count, pattern }]) => ({
            shiftType,
            shortName:     pattern?.shortName    ?? shiftType,
            color:         pattern?.color        ?? '#6B7280',
            count,
            requiredStaff: pattern?.requiredStaff ?? 0,
            avgPerDay:     Math.round((count / daysInMonth) * 10) / 10,
          }))
          .sort((a, b) => b.count - a.count);

        const activeStaff      = staffWorkload.length;
        const totalWorkDays    = staffWorkload.reduce((s, w) => s + w.workDays,       0);
        const totalNightShifts = staffWorkload.reduce((s, w) => s + w.nightShifts,    0);
        const totalWorkHours   = staffWorkload.reduce((s, w) => s + w.totalWorkHours, 0);

        const result: StatisticsData = {
          year,
          month,
          summary: {
            totalShifts:            monthShifts.length,
            registeredStaff:        allStaff.length,
            activeStaff,
            avgWorkDaysPerStaff:    activeStaff > 0
              ? Math.round((totalWorkDays    / activeStaff) * 10) / 10 : 0,
            avgNightShiftsPerStaff: activeStaff > 0
              ? Math.round((totalNightShifts / activeStaff) * 10) / 10 : 0,
            avgWorkHoursPerStaff:   activeStaff > 0
              ? Math.round((totalWorkHours   / activeStaff) * 10) / 10 : 0,
          },
          staffWorkload,
          shiftTypeDistribution,
        };

        console.log('📊 統計データを更新しました:', monthShifts.length, '件');
        return result;

      } catch (e) {
        console.error('統計データの読み込みに失敗しました:', e);
        return null;
      }
    },
    [year, month, refreshCounter] // year/month変更 or 「更新」ボタンで再実行
  );

  // useLiveQuery の戻り値: undefined = ローディング中, それ以外 = データ
  const loading = queryResult === undefined;
  const data    = loading ? null : queryResult;

  return {
    data,
    loading,
    error: null,
    reload: () => setRefreshCounter(c => c + 1), // 「更新」ボタン用
  };
}
