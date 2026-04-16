import { useCallback, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../db/index';
import type {
  ConstraintsFormData,
  ScheduleConstraints,
} from '../types';

type LegacyScheduleConstraintRow = Partial<ScheduleConstraints> & {
  id?: number | string;
  name?: string;
  isActive?: boolean;
  priority?: number;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function toNumericId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function sortConstraints(list: ScheduleConstraints[]): ScheduleConstraints[] {
  return [...list].sort((a, b) => {
    const priorityDiff = safeNumber(a.priority, 9999) - safeNumber(b.priority, 9999);
    if (priorityDiff !== 0) return priorityDiff;

    const idDiff = safeNumber(a.id, 0) - safeNumber(b.id, 0);
    if (idDiff !== 0) return idDiff;

    const aName = safeString(a.name) || '制約';
    const bName = safeString(b.name) || '制約';
    return aName.localeCompare(bName, 'ja');
  });
}

function normalizeConstraintRow(
  row: Partial<ScheduleConstraints> | null | undefined
): ScheduleConstraints {
  const minRestDaysPerMonth =
    row?.minRestDaysPerMonth !== undefined
      ? safeNumber(row.minRestDaysPerMonth, 9)
      : row?.exactRestDaysPerMonth !== undefined
        ? safeNumber(row.exactRestDaysPerMonth, 9)
        : 9;

  const exactRestDaysPerMonth =
    row?.exactRestDaysPerMonth !== undefined
      ? safeNumber(row.exactRestDaysPerMonth, minRestDaysPerMonth)
      : minRestDaysPerMonth;

  return {
    id: toNumericId(row?.id),
    maxConsecutiveWorkDays: safeNumber(row?.maxConsecutiveWorkDays, 5),
    minRestDaysBetweenNights: safeNumber(row?.minRestDaysBetweenNights, 1),
    minWorkDaysPerMonth: safeNumber(row?.minWorkDaysPerMonth, 20),
    minRestDaysPerMonth,
    exactRestDaysPerMonth,
    restAfterAke: safeBoolean(row?.restAfterAke, true),
    maxNightShiftsPerMonth: safeNumber(row?.maxNightShiftsPerMonth, 8),
    preferMixedGenderNightShift: safeBoolean(row?.preferMixedGenderNightShift, true),
    sunHolidayDayStaffRequired: safeNumber(row?.sunHolidayDayStaffRequired, 3),
    name: safeString(row?.name) || undefined,
    isActive:
      typeof row?.isActive === 'boolean'
        ? row.isActive
        : true,
    priority: safeNumber(row?.priority, 1),
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
  };
}

function normalizeFormData(
  data: Partial<ConstraintsFormData>
): Partial<ScheduleConstraints> {
  const result: Partial<ScheduleConstraints> = {};

  if (data.maxConsecutiveWorkDays !== undefined) {
    result.maxConsecutiveWorkDays = safeNumber(data.maxConsecutiveWorkDays, 5);
  }

  if (data.minRestDaysBetweenNights !== undefined) {
    result.minRestDaysBetweenNights = safeNumber(data.minRestDaysBetweenNights, 1);
  }

  if (data.minWorkDaysPerMonth !== undefined) {
    result.minWorkDaysPerMonth = safeNumber(data.minWorkDaysPerMonth, 20);
  }

  if (data.minRestDaysPerMonth !== undefined) {
    result.minRestDaysPerMonth = safeNumber(data.minRestDaysPerMonth, 9);
  }

  if (data.exactRestDaysPerMonth !== undefined) {
    result.exactRestDaysPerMonth = safeNumber(data.exactRestDaysPerMonth, 9);
  }

  if (data.restAfterAke !== undefined) {
    result.restAfterAke = Boolean(data.restAfterAke);
  }

  if (data.maxNightShiftsPerMonth !== undefined) {
    result.maxNightShiftsPerMonth = safeNumber(data.maxNightShiftsPerMonth, 8);
  }

  if (data.preferMixedGenderNightShift !== undefined) {
    result.preferMixedGenderNightShift = Boolean(data.preferMixedGenderNightShift);
  }

  if (data.sunHolidayDayStaffRequired !== undefined) {
    result.sunHolidayDayStaffRequired = safeNumber(data.sunHolidayDayStaffRequired, 3);
  }

  return result;
}

function buildConstraintRecord(
  formData: ConstraintsFormData,
  id?: number
): ScheduleConstraints {
  const normalized = normalizeFormData(formData);
  const now = new Date();

  const minRestDaysPerMonth =
    normalized.minRestDaysPerMonth !== undefined
      ? safeNumber(normalized.minRestDaysPerMonth, 9)
      : 9;

  const exactRestDaysPerMonth =
    normalized.exactRestDaysPerMonth !== undefined
      ? safeNumber(normalized.exactRestDaysPerMonth, minRestDaysPerMonth)
      : minRestDaysPerMonth;

  return {
    id,
    maxConsecutiveWorkDays: safeNumber(normalized.maxConsecutiveWorkDays, 5),
    minRestDaysBetweenNights: safeNumber(normalized.minRestDaysBetweenNights, 1),
    minWorkDaysPerMonth: safeNumber(normalized.minWorkDaysPerMonth, 20),
    minRestDaysPerMonth,
    exactRestDaysPerMonth,
    restAfterAke:
      normalized.restAfterAke !== undefined
        ? Boolean(normalized.restAfterAke)
        : true,
    maxNightShiftsPerMonth: safeNumber(normalized.maxNightShiftsPerMonth, 8),
    preferMixedGenderNightShift:
      normalized.preferMixedGenderNightShift !== undefined
        ? Boolean(normalized.preferMixedGenderNightShift)
        : true,
    sunHolidayDayStaffRequired: safeNumber(normalized.sunHolidayDayStaffRequired, 3),
    name: '標準制約',
    isActive: true,
    priority: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function convertLegacyConstraintRow(
  row: LegacyScheduleConstraintRow
): ScheduleConstraints {
  return normalizeConstraintRow({
    id: toNumericId(row.id),
    name: safeString(row.name) || '旧制約',
    isActive:
      typeof row.isActive === 'boolean'
        ? row.isActive
        : true,
    priority: safeNumber(row.priority, 1),
    maxConsecutiveWorkDays: row.maxConsecutiveWorkDays,
    minRestDaysBetweenNights: row.minRestDaysBetweenNights,
    minWorkDaysPerMonth: row.minWorkDaysPerMonth,
    minRestDaysPerMonth:
      row.minRestDaysPerMonth ?? row.exactRestDaysPerMonth,
    exactRestDaysPerMonth:
      row.exactRestDaysPerMonth ?? row.minRestDaysPerMonth,
    restAfterAke: row.restAfterAke,
    maxNightShiftsPerMonth: row.maxNightShiftsPerMonth,
    preferMixedGenderNightShift: row.preferMixedGenderNightShift,
    sunHolidayDayStaffRequired: row.sunHolidayDayStaffRequired,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function useConstraints() {
  const [constraints, setConstraints] = useState<ScheduleConstraints[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadConstraints = useCallback(async () => {
    try {
      setLoading(true);

      await initializeDatabase();

      const constraintRows = await db.constraints.toArray().catch(() => []);

      let legacyRows: LegacyScheduleConstraintRow[] = [];
      try {
        if (db.scheduleConstraints && typeof db.scheduleConstraints.toArray === 'function') {
          legacyRows = (await db.scheduleConstraints.toArray()) as LegacyScheduleConstraintRow[];
        }
      } catch (error) {
        console.warn('⚠️ 旧 scheduleConstraints の読み込みに失敗しました:', error);
      }

      let normalized = (constraintRows as ScheduleConstraints[]).map((row) =>
        normalizeConstraintRow(row)
      );

      if (normalized.length === 0 && legacyRows.length > 0) {
        normalized = legacyRows.map((row) => convertLegacyConstraintRow(row));
      }

      setConstraints(sortConstraints(normalized));
    } catch (error) {
      console.error('❌ 制約条件の読み込みに失敗しました:', error);
      setConstraints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConstraints();
  }, [loadConstraints]);

  const addConstraints = useCallback(
    async (formData: ConstraintsFormData): Promise<boolean> => {
      try {
        const existingRows = await db.constraints.toArray().catch(() => []);

        const nextPriority =
          existingRows.length > 0
            ? Math.max(...existingRows.map((row) => safeNumber(row.priority, 1))) + 1
            : 1;

        const record = buildConstraintRecord(formData);
        record.priority = nextPriority;
        record.name = existingRows.length === 0 ? '標準制約' : `制約 ${nextPriority}`;
        record.isActive = true;

        await db.constraints.add(record as ScheduleConstraints);
        await loadConstraints();
        return true;
      } catch (error) {
        console.error('❌ 制約条件の追加に失敗しました:', error);
        return false;
      }
    },
    [loadConstraints]
  );

  const updateConstraints = useCallback(
    async (
      id: number,
      formData: Partial<ConstraintsFormData>
    ): Promise<boolean> => {
      try {
        const existing = await db.constraints.get(id);

        if (!existing) {
          console.warn('⚠️ 更新対象の制約条件が見つかりません:', id);
          return false;
        }

        const normalizedExisting = normalizeConstraintRow(existing);
        const normalizedPatch = normalizeFormData(formData);

        const nextMinRestDaysPerMonth =
          normalizedPatch.minRestDaysPerMonth !== undefined
            ? safeNumber(normalizedPatch.minRestDaysPerMonth, 9)
            : safeNumber(
                normalizedExisting.minRestDaysPerMonth,
                normalizedExisting.exactRestDaysPerMonth ?? 9
              );

        const nextExactRestDaysPerMonth =
          normalizedPatch.exactRestDaysPerMonth !== undefined
            ? safeNumber(normalizedPatch.exactRestDaysPerMonth, nextMinRestDaysPerMonth)
            : normalizedExisting.exactRestDaysPerMonth !== undefined
              ? safeNumber(normalizedExisting.exactRestDaysPerMonth, nextMinRestDaysPerMonth)
              : nextMinRestDaysPerMonth;

        const patch: Partial<ScheduleConstraints> = {
          ...normalizedPatch,
          minRestDaysPerMonth: nextMinRestDaysPerMonth,
          exactRestDaysPerMonth: nextExactRestDaysPerMonth,
          updatedAt: new Date(),
        };

        await db.constraints.update(id, patch);
        await loadConstraints();
        return true;
      } catch (error) {
        console.error('❌ 制約条件の更新に失敗しました:', error);
        return false;
      }
    },
    [loadConstraints]
  );

  const deleteConstraints = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const existingRows = await db.constraints.toArray().catch(() => []);
        const existing = existingRows.find((row) => row.id === id);

        if (!existing) {
          console.warn('⚠️ 削除対象の制約条件が見つかりません:', id);
          return false;
        }

        if (existingRows.length <= 1) {
          console.warn('⚠️ 制約条件は最低1件必要なため削除できません');
          return false;
        }

        await db.constraints.delete(id);
        await loadConstraints();
        return true;
      } catch (error) {
        console.error('❌ 制約条件の削除に失敗しました:', error);
        return false;
      }
    },
    [loadConstraints]
  );

  const getConstraintById = useCallback(
    (id: number | null | undefined): ScheduleConstraints | undefined => {
      if (id == null) return undefined;
      return constraints.find((row) => row.id === id);
    },
    [constraints]
  );

  const getActiveConstraint = useCallback((): ScheduleConstraints | undefined => {
    const active = constraints
      .filter((row) => row.isActive !== false)
      .sort((a, b) => {
        const priorityDiff = safeNumber(a.priority, 9999) - safeNumber(b.priority, 9999);
        if (priorityDiff !== 0) return priorityDiff;
        return safeNumber(a.id, 0) - safeNumber(b.id, 0);
      });

    if (active.length > 0) {
      return active[0];
    }

    return constraints[0];
  }, [constraints]);

  const replaceActiveConstraint = useCallback(
    async (formData: ConstraintsFormData): Promise<boolean> => {
      try {
        const current = getActiveConstraint();

        if (!current?.id) {
          return addConstraints(formData);
        }

        return await updateConstraints(current.id, formData);
      } catch (error) {
        console.error('❌ 有効制約条件の更新に失敗しました:', error);
        return false;
      }
    },
    [addConstraints, getActiveConstraint, updateConstraints]
  );

  return {
    constraints,
    loading,
    addConstraints,
    updateConstraints,
    deleteConstraints,
    getConstraintById,
    getActiveConstraint,
    replaceActiveConstraint,
    reload: loadConstraints,
  };
}
