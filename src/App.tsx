import { useState } from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Download } from 'lucide-react';
import { StaffList } from './components/StaffList';
import { CalendarView } from './components/CalendarView';
import { SettingsPanel } from './components/SettingsPanel';
import { ShiftRequestCalendar } from './components/ShiftRequestCalendar';
import { ShiftRequestList } from './components/ShiftRequestList';
import { ConstraintSettings } from './components/ConstraintSettings';
import { useStaff } from './hooks/useStaff';
import { useShiftRequests } from './hooks/useShiftRequests';

type TabType = 'calendar' | 'staff' | 'requests' | 'statistics' | 'export' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const { staff } = useStaff();
  const { shiftRequests } = useShiftRequests();

  const tabs = [
    { id: 'calendar' as TabType, label: '勤務表', icon: Calendar },
    { id: 'staff' as TabType, label: 'スタッフ管理', icon: Users },
    { id: 'requests' as TabType, label: 'シフト入力', icon: FileText },
    { id: 'statistics' as TabType, label: '統計', icon: BarChart3 },
    { id: 'export' as TabType, label: 'エクスポート', icon: Download },
    { id: 'settings' as TabType, label: '設定', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'calendar':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">勤務表カレンダー</h2>
                <p className="text-sm text-gray-600 mt-1">月次の勤務スケジュールを表示します</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
                自動生成
              </button>
            </div>
            <CalendarView />
          </div>
        );

      case 'staff':
        return <StaffList />;

      case 'requests':
        return (
          <div className="space-y-6">
            {/* ヘッダー */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800">シフト希望入力</h2>
              <p className="text-sm text-gray-600 mt-1">
                スタッフごとの勤務希望や休み希望を入力できます
              </p>
            </div>

            {/* タブ切り替え */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-1 p-2">
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-100 text-indigo-700"
                  >
                    📅 カレンダー入力
                  </button>
                  <button
                    onClick={() => {
                      const listSection = document.getElementById('shift-request-list');
                      if (listSection) {
                        listSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                    📋 一覧表示
                  </button>
                </nav>
              </div>
            </div>

            {/* カレンダー入力 */}
            <ShiftRequestCalendar />

            {/* 一覧表示 */}
            <div id="shift-request-list">
              <ShiftRequestList />
            </div>
          </div>
        );

      case 'statistics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">統計情報</h2>
              <p className="text-sm text-gray-600 mt-1">スタッフと勤務の統計データ</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">登録スタッフ数</p>
                    <p className="text-3xl font-bold mt-2">{staff.length}名</p>
                  </div>
                  <Users className="w-12 h-12 text-blue-200 opacity-80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">登録済みシフト</p>
                    <p className="text-3xl font-bold mt-2">{shiftRequests.length}件</p>
                  </div>
                  <Calendar className="w-12 h-12 text-green-200 opacity-80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">シフト希望</p>
                    <p className="text-3xl font-bold mt-2">{shiftRequests.length}件</p>
                  </div>
                  <FileText className="w-12 h-12 text-purple-200 opacity-80" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">詳細な統計レポート</h3>
                <p className="text-gray-600 mb-4">
                  勤務パターン別の分布、スタッフごとの勤務時間など
                </p>
                <p className="text-sm text-indigo-600 font-medium">
                  Phase 4 で実装予定
                </p>
              </div>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <Download className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">データエクスポート</h3>
              <p className="text-gray-600 mb-6">
                勤務表をPDF、Excel、CSV形式でエクスポートできます
              </p>
              <div className="flex justify-center space-x-4">
                <button className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md opacity-50 cursor-not-allowed">
                  PDF出力
                </button>
                <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md opacity-50 cursor-not-allowed">
                  Excel出力
                </button>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md opacity-50 cursor-not-allowed">
                  CSV出力
                </button>
              </div>
              <p className="text-sm text-indigo-600 font-medium mt-6">
                Phase 5 で実装予定
              </p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            {/* 設定タブ内のサブタブ */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-1 p-2">
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-100 text-indigo-700"
                  >
                    ⚙️ 勤務パターン設定
                  </button>
                  <button
                    onClick={() => {
                      const constraintSection = document.getElementById('constraint-settings');
                      if (constraintSection) {
                        constraintSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                    🔒 制約条件設定
                  </button>
                </nav>
              </div>
            </div>

            {/* 勤務パターン設定 */}
            <SettingsPanel />

            {/* 制約条件設定 */}
            <div id="constraint-settings" className="scroll-mt-6">
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
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  🚀 看護師勤務表システム v2.0
                </h1>
                <p className="text-sm text-gray-600">Phase 3-2: シフト希望入力機能</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  flex items-center space-x-2 px-4 py-3 font-medium text-sm transition-all
                  border-b-2 whitespace-nowrap
                  ${
                    activeTab === id
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      {/* フッター */}
      <footer className="bg-white shadow-md mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600">
            <p>看護師勤務表システム オンライン版 v1.0.0 (Phase 3-2)</p>
            <p>
              登録スタッフ数: {staff.length}名 | シフト登録: {shiftRequests.length}件 | データはブラウザに保存されます
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
