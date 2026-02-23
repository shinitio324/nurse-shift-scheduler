import { useState } from 'react';
import { db } from '../db';
import {
  ScheduleGenerationParams,
  ScheduleGenerationResult,
  GeneratedSchedule,
} from '../types';
import { ScheduleGenerator } from '../utils/scheduleAlgorithm';

export function useScheduleGenerator() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleGenerationResult | null>(null);

  /**
   * スケジュールを生成
   */
  const generateSchedule = async (
    params: ScheduleGenerationParams
  ): Promise<ScheduleGenerationResult | null> => {
    try {
      setGenerating(true);
      console.log('🚀 スケジュール生成を開始します...', params);

      // データベースから必要なデータを取得
      const staff = await db.staff.toArray();
      const patterns = await db.shiftPatterns.toArray();
      const constraints = await db.scheduleConstraints.toArray();
      
      // 対象月のシフト希望を取得
      const startDate = `${params.targetYear}-${String(params.targetMonth).padStart(2, '0')}-01`;
      const endDate = `${params.targetYear}-${String(params.targetMonth).padStart(2, '0')}-31`;
      
      const requests = await db.shifts
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();

      // スタッフ名を付与
      const requestsWithNames = requests.map(r => {
        const staffMember = staff.find(s => s.id === r.staffId);
        return {
          ...r,
          staffName: staffMember?.name || '不明',
          status: 'pending' as const,
          requestedAt: r.createdAt,
        };
      });

      console.log('📊 データ取得完了:');
      console.log('  - スタッフ:', staff.length, '名');
      console.log('  - 勤務パターン:', patterns.length, '種類');
      console.log('  - 制約条件:', constraints.length, '種類');
      console.log('  - シフト希望:', requestsWithNames.length, '件');

      // スケジュール生成エンジンを実行
      const generator = new ScheduleGenerator(
        staff,
        patterns,
        constraints,
        requestsWithNames,
        params
      );

      const generationResult = generator.generate();

      console.log('✅ スケジュール生成が完了しました！');
      console.log('📊 結果:', generationResult.schedules.length, '件のシフト');
      console.log('⚠️ 違反:', generationResult.violations.length, '件');

      setResult(generationResult);
      return generationResult;
    } catch (error) {
      console.error('❌ スケジュール生成に失敗しました:', error);
      alert('スケジュール生成に失敗しました。もう一度お試しください。');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  /**
   * 生成されたスケジュールをデータベースに保存
   */
  const saveSchedule = async (schedules: GeneratedSchedule[]): Promise<boolean> => {
    try {
      console.log('💾 スケジュールを保存中...', schedules.length, '件');

      // 対象月の既存のスケジュールを削除
      if (schedules.length > 0) {
        const firstDate = schedules[0].date;
        const [year, month] = firstDate.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        const existingShifts = await db.shifts
          .where('date')
          .between(startDate, endDate, true, true)
          .toArray();

        if (existingShifts.length > 0) {
          await db.shifts.bulkDelete(existingShifts.map(s => s.id));
          console.log('🗑️ 既存のスケジュールを削除しました:', existingShifts.length, '件');
        }
      }

      // 新しいスケジュールを保存
      const shiftsToSave = schedules.map(s => ({
        id: s.id,
        staffId: s.staffId,
        date: s.date,
        shiftType: s.shiftType,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      await db.shifts.bulkAdd(shiftsToSave);
      console.log('✅ スケジュールの保存が完了しました！');

      return true;
    } catch (error) {
      console.error('❌ スケジュールの保存に失敗しました:', error);
      alert('スケジュールの保存に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  /**
   * 結果をクリア
   */
  const clearResult = () => {
    setResult(null);
  };

  return {
    generating,
    result,
    generateSchedule,
    saveSchedule,
    clearResult,
  };
}
