import React, { useEffect, useMemo, useState } from 'react';
import {
  Save,
  X,
  AlertTriangle,
  Users,
  Calendar,
  Clock,
} from 'lucide-react';

import { db } from '../db';
import { useScheduleGenerator } from '../hooks/useScheduleGenerator';

import type {
  ScheduleGenerationResult,
  ShiftPattern,
  Staff,
  GeneratedShift,
} from '../types';

interface SchedulePreviewProps {
  result: ScheduleGenerationResult;
  year: number;
  month: number;
  onSave: () => void;
  onCancel: () => void;
}

function toIdKey(id: string | number | null | undefined): string {
  return String(id ?? '');
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0'
  )}`;
}

const summaryCardStyles = {
  blue: {
    box: 'bg-blue-50',
    icon: 'text-blue-600',
    value: 'text-blue-700',
    label: 'text-blue-600',
  },
  green: {
    box: 'bg-green-50',
    icon: 'text-green-600',
    value: 'text-green-700',
    label: 'text-green-600',
  },
  purple: {
    box: 'bg-purple-50',
    icon: 'text-purple-600',
    value: 'text-purple-700',
    label: 'text-purple-600',
  },
  yellow: {
    box: 'bg-yellow-50',
    icon: 'text-yellow-600',
    value: 'text-yellow-700',
    label: 'text-yellow-600',
  },
} as const;

export const SchedulePreview: React.FC<SchedulePreviewProps> = ({
  result,
  year,
  month,
  onSave,
  onCancel,
}) => {
  const { saveSchedule } = useScheduleGenerator();

  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

  const safeSchedule: GeneratedShift[] = Array.isArray(result?.schedule)
    ? result.schedule
    : [];

  const safeWorkload = Array.isArray(result?.statistics?.staffWorkload)
    ? result.statistics.staffWorkload
    : [];

  const safeWarnings = Array.isArray(result?.warnings) ? result.warnings : [];

  const safeDist =
    result?.statistics?.shiftTypeDistribution &&
    typeof result.statistics.shiftTypeDistribution === 'object'
      ? result.statistics.shiftTypeDistribution
      : {};

  useEffect(() => {
    let active = true;

    Promise.all([
      db.shiftPatterns.toArray().catch(() => []),
      db.staff.toArray().catch(() => []),
    ]).then(([loadedPatterns, loadedStaff]) => {
      if (!active) return;
      setPatterns(Array.isArray(loadedPatterns) ? loadedPatterns : []);
      setStaff(Array.isArray(loadedStaff) ? loadedStaff : []);
    });

    return () => {
      active = false;
    };
  }, []);

  const patternMap = useMemo(() => {
    const map = new Map<string, ShiftPattern>();
    for (const p of patterns) {
      if (p?.id == null) continue;
      map.set(toIdKey(p.id), p);
    }
    return map;
  }, [patterns]);

  const staffMap = useMemo(() => {
    const map = new Map<string, Staff>();
    for (const s of staff) {
      if (s?.id == null) continue;
      map.set(toIdKey(s.id), s);
    }
    return map;
  }, [staff]);

  const getPattern = (patternId: number | string): ShiftPattern | undefined =>
    patternMap.get(toIdKey(patternId));

  const getShiftColor = (patternId: number | string): string =>
    getPattern(patternId)?.color ?? '#e5e7eb';

  const getShiftName = (patternId: number | string): string =>
    getPattern(patternId)?.name ?? '-';

  const getStaffName = (staffId: number | string): string =>
    staffMap.get(toIdKey(staffId))?.name ?? `ID:${staffId}`;

  const days =
    Number(result?.statistics?.totalDays) > 0
      ? Number(result.statistics.totalDays)
      : new Date(year, month, 0).getDate();

  const dates: string[] = useMemo(() => {
    return Array.from({ length: days }, (_, i) =>
      formatDateString(year, month, i + 1)
    );
  }, [year, month, days]);

  const scheduleByDateAndStaff = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    for (const s of safeSchedule) {
      if (!s?.date || s.staffId == null || s.patternId == null) continue;
      if (!map[s.date]) map[s.date] = {};
      map[s.date][toIdKey(s.staffId)] = Number(s.patternId);
    }

    return map;
  }, [safeSchedule]);

  const displayedStaff = useMemo(() => {
    if (staff.length > 0) return staff;

    // スタッフ一覧の読み込みがまだでも workload だけは見えるよう補完
    return safeWorkload.map((wl) => ({
      id: wl.staffId as string,
      name: wl.staffName,
      position: 'その他' as const,
      employmentType: '常勤' as const,
      qualifications: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }, [staff, safeWorkload]);

  const distributionEntries = Object.entries(safeDist).sort((a, b) =>
    a[0].localeCompare(b[0], 'ja')
  );

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {year}年{month}月 スケジュールプレビュー
            </h2>
            <p className="text-sm text-gray-500">
              {safeSchedule.length}件のシフトを生成しました
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            キャンセル
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存する
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        {[
          {
            icon: Calendar,
            color: 'blue' as const,
            label: '対象日数',
            value: `${result?.statistics?.totalDays ?? 0}日`,
          },
          {
            icon: Clock,
            color: 'green' as const,
            label: '総シフト数',
            value: `${safeSchedule.length}件`,
          },
          {
            icon: Users,
            color: 'purple' as const,
            label: 'スタッフ数',
            value: `${safeWorkload.length}名`,
          },
          {
            icon: AlertTriangle,
            color: 'yellow' as const,
            label: '警告',
            value: `${safeWarnings.length}件`,
          },
        ].map(({ icon: Icon, color, label, value }) => {
          const style = summaryCardStyles[color];
          return (
            <div key={label} className={`${style.box} rounded-lg p-4 text-center`}>
              <Icon className={`mx-auto mb-1 h-5 w-5 ${style.icon}`} />
              <p className={`text-2xl font-bold ${style.value}`}>{value}</p>
              <p className={`text-xs ${style.label}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {/* 警告一覧 */}
      {safeWarnings.length > 0 && (
        <div className="mx-5 mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              警告 ({safeWarnings.length}件)
            </span>
          </div>
          <ul className="space-y-1">
            {safeWarnings.map((warning, index) => (
              <li key={`${warning}-${index}`} className="text-sm text-yellow-700">
                ・{warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* シフト種別分布 */}
      {distributionEntries.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            シフト種別集計
          </h3>
          <div className="flex flex-wrap gap-2">
            {distributionEntries.map(([name, count]) => (
              <div
                key={name}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
              >
                {name}: <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* スタッフ別勤務集計 */}
      {safeWorkload.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Users className="h-4 w-4" />
            スタッフ別集計
          </h3>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['スタッフ', '勤務', '夜勤', '明け', '有給', '休み', '合計'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {safeWorkload.map((wl) => (
                  <tr
                    key={toIdKey(wl?.staffId)}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">
                      {wl?.staffName ?? getStaffName(wl?.staffId)}
                    </td>
                    <td className="px-3 py-2 text-center text-blue-700">
                      {wl?.workDays ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center text-indigo-700">
                      {wl?.nightDays ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center text-cyan-700">
                      {wl?.akeDays ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center text-green-700">
                      {wl?.vacationDays ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {wl?.restDays ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-gray-800">
                      {wl?.totalDays ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* カレンダープレビュー */}
      {displayedStaff.length > 0 && dates.length > 0 && (
        <div className="mx-5 mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            カレンダープレビュー
          </h3>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 whitespace-nowrap bg-gray-50 px-3 py-2 text-left font-medium text-gray-500">
                    スタッフ
                  </th>
                  {dates.map((d) => {
                    const day = new Date(d).getDay();
                    const isHoliday = day === 0 || day === 6;
                    return (
                      <th
                        key={d}
                        className={`whitespace-nowrap px-1.5 py-2 text-center font-medium ${
                          isHoliday ? 'text-red-500' : 'text-gray-500'
                        }`}
                      >
                        {new Date(d).getDate()}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {displayedStaff.map((member) => {
                  if (member?.id == null) return null;

                  const memberKey = toIdKey(member.id);

                  return (
                    <tr key={memberKey} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-gray-800">
                        {member.name}
                      </td>

                      {dates.map((d) => {
                        const pid = scheduleByDateAndStaff[d]?.[memberKey];
                        const color = pid != null ? getShiftColor(pid) : '#f3f4f6';
                        const name = pid != null ? getShiftName(pid) : '';

                        return (
                          <td key={`${memberKey}-${d}`} className="px-1 py-1">
                            <div
                              className="flex h-6 w-8 items-center justify-center rounded text-[10px] font-medium text-gray-700"
                              style={{ backgroundColor: color }}
                              title={name || '未割当'}
                            >
                              {name ? name.slice(0, 2) : ''}
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
