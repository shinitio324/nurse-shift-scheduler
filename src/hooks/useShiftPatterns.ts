import { useState, useEffect } from 'react';
import { db } from '../db';
import { ShiftPattern, ShiftPatternFormData } from '../types';

export function useShiftPatterns() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      const allPatterns = await db.shiftPatterns.orderBy('sortOrder').toArray();
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

  const addPattern = async (data: ShiftPatternFormData): Promise<boolean> => {
    try {
      const currentPatterns = await db.shiftPatterns.toArray();
      const newPattern: ShiftPattern = {
        id: crypto.randomUUID(),
        name: data.name,
        shortName: data.shortName,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        requiredStaff: data.requiredStaff,
        isWorkday: data.isWorkday,
        sortOrder: currentPatterns.length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.shiftPatterns.add(newPattern);
      console.log('✅ 追加成功:', newPattern.name);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの追加に失敗しました:', error);
      return false;
    }
  };

  const updatePattern = async (id: string, data: Partial<ShiftPatternFormData>): Promise<boolean> => {
    try {
      await db.shiftPatterns.update(id, {
        name: data.name,
        shortName: data.shortName,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        requiredStaff: data.requiredStaff,
        isWorkday: data.isWorkday,
        updatedAt: new Date(),
      });
      console.log('✅ 更新成功:', id);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの更新に失敗しました:', error);
      return false;
    }
  };

  const deletePattern = async (id: string): Promise<boolean> => {
    try {
      await db.shiftPatterns.delete(id);
      await loadPatterns();
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
