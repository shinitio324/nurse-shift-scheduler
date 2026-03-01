import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { ShiftPatternForm } from './ShiftPatternForm';
import { useShiftPatterns } from '../hooks/useShiftPatterns';
import type { ShiftPattern, ShiftPatternFormData } from '../types';

export function ShiftPatternList() {
  const { patterns, loading, addPattern, updatePattern, deletePattern } = useShiftPatterns();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null);

  // ★ 修正: Promise<boolean> を返すように変更
  const handleSubmit = async (data: ShiftPatternFormData): Promise<boolean> => {
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
      return success;
    } catch (error) {
      console.error('勤務パターンの保存に失敗しました:', error);
      return false;
    }
  };

  const handleEdit = (pattern: ShiftPattern) => {
    setEditingPattern(pattern);
    setIsFormOpen(true);
  };

  const handleDelete = async (pattern: ShiftPattern) => {
    const confirmed = window.confirm(`勤務パターン「${pattern.name}」を削除してもよろしいですか？`);
    if (!confirmed) return;
    try {
      await deletePattern(pattern.id);
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

  const sortedPatterns = [...patterns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const totalRequired = patterns.filter(p => p.isWorkday).reduce((sum, p) => sum + p.requiredStaff, 0);
  const workPatterns = patterns.filter(p => p.isWorkday);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">勤務パターン一覧</h3>
          <p className="text-sm text-gray-600 mt-1">登録済み: {patterns.length} 種類</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span>新しいパターンを追加</span>
        </button>
      </div>

      {sortedPatterns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Plus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-800 mb-2">勤務パターンが登録されていません</h4>
          <p className="text-gray-600 mb-6">「新しいパターンを追加」ボタンから勤務パターンを登録しましょう</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPatterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-lg shadow-md p-4 border-l-4 hover:shadow-lg transition-shadow"<span class="cursor">█</span>
