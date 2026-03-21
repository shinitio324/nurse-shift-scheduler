import { useState, useEffect } from 'react';
import { db } from '../db';
import { Shift, ShiftRequest, ShiftRequestFormData, Staff } from '../types';
import {
  compareDateStrings,
  getMonthEndDateString,
  getMonthStartDateString,
  normalizeDateString,
} from '../utils/dateUtils';

export function useShiftRequests() {
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShiftRequests = async () => {
    try {
      setLoading(true);

      const shifts = await db.shifts.toArray();
      const staff = await db.staff.toArray();
      const staffMap = new Map<string, Staff>();
      staff.forEach((s) => staffMap.set(s.id, s));

      const requests: ShiftRequest[] = shifts.map((shift) => ({
        ...shift,
        date: normalizeDateString(shift.date),
        staffName: staffMap.get(shift.staffId)?.name || '不明なスタッフ',
        status: 'pending' as const,
        requestedAt: shift.createdAt,
      }));

      requests.sort((a, b) => compareDateStrings(b.date, a.date));
      setShiftRequests(requests);
    } catch (error) {
      console.error('シフトリクエストの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftRequests();
  }, []);

  const addShiftRequest = async (data: ShiftRequestFormData): Promise<boolean> => {
    try {
      const normalizedDate = normalizeDateString(data.date);

      const existing = await db.shifts
        .where('staffId')
        .equals(data.staffId)
        .and((shift) => normalizeDateString(shift.date) === normalizedDate)
        .first();

      if (existing) {
        console.warn('このスタッフは既にこの日のシフトが登録されています。');
        return false;
      }

      const newShift: Shift = {
        id: crypto.randomUUID(),
        staffId: data.staffId,
        date: normalizedDate,
        shiftType: data.shiftType as string,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.shifts.add(newShift);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの追加に失敗しました:', error);
      return false;
    }
  };

  const updateShiftRequest = async (
    id: string,
    data: Partial<ShiftRequestFormData>
  ): Promise<boolean> => {
    try {
      const payload: Partial<Shift> = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.date) {
        payload.date = normalizeDateString(data.date);
      }

      await db.shifts.update(id, payload);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの更新に失敗しました:', error);
      return false;
    }
  };

  const deleteShiftRequest = async (id: string): Promise<boolean> => {
    try {
      await db.shifts.delete(id);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの削除に失敗しました:', error);
      return false;
    }
  };

  const getShiftRequestsByStaff = (staffId: string): ShiftRequest[] => {
    return shiftRequests.filter((req) => req.staffId === staffId);
  };

  const getShiftRequestsByDate = (date: string): ShiftRequest[] => {
    const normalizedDate = normalizeDateString(date);
    return shiftRequests.filter((req) => req.date === normalizedDate);
  };

  const getShiftRequestsByMonth = (year: number, month: number): ShiftRequest[] => {
    const startDate = getMonthStartDateString(year, month);
    const endDate = getMonthEndDateString(year, month);

    return shiftRequests.filter(
      (req) => req.date >= startDate && req.date <= endDate
    );
  };

  const getShiftRequestsByStaffAndMonth = (
    staffId: string,
    year: number,
    month: number
  ): ShiftRequest[] => {
    return getShiftRequestsByMonth(year, month).filter((req) => req.staffId === staffId);
  };

  const getMonthlyStats = (year: number, month: number) => {
    const monthRequests = getShiftRequestsByMonth(year, month);

    const shiftTypeCounts: Record<string, number> = {};
    monthRequests.forEach((req) => {
      shiftTypeCounts[req.shiftType] = (shiftTypeCounts[req.shiftType] || 0) + 1;
    });

    const staffCounts: Record<string, number> = {};
    monthRequests.forEach((req) => {
      const name = req.staffName || '不明';
      staffCounts[name] = (staffCounts[name] || 0) + 1;
    });

    return {
      total: monthRequests.length,
      byShiftType: shiftTypeCounts,
      byStaff: staffCounts,
    };
  };

  const addBulkShiftRequests = async (
    requests: ShiftRequestFormData[]
  ): Promise<boolean> => {
    try {
      const normalized = requests.map((data) => ({
        id: crypto.randomUUID(),
        staffId: data.staffId,
        date: normalizeDateString(data.date),
        shiftType: data.shiftType as string,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.shifts.bulkAdd(normalized);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの一括追加に失敗しました:', error);
      return false;
    }
  };

  const deleteShiftRequestsByDateRange = async (
    startDate: string,
    endDate: string
  ): Promise<boolean> => {
    try {
      const start = normalizeDateString(startDate);
      const end = normalizeDateString(endDate);

      const toDelete = shiftRequests.filter(
        (req) => req.date >= start && req.date <= end
      );
      const ids = toDelete.map((req) => req.id);
      await db.shifts.bulkDelete(ids);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの削除に失敗しました:', error);
      return false;
    }
  };

  const clearStaffMonthShifts = async (
    staffId: string,
    year: number,
    month: number
  ): Promise<boolean> => {
    try {
      const toDelete = getShiftRequestsByStaffAndMonth(staffId, year, month);
      const ids = toDelete.map((req) => req.id);
      await db.shifts.bulkDelete(ids);
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストのクリアに失敗しました:', error);
      return false;
    }
  };

  return {
    shiftRequests,
    loading,
    addShiftRequest,
    updateShiftRequest,
    deleteShiftRequest,
    getShiftRequestsByStaff,
    getShiftRequestsByDate,
    getShiftRequestsByMonth,
    getShiftRequestsByStaffAndMonth,
    getMonthlyStats,
    addBulkShiftRequests,
    deleteShiftRequestsByDateRange,
    clearStaffMonthShifts,
    reload: loadShiftRequests,
  };
}
