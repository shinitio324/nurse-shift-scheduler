import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShiftRequests } from '../hooks/useShiftRequests';
import { useShiftPatterns } from '../hooks/useShiftPatterns';
import { useStaff } from '../hooks/useStaff';
import type { CalendarDate } from '../types';

export function ShiftRequestCalendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  // ★ 修正: ShiftType → string（カスタムパターン対応）
  const [selectedShiftType, setSelectedShiftType] = useState<string>('日勤');

  const { staff } = useStaff();
  const { patterns } = useShiftPatterns();
  const {
    shiftRequests,
    addShiftRequest,
    deleteShiftRequest,
    getShiftRequestsByStaffAndMonth,
  } = useShiftRequests();

  const calendarDates = useMemo((): CalendarDate[] => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthDays = prevMonthLastDay.getDate();
    const dates: CalendarDate[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 2, prevMonthDays - i);
      const dateString = formatDate(date);
      dates.push({
        date, dateString, isCurrentMonth: false, isToday: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        shiftRequests: shiftRequests.filter(req => req.date === dateString),
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth - 1, day);
      const dateString = formatDate(date);
      dates.push({
        date, dateString, isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        shiftRequests: shiftRequests.filter(req => req.date === dateString),
      });
    }

    const remainingDays = 42 - dates.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateString = formatDate(date);
      dates.push({
        date, dateString, isCurrentMonth: false, isToday: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        shiftRequests: shiftRequests.filter(req => req.date === dateString),
      });
    }
    return dates;
  }, [currentYear, currentMonth, shiftRequests]);

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const goToPreviousMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
    else { setCurrentMonth(currentMonth - 1); }
  };
  const goToNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
    else { setCurrentMonth(currentMonth + 1); }
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  const handleDateClick = async (calendarDate: CalendarDate) => {
    if (!selectedStaffId) { alert('スタッフを選択してください'); return; }
    if (!calendarDate.isCurrentMonth) return;

    const existingRequest = calendarDate.shiftRequests.find(req => req.staffId === selectedStaffId);
    if (existingRequest) {
      const confirmDelete = window.confirm(
        `${calendarDate.date.getMonth() + 1}月${calendarDate.date.getDate()}日の「${existingRequest.shiftType}」を削除しますか？`
      );
      if (confirmDelete) await deleteShiftRequest(existingRequest.id);
    } else {
      const success = await addShiftRequest({
        staffId: selectedStaffId,
        date: calendarDate.dateString,
        shiftType: selectedShiftType,
      });
      if (success) console.log(`シフトリクエストを追加しました: ${calendarDate.dateString}`);
    }
  };

  const selectedStaffRequests = useMemo(() => {
    if (!selectedStaffId) return [];
    return getShiftRequestsByStaffAndMonth(selectedStaffId, currentYear, currentMonth);
  }, [selectedStaffId, currentYear, currentMonth, shiftRequests]);

  // ★ 修正: ShiftType → string
  const getPatternColor = (shiftType: string): string => {
    const pattern = patterns.find(p => p.name === shiftType);
    return pattern?.color || '#6B7280';
  };
  const getPatternShortName = (shiftType: string): string => {
    const pattern = patterns.find(p => p.name === shiftType);
    return pattern?.shortName || shiftType;
  };

  // パターンが読み込まれたとき、初期選択を最初のパターンに合わせる
  const effectiveShiftType = patterns.find(p => p.name === selectedShiftType)
    ? selectedShiftType
    : (patterns[0]?.name || '日勤');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* スタッフ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">スタッフを選択</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- スタッフを選択 --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
              ))}
            </select>
          </div>

          {/* ★ 修正: シフトタイプ選択 — 全パターン表示 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">入力するシフト</label>
            <select
              value={effectiveShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {patterns.length === 0 && (
                <option value="">-- パターンを先に登録してください --</option>
              )}
              {/* ★ .filter() を削除 → 全パターンを表示 */}
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.name}>
                  {pattern.shortName}: {pattern.name}
                  {pattern.isWorkday
                    ? ` (${pattern.startTime}〜${pattern.endTime})`
                    : ' (休暇)'}
                </option>
              ))}
            </select>
          </div>

          {/* 統計情報 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">選択中のスタッフの統計</label>
            <div className="px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-700">
                今月のシフト: <span className="font-bold text-indigo-600">{selectedStaffRequests.length}件</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>使い方:</strong> スタッフとシフトタイプを選択してから、カレンダーの日付をクリックしてシフトを入力してください。
            既にシフトが入力されている日をクリックすると削除できます。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center space-x-4">
            <h3 className="text-2xl font-bold text-gray-800">{currentYear}年 {currentMonth}月</h3>
            <button onClick={goToToday} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium">
              今月
            </button>
          </div>
          <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
            <div key={day} className={`text-center text-sm font-semibold py-2 ${
              index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDates.map((calendarDate, index) => {
            const dayOfWeek = calendarDate.date.getDay();
            const isClickable = calendarDate.isCurrentMonth && selectedStaffId;
            const staffRequestOnThisDay = calendarDate.shiftRequests.find(req => req.staffId === selectedStaffId);

            return (
              <div
                key={index}
                onClick={() => isClickable && handleDateClick(calendarDate)}
                className={`
                  min-h-[80px] p-2 rounded-lg border-2 transition-all
                  ${calendarDate.isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
                  ${calendarDate.isToday ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
                  ${isClickable ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md' : ''}
                `}
              >
                <div className={`text-sm font-semibold mb-1
                  ${calendarDate.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}
                  ${dayOfWeek === 0 ? 'text-red-600' : ''}
                  ${dayOfWeek === 6 ? 'text-blue-600' : ''}
                  ${calendarDate.isToday ? 'text-indigo-600' : ''}
                `}>
                  {calendarDate.date.getDate()}
                </div>
                {calendarDate.isCurrentMonth && (
                  <div className="space-y-1">
                    {staffRequestOnThisDay && (
                      <div
                        className="text-xs font-bold text-white px-2 py-1 rounded text-center"
                        style={{ backgroundColor: getPatternColor(staffRequestOnThisDay.shiftType) }}
                      >
                        {getPatternShortName(staffRequestOnThisDay.shiftType)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">シフト凡例</h4>
          <div className="flex flex-wrap gap-3">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: pattern.color }}></div>
                <span className="text-sm text-gray-700">{pattern.shortName}: {pattern.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
