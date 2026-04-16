import { useCallback, useState } from 'react';
import { db, initializeDatabase } from '../db/index';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';
import type {
  GeneratedShift,
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  ScheduleStatistics,
} from '../types';

function safeNumber(value: unknown, fallback: number): number {
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

function normalizeDateString(value: unknown): string {
  if (typeof value !== 'string') return '';

  const raw = value.trim();
  if (!raw) return '';

  const directMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (directMatch) {
    const [, y, m, d] = directMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function resolveYearMonth(
  params?: ScheduleGenerationParams
): { year: number; month: number } {
  const now = new Date();

  const year = safeNumber(
    params?.year ?? params?.targetYear,
    now.getFullYear()
  );

  const month = safeNumber(
    params?.month ?? params?.targetMonth,
    now.getMonth() + 1
  );

  const normalizedMonth =
    month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  return {
    year,
    month: normalizedMonth,
  };
}

function makeEmptyStatistics(): ScheduleStatistics {
  return {
    totalDays: 0,
    totalShifts: 0,
    staffWorkload: [],
    shiftTypeDistribution: {},
  };
}

function makeEmptyResult(): ScheduleGenerationResult {
  return {
    schedule: [],
    statistics: makeEmptyStatistics(),
    warnings: [],
  };
}

function normalizeGeneratedShift(row: Partial<GeneratedShift>): GeneratedShift {
  return {
    id:
      typeof row.id === 'number' && Number.isFinite(row.id)
        ? row.id
        : undefined,
    staffId: row.staffId ?? '',
    date: normalizeDateString(row.date),
    patternId: row.patternId ?? '',
    isManual: typeof row.isManual === 'boolean' ? row.isManual : false,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

function normalizeResult(
  raw: ScheduleGenerationResult | null | undefined
): ScheduleGenerationResult {
  if (!raw) {
    return makeEmptyResult();
  }

  const schedule = Array.isArray(raw.schedule)
    ? raw.schedule.map((row) => normalizeGeneratedShift(row))
    : [];

  return {
    schedule,
    statistics: {
      totalDays:
        typeof raw.statistics?.totalDays === 'number'
          ? raw.statistics.totalDays
          : 0,
      totalShifts:
        typeof raw.statistics?.totalShifts === 'number'
          ? raw.statistics.totalShifts
          : 0,
      staffWorkload: Array.isArray(raw.statistics?.staffWorkload)
        ? raw.statistics.staffWorkload
        : [],
      shiftTypeDistribution:
        raw.statistics?.shiftTypeDistribution &&
        typeof raw.statistics.shiftTypeDistribution === 'object'
          ? raw.statistics.shiftTypeDistribution
          : {},
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

export function useScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<ScheduleGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSavedSchedule = useCallback(
    async (year: number, month: number): Promise<GeneratedShift[]> => {
      try {
        const monthPrefix = getMonthPrefix(year, month);

        const rows = await db.generatedSchedules
          .filter((row) => normalizeDateString(row.date).startsWith(monthPrefix))
          .toArray()
          .catch(() => []);

        return (rows as GeneratedShift[])
          .map((row) => normalizeGeneratedShift(row))
          .sort((a, b) => {
            const dateCompare = String(a.date).localeCompare(String(b.date), 'ja');
            if (dateCompare !== 0) return dateCompare;
            return String(a.staffId).localeCompare(String(b.staffId), 'ja');
          });
      } catch (e) {
        console.error('❌ 保存済みスケジュールの読み込みに失敗しました:', e);
        return [];
      }
    },
    []
  );

  const clearSavedSchedule = useCallback(
    async (year: number, month: number): Promise<boolean> => {
      try {
        const monthPrefix = getMonthPrefix(year, month);

        const existing = await db.generatedSchedules
          .filter((row) => normalizeDateString(row.date).startsWith(monthPrefix))
          .toArray()
          .catch(() => []);

        const ids = (existing as GeneratedShift[])
          .map((row) => row.id)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

        if (ids.length > 0) {
          await db.generatedSchedules.bulkDelete(ids);
        }

        return true;
      } catch (e) {
        console.error('❌ 保存済みスケジュールの削除に失敗しました:', e);
        return false;
      }
    },
    []
  );

  const saveSchedule = useCallback(
    async (
      generationResult: ScheduleGenerationResult,
      year?: number,
      month?: number
    ): Promise<boolean> => {
      try {
        const normalizedResult = normalizeResult(generationResult);

        if (!Array.isArray(normalizedResult.schedule)) {
          return false;
        }

        let resolvedYear = year;
        let resolvedMonth = month;

        if (
          (!resolvedYear || !resolvedMonth) &&
          normalizedResult.schedule.length > 0
        ) {
          const firstDate = normalizeDateString(normalizedResult.schedule[0].date);
          const matched = firstDate.match(/^(\d{4})-(\d{2})-/);
          if (matched) {
            resolvedYear = resolvedYear ?? Number(matched[1]);
            resolvedMonth = resolvedMonth ?? Number(matched[2]);
          }
        }

        if (!resolvedYear || !resolvedMonth) {
          const now = new Date();
          resolvedYear = now.getFullYear();
          resolvedMonth = now.getMonth() + 1;
        }

        const cleared = await clearSavedSchedule(resolvedYear, resolvedMonth);
        if (!cleared) {
          return false;
        }

        if (normalizedResult.schedule.length === 0) {
          return true;
        }

        const rowsToSave = normalizedResult.schedule.map((row) => {
          const { id: _id, ...rest } = row;
          return {
            ...rest,
            date: normalizeDateString(rest.date),
            createdAt: rest.createdAt ?? new Date(),
            updatedAt: new Date(),
          };
        });

        await db.generatedSchedules.bulkAdd(rowsToSave as GeneratedShift[]);
        return true;
      } catch (e) {
        console.error('❌ スケジュール保存に失敗しました:', e);
        return false;
      }
    },
    [clearSavedSchedule]
  );

  const generateSchedule = useCallback(
    async (params: ScheduleGenerationParams): Promise<ScheduleGenerationResult> => {
      setIsGenerating(true);
      setError(null);

      try {
        await initializeDatabase();

        const { year, month } = resolveYearMonth(params);

        const normalizedParams: ScheduleGenerationParams = {
          ...params,
          year,
          month,
          targetYear: year,
          targetMonth: month,
        };

        const generator = new ScheduleGenerator(normalizedParams);
        const rawResult = await generator.generate();
        const normalizedResult = normalizeResult(rawResult);

        setResult(normalizedResult);
        return normalizedResult;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'スケジュール生成中に不明なエラーが発生しました';

        console.error('❌ スケジュール生成に失敗しました:', e);
        setError(message);

        const empty = makeEmptyResult();
        setResult(empty);
        return empty;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const generateAndSaveSchedule = useCallback(
    async (params: ScheduleGenerationParams): Promise<ScheduleGenerationResult> => {
      const generated = await generateSchedule(params);

      const { year, month } = resolveYearMonth(params);
      const saved = await saveSchedule(generated, year, month);

      if (!saved) {
        const warningMessage = '生成は完了しましたが、保存に失敗しました。';
        const withWarning: ScheduleGenerationResult = {
          ...generated,
          warnings: [...generated.warnings, warningMessage],
        };
        setResult(withWarning);
        return withWarning;
      }

      return generated;
    },
    [generateSchedule, saveSchedule]
  );

  const loadGeneratedResult = useCallback(
    async (year: number, month: number): Promise<ScheduleGenerationResult> => {
      try {
        await initializeDatabase();

        const savedSchedule = await loadSavedSchedule(year, month);

        const loadedResult: ScheduleGenerationResult = {
          schedule: savedSchedule,
          statistics: {
            totalDays: savedSchedule.length > 0 ? new Date(year, month, 0).getDate() : 0,
            totalShifts: savedSchedule.length,
            staffWorkload: [],
            shiftTypeDistribution: {},
          },
          warnings: [],
        };

        setResult(loadedResult);
        setError(null);
        return loadedResult;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : '保存済みスケジュールの読み込みに失敗しました';
        setError(message);

        const empty = makeEmptyResult();
        setResult(empty);
        return empty;
      }
    },
    [loadSavedSchedule]
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    isGenerating,
    result,
    error,
    generateSchedule,
    saveSchedule,
    generateAndSaveSchedule,
    loadSavedSchedule,
    loadGeneratedResult,
    clearSavedSchedule,
    clearResult,
  };
}
