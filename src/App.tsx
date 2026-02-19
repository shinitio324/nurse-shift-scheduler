import { useState } from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Download } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">看護師勤務表システム</h1>
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
            <h2 className="text-xl font-semibold mb-4">勤務表カレンダー</h2>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                <div key={day} className="text-center font-semibold py-2 bg-gray-100 rounded">
                  {day}
                </div>
              ))}
            </div>
            <div className="text-gray-500 text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>カレンダービューを準備中です</p>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">スタッフ管理</h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                + スタッフを追加
              </button>
            </div>
            <div className="text-gray-500 text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>スタッフ一覧を準備中です</p>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">シフト希望入力</h2>
            <div className="text-gray-500 text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>シフト希望入力フォームを準備中です</p>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">統計情報</h2>
            <div className="text-gray-500 text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>統計グラフを準備中です</p>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">データエクスポート</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">PDF出力</div>
                <div className="text-sm text-gray-500">印刷用フォーマット</div>
              </button>
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="font-semibold">Excel出力</div>
                <div className="text-sm text-gray-500">編集可能な形式</div>
              </button>
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                <Download className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="font-semibold">CSV出力</div>
                <div className="text-sm text-gray-500">データ分析用</div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">システム設定</h2>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">基本設定</h3>
                <p className="text-sm text-gray-600">施設情報、部署設定など</p>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">シフトパターン</h3>
                <p className="text-sm text-gray-600">勤務種別の定義</p>
              </div>
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-2">制約条件</h3>
                <p className="text-sm text-gray-600">スケジュール生成ルール</p>
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
          </div>
        </div>
      </footer>
    </div>
  );
}
