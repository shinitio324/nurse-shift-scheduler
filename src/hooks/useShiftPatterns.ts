import { useState, useEffect } from 'react';
import { db } from '../db';
import { ShiftPattern, ShiftPatternFormData } from '../types';

export function useShiftPatterns() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      console.log('📥 勤務パターンを読み込み中...');
      const allPatterns = await db.shiftPatterns.toArray();
      const sorted = [...allPatterns].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      console.log('✅ 読み込み成功:', sorted.length, '種類');
      setPatterns(sorted);
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
      console.log('➕ 勤務パターンを追加中...', data);
      const currentPatterns = await db.shiftPatterns.toArray();

      const newPattern: Omit<ShiftPattern, 'id'> = {
        name: data.name,
        shortName: data.shortName,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        requiredStaff: data.requiredStaff,
        isNight: data.isNight ?? false,
        isAke: data.isAke ?? false,
        isVacation: data.isVacation ?? false,
        isWorkday: data.isWorkday ?? true,
        sortOrder: currentPatterns.length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.shiftPatterns.add(newPattern as ShiftPattern);
      console.log('✅ 追加成功:', newPattern.name);
      await loadPatterns();
      return true;
    } catch (error) {
      console.error('❌ 勤務パターンの追加に失敗しました:', error);
      return false;
    }
  };

  const updatePattern = async (
    id: number,
    data: Partial<ShiftPatternFormData>
  ): Promise<boolean> => {
    try {
      console.log('✏️ 勤務パターンを更新中...', id, data);
      await db.shiftPatterns.update(id, {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.shortName !== undefined ? { shortName: data.shortName } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.requiredStaff !== undefined
          ? { requiredStaff: data.requiredStaff }
          : {}),
        ...(data.isNight !== undefined ? { isNight: data.isNight } : {}),
        ...(data.isAke !== undefined ? { isAke: data.isAke } : {}),
        ...(data.isVacation !== undefined
          ? { isVacation: data.isVacation }
          : {}),
        ...(data.isWorkday !== undefined ? { isWorkday: data.isWorkday } : {}),
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

  const deletePattern = async (id: number): Promise<boolean> => {
    try {
      console.log('🗑️ 勤務パターンを削除中...', id);
      await db.shiftPatterns.delete(id);
      console.log('✅ データベースから削除成功:', id);
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
