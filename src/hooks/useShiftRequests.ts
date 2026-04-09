import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/index';
import type {
  Shift,
  ShiftPattern,
  ShiftRequest,
  ShiftRequestFormData,
  Staff,
  StaffId,
  PatternId,
} from '../types';
import {
  compareDateStrings,
  getMonthEndDateString,
  getMonthStartDateString,
  normalizeDateString,
} from '../utils/dateUtils';

type RequestSource = 'shiftRequests' | 'shifts';

export type ShiftRequestListItem = Omit<ShiftRequest, 'id'> & {
  id: string;
  __source: RequestSource;
  __rawId: string | number;
};

function encodeId(source: RequestSource, rawId: string | number): string {
  return `${source}:${String(rawId)}`;
}

function decodeId(id: string): { source: RequestSource; rawId: string } | null {
  if (id.startsWith('shiftRequests:')) {
    return {
      source: 'shiftRequests',
      rawId: id.slice('shiftRequests:'.length),
    };
  }

  if (id.startsWith('shifts:')) {
    return {
      source: 'shifts',
      rawId: id.slice('shifts:'.length),
    };
  }

  return null;
}

function sameId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function toNumericId(id: unknown): number | undefined {
  if (id == null || id === '') return undefined;
  const n = Number(id);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePatternId(id: unknown): PatternId | undefined {
  const numeric = toNumericId(id);
  if (numeric !== undefined) return numeric;
  if (id == null || id === '') return undefined;
  return String(id);
}

function normalizeStaffId(id: unknown): StaffId {
  if (id == null) return '';
  return String(id);
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : String(value ?? fallback);
}

function buildStaffMap(staffList: Staff[]): Map<string, Staff> {
  const map = new Map<string, Staff>();
  for (const member of staffList) {
    if (member?.id == null) continue;
    map.set(String(member.id), member);
  }
  return map;
}

function buildPatternMaps(patterns: ShiftPattern[]) {
  const byId = new Map<string, ShiftPattern>();
  const byName = new Map<string, ShiftPattern>();

  for (const pattern of patterns) {
    if (!pattern) continue;
    if (pattern.id != null) {
      byId.set(String(pattern.id), pattern);
    }
    byName.set(String(pattern.name ?? ''), pattern);
  }

  return { byId, byName };
}

function findPatternByFormData(
  patterns: ShiftPattern[],
  data: Partial<ShiftRequestFormData>
): ShiftPattern | undefined {
  if (data.patternId != null) {
    return patterns.find((p) => sameId(p.id, data.patternId));
  }

  if (data.shiftType != null) {
    return patterns.find((p) => String(p.name ?? '') === String(data.shiftType));
  }

  return undefined;
}

function isDuplicateRequest(
  rows: Array<{ staffId?: unknown; date?: unknown }>,
  staffId: StaffId,
  normalizedDate: string,
  ignoreRawId?: string | number
): boolean {
  return rows.some((row: any) => {
    if (!sameId(row?.staffId, staffId)) return false;
    if (normalizeDateString(String(row?.date ?? '')) !== normalizedDate) return false;
    if (ignoreRawId != null && String(row?.id) === String(ignoreRawId)) return false;
    return true;
  });
}

export function useShiftRequests() {
  const [shiftRequests, setShiftRequests] = useState<ShiftRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShiftRequests = useCallback(async () => {
    try {
      setLoading(true);

      const [requestRows, legacyRows, staffRows, patternRows] = await Promise.all([
        db.shiftRequests.toArray().catch(() => []),
        db.shifts.toArray().catch(() => []),
        db.staff.toArray().catch(() => []),
        db.shiftPatterns.toArray().catch(() => []),
      ]);

      const staffMap = buildStaffMap(staffRows as Staff[]);
      const { byId: patternById, byName: patternByName } = buildPatternMaps(
        patternRows as ShiftPattern[]
      );

      const normalizedFromRequests: ShiftRequestListItem[] = (requestRows as any[]).map(
        (row) => {
          const patternId = normalizePatternId(row?.patternId);
          const pattern =
            patternId != null ? patternById.get(String(patternId)) : undefined;
          const staffId = normalizeStaffId(row?.staffId);

          return {
            ...(row as ShiftRequest),
            id: encodeId('shiftRequests', row.id),
            __source: 'shiftRequests',
            __rawId: row.id,
            staffId,
            date: normalizeDateString(safeString(row?.date)),
            shiftType: safeString(row?.shiftType, pattern?.name ?? ''),
            patternId,
            staffName: staffMap.get(String(staffId))?.name ?? '不明なスタッフ',
            status: (row?.status ?? 'pending') as ShiftRequest['status'],
            requestedAt: row?.requestedAt ?? row?.createdAt ?? new Date(),
          };
        }
      );

      const normalizedFromLegacy: ShiftRequestListItem[] = (legacyRows as any[]).map(
        (row) => {
          const shiftType = safeString(row?.shiftType);
          const pattern = patternByName.get(shiftType);
          const staffId = normalizeStaffId(row?.staffId);

          return {
            ...(row as ShiftRequest),
            id: encodeId('shifts', row.id),
            __source: 'shifts',
            __rawId: row.id,
            staffId,
            date: normalizeDateString(safeString(row?.date)),
            shiftType,
            patternId: normalizePatternId(pattern?.id),
            staffName: staffMap.get(String(staffId))?.name ?? '不明なスタッフ',
            status: 'pending',
            requestedAt: row?.createdAt ?? new Date(),
          };
        }
      );

      const merged: ShiftRequestListItem[] = [];
      const seen = new Set<string>();

      for (const req of [...normalizedFromRequests, ...normalizedFromLegacy]) {
        if (!req.staffId || !req.date) continue;

        const key = `${String(req.staffId)}__${req.date}`;
        if (seen.has(key)) continue;

        seen.add(key);
        merged.push(req);
      }

      merged.sort((a, b) => compareDateStrings(b.date, a.date));
      setShiftRequests(merged);
    } catch (error) {
      console.error('シフト希望の読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShiftRequests();
  }, [loadShiftRequests]);

  const addShiftRequest = useCallback(
    async (data: ShiftRequestFormData): Promise<boolean> => {
      try {
        const normalizedDate = normalizeDateString(data.date);
        const normalizedStaffId = normalizeStaffId(data.staffId);

        const [requestRows, legacyRows, patterns] = await Promise.all([
          db.shiftRequests.toArray().catch(() => []),
          db.shifts.toArray().catch(() => []),
          db.shiftPatterns.toArray().catch(() => []),
        ]);

        if (
          isDuplicateRequest(requestRows as any[], normalizedStaffId, normalizedDate) ||
          isDuplicateRequest(legacyRows as any[], normalizedStaffId, normalizedDate)
        ) {
          console.warn('このスタッフは既にこの日のシフト希望が登録されています。');
          return false;
        }

        const matchedPattern = findPatternByFormData(patterns as ShiftPattern[], data);
        const finalShiftType =
          data.shiftType != null && String(data.shiftType).length > 0
            ? String(data.shiftType)
            : String(matchedPattern?.name ?? '');

        const now = new Date();

        await db.shiftRequests.add({
          staffId: normalizedStaffId,
          date: normalizedDate,
          shiftType: finalShiftType,
          patternId: normalizePatternId(data.patternId ?? matchedPattern?.id),
          status: 'pending',
          note: data.note,
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
        } as ShiftRequest);

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('シフト希望の追加に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const updateShiftRequest = useCallback(
    async (id: string, data: Partial<ShiftRequestFormData>): Promise<boolean> => {
      try {
        const decoded = decodeId(id);
        if (!decoded) return false;

        const [requestRows, legacyRows, patterns] = await Promise.all([
          db.shiftRequests.toArray().catch(() => []),
          db.shifts.toArray().catch(() => []),
          db.shiftPatterns.toArray().catch(() => []),
        ]);

        const matchedPattern = findPatternByFormData(patterns as ShiftPattern[], data);
        const normalizedDate =
          data.date !== undefined ? normalizeDateString(data.date) : undefined;
        const normalizedStaffId =
          data.staffId !== undefined ? normalizeStaffId(data.staffId) : undefined;
        const normalizedShiftType =
          data.shiftType !== undefined
            ? String(data.shiftType)
            : matchedPattern?.name !== undefined
            ? String(matchedPattern.name)
            : undefined;
        const nextPatternId =
          data.patternId !== undefined || matchedPattern?.id !== undefined
            ? normalizePatternId(data.patternId ?? matchedPattern?.id)
            : undefined;

        if (decoded.source === 'shiftRequests') {
          const current = (requestRows as any[]).find(
            (row) => String(row?.id) === String(decoded.rawId)
          );
          if (!current) return false;

          const nextStaffId = normalizedStaffId ?? normalizeStaffId(current.staffId);
          const nextDate = normalizedDate ?? normalizeDateString(String(current.date ?? ''));

          const duplicateInRequests = isDuplicateRequest(
            requestRows as any[],
            nextStaffId,
            nextDate,
            decoded.rawId
          );

          const duplicateInLegacy = isDuplicateRequest(
            legacyRows as any[],
            nextStaffId,
            nextDate
          );

          if (duplicateInRequests || duplicateInLegacy) {
            console.warn('更新後のスタッフ・日付に重複するシフト希望があります。');
            return false;
          }

          const payload: Partial<ShiftRequest> = {
            updatedAt: new Date(),
          };

          if (normalizedStaffId !== undefined) {
            payload.staffId = normalizedStaffId;
          }

          if (normalizedDate !== undefined) {
            payload.date = normalizedDate;
          }

          if (normalizedShiftType !== undefined) {
            payload.shiftType = normalizedShiftType;
          }

          if (data.patternId !== undefined || matchedPattern?.id !== undefined) {
            payload.patternId = nextPatternId;
          }

          if (data.note !== undefined) {
            payload.note = data.note;
          }

          await db.shiftRequests.update(Number(decoded.rawId), payload as any);
        } else {
          const current = (legacyRows as any[]).find(
            (row) => String(row?.id) === String(decoded.rawId)
          );
          if (!current) return false;

          const nextStaffId = normalizedStaffId ?? normalizeStaffId(current.staffId);
          const nextDate = normalizedDate ?? normalizeDateString(String(current.date ?? ''));

          const duplicateInRequests = isDuplicateRequest(
            requestRows as any[],
            nextStaffId,
            nextDate
          );

          const duplicateInLegacy = isDuplicateRequest(
            legacyRows as any[],
            nextStaffId,
            nextDate,
            decoded.rawId
          );

          if (duplicateInRequests || duplicateInLegacy) {
            console.warn('更新後のスタッフ・日付に重複するシフト希望があります。');
            return false;
          }

          const payload: Partial<Shift> = {
            updatedAt: new Date(),
          };

          if (normalizedStaffId !== undefined) {
            payload.staffId = normalizedStaffId;
          }

          if (normalizedDate !== undefined) {
            payload.date = normalizedDate;
          }

          if (normalizedShiftType !== undefined) {
            payload.shiftType = normalizedShiftType;
          }

          if (data.note !== undefined) {
            payload.note = data.note;
          }

          await db.shifts.update(decoded.rawId as any, payload as any);
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('シフト希望の更新に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const deleteShiftRequest = useCallback(
    async (id: string): Promise<boolean> => {
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
        console.error('シフト希望の削除に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const getShiftRequestsByStaff = useCallback(
    (staffId: StaffId): ShiftRequestListItem[] => {
      return shiftRequests.filter((req) => sameId(req.staffId, staffId));
    },
    [shiftRequests]
  );

  const getShiftRequestsByDate = useCallback(
    (date: string): ShiftRequestListItem[] => {
      const normalizedDate = normalizeDateString(date);
      return shiftRequests.filter((req) => req.date === normalizedDate);
    },
    [shiftRequests]
  );

  const getShiftRequestsByMonth = useCallback(
    (year: number, month: number): ShiftRequestListItem[] => {
      const startDate = getMonthStartDateString(year, month);
      const endDate = getMonthEndDateString(year, month);

      return shiftRequests.filter(
        (req) => req.date >= startDate && req.date <= endDate
      );
    },
    [shiftRequests]
  );

  const getShiftRequestsByStaffAndMonth = useCallback(
    (staffId: StaffId, year: number, month: number): ShiftRequestListItem[] => {
      return getShiftRequestsByMonth(year, month).filter((req) =>
        sameId(req.staffId, staffId)
      );
    },
    [getShiftRequestsByMonth]
  );

  const getMonthlyStats = useCallback(
    (year: number, month: number) => {
      const monthRequests = getShiftRequestsByMonth(year, month);

      const shiftTypeCounts: Record<string, number> = {};
      const staffCounts: Record<string, number> = {};

      for (const req of monthRequests) {
        const shiftType = String(req.shiftType ?? '');
        const staffName = String(req.staffName ?? '不明');

        shiftTypeCounts[shiftType] = (shiftTypeCounts[shiftType] || 0) + 1;
        staffCounts[staffName] = (staffCounts[staffName] || 0) + 1;
      }

      return {
        total: monthRequests.length,
        byShiftType: shiftTypeCounts,
        byStaff: staffCounts,
      };
    },
    [getShiftRequestsByMonth]
  );

  const addBulkShiftRequests = useCallback(
    async (requests: ShiftRequestFormData[]): Promise<boolean> => {
      try {
        for (const req of requests) {
          const ok = await addShiftRequest(req);
          if (!ok) return false;
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('シフト希望の一括追加に失敗しました:', error);
        return false;
      }
    },
    [addShiftRequest, loadShiftRequests]
  );

  const deleteShiftRequestsByDateRange = useCallback(
    async (startDate: string, endDate: string): Promise<boolean> => {
      try {
        const start = normalizeDateString(startDate);
        const end = normalizeDateString(endDate);

        const targets = shiftRequests.filter(
          (req) => req.date >= start && req.date <= end
        );

        for (const req of targets) {
          await deleteShiftRequest(req.id);
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('日付範囲のシフト希望削除に失敗しました:', error);
        return false;
      }
    },
    [deleteShiftRequest, loadShiftRequests, shiftRequests]
  );

  const clearStaffMonthShifts = useCallback(
    async (staffId: StaffId, year: number, month: number): Promise<boolean> => {
      try {
        const targets = getShiftRequestsByStaffAndMonth(staffId, year, month);

        for (const req of targets) {
          await deleteShiftRequest(req.id);
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('スタッフ月間シフト希望のクリアに失敗しました:', error);
        return false;
      }
    },
    [deleteShiftRequest, getShiftRequestsByStaffAndMonth, loadShiftRequests]
  );

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
