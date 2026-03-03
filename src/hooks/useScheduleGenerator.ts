// src/hooks/useScheduleGenerator.ts
import { useState, useCallback } from 'react';
import { db } from '../db';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';
import type {
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  GeneratedShift,
  StaffWorkloadStat,
} from '../types';

// ✅ emptyResult は関数 — paramsを参照しない
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

export function useScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult]             = useState<ScheduleGenerationResult>(makeEmptyResult());
  const [error, setError]               = useState<string | null>(null);

  const generateSchedule = useCallback(
    async (params: ScheduleGenerationParams) => {
      setIsGenerating(true);
      setError(null);
      try {
        const generator = new ScheduleGenerator(params);
        const raw = await generator.generate();

        // null-safe にresultを組み立て
        const safeResult: ScheduleGenerationResult = {
          schedule: Array.isArray(raw?.schedule) ? raw.schedule : [],
          statistics: {
            totalDays:   raw?.statistics?.totalDays   ?? 0,
            totalShifts: raw?.statistics?.totalShifts ?? 0,
            staffWorkload: Array.isArray(raw?.statistics?.staffWorkload)
              ? raw.statistics.staffWorkload
              : [],
            shiftTypeDistribution:
              raw?.statistics?.shiftTypeDistribution ?? {},
          },
          warnings: Array.isArray(raw?.warnings) ? raw.warnings : [],
        };

        setResult(safeResult);
        return safeResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useScheduleGenerator] エラー:', err);
        setError(msg);
        return makeEmptyResult();
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const saveSchedule = useCallback(
    async (schedule: GeneratedShift[], year: number, month: number) => {
      try {
        // 同月のデータを削除してから保存
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const old = await db.generatedSchedules
          .where('date').startsWith(prefix)
          .toArray();
        const oldIds = old.map(s => s.id!).filter(Boolean);
        if (oldIds.length > 0) await db.generatedSchedules.bulkDelete(oldIds);

        await db.generatedSchedules.bulkAdd(schedule);
        console.log(`[save] ${schedule.length}件 保存完了`);
      } catch (err) {
        console.error('[save] 保存エラー:', err);
        throw err;
      }
    },
    []
  );

  return { isGenerating, result, error, generateSchedule, saveSchedule };
}
