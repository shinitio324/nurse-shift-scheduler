import { useState, useEffect } from 'react';
import { Calendar, Settings, Zap, Play } from 'lucide-react';
import { db } from '../db';
import { ScheduleConstraints, ScheduleGenerationParams } from '../types';
import { useScheduleGenerator } from '../hooks/useScheduleGenerator';

interface Props {
  onGenerated: () => void;
}

export function ScheduleGeneratorForm({ onGenerated }: Props) {
  const currentDate = new Date();
  const [targetYear, setTargetYear] = useState(currentDate.getFullYear());
  const [targetMonth, setTargetMonth] = useState(currentDate.getMonth() + 1);
  
  const [constraints, setConstraints] = useState<ScheduleConstraints[]>([]);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  
  const [prioritizeRequests, setPrioritizeRequests] = useState(true);
  const [balanceWorkload, setBalanceWorkload] = useState(true);
  const [balanceNightShifts, setBalanceNightShifts] = useState(true);

  const { generating, generateSchedule, result } = useScheduleGenerator();

  // 制約条件を読み込み
  useEffect(() => {
    loadConstraints();
  }, []);

  // result が更新されたら onGenerated を呼ぶ
  useEffect(() => {
    if (result) {
      console.log('✅ ScheduleGeneratorForm: 生成結果を検出しました');
      console.log('📊 生成されたシフト:', result.schedules.length, '件');
      console.log('🔔 onGenerated コールバックを呼び出します');
      onGenerated();
    }
  }, [result, onGenerated]);

  const loadConstraints = async () => {
    try {
      const allConstraints = await db.scheduleConstraints.toArray();
      const activeConstraints = allConstraints
        .filter(c => c.isActive)
        .sort((a, b) => b.priority - a.priority);
      
      setConstraints(activeConstraints);
      
      // デフォルトで全ての有効な制約を選択
      setSelectedConstraints(activeConstraints.map(c => c.id));
      
      console.log('✅ 制約条件を読み込みました:', activeConstraints.length, '種類');
    } catch (error) {
      console.error('❌ 制約条件の読み込みに失敗しました:', error);
    }
  };

  const handleConstraintToggle = (constraintId: string) => {
    setSelectedConstraints(prev =>
      prev.includes(constraintId)
        ? prev.filter(id => id !== constraintId)
        : [...prev, constraintId]
    );
  };

  const handleGenerate = async () => {
    if (selectedConstraints.length === 0) {
      alert('少なくとも1つの制約条件を選択してください。');
      return;
    }

    const params: ScheduleGenerationParams = {
      targetYear,
      targetMonth,
      constraintIds: selectedConstraints,
      prioritizeRequests,
      balanceWorkload,
      balanceNightShifts,
    };

    console.log('🚀 スケジュール生成を開始します...', params);

    const generationResult = await generateSchedule(params);

    if (generationResult) {
      console.log('✅ スケジュール生成が完了しました！');
      console.log('📊 結果:', generationResult.schedules.length, '件のシフト');
      console.log('⚠️ 違反:', generationResult.violations.length, '件');
      
      // 明示的に onGenerated を呼ぶ（念のため）
      console.log('🔔 onGenerated コールバックを直接呼び出します');
      onGenerated();
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Zap className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">自動スケジュール生成</h2>
          <p className="text-sm text-gray-600">制約条件を満たす最適なシフトを自動生成します</p>
        </div>
      </div>

      {/* 対象年月 */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Calendar className="w-4 h-4" />
          対象年月
        </label>
        <div className="flex gap-4">
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={generating}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={targetMonth}
            onChange={(e) => setTargetMonth(Number(e.target.value))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={generating}
          >
            {months.map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
        </div>
      </div>

      {/* 制約条件の選択 */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Settings className="w-4 h-4" />
          適用する制約条件
        </label>
        <div className="space-y-2">
          {constraints.map(constraint => (
            <label
              key={constraint.id}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedConstraints.includes(constraint.id)}
                onChange={() => handleConstraintToggle(constraint.id)}
                disabled={generating}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{constraint.name}</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    優先度: {constraint.priority}
                  </span>
                </div>
                {constraint.description && (
                  <p className="text-sm text-gray-600 mt-1">{constraint.description}</p>
                )}
              </div>
            </label>
          ))}
          {constraints.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              有効な制約条件がありません。設定タブで制約条件を追加してください。
            </p>
          )}
        </div>
      </div>

      {/* 生成オプション */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          生成オプション
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={prioritizeRequests}
              onChange={(e) => setPrioritizeRequests(e.target.checked)}
              disabled={generating}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <div>
              <span className="font-medium text-gray-800">🎯 シフト希望を優先</span>
              <p className="text-sm text-gray-600">スタッフが登録したシフト希望を優先的に反映します</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={balanceWorkload}
              onChange={(e) => setBalanceWorkload(e.target.checked)}
              disabled={generating}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <div>
              <span className="font-medium text-gray-800">⚖️ 勤務配分の公平性</span>
              <p className="text-sm text-gray-600">スタッフ間の勤務日数を均等に配分します</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={balanceNightShifts}
              onChange={(e) => setBalanceNightShifts(e.target.checked)}
              disabled={generating}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <div>
              <span className="font-medium text-gray-800">🌙 夜勤の均等配分</span>
              <p className="text-sm text-gray-600">夜勤シフトをスタッフ間で均等に配分します</p>
            </div>
          </label>
        </div>
      </div>

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={generating || selectedConstraints.length === 0}
        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            <span>スケジュール生成中...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span>スケジュールを生成</span>
          </>
        )}
      </button>

      {generating && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 スケジュール生成には数秒かかる場合があります。しばらくお待ちください...
          </p>
        </div>
      )}

      {/* デバッグ情報 */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✅ 生成完了: {result.schedules.length}件のシフトを生成しました
          </p>
          <p className="text-xs text-green-700 mt-1">
            制約違反: {result.violations.length}件
          </p>
        </div>
      )}
    </div>
  );
}
