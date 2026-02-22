import { useState, useMemo } from 'react';
import { Trash2, Filter, Calendar, Users, BarChart3 } from 'lucide-react';
import { useShiftRequests } from '../hooks/useShiftRequests';
import { useShiftPatterns } from '../hooks/useShiftPatterns';
import { useStaff } from '../hooks/useStaff';
import type { ShiftRequest, ShiftType } from '../types';

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

  /**
   * フィルタリング＆ソート済みのシフトリクエスト
   */
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...shiftRequests];

    // フィルタリング
    if (filterType === 'staff' && filterValue) {
      filtered = filtered.filter(req => req.staffId === filterValue);
    } else if (filterType === 'date' && filterValue) {
      filtered = filtered.filter(req => req.date === filterValue);
    } else if (filterType === 'shiftType' && filterValue) {
      filtered = filtered.filter(req => req.shiftType === filterValue);
    }

    // ソート
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'staff':
          return (a.staffName || '').localeCompare(b.staffName || '');
        case 'shiftType':
          return a.shiftType.localeCompare(b.shiftType);
        default:
          return 0;
      }
    });

    return filtered;
  }, [shiftRequests, filterType, filterValue, sortType]);

  /**
   * 月別統計
   */
  const monthlyStats = useMemo(() => {
    return getMonthlyStats(currentYear, currentMonth);
  }, [currentYear, currentMonth, shiftRequests]);

  /**
   * 勤務パターンの色を取得
   */
  const getPatternColor = (shiftType: ShiftType): string => {
    const pattern = patterns.find(p => p.name === shiftType);
    return pattern?.color || '#6B7280';
  };

  /**
   * 勤務パターンの略称を取得
   */
  const getPatternShortName = (shiftType: ShiftType): string => {
    const pattern = patterns.find(p => p.name === shiftType);
    return pattern?.shortName || shiftType;
  };

  /**
   * 日付を表示用にフォーマット
   */
  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
  };

  /**
   * シフトリクエストを削除
   */
  const handleDelete = async (id: string, staffName: string, date: string, shiftType: string) => {
    const confirmDelete = window.confirm(
      `${staffName}の${formatDisplayDate(date)}「${shiftType}」を削除しますか？`
    );

    if (confirmDelete) {
      await deleteShiftRequest(id);
    }
  };

  /**
   * スタッフの月別シフトを全てクリア
   */
  const handleClearStaffMonth = async (staffId: string, staffName: string) => {
    const confirmClear = window.confirm(
      `${staffName}の${currentMonth}月のシフトを全て削除しますか？\n\nこの操作は取り消せません。`
    );

    if (confirmClear) {
      await clearStaffMonthShifts(staffId, currentYear, currentMonth);
    }
  };

  /**
   * フィルタをリセット
   */
  const resetFilter = () => {
    setFilterType('all');
    setFilterValue('');
  };

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">総シフト数</p>
              <p className="text-3xl font-bold mt-1">{monthlyStats.total}</p>
            </div>
            <Calendar className="w-10 h-10 text-blue-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">登録スタッフ</p>
              <p className="text-3xl font-bold mt-1">
                {Object.keys(monthlyStats.byStaff).length}
              </p>
            </div>
            <Users className="w-10 h-10 text-green-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">シフト種類</p>
              <p className="text-3xl font-bold mt-1">
                {Object.keys(monthlyStats.byShiftType).length}
              </p>
            </div>
            <BarChart3 className="w-10 h-10 text-purple-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">表示期間</p>
              <p className="text-2xl font-bold mt-1">
                {currentYear}年{currentMonth}月
              </p>
            </div>
            <Calendar className="w-10 h-10 text-orange-200 opacity-80" />
          </div>
        </div>
      </div>

      {/* フィルター＆ソート */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">フィルター＆ソート</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* フィルタータイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              フィルター条件
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as FilterType);
                setFilterValue('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">全て表示</option>
              <option value="staff">スタッフ別</option>
              <option value="shiftType">シフト種類別</option>
            </select>
          </div>

          {/* フィルター値 */}
          {filterType === 'staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                スタッフ選択
              </label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                シフト種類選択
              </label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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

          {/* ソート */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              並び順
            </label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as SortType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="date-desc">日付が新しい順</option>
              <option value="date-asc">日付が古い順</option>
              <option value="staff">スタッフ名順</option>
              <option value="shiftType">シフト種類順</option>
            </select>
          </div>

          {/* リセットボタン */}
          {(filterType !== 'all' || sortType !== 'date-desc') && (
            <div className="flex items-end">
              <button
                onClick={resetFilter}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                フィルターをリセット
              </button>
            </div>
          )}
        </div>
      </div>

      {/* シフトリクエスト一覧 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            シフトリクエスト一覧
            <span className="ml-2 text-sm font-normal text-gray-600">
              （{filteredAndSortedRequests.length}件）
            </span>
          </h3>
        </div>

        {filteredAndSortedRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-800 mb-2">
              シフトリクエストがありません
            </h4>
            <p className="text-gray-600">
              カレンダーからシフトを入力してください
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    スタッフ名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    シフト種類
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登録日時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDisplayDate(request.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {request.staffName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: getPatternColor(request.shiftType) }}
                      >
                        {getPatternShortName(request.shiftType)} - {request.shiftType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                        <Trash2 className="w-5 h-5" />
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            スタッフ別シフト統計
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(monthlyStats.byStaff).map(([staffName, count]) => {
              const staffData = staff.find(s => s.name === staffName);
              return (
                <div
                  key={staffName}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
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
                      className="mt-3 w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            シフト種類別統計
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(monthlyStats.byShiftType).map(([shiftType, count]) => (
              <div
                key={shiftType}
                className="p-4 rounded-lg text-center text-white shadow-md"
                style={{ backgroundColor: getPatternColor(shiftType as ShiftType) }}
              >
                <p className="text-sm font-medium opacity-90">
                  {getPatternShortName(shiftType as ShiftType)}
                </p>
                <p className="text-3xl font-bold mt-2">{count}</p>
                <p className="text-xs opacity-80 mt-1">{shiftType}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
