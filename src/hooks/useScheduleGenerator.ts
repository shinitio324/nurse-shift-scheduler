// src/hooks/useScheduleGenerator.ts
import { useState, useCallback } from 'react';
import { db } from '../db';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';
import type {
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  GeneratedShift,
} from '../types';

const EMPTY_RESULT: ScheduleGenerationResult = {
  schedule: [],
  statistics: {
    totalDays:             0,
    totalShifts:           0,
    staffWorkload:         [],   // ← 絶対にundefinedにならない
    shiftTypeDistribution: {},
  },
  warnings: [],
};

// result を null-safe に正規化する
function normalizeResult(raw: unknown): ScheduleGenerationResult {
  if (!raw || typeof raw !== 'object') return EMPTY_RESULT;
  const r = raw as any;

  const schedule: GeneratedShift[] = Array.isArray(r.schedule) ? r.schedule : [];
  const warnings: string[]         = Array.isArray(r.warnings) ? r.warnings : [];

  const rawStats = r.statistics ?? {};
  const staffWorkload = Array.isArray(rawStats.staffWorkload)
    ? rawStats.staffWorkload
    : [];
  const shiftTypeDistribution =
    rawStats.shiftTypeDistribution &&
    typeof rawStats.shiftTypeDistribution === 'object'
      ? rawStats.shiftTypeDistribution
      : {};

  return {
    schedule,
    warnings,
    statistics: {
      totalDays:             Number(rawStats.totalDays)    || 0,
      totalShifts:           Number(rawStats.totalShifts)  || 0,
      staffWorkload,
      shiftTypeDistribution,
    },
  };
}

export function useScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult]             = useState<ScheduleGenerationResult>(EMPTY_RESULT);
  const [error, setError]               = useState<string | null>(null);

  const generateSchedule = useCallback(
    async (params: ScheduleGenerationParams) => {
      setIsGenerating(true);
      setError(null);

      let safeResult = EMPTY_RESULT;
      try {
        const generator = new ScheduleGenerator(params ?? {});
        const raw = await generator.generate();
        safeResult = normalizeResult(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useScheduleGenerator] エラー:', err);
        setError(msg);
        safeResult = {
          ...EMPTY_RESULT,
          warnings: [msg],
        };
      } finally {
        setIsGenerating(false);
      }

      setResult(safeResult);
      return safeResult;
    },
    []
  );

  const saveSchedule = useCallback(
    async (schedule: GeneratedShift[], year: number, month: number) => {
      try {
        const safeSchedule = Array.isArray(schedule) ? schedule : [];
        const y = Number(year)  || new Date().getFullYear();
        const m = Number(month) || (new Date().getMonth() + 1);
        const prefix = `${y}-${String(m).padStart(2, '0')}`;

        const old = await db.generatedSchedules
          .where('date').startsWith(prefix).toArray().catch(() => []);
        const ids = (old ?? []).map((s: any) => s.id).filter(Boolean);
        if (ids.length > 0) {
          await db.generatedSchedules.bulkDelete(ids).catch(() => {});
        }
        if (safeSchedule.length > 0) {
          await db.generatedSchedules.bulkAdd(safeSchedule).catch(() => {});
        }
        console.log(`[save] ${safeSchedule.length}件 保存完了`);
      } catch (err) {
        console.error('[save] エラー:', err);
        throw err;
      }
    },
    []
  );

  return { isGenerating, result, error, generateSchedule, saveSchedule };
}
