// src/components/SchedulePreview.tsx
import React, { useEffect, useState } from 'react';
import { Save, X, AlertTriangle, Users, Calendar, Clock } from 'lucide-react';
import { db } from '../db';
import { useScheduleGenerator } from '../hooks/useScheduleGenerator';
import type { ScheduleGenerationResult, ShiftPattern, Staff } from '../types';

interface SchedulePreviewProps {
  result: ScheduleGenerationResult;
  year: number;
  month: number;
  onSave: () => void;
  onCancel: () => void;
}

export const SchedulePreview: React.FC<SchedulePreviewProps> = ({
  result, year, month, onSave, onCancel,
}) => {
  const { saveSchedule } = useScheduleGenerator();
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [staff,    setStaff]    = useState<Staff[]>([]);
  const [saving,   setSaving]   = useState(false);

  const safeSchedule   = Array.isArray(result?.schedule)                        ? result.schedule                        : [];
  const safeWorkload   = Array.isArray(result?.statistics?.staffWorkload)        ? result.statistics.staffWorkload        : [];
  const safeWarnings   = Array.isArray(result?.warnings)                         ? result.warnings                        : [];
  const safeDist       = (result?.statistics?.shiftTypeDistribution && typeof result.statistics.shiftTypeDistribution === 'object')
    ? result.statistics.shiftTypeDistribution : {};

  useEffect(() => {
    db.shiftPatterns.toArray().then(setPatterns).catch(() => setPatterns([]));
    db.staff.toArray().then(setStaff).catch(() => setStaff([]));
  }, []);

  const getPattern = (patternId: number): ShiftPattern | undefined =>
    patterns.find(p => p?.id === patternId);

  const getShiftColor = (patternId: number): string =>
    getPattern(patternId)?.color ?? '#e5e7eb';

  const getShiftName = (patternId: number): string =>
    getPattern(patternId)?.name ?? '-';

  const getStaffName = (staffId: number): string =>
    staff.find(s => s?.id === staffId)?.name ?? `ID:${staffId}`;

  // 日付リスト
  const days = result?.statistics?.totalDays ?? 0;
  const dates: string[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // 日付ごとのシフトMap
  const scheduleByDate: Record<string, Record<number, number>> = {};
  for (const s of safeSchedule) {
    if (!s) continue;
    if (!scheduleByDate[s.date]) scheduleByDate[s.date] = {};
    scheduleByDate[s.date][s.staffId] = s.patternId;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSchedule(safeSchedule, year, month);
      onSave();
    } catch (e) {
      console.error('保存失敗:', e);
      alert('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {year}年{month}月 スケジュールプレビュー
            </h2>
            <p className="text-sm text-gray-500">{safeSchedule.length}件のシフトを生成しました</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" /> キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存する
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
        {[
          { icon: Calendar, color: 'blue',   label: '対象日数',   value: `${result?.statistics?.totalDays ?? 0}日` },
          { icon: Clock,    color: 'green',  label: '総シフト数', value: `${safeSchedule.length}件` },
          { icon: Users,    color: 'purple', label: 'スタッフ数', value: `${safeWorkload.length}名` },
          { icon: AlertTriangle, color: 'yellow', label: '警告', value: `${safeWarnings.length}件` },
        ].map(({ icon: Icon, color, label, value }) => (
          <div key={label} className={`bg-${color}-50 rounded-lg p-4 text-center`}>
            <Icon className={`w-5 h-5 text-${color}-600 mx-auto mb-1`} />
            <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
            <p className={`text-xs text-${color}-600`}>{label}</p>
          </div>
        ))}
      </div>

      {/* 警告一覧 */}
      {safeWarnings.length > 0 && (
        <div className="mx-5 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">警告 ({safeWarnings.length}件)</span>
          </div>
          <ul className="space-y-1">
            {safeWarnings.map((w, i) => (
              <li key={i} className="text-sm text-yellow-700">・{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* スタッフ別勤務集計 */}
      {safeWorkload.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> スタッフ別集計
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['スタッフ', '勤務', '夜勤', '明け', '有給', '休み', '合計'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {safeWorkload.map(wl => (
                  <tr key={wl?.staffId ?? Math.random()} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{wl?.staffName ?? '-'}</td>
                    <td className="px-3 py-2 text-center text-blue-700">{wl?.workDays ?? 0}</td>
                    <td className="px-3 py-2 text-center text-indigo-700">{wl?.nightDays ?? 0}</td>
                    <td className="px-3 py-2 text-center text-cyan-700">{wl?.akeDays ?? 0}</td>
                    <td className="px-3 py-2 text-center text-green-700">{wl?.vacationDays ?? 0}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{wl?.restDays ?? 0}</td>
                    <td className="px-3 py-2 text-center text-gray-800 font-medium">{wl?.totalDays ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* カレンダープレビュー */}
      {staff.length > 0 && dates.length > 0 && (
        <div className="mx-5 mb-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> カレンダープレビュー
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
                    スタッフ
                  </th>
                  {dates.map(d => {
                    const day = new Date(d).getDay();
                    const isHoliday = day === 0 || day === 6;
                    return (
                      <th
                        key={d}
                        className={`px-1.5 py-2 text-center font-medium whitespace-nowrap ${isHoliday ? 'text-red-500' : 'text-gray-500'}`}
                      >
                        {new Date(d).getDate()}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(member => {
                  if (member?.id == null) return null;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">
                        {member.name}
                      </td>
                      {dates.map(d => {
                        const pid = scheduleByDate[d]?.[member.id!];
                        const color = pid != null ? getShiftColor(pid) : '#f3f4f6';
                        const name  = pid != null ? getShiftName(pid)  : '';
                        return (
                          <td key={d} className="px-1 py-1">
                            <div
                              className="w-8 h-6 rounded flex items-center justify-center text-xs font-medium text-gray-700"
                              style={{ backgroundColor: color }}
                            >
                              {name.slice(0, 2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePreview;
