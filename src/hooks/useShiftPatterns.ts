import { useState, useEffect } from 'react';
import { db } from '../db';
import { ShiftPattern, ShiftPatternFormData } from '../types';

export function useShiftPatterns() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);

  // 勤務パターンの読み込み
  const loadPatterns = async () => {
    try {
      setLoading(true);
      console.log('📥 勤務パターンを読み込み中...');
      const allPatterns = await db.shiftPatterns.toArray();
      console.log('✅ 読み込み成功:', allPatterns.length, '種類');
      setPatterns(allPatterns);
    } catch (error) {
      console.error('❌ 勤務パターンの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, []);

  // 勤務パターンの追加
  const addPattern = async (data: ShiftPatternFormData): Promise<boolean> => {
    try {
      console.log('➕ 勤務パターンを追加中...', data);
      const newPattern: ShiftPattern = {
        id: crypto.randomUUID(),
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        requiredStaff: data.requiredStaff,
        description: data.description || '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await db.shiftPatterns.add(newPattern);
      console.log('✅ 追加成功:', newPattern.name);
      
      // 再読み込み
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの追加に失敗しました:', error);
      return false;
    }
  };

  // 勤務パターンの更新
  const updatePattern = async (id: string, data: Partial<ShiftPatternFormData>): Promise<boolean> => {
    try {
      console.log('✏️ 勤務パターンを更新中...', id, data);
      await db.shiftPatterns.update(id, {
        ...data,
        updatedAt: new Date(),
      });
      console.log('✅ 更新成功:', id);
      
      // 再読み込み
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの更新に失敗しました:', error);
      return false;
    }
  };

  // 勤務パターンの削除
  const deletePattern = async (id: string): Promise<boolean> => {
    try {
      console.log('🗑️ 勤務パターンを削除中...', id);
      
      // データベースから削除
      await db.shiftPatterns.delete(id);
      console.log('✅ データベースから削除成功:', id);
      
      // 画面を強制的に再読み込み
      await loadPatterns();
      console.log('✅ 画面を更新しました');
      
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの削除に失敗しました:', error);
      return false;
    }
  };

  return {
    patterns,
    loading,
    addPattern,
    updatePattern,
    deletePattern,
    reload: loadPatterns,
  };
}
