// src/components/ScheduleGeneratorForm.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Settings, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { db } from '../db';
import { useScheduleGenerator } from '../hooks/useScheduleGenerator';
import type { ScheduleGenerationResult, ScheduleConstraints } from '../types';

interface ScheduleGeneratorFormProps {
  onGenerated: (result: ScheduleGenerationResult) => void;
}

export const ScheduleGeneratorForm: React.FC<ScheduleGeneratorFormProps> = ({ onGenerated }) => {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [constraints, setConstraints] = useState<ScheduleConstraints>({});
  const [prioritizeRequests, setPrioritizeRequests] = useState(true);
  const [balanceWorkload,    setBalanceWorkload]    = useState(true);
  const [balanceNightShifts, setBalanceNightShifts] = useState(true);

  const { isGenerating, result, error, generateSchedule } = useScheduleGenerator();

  useEffect(() => {
    db.constraints.orderBy('id').last()
      .then(c => { if (c) setConstraints(c); })
      .catch(e => console.warn('constraints 取得失敗:', e));
  }, []);

  const handleGenerate = async () => {
    const res = await generateSchedule({
      year,
      month,
      prioritizeRequests,
      balanceWorkload,
      balanceNightShifts,
    } as any);
    onGenerated(res);
  };

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">スケジュール自動生成</h2>
          <p className="text-sm text-gray-500">対象年月を選択して生成してください</p>
        </div>
      </div>

      {/* 年月選択 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">年</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">月</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>

      {/* 制約情報表示 */}
      {(constraints.minWorkDaysPerMonth || constraints.maxConsecutiveWorkDays) && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">適用中の制約</span>
          </div>
          {constraints.minWorkDaysPerMonth != null && (
            <p className="text-xs text-gray-600">最低勤務日数: {constraints.minWorkDaysPerMonth}日/月</p>
          )}
          {constraints.maxConsecutiveWorkDays != null && (
            <p className="text-xs text-gray-600">最大連続勤務: {constraints.maxConsecutiveWorkDays}日</p>
          )}
          {constraints.exactRestDaysPerMonth != null && (
            <p className="text-xs text-gray-600">休み日数: {constraints.exactRestDaysPerMonth}日/月</p>
          )}
        </div>
      )}

      {/* オプション */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">生成オプション</p>
        {[
          { label: 'シフト希望を優先する', value: prioritizeRequests, setter: setPrioritizeRequests },
          { label: '勤務日数を均等化する', value: balanceWorkload,    setter: setBalanceWorkload },
          { label: '夜勤回数を均等化する', value: balanceNightShifts, setter: setBalanceNightShifts },
        ].map(({ label, value, setter }) => (
          <label key={label} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value}
              onChange={e => setter(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            スケジュールを生成
          </>
        )}
      </button>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 結果サマリー */}
      {!isGenerating && (result?.schedule?.length ?? 0) > 0 && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-700">
            <p>✅ 生成完了: {result.schedule.length}件のシフトを生成しました</p>
            {(result?.warnings?.length ?? 0) > 0 && (
              <p className="mt-1 text-yellow-700">⚠️ 警告: {result.warnings.length}件</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleGeneratorForm;
