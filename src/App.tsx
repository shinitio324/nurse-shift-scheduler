import { useState, useEffect } from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Download } from 'lucide-react';
import { StaffList } from './components/StaffList';
import { CalendarView } from './components/CalendarView';
import { SettingsPanel } from './components/SettingsPanel';
import { ShiftRequestCalendar } from './components/ShiftRequestCalendar';
import { ShiftRequestList } from './components/ShiftRequestList';
import { ConstraintSettings } from './components/ConstraintSettings';
import { ScheduleGeneratorForm } from './components/ScheduleGeneratorForm';
import { SchedulePreview } from './components/SchedulePreview';
import { useStaff } from './hooks/useStaff';
import { useShiftRequests } from './hooks/useShiftRequests';
import { useScheduleGenerator } from './hooks/useScheduleGenerator';

type TabType = 'calendar' | 'staff' | 'requests' | 'statistics' | 'export' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('staff'); // 初期タブを「スタッフ管理」に変更
  const { staff, loading: staffLoading } = useStaff();
  const { shiftRequests, loading: shiftsLoading } = useShiftRequests();
  const { result, clearResult } = useScheduleGenerator();

  // デバッグ用ログ
  useEffect(() => {
    console.log('📊 App.tsx - データ状態:');
    console.log('  スタッフ読み込み中:', staffLoading);
    console.log('  スタッフ数:', staff.length);
    console.log('  シフト読み込み中:', shiftsLoading);
    console.log('  シフト数:', shiftRequests.length);
  }, [staff, shiftRequests, staffLoading, shiftsLoading]);

  const tabs = [
    { id: 'calendar' as TabType, label: '勤務表', icon: Calendar },
    { id: 'staff' as TabType, label: 'スタッフ管理', icon: Users },
    { id: 'requests' as TabType, label: 'シフト入力', icon: FileText },
    { id: 'statistics' as TabType, label: '統計', icon: BarChart3 },
    { id: 'export' as TabType, label: 'エクスポート', icon: Download },
    { id: 'settings' as TabType, label: '設定', icon: Settings },
  ];

  const handleScheduleGenerated = () => {
    // 生成完了後の処理（何もしない - プレビューを表示）
  };

  const handleScheduleSaved = () => {
    clearResult();
    setActiveTab('calendar');
    // シフトデータを再読み込み
    window.location.reload();
  };

  const handleScheduleCancelled = () => {
    clearResult();
  };

  const renderContent = () => {
    // スケジュール生成結果がある場合はプレビューを表示
    if (result && activeTab === 'calendar') {
      return (
        <SchedulePreview
          result={result}
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
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 統計情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium mb-2">登録スタッフ数</p>
                <p className="text-3xl font-bold text-blue-700">
                  {staffLoading ? '読み込み中...' : `${staff.length}名`}
                </p>
              </div>
              <div className="p-6 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium mb-2">登録済みシフト</p>
                <p className="text-3xl font-bold text-green-700">
                  {shiftsLoading ? '読み込み中...' : `${shiftRequests.length}件`}
                </p>
              </div>
              <div className="p-6 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 font-medium mb-2">シフト希望</p>
                <p className="text-3xl font-bold text-purple-700">
                  {shiftsLoading ? '読み込み中...' : `${shiftRequests.length}件`}
                </p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                ※ より詳細な統計情報は Phase 4 で実装予定です
              </p>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📥 エクスポート</h2>
            <p className="text-gray-600 mb-4">
              スケジュールをPDF、Excel、CSV形式でエクスポートできます。
            </p>
            <div className="space-y-3">
              <button className="w-full py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                📄 PDF形式でエクスポート（Phase 5で実装予定）
              </button>
              <button className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                📊 Excel形式でエクスポート（Phase 5で実装予定）
              </button>
              <button className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                📋 CSV形式でエクスポート（Phase 5で実装予定）
              </button>
            </div>
          </div>
        );

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 看護師勤務表システム v2.0
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Phase 3-3: 自動スケジュール生成機能
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
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-600">
            看護師勤務表システム v2.0 | Phase 3-3: 自動スケジュール生成機能 | 
            IndexedDB使用 | スタッフ: {staffLoading ? '...' : `${staff.length}名`} | 
            シフト: {shiftsLoading ? '...' : `${shiftRequests.length}件`}
          </p>
        </div>
      </footer>
    </div>
  );
}
