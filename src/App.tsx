import { useState, type ElementType } from 'react';
import {
  Calendar,
  Users,
  FileText,
  Settings,
  BarChart3,
  Download,
} from 'lucide-react';

import { StaffList } from './components/StaffList';
import { CalendarView } from './components/CalendarView';
import { SettingsPanel } from './components/SettingsPanel';
import { ShiftRequestCalendar } from './components/ShiftRequestCalendar';
import { ShiftRequestList } from './components/ShiftRequestList';
import { ConstraintSettings } from './components/ConstraintSettings';
import { ScheduleGeneratorForm } from './components/ScheduleGeneratorForm';
import { SchedulePreview } from './components/SchedulePreview';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ExportPanel } from './components/ExportPanel';

import { useStaff } from './hooks/useStaff';
import { useShiftRequests } from './hooks/useShiftRequests';

import type { ScheduleGenerationResult } from './types';

type TabType =
  | 'calendar'
  | 'staff'
  | 'requests'
  | 'statistics'
  | 'export'
  | 'settings';

interface TabItem {
  id: TabType;
  label: string;
  icon: ElementType;
}

export default function App() {
  // 保存後リロード時に統計タブへ自動遷移
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const pending = sessionStorage.getItem('afterSaveTab') as TabType | null;
    if (pending) {
      sessionStorage.removeItem('afterSaveTab');
      return pending;
    }
    return 'calendar';
  });

  const [showPreview, setShowPreview] = useState(false);
  const [scheduleResult, setScheduleResult] =
    useState<ScheduleGenerationResult | null>(null);

  // 生成時の年月を保持（SchedulePreview に渡すため）
  const [previewYear, setPreviewYear] = useState<number>(
    new Date().getFullYear()
  );
  const [previewMonth, setPreviewMonth] = useState<number>(
    new Date().getMonth() + 1
  );

  const { staff, loading: staffLoading } = useStaff();
  const { shiftRequests, loading: shiftsLoading } = useShiftRequests();

  const tabs: TabItem[] = [
    { id: 'calendar', label: '勤務表', icon: Calendar },
    { id: 'staff', label: 'スタッフ管理', icon: Users },
    { id: 'requests', label: 'シフト入力', icon: FileText },
    { id: 'statistics', label: '統計', icon: BarChart3 },
    { id: 'export', label: 'エクスポート', icon: Download },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  const handleScheduleGenerated = (
    result: ScheduleGenerationResult,
    year?: number,
    month?: number
  ) => {
    const safeResult: ScheduleGenerationResult = {
      schedule: Array.isArray(result?.schedule) ? result.schedule : [],
      statistics: {
        totalDays: Number(result?.statistics?.totalDays ?? 0),
        totalShifts: Number(result?.statistics?.totalShifts ?? 0),
        staffWorkload: Array.isArray(result?.statistics?.staffWorkload)
          ? result.statistics.staffWorkload
          : [],
        shiftTypeDistribution:
          result?.statistics?.shiftTypeDistribution &&
          typeof result.statistics.shiftTypeDistribution === 'object'
            ? result.statistics.shiftTypeDistribution
            : {},
      },
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    };

    console.log(
      '✅ App.tsx: 生成結果を受信',
      safeResult.schedule.length,
      '件'
    );

    setScheduleResult(safeResult);

    if (year != null) setPreviewYear(year);
    if (month != null) setPreviewMonth(month);

    setActiveTab('calendar');
    setShowPreview(true);
  };

  const handleScheduleSaved = () => {
    console.log('💾 スケジュール保存完了 → 統計タブへ遷移');
    setScheduleResult(null);
    setShowPreview(false);
    sessionStorage.setItem('afterSaveTab', 'statistics');
    window.location.reload();
  };

  const handleScheduleCancelled = () => {
    console.log('❌ スケジュール生成をキャンセル');
    setScheduleResult(null);
    setShowPreview(false);
  };

  const renderContent = () => {
    if (showPreview && scheduleResult && activeTab === 'calendar') {
      console.log('🖼️ プレビュー画面を表示します');
      return (
        <SchedulePreview
          result={scheduleResult}
          year={previewYear}
          month={previewMonth}
          onSave={handleScheduleSaved}
          onCancel={handleScheduleCancelled}
        />
      );
    }

    switch (activeTab) {
      case 'calendar':
        return (
          <div className="space-y-6">
            <ScheduleGeneratorForm onGenerated={handleScheduleGenerated} />
            <CalendarView />
          </div>
        );

      case 'staff':
        return <StaffList />;

      case 'requests':
        return (
          <div className="space-y-6">
            <ShiftRequestCalendar />
            <div id="shift-request-list">
              <ShiftRequestList />
            </div>
          </div>
        );

      case 'statistics':
        return <StatisticsPanel />;

      case 'export':
        return <ExportPanel />;

      case 'settings':
        return (
          <div className="space-y-6">
            <SettingsPanel />
            <div id="constraint-settings">
              <ConstraintSettings />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 看護師勤務表システム v2.0
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Phase 4: 詳細統計 / Phase 5: エクスポート 実装済み
                {showPreview && scheduleResult && (
                  <span className="ml-2 text-green-600">（プレビュー表示中）</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">登録スタッフ</p>
                <p className="text-lg font-bold text-indigo-600">
                  {staffLoading ? '...' : `${staff.length}名`}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600">登録シフト</p>
                <p className="text-lg font-bold text-green-600">
                  {shiftsLoading ? '...' : `${shiftRequests.length}件`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'calendar') setShowPreview(false);
                  }}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {renderContent()}
      </main>

      {/* フッター */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600">
            看護師勤務表システム v2.0 | Phase 4: 詳細統計 ✅ | Phase 5:
            エクスポート ✅ | スタッフ:{' '}
            {staffLoading ? '...' : `${staff.length}名`} | シフト:{' '}
            {shiftsLoading ? '...' : `${shiftRequests.length}件`}
            {showPreview && scheduleResult && ' | プレビュー表示中'}
          </p>
        </div>
      </footer>
    </div>
  );
}
