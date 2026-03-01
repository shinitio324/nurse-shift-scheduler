import { useState, useEffect, useCallback } from 'react';
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
  // 20:00 以降 or 05:00 以前スタートは夜勤とみなす
  return pattern.startTime >= '20:00' || pattern.startTime <= '05:00';
}

function calculateWorkHours(pattern: ShiftPattern): number {
  if (!pattern.isWorkday || !pattern.startTime || !pattern.endTime) return 0;
  const [sh, sm] = pattern.startTime.split(':').map(Number);
  const [eh, em] = pattern.endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60; // 日跨ぎシフト
  return minutes / 60;
}

// ========== フック本体 ==========

export function useStatistics(year: number, month: number) {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const mm = String(month).padStart(2, '0');
      const startDate = `${year}-${mm}-01`;
      const endDate   = `${year}-${mm}-31`;

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
        const w = workloadMap.get(shift.staffId);
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

      const daysInMonth = new Date(year, month, 0).getDate();

      const staffWorkload = Array.from(workloadMap.values())
        .filter(s => s.totalShifts > 0)
        .sort((a, b) => b.totalShifts - a.totalShifts);

      const shiftTypeDistribution: ShiftTypeDistribution[] = Array.from(shiftTypeMap.entries())
        .map(([shiftType, { count, pattern }]) => ({
          shiftType,
          shortName:    pattern?.shortName   || shiftType,
          color:        pattern?.color       || '#6B7280',
          count,
          requiredStaff: pattern?.requiredStaff || 0,
          avgPerDay:    Math.round((count / daysInMonth) * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count);

      const activeStaff = staffWorkload.length;
      const totalWorkDays   = staffWorkload.reduce((s, w) => s + w.workDays,  0);
      const totalNightShifts = staffWorkload.reduce((s, w) => s + w.nightShifts, 0);
      const totalWorkHours  = staffWorkload.reduce((s, w) => s + w.totalWorkHours, 0);

      setData({
        year, month,
        summary: {
          totalShifts:           monthShifts.length,
          registeredStaff:       allStaff.length,
          activeStaff,
          avgWorkDaysPerStaff:   activeStaff > 0 ? Math.round((totalWorkDays   / activeStaff) * 10) / 10 : 0,
          avgNightShiftsPerStaff: activeStaff > 0 ? Math.round((totalNightShifts / activeStaff) * 10) / 10 : 0,
          avgWorkHoursPerStaff:  activeStaff > 0 ? Math.round((totalWorkHours  / activeStaff) * 10) / 10 : 0,
        },
        staffWorkload,
        shiftTypeDistribution,
      });

      console.log('📊 統計データを読み込みました:', monthShifts.length, '件');
    } catch (e) {
      console.error('統計データの読み込みに失敗しました:', e);
      setError('統計データの読み込みに失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  return { data, loading, error, reload: loadData };
}
