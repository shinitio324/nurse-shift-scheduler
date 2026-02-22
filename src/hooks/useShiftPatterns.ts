import { useState, useEffect } from 'react';
import { db, initializeDefaultShiftPatterns } from '../db';
import { ShiftPattern, ShiftPatternFormData } from '../types';

export function useShiftPatterns() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);

  // シフトパターン一覧を読み込み
  const loadPatterns = async () => {
    try {
      // デフォルトパターンを初期化
      await initializeDefaultShiftPatterns();
      
      // 全パターンを取得してソート
      const allPatterns = await db.shiftPatterns.orderBy('sortOrder').toArray();
      setPatterns(allPatterns);
    } catch (error) {
      console.error('シフトパターンの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, []);

  // シフトパターンを追加
  const addPattern = async (data: ShiftPatternFormData) => {
    try {
      const maxOrder = patterns.length > 0 
        ? Math.max(...patterns.map(p => p.sortOrder)) 
        : 0;

      const newPattern: ShiftPattern = {
        id: crypto.randomUUID(),
        ...data,
        sortOrder: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.shiftPatterns.add(newPattern);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('シフトパターンの追加に失敗しました:', error);
      return false;
    }
  };

  // シフトパターンを更新
  const updatePattern = async (id: string, data: Partial<ShiftPatternFormData>) => {
    try {
      await db.shiftPatterns.update(id, {
        ...data,
        updatedAt: new Date()
      });
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('シフトパターンの更新に失敗しました:', error);
      return false;
    }
  };

  // シフトパターンを削除
  const deletePattern = async (id: string) => {
    try {
      // このパターンを使用しているシフトがあるかチェック
      const usedShifts = await db.staffShifts.where('shiftPatternId').equals(id).count();
      
      if (usedShifts > 0) {
        alert(`このシフトパターンは ${usedShifts} 件のシフトで使用されているため削除できません。`);
        return false;
      }

      await db.shiftPatterns.delete(id);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('シフトパターンの削除に失敗しました:', error);
      return false;
    }
  };

  // 並び順を変更
  const reorderPatterns = async (reorderedPatterns: ShiftPattern[]) => {
    try {
      const updates = reorderedPatterns.map((pattern, index) => 
        db.shiftPatterns.update(pattern.id, { sortOrder: index + 1 })
      );
      await Promise.all(updates);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('並び順の変更に失敗しました:', error);
      return false;
    }
  };

  return {
    patterns,
    loading,
    addPattern,
    updatePattern,
    deletePattern,
    reorderPatterns,
    reload: loadPatterns
  };
}
