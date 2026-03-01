import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { RefreshCw, TrendingUp, Users, Clock, Moon, Activity, AlertCircle } from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';

// ---- カスタム Tooltip ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md text-sm">
      <p className="font-semibold" style={{ color: p.payload?.color }}>{p.name}</p>
      <p>{p.value} 件 ({Math.round((p.payload?.percent ?? 0) * 100)}%)</p>
    </div>
  );
};

// ---- メインコンポーネント ----
export function StatisticsPanel() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data, loading, error, reload } = useStatistics(year, month);

  const years  = Array.from({ length: 3 }, (_, i) => today.getFullYear() - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // ---- チャートデータ変換 ----
  const staffBarData = (data?.staffWorkload ?? []).slice(0, 15).map(s => ({
    name:     s.staffName,
    '勤務日数': s.workDays,
    '夜勤':   s.nightShifts,
    '休日':   s.restDays,
  }));

  const pieData = (data?.shiftTypeDistribution ?? []).map(d => ({
    name:    d.shiftType,
    value:   d.count,
    color:   d.color,
    percent: 0, // recharts が上書きする
  }));

  const nightRankData = (data?.staffWorkload ?? [])
    .filter(s => s.nightShifts > 0)
    .sort((a, b) => b.nightShifts - a.nightShifts)
    .slice(0, 10)
    .map(s => ({ name: s.staffName, '夜勤回数': s.nightShifts }));

  const hoursRankData = (data?.staffWorkload ?? [])
    .filter(s => s.totalWorkHours > 0)
    .sort((a, b) => b.totalWorkHours - a.totalWorkHours)
    .slice(0, 10)
    .map(s => ({ name: s.staffName, '勤務時間': Math.round(s.totalWorkHours) }));

  return (
    <div className="space-y-6">

      {/* ── ヘッダー ── */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            詳細統計情報（Phase 4）
          </h2>
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm">
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">月</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm">
              {months.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── エラー ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── ローディング ── */}
      {loading && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* ── データなし ── */}
      {!loading && data && data.summary.totalShifts === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <p className="text-yellow-800 font-medium text-lg">
            {year}年{month}月のシフトデータがありません
          </p>
          <p className="text-yellow-700 text-sm mt-2">
            「勤務表」タブでスケジュールを自動生成してから確認してください。
          </p>
        </div>
      )}

      {/* ── 統計コンテンツ ── */}
      {!loading && data && data.summary.totalShifts > 0 && (
        <>
          {/* ── サマリーカード ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: '総シフト数',       value: `${data.summary.totalShifts}件`,                    icon: TrendingUp, bg: 'bg-blue-50',   text: 'text-blue-700',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-600' },
              { label: '登録スタッフ',      value: `${data.summary.registeredStaff}名`,                icon: Users,      bg: 'bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100',  iconColor: 'text-green-600' },
              { label: 'シフト有スタッフ',   value: `${data.summary.activeStaff}名`,                   icon: Users,      bg: 'bg-teal-50',   text: 'text-teal-700',   iconBg: 'bg-teal-100',   iconColor: 'text-teal-600' },
              { label: '平均勤務日数',      value: `${data.summary.avgWorkDaysPerStaff}日`,            icon: Clock,      bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
              { label: '平均夜勤回数',      value: `${data.summary.avgNightShiftsPerStaff}回`,         icon: Moon,       bg: 'bg-indigo-50', text: 'text-indigo-700', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
              { label: '平均勤務時間',      value: `${data.summary.avgWorkHoursPerStaff}h`,            icon: Activity,   bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
            ].map(({ label, value, icon: Icon, bg, text, iconBg, iconColor }) => (
              <div key={label} className={`${bg} rounded-lg shadow-sm p-4`}>
                <div className={`inline-flex p-2 ${iconBg} rounded-lg mb-2`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <p className="text-xs text-gray-600 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── チャート Row 1: スタッフ別 + パイチャート ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* スタッフ別シフト分布（横棒） */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">スタッフ別シフト分布</h3>
              {staffBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(240, staffBarData.length * 30)}>
                  <BarChart data={staffBarData} layout="vertical"
                    margin={{ top: 5, right: 20, left: 70, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
                    <Tooltip content={<BarTooltip />} />
                    <Legend />
                    <Bar dataKey="勤務日数" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="夜勤"     stackId="a" fill="#8B5CF6" />
                    <Bar dataKey="休日"     stackId="a" fill="#9CA3AF" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">データがありません</p>
              )}
            </div>

            {/* シフト種別分布（円） */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">シフト種別分布</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={true}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">データがありません</p>
              )}
            </div>
          </div>

          {/* ── チャート Row 2: 夜勤ランキング + 勤務時間ランキング ── */}
          {(nightRankData.length > 0 || hoursRankData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {nightRankData.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">🌙 夜勤回数ランキング</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, nightRankData.length * 32)}>
                    <BarChart data={nightRankData} layout="vertical"
                      margin={{ top: 5, right: 20, left: 70, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
                      <Tooltip />
                      <Bar dataKey="夜勤回数" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {hoursRankData.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">⏰ 勤務時間ランキング（h）</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, hoursRankData.length * 32)}>
                    <BarChart data={hoursRankData} layout="vertical"
                      margin={{ top: 5, right: 20, left: 70, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
                      <Tooltip />
                      <Bar dataKey="勤務時間" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── スタッフ別詳細テーブル ── */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">📋 スタッフ別詳細統計</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">スタッフ名</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">役職</th>
                    <th className="text-center px-3 py-3 font-semibold text-blue-700">総シフト</th>
                    <th className="text-center px-3 py-3 font-semibold text-green-700">勤務日</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">休日</th>
                    <th className="text-center px-3 py-3 font-semibold text-purple-700">夜勤</th>
                    <th className="text-center px-3 py-3 font-semibold text-indigo-700">勤務時間</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffWorkload.map((s, i) => (
                    <tr key={s.staffId}
                      className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.staffName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.position}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700">{s.totalShifts}</td>
                      <td className="px-3 py-3 text-center text-green-700">{s.workDays}</td>
                      <td className="px-3 py-3 text-center text-gray-400">{s.restDays}</td>
                      <td className="px-3 py-3 text-center text-purple-700">{s.nightShifts}</td>
                      <td className="px-3 py-3 text-center text-indigo-700">{Math.round(s.totalWorkHours)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── シフト種別カード ── */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">🗂️ シフト種別統計</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {data.shiftTypeDistribution.map(d => (
                <div key={d.shiftType} className="p-4 rounded-xl border-2"
                  style={{ borderColor: d.color, backgroundColor: `${d.color}18` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: d.color }}>
                      {d.shortName}
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">{d.shiftType}</span>
                  </div>
                  <p className="text-3xl font-bold mb-1" style={{ color: d.color }}>{d.count}</p>
                  <p className="text-xs text-gray-500">合計件数</p>
                  {d.requiredStaff > 0 && (
                    <p className="text-xs text-gray-600 mt-1">必要人数 {d.requiredStaff}名/日</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">平均 {d.avgPerDay}件/日</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
