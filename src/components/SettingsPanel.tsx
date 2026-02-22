import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { ShiftPatternList } from './ShiftPatternList';
import { useShiftPatterns } from '../hooks/useShiftPatterns';

export function SettingsPanel() {
  const {
    patterns,
    loading,
    addPattern,
    updatePattern,
    deletePattern,
  } = useShiftPatterns();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">システム設定</h2>
          <p className="text-sm text-gray-600">勤務パターンの管理と制約条件の設定</p>
        </div>
      </div>

      {/* 勤務パターン設定セクション */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-1 h-6 bg-indigo-600 rounded-full mr-3"></span>
          勤務パターン設定
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          各勤務パターンの名称、時間帯、必要人数を設定できます。<br />
          これらの設定は自動スケジュール生成時に使用されます。
        </p>

        <ShiftPatternList
          patterns={patterns}
          onAdd={addPattern}
          onUpdate={updatePattern}
          onDelete={deletePattern}
          loading={loading}
        />
      </div>

      {/* 将来の拡張用プレースホルダー（Phase 3-2で実装） */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-dashed border-indigo-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          🚧 今後追加予定の機能
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="text-indigo-600 mr-2">▸</span>
            <span><strong>制約条件設定</strong>: 連続勤務日数、最低休日数、夜勤回数の上限など</span>
          </li>
          <li className="flex items-start">
            <span className="text-indigo-600 mr-2">▸</span>
            <span><strong>休日設定</strong>: 祝日や病院の休業日の管理</span>
          </li>
          <li className="flex items-start">
            <span className="text-indigo-600 mr-2">▸</span>
            <span><strong>データバックアップ</strong>: データのエクスポート・インポート機能</span>
          </li>
          <li className="flex items-start">
            <span className="text-indigo-600 mr-2">▸</span>
            <span><strong>通知設定</strong>: シフト変更やリマインダーの設定</span>
          </li>
        </ul>
      </div>

      {/* システム情報 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">システム情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">バージョン</span>
            <span className="font-semibold text-gray-800">v1.0.0 (Phase 3-1)</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">データベース</span>
            <span className="font-semibold text-gray-800">IndexedDB (ローカル保存)</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">登録済み勤務パターン</span>
            <span className="font-semibold text-indigo-600">{patterns.length} 種類</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">ストレージ使用</span>
            <span className="font-semibold text-gray-800">ブラウザ依存</span>
          </div>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-amber-700">
              <strong>データについて:</strong> このアプリはブラウザのローカルストレージ（IndexedDB）にデータを保存します。
              ブラウザのデータを削除すると、すべての登録情報が失われます。定期的なバックアップをおすすめします。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
