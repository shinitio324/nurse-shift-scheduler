// =============================================================
// src/hooks/useScheduleGenerator.ts  ── 完全修正版
// =============================================================

import { useState, useCallback } from 'react';
import { db } from '../db';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';
import type {
  ScheduleGenerationParams,
  ScheduleGenerationResult,
} from '../types';

function emptyResult(year: number, month: number): ScheduleGenerationResult {
  return {
    schedules:  [],
    violations: [],
    statistics: {
      totalDays:              0,
      totalShifts:            0,
      staffWorkload:          [],
      shiftTypeDistribution:  [],
      maxConsecutiveWorkDays: 0,
      totalWorkHours:         0,
    },
    generatedAt: new Date().toISOString(),
    year,
    month,
  };
}

export function useScheduleGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSchedule = useCallback(
    async (params: ScheduleGenerationParams): Promise<ScheduleGenerationResult> => {
      setIsGenerating(true);
      setError(null);

      try {
        console.log('スケジュール生成を開始します...', params);

        const [staffList, patternList, allConstraints, allRequests] = await Promise.all([
          db.staff.toArray(),
          db.shiftPatterns.toArray(),
          db.scheduleConstraints.toArray(),
          db.shiftRequests.toArray(),
        ]);

        const monthPrefix = `${params.year}-${String(params.month).padStart(2, '0')}`;
        const monthRequests = allRequests.filter(r =>
          typeof r.date === 'string' && r.date.startsWith(monthPrefix),
        );

        const constraints =
          params.constraintIds && params.constraintIds.length > 0
            ? allConstraints.filter(c => c.id !== undefined && params.constraintIds.includes(c.id))
            : allConstraints.filter(c => c.isActive);

        console.log('データ取得完了:');
        console.log(`- スタッフ: ${staffList.length}名`);
        console.log(`- 勤務パターン: ${patternList.length}種類`);
        console.log(`- 制約条件: ${constraints.length}種類`);
        console.log(`- シフト希望: ${monthRequests.length}件`);

        const generator = new ScheduleGenerator(
          staffList, patternList, constraints, monthRequests, params,
        );
        const raw = await generator.generate();

        // ★ null-safe で結果を組み立て（ここがクラッシュ防止の核心）
        const safeResult: ScheduleGenerationResult = {
          schedules:  Array.isArray(raw?.schedules)  ? raw.schedules  : [],
          violations: Array.isArray(raw?.violations) ? raw.violations : [],
          statistics: {
            totalDays:             raw?.statistics?.totalDays              ?? 0,
            totalShifts:           raw?.statistics?.totalShifts            ?? 0,
            staffWorkload:         Array.isArray(raw?.statistics?.staffWorkload)
                                     ? raw.statistics.staffWorkload : [],
            shiftTypeDistribution: Array.isArray(raw?.statistics?.shiftTypeDistribution)
                                     ? raw.statistics.shiftTypeDistribution : [],
            maxConsecutiveWorkDays: raw?.statistics?.maxConsecutiveWorkDays ?? 0,
            totalWorkHours:         raw?.statistics?.totalWorkHours         ?? 0,
          },
          generatedAt: raw?.generatedAt ?? new Date().toISOString(),
          year:  raw?.year  ?? params.year,
          month: raw?.month ?? params.month,
        };

        console.log('スケジュール生成が完了しました！');
        console.log(
          `- 生成済み: ${safeResult.schedules.length}件`,
          `/ 違反: ${safeResult.violations.length}件`,
          `/ スタッフ統計: ${safeResult.statistics.staffWorkload.length}名分`,
        );

        setResult(safeResult);
        return safeResult;

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('スケジュール生成に失敗しました:', e);
        setError(msg);
        const fallback = emptyResult(params.year, params.month);
        setResult(fallback);
        throw e;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  const saveSchedule = useCallback(
    async (
      generationResult: ScheduleGenerationResult,
      year: number,
      month: number,
    ): Promise<boolean> => {
      try {
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

        const existing = await db.generatedSchedules
          .filter(s => typeof s.date === 'string' && s.date.startsWith(monthPrefix))
          .toArray();

        if (existing.length > 0) {
          const ids = existing
            .map(s => s.id)
            .filter((id): id is number => id !== undefined);
          await db.generatedSchedules.bulkDelete(ids);
          console.log(`既存スケジュール ${ids.length} 件を削除しました`);
        }

        const schedules = Array.isArray(generationResult?.schedules)
          ? generationResult.schedules : [];

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const toSave = schedules.map(({ id: _id, ...rest }) => ({
          ...rest,
          createdAt: rest.createdAt ?? new Date().toISOString(),
        }));

        if (toSave.length > 0) {
          await db.generatedSchedules.bulkAdd(
            toSave as Parameters<typeof db.generatedSchedules.bulkAdd>[0],
          );
        }

        console.log(`スケジュール ${toSave.length} 件を保存しました`);
        return true;

      } catch (e) {
        console.error('スケジュール保存に失敗しました:', e);
        return false;
      }
    },
    [],
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isGenerating, result, error, generateSchedule, saveSchedule, clearResult };
}
// ★ 追加: targetYear/targetMonth → year/month に正規化
function resolveYearMonth(params: ScheduleGenerationParams): { year: number; month: number } {
  const year  = params.year  ?? params.targetYear  ?? new Date().getFullYear();
  const month = params.month ?? params.targetMonth ?? (new Date().getMonth() + 1);
  return { year, month };
}

// generateSchedule 内でこれを使う
const { year, month } = resolveYearMonth(params);
