// src/hooks/useScheduleGenerator.ts
import { useState, useCallback } from 'react';
import { db } from '../db';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';
import type {
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  GeneratedShift,
} from '../types';

function makeEmptyResult(): ScheduleGenerationResult {
  return {
    schedule: [],
    statistics: {
      totalDays: 0,
      totalShifts: 0,
      staffWorkload: [],
      shiftTypeDistribution: {},
    },
    warnings: [],
  };
}

function normalizeResult(raw: unknown): ScheduleGenerationResult {
  if (!raw || typeof raw !== 'object') return makeEmptyResult();
  const r = raw as any;
  return {
    schedule: Array.isArray(r.schedule) ? r.schedule : [],
    statistics: {
      totalDays: Number(r.statistics?.totalDays ?? 0),
      totalShifts: Number(r.statistics?.totalShifts ?? 0),
      staffWorkload: Array.isArray(r.statistics?.staffWorkload) ? r.statistics.staffWorkload : [],
      shiftTypeDistribution: (r.statistics?.shiftTypeDistribution && typeof r.statistics.shiftTypeDistribution === 'object')
        ? r.statistics.shiftTypeDistribution
        : {},
    },
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
  };
}

export function useScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleGenerationResult>(makeEmptyResult());
  const [error, setError] = useState<string | null>(null);

  const generateSchedule = useCallback(async (params: ScheduleGenerationParams): Promise<ScheduleGenerationResult> => {
    setIsGenerating(true);
    setError(null);
    try {
      const generator = new ScheduleGenerator(params);
      const raw = await generator.generate();
      const safe = normalizeResult(raw);
      setResult(safe);
      return safe;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useScheduleGenerator] エラー:', err);
      setError(msg);
      const empty = makeEmptyResult();
      setResult(empty);
      return empty;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const saveSchedule = useCallback(async (
    schedule: GeneratedShift[],
    year: number,
    month: number,
  ): Promise<void> => {
    try {
      const safeSchedule = Array.isArray(schedule) ? schedule : [];
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const old = await db.generatedSchedules.where('date').startsWith(prefix).toArray().catch(() => []);
      const oldIds = old.map((s: any) => s.id).filter((id: any) => id != null);
      if (oldIds.length > 0) await db.generatedSchedules.bulkDelete(oldIds);
      if (safeSchedule.length > 0) await db.generatedSchedules.bulkAdd(safeSchedule);
      console.log(`[save] ${safeSchedule.length}件 保存完了`);
    } catch (err) {
      console.error('[save] 保存エラー:', err);
      throw err;
    }
  }, []);

  return { isGenerating, result, error, generateSchedule, saveSchedule };
}
