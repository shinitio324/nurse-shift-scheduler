import { useState } from 'react';
import { Edit2, Trash2, Clock } from 'lucide-react';
import { ShiftPattern, ShiftPatternFormData } from '../types';
import { ShiftPatternForm } from './ShiftPatternForm';

interface ShiftPatternListProps {
  patterns: ShiftPattern[];
  onAdd: (data: ShiftPatternFormData) => Promise<boolean>;
  onUpdate: (id: string, data: Partial<ShiftPatternFormData>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  loading: boolean;
}

export function ShiftPatternList({ patterns, onAdd, onUpdate, onDelete, loading }: ShiftPatternListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null);

  const handleDelete = async (pattern: ShiftPattern) => {
    if (window.confirm(`「${pattern.name}」を削除してもよろしいですか？`)) {
      await onDelete(pattern.id);
    }
  };

  const handleEdit = (pattern: ShiftPattern) => {
    setEditingPattern(pattern);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPattern(null);
  };

  const handleSubmit = async (data: ShiftPatternFormData) => {
    if (editingPattern) {
      return await onUpdate(editingPattern.id, data);
    } else {
      return await onAdd(data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">勤務パターン設定</h3>
          <p className="text-sm text-gray-600 mt-1">
            シフトの種類と勤務時間を設定します
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          新しいパターンを追加
        </button>
      </div>

      {/* パターン一覧 */}
      {patterns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">シフトパターンが登録されていません</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            最初のパターンを登録
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-gray-200">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  {/* 左側：パターン情報 */}
                  <div className="flex items-center gap-4 flex-1">
                    {/* 色と略称 */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: pattern.color }}
                    >
                      {pattern.shortName}
                    </div>

                    {/* パターン詳細 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {pattern.name}
                        </h4>
                        {!pattern.isWorkday && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            休日
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {pattern.isWorkday ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {pattern.startTime} - {pattern.endTime}
                            </span>
                            <span>
                              必要人数: <strong>{pattern.requiredStaff}名</strong>
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500">勤務時間なし</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右側：操作ボタン */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(pattern)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="編集"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pattern)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 統計情報 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium mb-1">
            登録パターン数
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {patterns.length}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium mb-1">
            勤務パターン
          </div>
          <div className="text-2xl font-bold text-green-900">
            {patterns.filter(p => p.isWorkday).length}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 font-medium mb-1">
            総必要人数
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {patterns.filter(p => p.isWorkday).reduce((sum, p) => sum + p.requiredStaff, 0)}名
          </div>
        </div>
      </div>

      {/* フォームモーダル */}
      {showForm && (
        <ShiftPatternForm
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          initialData={editingPattern ? {
            name: editingPattern.name,
            shortName: editingPattern.shortName,
            startTime: editingPattern.startTime,
            endTime: editingPattern.endTime,
            requiredStaff: editingPattern.requiredStaff,
            color: editingPattern.color,
            isWorkday: editingPattern.isWorkday
          } : undefined}
          isEdit={!!editingPattern}
        />
      )}
    </div>
  );
}
