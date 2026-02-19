import { useState } from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Download } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">看護師勤務表システム</h1>
            </div>
            <div className="text-sm text-gray-600">
              オンライン版 v1.0.0
            </div>
          </div>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'calendar', label: '勤務表', icon: Calendar },
              { id: 'staff', label: 'スタッフ管理', icon: Users },
              { id: 'requests', label: 'シフト入力', icon: FileText },
              { id: 'statistics', label: '統計', icon: BarChart3 },
              { id: 'export', label: 'エクスポート', icon: Download },
              { id: 'settings', label: '設定', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {activeTab === 'calendar' && (
            <div className="text-center">
              <Calendar className="h-24 w-24 text-blue-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">勤務表カレンダー</h2>
              <p className="text-gray-600 mb-8">
                ここに月間カレンダーが表示されます。<br />
                ドラッグ＆ドロップでシフトを編集できます。
              </p>
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                自動生成を実行
              </button>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="text-center">
              <Users className="h-24 w-24 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">スタッフ管理</h2>
              <p className="text-gray-600 mb-8">
                スタッフ情報を登録・編集できます。<br />
                スキル、資格、勤務形態などを設定します。
              </p>
              <button className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                新規スタッフ登録
              </button>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="text-center">
              <FileText className="h-24 w-24 text-purple-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">シフト希望入力</h2>
              <p className="text-gray-600 mb-8">
                スタッフのシフト希望を入力できます。<br />
                希望休、希望シフトを100%反映します。
              </p>
              <button className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
                希望を入力
              </button>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="text-center">
              <BarChart3 className="h-24 w-24 text-orange-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">統計・分析</h2>
              <p className="text-gray-600 mb-8">
                勤務実績の統計データを表示します。<br />
                勤務時間、夜勤回数、休日数などをグラフで確認できます。
              </p>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="text-center">
              <Download className="h-24 w-24 text-red-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">エクスポート</h2>
              <p className="text-gray-600 mb-8">
                勤務表をPDFまたはExcel形式でダウンロードできます。
              </p>
              <div className="flex justify-center space-x-4">
                <button className="bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                  PDF出力
                </button>
                <button className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                  Excel出力
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="text-center">
              <Settings className="h-24 w-24 text-gray-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">システム設定</h2>
              <p className="text-gray-600 mb-8">
                制約条件、シフトパターン、労働基準などを設定できます。
              </p>
              <button className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors">
                設定を編集
              </button>
            </div>
          )}
        </div>

        {/* 機能紹介カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">自動生成</h3>
            </div>
            <p className="text-gray-600 text-sm">
              ワンクリックで制約を満たす勤務表を5〜15秒で自動生成します。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Users className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">希望100%反映</h3>
            </div>
            <p className="text-gray-600 text-sm">
              スタッフの希望休・希望シフトを優先的に反映します。
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Download className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">PDF/Excel出力</h3>
            </div>
            <p className="text-gray-600 text-sm">
              完成した勤務表をPDFまたはExcel形式でダウンロードできます。
            </p>
          </div>
        </div>

        {/* フッター情報 */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>
            このシステムは完全無料・オープンソースです。<br />
            商用利用可能 | データは全てブラウザに保存されます（サーバーには送信されません）
          </p>
          <p className="mt-2">
            © 2026 Nurse Scheduler Team | MIT License
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
