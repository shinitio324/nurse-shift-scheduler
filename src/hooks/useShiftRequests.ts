import { useCallback, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../db/index';
import type {
  Shift,
  ShiftPattern,
  ShiftRequest,
  ShiftRequestFormData,
  Staff,
} from '../types';

type RequestSource = 'shiftRequests' | 'shifts';

export type DisplayShiftRequest = ShiftRequest & {
  id: string;
  __source: RequestSource;
  __rawId: string | number;
};

type MonthlyStats = {
  total: number;
  byShiftType: Record<string, number>;
  byStaff: Record<string, number>;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDateString(value: unknown): string {
  const raw = safeString(value);

  if (!raw) return '';

  const directMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (directMatch) {
    const [, y, m, d] = directMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareDateStrings(a: string, b: string): number {
  const aa = normalizeDateString(a);
  const bb = normalizeDateString(b);
  if (aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

function getMonthStartDateString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getMonthEndDateString(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function normalizeStaffId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return safeString(value);
}

function normalizePatternId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toNumericId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

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

function buildStaffMap(staffList: Staff[]): Map<string, Staff> {
  const map = new Map<string, Staff>();
  for (const staff of staffList) {
    map.set(normalizeStaffId(staff.id), staff);
  }
  return map;
}

function buildPatternMaps(patterns: ShiftPattern[]) {
  const byId = new Map<string, ShiftPattern>();
  const byName = new Map<string, ShiftPattern>();

  for (const pattern of patterns) {
    if (pattern.id != null) {
      byId.set(String(pattern.id), pattern);
    }
    byName.set(safeString(pattern.name), pattern);
  }

  return { byId, byName };
}

function findPatternByFormData(
  patterns: ShiftPattern[],
  data: Partial<ShiftRequestFormData>
): ShiftPattern | undefined {
  const normalizedPatternId = normalizePatternId(data.patternId);
  if (normalizedPatternId != null) {
    const byId = patterns.find((pattern) => pattern.id === normalizedPatternId);
    if (byId) return byId;
  }

  const normalizedShiftType = safeString(data.shiftType);
  if (normalizedShiftType) {
    return patterns.find((pattern) => safeString(pattern.name) === normalizedShiftType);
  }

  return undefined;
}

function isDuplicateRequest(
  requests: Array<Pick<ShiftRequest, 'staffId' | 'date'>>,
  staffId: string,
  date: string,
  excludeKey?: string
): boolean {
  return requests.some((request, index) => {
    const key = `${normalizeStaffId(request.staffId)}__${normalizeDateString(request.date)}__${index}`;
    if (excludeKey && key === excludeKey) {
      return false;
    }
    return (
      normalizeStaffId(request.staffId) === staffId &&
      normalizeDateString(request.date) === date
    );
  });
}

function makeRequestIdentityKey(request: Pick<ShiftRequest, 'staffId' | 'date'>, index: number): string {
  return `${normalizeStaffId(request.staffId)}__${normalizeDateString(request.date)}__${index}`;
}

export function useShiftRequests() {
  const [shiftRequests, setShiftRequests] = useState<DisplayShiftRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadShiftRequests = useCallback(async () => {
    try {
      setLoading(true);

      await initializeDatabase();

      const [requestRows, legacyRows, staffRows, patternRows] = await Promise.all([
        db.shiftRequests.toArray().catch(() => []),
        db.shifts.toArray().catch(() => []),
        db.staff.toArray().catch(() => []),
        db.shiftPatterns.toArray().catch(() => []),
      ]);

      const staffMap = buildStaffMap(staffRows as Staff[]);
      const patternMaps = buildPatternMaps(patternRows as ShiftPattern[]);

      const normalizedRequests: DisplayShiftRequest[] = (requestRows as ShiftRequest[]).map(
        (row) => {
          const normalizedStaffId = normalizeStaffId(row.staffId);
          const normalizedDate = normalizeDateString(row.date);
          const pattern =
            row.patternId != null
              ? patternMaps.byId.get(String(row.patternId))
              : patternMaps.byName.get(safeString(row.shiftType));

          return {
            ...row,
            id: encodeId('shiftRequests', row.id as number),
            __source: 'shiftRequests',
            __rawId: row.id as number,
            staffId: normalizedStaffId,
            date: normalizedDate,
            shiftType: safeString(row.shiftType) || safeString(pattern?.name),
            patternId:
              normalizePatternId(row.patternId) ?? normalizePatternId(pattern?.id),
            staffName:
              safeString(row.staffName) ||
              safeString(staffMap.get(normalizedStaffId)?.name) ||
              '不明なスタッフ',
            status: row.status ?? 'pending',
            requestedAt: row.requestedAt ?? row.createdAt ?? new Date(),
          };
        }
      );

      const normalizedLegacy: DisplayShiftRequest[] = (legacyRows as Shift[]).map((row) => {
        const normalizedStaffId = normalizeStaffId(row.staffId);
        const normalizedDate = normalizeDateString(row.date);
        const normalizedShiftType = safeString(row.shiftType);
        const pattern = patternMaps.byName.get(normalizedShiftType);

        return {
          id: encodeId('shifts', row.id as string | number),
          __source: 'shifts',
          __rawId: row.id as string | number,
          staffId: normalizedStaffId,
          date: normalizedDate,
          shiftType: normalizedShiftType,
          patternId: normalizePatternId(pattern?.id),
          staffName:
            safeString(row.staffName) ||
            safeString(staffMap.get(normalizedStaffId)?.name) ||
            '不明なスタッフ',
          status: 'pending',
          note: row.note,
          requestedAt: row.createdAt ?? new Date(),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      });

      const merged: DisplayShiftRequest[] = [];
      const seen = new Set<string>();

      for (const request of [...normalizedRequests, ...normalizedLegacy]) {
        const uniqueKey = `${normalizeStaffId(request.staffId)}__${normalizeDateString(request.date)}`;
        if (seen.has(uniqueKey)) {
          continue;
        }
        seen.add(uniqueKey);
        merged.push(request);
      }

      merged.sort((a, b) => {
        const dateCompare = compareDateStrings(a.date, b.date);
        if (dateCompare !== 0) return dateCompare;
        const staffCompare = safeString(a.staffName).localeCompare(safeString(b.staffName), 'ja');
        if (staffCompare !== 0) return staffCompare;
        return safeString(a.shiftType).localeCompare(safeString(b.shiftType), 'ja');
      });

      setShiftRequests(merged);
    } catch (error) {
      console.error('❌ シフト希望の読み込みに失敗しました:', error);
      setShiftRequests([]);
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
        const normalizedStaffId = normalizeStaffId(data.staffId);
        const normalizedDate = normalizeDateString(data.date);

        if (!normalizedStaffId || !normalizedDate) {
          console.warn('⚠️ staffId または date が不正です');
          return false;
        }

        const [requestRows, legacyRows, patterns] = await Promise.all([
          db.shiftRequests.toArray().catch(() => []),
          db.shifts.toArray().catch(() => []),
          db.shiftPatterns.toArray().catch(() => []),
        ]);

        const currentRequests = requestRows as ShiftRequest[];
        const currentLegacy = legacyRows as Shift[];
        const allForDuplicateCheck: Array<Pick<ShiftRequest, 'staffId' | 'date'>> = [
          ...currentRequests.map((row) => ({
            staffId: row.staffId,
            date: row.date,
          })),
          ...currentLegacy.map((row) => ({
            staffId: row.staffId,
            date: row.date,
          })),
        ];

        if (isDuplicateRequest(allForDuplicateCheck, normalizedStaffId, normalizedDate)) {
          console.warn('⚠️ 同一スタッフ・同一日の希望はすでに存在します');
          return false;
        }

        const pattern = findPatternByFormData(patterns as ShiftPattern[], data);
        const normalizedShiftType =
          safeString(data.shiftType) || safeString(pattern?.name);

        if (!normalizedShiftType) {
          console.warn('⚠️ shiftType または patternId が不正です');
          return false;
        }

        const now = new Date();

        await db.shiftRequests.add({
          staffId: normalizedStaffId,
          date: normalizedDate,
          shiftType: normalizedShiftType,
          patternId: normalizePatternId(data.patternId) ?? normalizePatternId(pattern?.id),
          status: 'pending',
          note: safeString(data.note) || undefined,
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
        } as ShiftRequest);

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ シフト希望の追加に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const updateShiftRequest = useCallback(
    async (
      id: string,
      data: Partial<ShiftRequestFormData>
    ): Promise<boolean> => {
      try {
        const decoded = decodeId(id);
        if (!decoded) {
          console.warn('⚠️ 不正なIDです:', id);
          return false;
        }

        const [requestRows, legacyRows, patternRows] = await Promise.all([
          db.shiftRequests.toArray().catch(() => []),
          db.shifts.toArray().catch(() => []),
          db.shiftPatterns.toArray().catch(() => []),
        ]);

        const patterns = patternRows as ShiftPattern[];

        if (decoded.source === 'shiftRequests') {
          const rawNumericId = toNumericId(decoded.rawId);
          if (rawNumericId == null) return false;

          const current = (requestRows as ShiftRequest[]).find((row) => row.id === rawNumericId);
          if (!current) {
            console.warn('⚠️ 更新対象の shiftRequests 行が見つかりません:', decoded.rawId);
            return false;
          }

          const nextStaffId =
            data.staffId !== undefined
              ? normalizeStaffId(data.staffId)
              : normalizeStaffId(current.staffId);

          const nextDate =
            data.date !== undefined
              ? normalizeDateString(data.date)
              : normalizeDateString(current.date);

          if (!nextStaffId || !nextDate) {
            console.warn('⚠️ 更新後の staffId または date が不正です');
            return false;
          }

          const allForDuplicateCheck = [
            ...(requestRows as ShiftRequest[]).map((row, index) => ({
              request: { staffId: row.staffId, date: row.date },
              key: makeRequestIdentityKey(
                { staffId: row.staffId, date: row.date },
                index
              ),
              id: row.id,
              source: 'shiftRequests' as const,
            })),
            ...(legacyRows as Shift[]).map((row, index) => ({
              request: { staffId: row.staffId, date: row.date },
              key: makeRequestIdentityKey(
                { staffId: row.staffId, date: row.date },
                index + 100000
              ),
              id: row.id,
              source: 'shifts' as const,
            })),
          ];

          const duplicateExists = allForDuplicateCheck.some((row) => {
            if (row.source === 'shiftRequests' && row.id === rawNumericId) {
              return false;
            }
            return (
              normalizeStaffId(row.request.staffId) === nextStaffId &&
              normalizeDateString(row.request.date) === nextDate
            );
          });

          if (duplicateExists) {
            console.warn('⚠️ 更新後に同一スタッフ・同一日の重複が発生します');
            return false;
          }

          const pattern = findPatternByFormData(patterns, data);
          const nextShiftType =
            data.shiftType !== undefined
              ? safeString(data.shiftType) || safeString(pattern?.name)
              : current.shiftType;

          const patch: Partial<ShiftRequest> = {
            staffId: nextStaffId,
            date: nextDate,
            updatedAt: new Date(),
          };

          if (data.shiftType !== undefined || data.patternId !== undefined) {
            patch.shiftType = nextShiftType;
            patch.patternId =
              normalizePatternId(data.patternId) ??
              normalizePatternId(pattern?.id) ??
              normalizePatternId(current.patternId);
          }

          if (data.note !== undefined) {
            patch.note = safeString(data.note) || undefined;
          }

          await db.shiftRequests.update(rawNumericId, patch);
        } else {
          const current = await db.shifts.get(decoded.rawId as any);
          if (!current) {
            console.warn('⚠️ 更新対象の legacy shifts 行が見つかりません:', decoded.rawId);
            return false;
          }

          const nextStaffId =
            data.staffId !== undefined
              ? normalizeStaffId(data.staffId)
              : normalizeStaffId(current.staffId);

          const nextDate =
            data.date !== undefined
              ? normalizeDateString(data.date)
              : normalizeDateString(current.date);

          if (!nextStaffId || !nextDate) {
            console.warn('⚠️ 更新後の staffId または date が不正です');
            return false;
          }

          const requestRowsNormalized = (requestRows as ShiftRequest[]).map((row) => ({
            source: 'shiftRequests' as const,
            id: row.id,
            staffId: normalizeStaffId(row.staffId),
            date: normalizeDateString(row.date),
          }));

          const legacyRowsNormalized = (legacyRows as Shift[]).map((row) => ({
            source: 'shifts' as const,
            id: row.id,
            staffId: normalizeStaffId(row.staffId),
            date: normalizeDateString(row.date),
          }));

          const duplicateExists = [...requestRowsNormalized, ...legacyRowsNormalized].some(
            (row) => {
              if (row.source === 'shifts' && String(row.id) === String(decoded.rawId)) {
                return false;
              }
              return row.staffId === nextStaffId && row.date === nextDate;
            }
          );

          if (duplicateExists) {
            console.warn('⚠️ 更新後に同一スタッフ・同一日の重複が発生します');
            return false;
          }

          const pattern = findPatternByFormData(patterns, data);
          const nextShiftType =
            data.shiftType !== undefined
              ? safeString(data.shiftType) || safeString(pattern?.name)
              : safeString(current.shiftType);

          const patch: Partial<Shift> = {
            staffId: nextStaffId,
            date: nextDate,
            updatedAt: new Date(),
          };

          if (data.shiftType !== undefined || data.patternId !== undefined) {
            patch.shiftType = nextShiftType;
          }

          if (data.note !== undefined) {
            patch.note = safeString(data.note) || undefined;
          }

          await db.shifts.update(decoded.rawId as any, patch as any);
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ シフト希望の更新に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const deleteShiftRequest = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const decoded = decodeId(id);
        if (!decoded) {
          console.warn('⚠️ 不正なIDです:', id);
          return false;
        }

        if (decoded.source === 'shiftRequests') {
          const rawNumericId = toNumericId(decoded.rawId);
          if (rawNumericId == null) return false;
          await db.shiftRequests.delete(rawNumericId);
        } else {
          await db.shifts.delete(decoded.rawId as any);
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ シフト希望の削除に失敗しました:', error);
        return false;
      }
    },
    [loadShiftRequests]
  );

  const getShiftRequestsByStaff = useCallback(
    (staffId: string | number): DisplayShiftRequest[] => {
      const normalizedStaffId = normalizeStaffId(staffId);
      return shiftRequests.filter(
        (request) => normalizeStaffId(request.staffId) === normalizedStaffId
      );
    },
    [shiftRequests]
  );

  const getShiftRequestsByDate = useCallback(
    (date: string): DisplayShiftRequest[] => {
      const normalizedDate = normalizeDateString(date);
      return shiftRequests.filter(
        (request) => normalizeDateString(request.date) === normalizedDate
      );
    },
    [shiftRequests]
  );

  const getShiftRequestsByMonth = useCallback(
    (year: number, month: number): DisplayShiftRequest[] => {
      const start = getMonthStartDateString(year, month);
      const end = getMonthEndDateString(year, month);

      return shiftRequests.filter((request) => {
        const date = normalizeDateString(request.date);
        return date >= start && date <= end;
      });
    },
    [shiftRequests]
  );

  const getShiftRequestsByStaffAndMonth = useCallback(
    (staffId: string | number, year: number, month: number): DisplayShiftRequest[] => {
      const normalizedStaffId = normalizeStaffId(staffId);
      return getShiftRequestsByMonth(year, month).filter(
        (request) => normalizeStaffId(request.staffId) === normalizedStaffId
      );
    },
    [getShiftRequestsByMonth]
  );

  const getMonthlyStats = useCallback(
    (year: number, month: number): MonthlyStats => {
      const monthRequests = getShiftRequestsByMonth(year, month);

      const byShiftType: Record<string, number> = {};
      const byStaff: Record<string, number> = {};

      for (const request of monthRequests) {
        const shiftType = safeString(request.shiftType) || '未設定';
        const staffName = safeString(request.staffName) || '不明';

        byShiftType[shiftType] = (byShiftType[shiftType] ?? 0) + 1;
        byStaff[staffName] = (byStaff[staffName] ?? 0) + 1;
      }

      return {
        total: monthRequests.length,
        byShiftType,
        byStaff,
      };
    },
    [getShiftRequestsByMonth]
  );

  const addBulkShiftRequests = useCallback(
    async (requests: ShiftRequestFormData[]): Promise<boolean> => {
      try {
        for (const request of requests) {
          const ok = await addShiftRequest(request);
          if (!ok) {
            return false;
          }
        }
        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ シフト希望の一括追加に失敗しました:', error);
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

        const targets = shiftRequests.filter((request) => {
          const date = normalizeDateString(request.date);
          return date >= start && date <= end;
        });

        for (const request of targets) {
          const ok = await deleteShiftRequest(request.id);
          if (!ok) return false;
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ 期間指定削除に失敗しました:', error);
        return false;
      }
    },
    [deleteShiftRequest, loadShiftRequests, shiftRequests]
  );

  const clearStaffMonthShifts = useCallback(
    async (staffId: string | number, year: number, month: number): Promise<boolean> => {
      try {
        const targets = getShiftRequestsByStaffAndMonth(staffId, year, month);

        for (const request of targets) {
          const ok = await deleteShiftRequest(request.id);
          if (!ok) return false;
        }

        await loadShiftRequests();
        return true;
      } catch (error) {
        console.error('❌ スタッフ月次希望のクリアに失敗しました:', error);
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
