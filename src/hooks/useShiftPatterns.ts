import { useCallback, useEffect, useState } from 'react';
import { db, DEFAULT_PATTERNS, initializeDatabase } from '../db/index';
import type { ShiftPattern, ShiftPatternFormData } from '../types';

const REQUIRED_PATTERN_NAMES = new Set(
  DEFAULT_PATTERNS.map((pattern) => pattern.name)
);

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeFormData(data: ShiftPatternFormData): ShiftPatternFormData {
  return {
    name: safeString(data.name),
    shortName: safeString(data.shortName),
    startTime: safeString(data.startTime) || '00:00',
    endTime: safeString(data.endTime) || '00:00',
    color: safeString(data.color) || '#d1d5db',
    isNight: Boolean(data.isNight),
    isAke: Boolean(data.isAke),
    isVacation: Boolean(data.isVacation),
    isWorkday:
      typeof data.isWorkday === 'boolean'
        ? data.isWorkday
        : !(data.isAke || data.isVacation),
    requiredStaff: safeNumber(data.requiredStaff, 0),
    sortOrder: safeNumber(data.sortOrder, 0),
  };
}

function sortPatterns(list: ShiftPattern[]): ShiftPattern[] {
  return [...list].sort((a, b) => {
    const orderDiff = safeNumber(a.sortOrder, 9999) - safeNumber(b.sortOrder, 9999);
    if (orderDiff !== 0) return orderDiff;

    const aName = safeString(a.name);
    const bName = safeString(b.name);
    return aName.localeCompare(bName, 'ja');
  });
}

function sameName(a: unknown, b: unknown): boolean {
  return safeString(a) === safeString(b);
}

function isProtectedPatternName(name: unknown): boolean {
  return REQUIRED_PATTERN_NAMES.has(safeString(name));
}

export function useShiftPatterns() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPatterns = useCallback(async () => {
    try {
      setLoading(true);

      await initializeDatabase();

      const allPatterns = await db.shiftPatterns.toArray();
      setPatterns(sortPatterns(allPatterns));
    } catch (error) {
      console.error('❌ 勤務パターンの読み込みに失敗しました:', error);
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatterns();
  }, [loadPatterns]);

  const addPattern = useCallback(
    async (formData: ShiftPatternFormData): Promise<boolean> => {
      try {
        const data = normalizeFormData(formData);

        if (!data.name) {
          console.warn('⚠️ 勤務パターン名が空です');
          return false;
        }

        const currentPatterns = await db.shiftPatterns.toArray();

        const duplicate = currentPatterns.some((pattern) =>
          sameName(pattern.name, data.name)
        );

        if (duplicate) {
          console.warn('⚠️ 同名の勤務パターンが既に存在します:', data.name);
          return false;
        }

        const nextSortOrder =
          currentPatterns.length > 0
            ? Math.max(...currentPatterns.map((p) => safeNumber(p.sortOrder, 0))) + 1
            : 1;

        const newPattern: Omit<ShiftPattern, 'id'> = {
          name: data.name,
          shortName: data.shortName || data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          color: data.color,
          isNight: Boolean(data.isNight),
          isAke: Boolean(data.isAke),
          isVacation: Boolean(data.isVacation),
          isWorkday:
            typeof data.isWorkday === 'boolean'
              ? data.isWorkday
              : !(data.isAke || data.isVacation),
          requiredStaff: safeNumber(data.requiredStaff, 0),
          sortOrder: safeNumber(data.sortOrder, nextSortOrder) || nextSortOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.shiftPatterns.add(newPattern as ShiftPattern);
        await loadPatterns();
        return true;
      } catch (error) {
        console.error('❌ 勤務パターンの追加に失敗しました:', error);
        return false;
      }
    },
    [loadPatterns]
  );

  const updatePattern = useCallback(
    async (
      id: number,
      formData: Partial<ShiftPatternFormData>
    ): Promise<boolean> => {
      try {
        const existing = await db.shiftPatterns.get(id);

        if (!existing) {
          console.warn('⚠️ 更新対象の勤務パターンが見つかりません:', id);
          return false;
        }

        const nextName =
          formData.name !== undefined ? safeString(formData.name) : safeString(existing.name);

        if (!nextName) {
          console.warn('⚠️ 勤務パターン名を空にはできません');
          return false;
        }

        const allPatterns = await db.shiftPatterns.toArray();
        const duplicate = allPatterns.some(
          (pattern) => pattern.id !== id && sameName(pattern.name, nextName)
        );

        if (duplicate) {
          console.warn('⚠️ 同名の勤務パターンが既に存在します:', nextName);
          return false;
        }

        const willBeProtected = isProtectedPatternName(existing.name);

        const patch: Partial<ShiftPattern> = {
          updatedAt: new Date(),
        };

        if (formData.name !== undefined) {
          patch.name = nextName;
        }

        if (formData.shortName !== undefined) {
          patch.shortName = safeString(formData.shortName);
        }

        if (formData.startTime !== undefined) {
          patch.startTime = safeString(formData.startTime) || '00:00';
        }

        if (formData.endTime !== undefined) {
          patch.endTime = safeString(formData.endTime) || '00:00';
        }

        if (formData.color !== undefined) {
          patch.color = safeString(formData.color) || '#d1d5db';
        }

        if (formData.requiredStaff !== undefined) {
          patch.requiredStaff = safeNumber(formData.requiredStaff, 0);
        }

        if (formData.isNight !== undefined) {
          patch.isNight = Boolean(formData.isNight);
        }

        if (formData.isAke !== undefined) {
          patch.isAke = Boolean(formData.isAke);
        }

        if (formData.isVacation !== undefined) {
          patch.isVacation = Boolean(formData.isVacation);
        }

        if (formData.isWorkday !== undefined) {
          patch.isWorkday = Boolean(formData.isWorkday);
        }

        if (formData.sortOrder !== undefined) {
          patch.sortOrder = safeNumber(formData.sortOrder, safeNumber(existing.sortOrder, 0));
        }

        if (willBeProtected) {
          const protectedDefault = DEFAULT_PATTERNS.find((p) => sameName(p.name, existing.name));

          if (protectedDefault) {
            patch.name = protectedDefault.name;
            patch.shortName =
              formData.shortName !== undefined
                ? safeString(formData.shortName)
                : existing.shortName ?? protectedDefault.shortName;
          }
        }

        await db.shiftPatterns.update(id, patch);
        await loadPatterns();
        return true;
      } catch (error) {
        console.error('❌ 勤務パターンの更新に失敗しました:', error);
        return false;
      }
    },
    [loadPatterns]
  );

  const deletePattern = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const existing = await db.shiftPatterns.get(id);

        if (!existing) {
          console.warn('⚠️ 削除対象の勤務パターンが見つかりません:', id);
          return false;
        }

        if (isProtectedPatternName(existing.name)) {
          console.warn(
            '⚠️ 日勤・夜勤・明け・有給・休み はスケジューラ必須のため削除できません:',
            existing.name
          );
          return false;
        }

        const usingRequestCount = await db.shiftRequests
          .where('patternId')
          .equals(id)
          .count()
          .catch(() => 0);

        const usingGeneratedCount = await db.generatedSchedules
          .where('patternId')
          .equals(id)
          .count()
          .catch(() => 0);

        if (usingRequestCount > 0 || usingGeneratedCount > 0) {
          console.warn(
            '⚠️ 参照中の勤務パターンは削除できません:',
            existing.name,
            {
              shiftRequests: usingRequestCount,
              generatedSchedules: usingGeneratedCount,
            }
          );
          return false;
        }

        await db.shiftPatterns.delete(id);
        await loadPatterns();
        return true;
      } catch (error) {
        console.error('❌ 勤務パターンの削除に失敗しました:', error);
        return false;
      }
    },
    [loadPatterns]
  );

  const getPatternById = useCallback(
    (id: number | string | undefined | null): ShiftPattern | undefined => {
      if (id === undefined || id === null) return undefined;
      return patterns.find((pattern) => String(pattern.id) === String(id));
    },
    [patterns]
  );

  const getPatternByName = useCallback(
    (name: string): ShiftPattern | undefined => {
      const normalized = safeString(name);
      return patterns.find((pattern) => sameName(pattern.name, normalized));
    },
    [patterns]
  );

  const isProtectedPattern = useCallback(
    (id: number): boolean => {
      const pattern = patterns.find((item) => item.id === id);
      return Boolean(pattern && isProtectedPatternName(pattern.name));
    },
    [patterns]
  );

  return {
    patterns,
    loading,
    addPattern,
    updatePattern,
    deletePattern,
    getPatternById,
    getPatternByName,
    isProtectedPattern,
    reload: loadPatterns,
  };
}
