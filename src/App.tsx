import { useState } from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Download } from 'lucide-react';
import { useStaff } from './hooks/useStaff';
import { StaffList } from './components/StaffList';
import { CalendarView } from './components/CalendarView';

function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const { staff, loading, addStaff, updateStaff, deleteStaff } = useStaff();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🚀 看護師勤務表システム v2.0</h1>
              <p className="text-sm text-gray-500 mt-1">オンライン版 v1.0.0</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                エクスポート
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'calendar', icon: Calendar, label: '勤務表' },
              { id: 'staff', icon: Users, label: 'スタッフ管理' },
              { id: 'requests', icon: FileText, label: 'シフト入力' },
              { id: 'statistics', icon: BarChart3, label: '統計' },
              { id: 'export', icon: Download, label: 'エクスポート' },
              { id: 'settings', icon: Settings, label: '設定' }
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-4 border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <CalendarView />
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <StaffList
              staff={staff}
              onAdd={addStaff}
              onUpdate={updateStaff}
              onDelete={deleteStaff}
              loading={loading}
            />
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">シフト希望入力</h2>
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">シフト希望入力機能</p>
              <p className="text-sm text-gray-400">Phase 3 で実装予定</p>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">統計情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                <div className="text-sm text-blue-600 font-medium mb-1">登録スタッフ数</div>
                <div className="text-3xl font-bold text-blue-900">{staff.length}名</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                <div className="text-sm text-green-600 font-medium mb-1">今月のシフト数</div>
                <div className="text-3xl font-bold text-green-900">0件</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                <div className="text-sm text-purple-600 font-medium mb-1">未確定シフト</div>
                <div className="text-3xl font-bold text-purple-900">0件</div>
              </div>
            </div>
            <div className="text-center py-8">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">詳細な統計グラフ</p>
              <p className="text-sm text-gray-400">Phase 3 で実装予定</p>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">データエクスポート</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">PDF出力</div>
                <div className="text-sm text-gray-500 mt-1">印刷用フォーマット</div>
                <div className="text-xs text-gray-400 mt-2">Phase 3 で実装予定</div>
              </button>
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="font-semibold">Excel出力</div>
                <div className="text-sm text-gray-500 mt-1">編集可能な形式</div>
                <div className="text-xs text-gray-400 mt-2">Phase 3 で実装予定</div>
              </button>
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="font-semibold">CSV出力</div>
                <div className="text-sm text-gray-500 mt-1">データ分析用</div>
                <div className="text-xs text-gray-400 mt-2">Phase 3 で実装予定</div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">システム設定</h2>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <h3 className="font-semibold mb-2">基本設定</h3>
                <p className="text-sm text-gray-600 mb-2">施設情報、部署設定など</p>
                <p className="text-xs text-gray-400">Phase 3 で実装予定</p>
              </div>
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <h3 className="font-semibold mb-2">シフトパターン</h3>
                <p className="text-sm text-gray-600 mb-2">勤務種別の定義</p>
                <p className="text-xs text-gray-400">Phase 3 で実装予定</p>
              </div>
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <h3 className="font-semibold mb-2">制約条件</h3>
                <p className="text-sm text-gray-600 mb-2">スケジュール生成ルール</p>
                <p className="text-xs text-gray-400">Phase 3 で実装予定</p>
              </div>
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <h3 className="font-semibold mb-2">データ管理</h3>
                <p className="text-sm text-gray-600 mb-2">バックアップと復元</p>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    バックアップ
                  </button>
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                    復元
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>看護師勤務表システム オンライン版 v1.0.0</p>
            <p className="mt-1">© 2026 Nurse Shift Scheduler. All rights reserved.</p>
            <p className="mt-2 text-xs">
              登録スタッフ数: {staff.length}名 | データはブラウザに保存されます
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
