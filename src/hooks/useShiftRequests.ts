import { useEffect, useState } from 'react';
import { db } from '../db';
import type {
  Shift,
  ShiftPattern,
  ShiftRequest,
  ShiftRequestFormData,
  Staff,
} from '../types';
import {
  compareDateStrings,
  getMonthEndDateString,
  getMonthStartDateString,
  normalizeDateString,
} from '../utils/dateUtils';

type RequestSource = 'shiftRequests' | 'shifts';

type InternalShiftRequest = ShiftRequest & {
  id: string;
  __source: RequestSource;
  __rawId: string | number;
};

function encodeId(source: RequestSource, rawId: string | number): string {
  return `${source}:${String(rawId)}`;
}

function decodeId(id: string): { source: RequestSource; rawId: string } | null {
  if (id.startsWith('shiftRequests:')) {
    return { source: 'shiftRequests', rawId: id.slice('shiftRequests:'.length) };
  }
  if (id.startsWith('shifts:')) {
    return { source: 'shifts', rawId: id.slice('shifts:'.length) };
  }
  return null;
}

export function useShiftRequests() {
  const [shiftRequests, setShiftRequests] = useState<InternalShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShiftRequests = async () => {
    try {
      setLoading(true);

      const [requestRows, legacyRows, staff, patterns] = await Promise.all([
        db.shiftRequests.toArray().catch(() => []),
        db.shifts.toArray().catch(() => []),
        db.staff.toArray().catch(() => []),
        db.shiftPatterns.toArray().catch(() => []),
      ]);

      const staffMap = new Map<string, Staff>();
      staff.forEach((s) => staffMap.set(String(s.id), s));

      const patternById = new Map<string, ShiftPattern>();
      const patternByName = new Map<string, ShiftPattern>();
      patterns.forEach((p) => {
        if (p?.id != null) {
          patternById.set(String(p.id), p);
        }
        patternByName.set(String(p.name ?? ''), p);
      });

      const fromShiftRequests: InternalShiftRequest[] = (requestRows as any[]).map((row) => {
        const pattern = row?.patternId != null ? patternById.get(String(row.patternId)) : undefined;
        return {
          ...(row as any),
          id: encodeId('shiftRequests', row.id),
          __source: 'shiftRequests',
          __rawId: row.id,
          staffId: String(row.staffId ?? ''),
          date: normalizeDateString(String(row.date ?? '')),
          shiftType: String(row.shiftType ?? pattern?.name ?? ''),
          patternId: row.patternId,
          staffName: staffMap.get(String(row.staffId ?? ''))?.name || '不明なスタッフ',
          status: (row.status ?? 'pending') as ShiftRequest['status'],
          requestedAt: row.requestedAt ?? row.createdAt ?? new Date(),
        };
      });

      const fromLegacyShifts: InternalShiftRequest[] = (legacyRows as any[]).map((shift) => {
        const shiftType = String(shift.shiftType ?? '');
        const pattern = patternByName.get(shiftType);
        return {
          ...(shift as any),
          id: encodeId('shifts', shift.id),
          __source: 'shifts',
          __rawId: shift.id,
          staffId: String(shift.staffId ?? ''),
          date: normalizeDateString(String(shift.date ?? '')),
          shiftType,
          patternId: pattern?.id,
          staffName: staffMap.get(String(shift.staffId ?? ''))?.name || '不明なスタッフ',
          status: 'pending' as const,
          requestedAt: shift.createdAt ?? new Date(),
        };
      });

      const merged: InternalShiftRequest[] = [];
      const seen = new Set<string>();

      for (const req of [...fromShiftRequests, ...fromLegacyShifts]) {
        const key = `${req.staffId}__${req.date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(req);
      }

      merged.sort((a, b) => compareDateStrings(b.date, a.date));
      setShiftRequests(merged);
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
      const normalizedShiftType = String(data.shiftType ?? '');

      const [existingRequest, existingLegacy, patterns] = await Promise.all([
        db.shiftRequests
          .where('staffId')
          .equals(data.staffId as any)
          .and((row: any) => normalizeDateString(String(row.date ?? '')) === normalizedDate)
          .first(),
        db.shifts
          .where('staffId')
          .equals(data.staffId as any)
          .and((row: any) => normalizeDateString(String(row.date ?? '')) === normalizedDate)
          .first(),
        db.shiftPatterns.toArray().catch(() => []),
      ]);

      if (existingRequest || existingLegacy) {
        console.warn('このスタッフは既にこの日のシフト希望が登録されています。');
        return false;
      }

      const pattern = (patterns as ShiftPattern[]).find(
        (p) => String(p.name ?? '') === normalizedShiftType
      );

      const now = new Date();

      await db.shiftRequests.add({
        staffId: data.staffId,
        date: normalizedDate,
        shiftType: normalizedShiftType,
        patternId: pattern?.id,
        status: 'pending',
        note: data.note,
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      } as any);

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
      const decoded = decodeId(id);
      if (!decoded) return false;

      const patterns = await db.shiftPatterns.toArray().catch(() => []);
      const normalizedShiftType =
        data.shiftType !== undefined ? String(data.shiftType) : undefined;
      const pattern = normalizedShiftType
        ? (patterns as ShiftPattern[]).find((p) => String(p.name ?? '') === normalizedShiftType)
        : undefined;

      if (decoded.source === 'shiftRequests') {
        const payload: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (data.date) {
          payload.date = normalizeDateString(data.date);
        }
        if (normalizedShiftType !== undefined) {
          payload.shiftType = normalizedShiftType;
          payload.patternId = pattern?.id;
        }

        await db.shiftRequests.update(Number(decoded.rawId), payload as any);
      } else {
        const payload: Partial<Shift> = {
          updatedAt: new Date(),
        };

        if (data.date) {
          payload.date = normalizeDateString(data.date);
        }
        if (normalizedShiftType !== undefined) {
          payload.shiftType = normalizedShiftType;
        }

        await db.shifts.update(decoded.rawId, payload as any);
      }

      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストの更新に失敗しました:', error);
      return false;
    }
  };

  const deleteShiftRequest = async (id: string): Promise<boolean> => {
    try {
      const decoded = decodeId(id);
      if (!decoded) return false;

      if (decoded.source === 'shiftRequests') {
        await db.shiftRequests.delete(Number(decoded.rawId));
      } else {
        await db.shifts.delete(decoded.rawId as any);
      }

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
      for (const req of requests) {
        const ok = await addShiftRequest(req);
        if (!ok) {
          return false;
        }
      }
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

      for (const req of toDelete) {
        await deleteShiftRequest(req.id);
      }

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
      for (const req of toDelete) {
        await deleteShiftRequest(String(req.id));
      }
      await loadShiftRequests();
      return true;
    } catch (error) {
      console.error('シフトリクエストのクリアに失敗しました:', error);
      return false;
    }
  };

  return {
    shiftRequests: shiftRequests as ShiftRequest[],
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
