import { useState, useMemo } from 'react';
import { Trash2, Filter, Calendar, Users, BarChart3 } from 'lucide-react';
import { useShiftRequests } from '../hooks/useShiftRequests';
import { useShiftPatterns } from '../hooks/useShiftPatterns';
import { useStaff } from '../hooks/useStaff';
import {
  compareDateStrings,
  getWeekdayLabel,
  parseLocalDate,
} from '../utils/dateUtils';

type FilterType = 'all' | 'staff' | 'date' | 'shiftType';
type SortType = 'date-asc' | 'date-desc' | 'staff' | 'shiftType';

export function ShiftRequestList() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [sortType, setSortType] = useState<SortType>('date-desc');
  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const { staff } = useStaff();
  const { patterns } = useShiftPatterns();
  const {
    shiftRequests,
    deleteShiftRequest,
    getMonthlyStats,
    clearStaffMonthShifts,
  } = useShiftRequests();

  const filteredAndSortedRequests = useMemo(() => {
    const filtered = [...shiftRequests];

    const next = filtered.filter((req) => {
      if (filterType === 'staff' && filterValue) {
        return req.staffId === filterValue;
      }

      if (filterType === 'date' && filterValue) {
        return req.date === filterValue;
      }

      if (filterType === 'shiftType' && filterValue) {
        return req.shiftType === filterValue;
      }

      return true;
    });

    next.sort((a, b) => {
      switch (sortType) {
        case 'date-asc':
          return compareDateStrings(a.date, b.date);
        case 'date-desc':
          return compareDateStrings(b.date, a.date);
        case 'staff':
          return (a.staffName || '').localeCompare(b.staffName || '', 'ja');
        case 'shiftType':
          return a.shiftType.localeCompare(b.shiftType, 'ja');
        default:
          return 0;
      }
    });

    return next;
  }, [shiftRequests, filterType, filterValue, sortType]);

  const monthlyStats = useMemo(() => {
    return getMonthlyStats(currentYear, currentMonth);
  }, [currentYear, currentMonth, shiftRequests, getMonthlyStats]);

  const getPatternColor = (shiftType: string): string => {
    const pattern = patterns.find((p) => p.name === shiftType);
    return pattern?.color || '#6B7280';
  };

  const getPatternShortName = (shiftType: string): string => {
    const pattern = patterns.find((p) => p.name === shiftType);
    return pattern?.shortName || shiftType;
  };

  const formatDisplayDate = (dateString: string): string => {
    const date = parseLocalDate(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = getWeekdayLabel(dateString);
    return `${month}/${day} (${weekday})`;
  };

  const handleDelete = async (
    id: string,
    staffName: string,
    date: string,
    shiftType: string
  ) => {
    const confirmDelete = window.confirm(
      `${staffName}の${formatDisplayDate(date)}「${shiftType}」を削除しますか？`
    );

    if (confirmDelete) {
      await deleteShiftRequest(id);
    }
  };

  const handleClearStaffMonth = async (staffId: string, staffName: string) => {
    const confirmClear = window.confirm(
      `${staffName}の${currentMonth}月のシフトを全て削除しますか？\n\nこの操作は取り消せません。`
    );

    if (confirmClear) {
      await clearStaffMonthShifts(staffId, currentYear, currentMonth);
    }
  };

  const resetFilter = () => {
    setFilterType('all');
    setFilterValue('');
    setSortType('date-desc');
  };

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">総シフト数</p>
              <p className="mt-1 text-3xl font-bold">{monthlyStats.total}</p>
            </div>
            <Calendar className="h-10 w-10 text-blue-200 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">登録スタッフ</p>
              <p className="mt-1 text-3xl font-bold">
                {Object.keys(monthlyStats.byStaff).length}
              </p>
            </div>
            <Users className="h-10 w-10 text-green-200 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">シフト種類</p>
              <p className="mt-1 text-3xl font-bold">
                {Object.keys(monthlyStats.byShiftType).length}
              </p>
            </div>
            <BarChart3 className="h-10 w-10 text-purple-200 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">表示期間</p>
              <p className="mt-1 text-2xl font-bold">
                {currentYear}年{currentMonth}月
              </p>
            </div>
            <Calendar className="h-10 w-10 text-orange-200 opacity-80" />
          </div>
        </div>
      </div>

      {/* フィルター＆ソート */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">フィルター＆ソート</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              フィルター条件
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as FilterType);
                setFilterValue('');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">全て表示</option>
              <option value="staff">スタッフ別</option>
              <option value="shiftType">シフト種類別</option>
            </select>
          </div>

          {filterType === 'staff' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                スタッフ選択
              </label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- 選択してください --</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterType === 'shiftType' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                シフト種類選択
              </label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- 選択してください --</option>
                {patterns.map((pattern) => (
                  <option key={pattern.id} value={pattern.name}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              並び順
            </label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as SortType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="date-desc">日付が新しい順</option>
              <option value="date-asc">日付が古い順</option>
              <option value="staff">スタッフ名順</option>
              <option value="shiftType">シフト種類順</option>
            </select>
          </div>

          {(filterType !== 'all' || sortType !== 'date-desc') && (
            <div className="flex items-end">
              <button
                onClick={resetFilter}
                className="w-full rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300"
              >
                フィルターをリセット
              </button>
            </div>
          )}
        </div>
      </div>

      {/* シフトリクエスト一覧 */}
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-800">
            シフトリクエスト一覧
            <span className="ml-2 text-sm font-normal text-gray-600">
              （{filteredAndSortedRequests.length}件）
            </span>
          </h3>
        </div>

        {filteredAndSortedRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h4 className="mb-2 text-xl font-semibold text-gray-800">
              シフトリクエストがありません
            </h4>
            <p className="text-gray-600">カレンダーからシフトを入力してください</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    日付
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    スタッフ名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    シフト種類
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    登録日時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAndSortedRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDisplayDate(request.date)}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {request.staffName}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white"
                        style={{ backgroundColor: getPatternColor(request.shiftType) }}
                      >
                        {getPatternShortName(request.shiftType)} - {request.shiftType}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {new Date(request.createdAt).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          handleDelete(
                            request.id,
                            request.staffName || '不明',
                            request.date,
                            request.shiftType
                          )
                        }
                        className="text-red-600 hover:text-red-900"
                        title="削除"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* スタッフ別統計 */}
      {Object.keys(monthlyStats.byStaff).length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            スタッフ別シフト統計
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(monthlyStats.byStaff).map(([staffName, count]) => {
              const staffData = staff.find((s) => s.name === staffName);

              return (
                <div
                  key={staffName}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{staffName}</p>
                      <p className="text-sm text-gray-600">
                        {staffData?.position || '不明'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-600">{count}</p>
                      <p className="text-xs text-gray-500">件のシフト</p>
                    </div>
                  </div>

                  {staffData && (
                    <button
                      onClick={() => handleClearStaffMonth(staffData.id, staffName)}
                      className="mt-3 w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                    >
                      今月のシフトを全削除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* シフト種類別統計 */}
      {Object.keys(monthlyStats.byShiftType).length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            シフト種類別統計
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(monthlyStats.byShiftType).map(([shiftType, count]) => (
              <div
                key={shiftType}
                className="rounded-lg p-4 text-center text-white shadow-md"
                style={{ backgroundColor: getPatternColor(shiftType) }}
              >
                <p className="text-sm font-medium opacity-90">
                  {getPatternShortName(shiftType)}
                </p>
                <p className="mt-2 text-3xl font-bold">{count}</p>
                <p className="mt-1 text-xs opacity-80">{shiftType}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
