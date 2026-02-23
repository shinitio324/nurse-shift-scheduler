import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { ShiftPatternForm } from './ShiftPatternForm';
import { useShiftPatterns } from '../hooks/useShiftPatterns';
import type { ShiftPattern, ShiftPatternFormData } from '../types';

export function ShiftPatternList() {
  const { patterns, loading, addPattern, updatePattern, deletePattern } = useShiftPatterns();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null);

  const handleSubmit = async (data: ShiftPatternFormData) => {
    try {
      let success: boolean;
      
      if (editingPattern) {
        success = await updatePattern(editingPattern.id, data);
      } else {
        success = await addPattern(data);
      }

      if (success) {
        setIsFormOpen(false);
        setEditingPattern(null);
      }
    } catch (error) {
      console.error('勤務パターンの保存に失敗しました:', error);
      alert('勤務パターンの保存に失敗しました');
    }
  };

  const handleEdit = (pattern: ShiftPattern) => {
    setEditingPattern(pattern);
    setIsFormOpen(true);
  };

  const handleDelete = async (pattern: ShiftPattern) => {
    console.log('削除ボタンがクリックされました:', pattern.name);
    
    // 確認ダイアログを表示
    const confirmMessage = `勤務パターン「${pattern.name}」を削除してもよろしいですか？`;
    const confirmed = window.confirm(confirmMessage);
    
    console.log('削除確認結果:', confirmed);
    
    if (!confirmed) {
      console.log('削除がキャンセルされました');
      return;
    }

    try {
      console.log('削除処理を開始します:', pattern.id);
      const success = await deletePattern(pattern.id);
      
      if (success) {
        console.log('削除に成功しました');
      } else {
        console.log('削除に失敗しました');
      }
    } catch (error) {
      console.error('削除処理で例外が発生しました:', error);
      alert('削除処理でエラーが発生しました');
    }
  };

  const handleAddNew = () => {
    setEditingPattern(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPattern(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 勤務パターンを sortOrder でソート
  const sortedPatterns = [...patterns].sort((a, b) => a.sortOrder - b.sortOrder);

  // 統計情報を計算
  const totalRequired = patterns
    .filter(p => p.isWorkday)
    .reduce((sum, p) => sum + p.requiredStaff, 0);

  const workPatterns = patterns.filter(p => p.isWorkday);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">勤務パターン一覧</h3>
          <p className="text-sm text-gray-600 mt-1">
            登録済み: {patterns.length} 種類
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span>新しいパターンを追加</span>
        </button>
      </div>

      {/* パターンリスト */}
      {sortedPatterns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Plus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-800 mb-2">
            勤務パターンが登録されていません
          </h4>
          <p className="text-gray-600 mb-6">
            「新しいパターンを追加」ボタンから勤務パターンを登録しましょう
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPatterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-lg shadow-md p-4 border-l-4 hover:shadow-lg transition-shadow"
              style={{ borderLeftColor: pattern.color }}
            >
              {/* パターンヘッダー */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md"
                    style={{ backgroundColor: pattern.color }}
                  >
                    {pattern.shortName}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{pattern.name}</h4>
                    <p className="text-xs text-gray-500">
                      {pattern.isWorkday ? '勤務' : '休暇'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(pattern)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('削除ボタンクリック:', pattern.name);
                      handleDelete(pattern);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* パターン詳細 */}
              {pattern.isWorkday && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">勤務時間:</span>
                    <span className="font-semibold text-gray-800">
                      {pattern.startTime} - {pattern.endTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">必要人数:</span>
                    <span className="font-semibold text-indigo-600">
                      {pattern.requiredStaff}名
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 統計情報 */}
      {patterns.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-800 mb-4">統計情報</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-gray-600 mb-1">登録済みパターン</p>
              <p className="text-3xl font-bold text-indigo-600">{patterns.length}</p>
              <p className="text-xs text-gray-500 mt-1">種類</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-gray-600 mb-1">勤務パターン</p>
              <p className="text-3xl font-bold text-green-600">{workPatterns.length}</p>
              <p className="text-xs text-gray-500 mt-1">種類</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-gray-600 mb-1">総必要人数</p>
              <p className="text-3xl font-bold text-orange-600">{totalRequired}</p>
              <p className="text-xs text-gray-500 mt-1">名</p>
            </div>
          </div>
        </div>
      )}

      {/* フォームモーダル */}
      {isFormOpen && (
        <ShiftPatternForm
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          initialData={editingPattern || undefined}
          isEdit={!!editingPattern}
        />
      )}
    </div>
  );
}
