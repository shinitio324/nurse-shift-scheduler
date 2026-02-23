import { Calendar, AlertTriangle, CheckCircle, Users, BarChart3, Save, X } from 'lucide-react';
import { ScheduleGenerationResult } from '../types';
import { useScheduleGenerator } from '../hooks/useScheduleGenerator';

interface Props {
  result: ScheduleGenerationResult;
  onSave: () => void;
  onCancel: () => void;
}

export function SchedulePreview({ result, onSave, onCancel }: Props) {
  const { saveSchedule } = useScheduleGenerator();

  const handleSave = async () => {
    const success = await saveSchedule(result.schedules);
    if (success) {
      alert('スケジュールを保存しました！');
      onSave();
    }
  };

  const getShiftColor = (shiftType: string): string => {
    if (shiftType === '休み') return 'bg-gray-100 text-gray-700';
    if (shiftType.includes('日勤')) return 'bg-blue-100 text-blue-700';
    if (shiftType.includes('早番')) return 'bg-green-100 text-green-700';
    if (shiftType.includes('遅番')) return 'bg-orange-100 text-orange-700';
    if (shiftType.includes('夜勤') || shiftType.includes('夜')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  // 日付ごとにグループ化
  const schedulesByDate = result.schedules.reduce((acc, schedule) => {
    if (!acc[schedule.date]) {
      acc[schedule.date] = [];
    }
    acc[schedule.date].push(schedule);
    return acc;
  }, {} as Record<string, typeof result.schedules>);

  const dates = Object.keys(schedulesByDate).sort();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">スケジュール生成完了</h2>
            <p className="text-sm text-gray-600">
              {result.statistics.totalDays}日間 / {result.statistics.totalShifts}件のシフト
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </div>

      {/* 制約違反の警告 */}
      {result.violations.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-800 mb-2">
                ⚠️ 制約違反が検出されました（{result.violations.length}件）
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.violations.map((violation, index) => (
                  <div key={index} className="text-sm text-amber-700">
                    <span className="font-medium">{violation.date}</span> - 
                    <span className="ml-1">{violation.staffName}</span> - 
                    <span className="ml-1">{violation.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">総日数</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{result.statistics.totalDays}日</p>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">総シフト数</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{result.statistics.totalShifts}件</p>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">スタッフ数</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{result.statistics.staffWorkload.length}名</p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-900">制約違反</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{result.violations.length}件</p>
        </div>
      </div>

      {/* スタッフ別統計 */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">👥 スタッフ別統計</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スタッフ名
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  勤務日数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  夜勤回数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  休日数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最大連続勤務
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  総勤務時間
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {result.statistics.staffWorkload.map((staff) => (
                <tr key={staff.staffId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {staff.staffName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                    {staff.totalShifts}日
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                    {staff.nightShifts}回
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                    {staff.restDays}日
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                    {staff.consecutiveWorkDays}日
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                    {staff.totalWorkHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* カレンダープレビュー */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-3">📅 カレンダープレビュー</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {dates.map(date => (
            <div key={date} className="border border-gray-200 rounded-lg p-3">
              <div className="font-medium text-gray-800 mb-2">
                {new Date(date).toLocaleDateString('ja-JP', { 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'short'
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {schedulesByDate[date]
                  .sort((a, b) => a.staffName.localeCompare(b.staffName))
                  .map(schedule => (
                    <span
                      key={schedule.id}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getShiftColor(schedule.shiftType)}`}
                    >
                      {schedule.staffName}: {schedule.shiftType}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
