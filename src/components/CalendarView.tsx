import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  const tempDate = new Date(startDate);

  for (let i = 0; i < 42; i++) {
    currentWeek.push(new Date(tempDate));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === month;
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">勤務表カレンダー</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-medium min-w-[120px] text-center">
            {year}年 {month + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* カレンダー */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center font-semibold text-sm ${
                i === 0 ? 'text-red-600 bg-red-50' : i === 6 ? 'text-blue-600 bg-blue-50' : 'bg-gray-50'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {weeks.map((week, weekIndex) =>
            week.map((date, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`min-h-[100px] p-2 bg-white ${
                  !isCurrentMonth(date) ? 'bg-gray-50' : ''
                } ${isToday(date) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    !isCurrentMonth(date)
                      ? 'text-gray-400'
                      : dayIndex === 0
                      ? 'text-red-600'
                      : dayIndex === 6
                      ? 'text-blue-600'
                      : 'text-gray-900'
                  } ${isToday(date) ? 'font-bold' : ''}`}
                >
                  {date.getDate()}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  {/* ここにシフト情報が表示されます（Phase 3で実装） */}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">凡例</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span>日勤</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>早番</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>遅番</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
            <span>夜勤</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span>休み</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>希望休</span>
          </div>
        </div>
      </div>
    </div>
  );
}
