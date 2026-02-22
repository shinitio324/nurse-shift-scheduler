import { useState, useEffect } from 'react';
import { db } from '../db';
import { Staff, StaffFormData } from '../types';

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * スタッフを読み込み
   */
  const loadStaff = async () => {
    try {
      setLoading(true);
      const allStaff = await db.staff.toArray();
      // 作成日時順にソート
      allStaff.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setStaff(allStaff);
      console.log('スタッフを読み込みました:', allStaff.length, '名');
    } catch (error) {
      console.error('スタッフの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  /**
   * スタッフを追加
   */
  const addStaff = async (data: StaffFormData): Promise<boolean> => {
    try {
      // バリデーション
      if (!data.name || !data.name.trim()) {
        console.error('スタッフ名が空です');
        alert('スタッフ名を入力してください');
        return false;
      }

      const newStaff: Staff = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        position: data.position,
        employmentType: data.employmentType,
        qualifications: data.qualifications || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('スタッフを追加中:', newStaff);

      await db.staff.add(newStaff);
      await loadStaff();

      console.log('スタッフの追加に成功しました:', newStaff);
      return true;
    } catch (error) {
      console.error('スタッフの追加に失敗しました:', error);
      alert('スタッフの追加に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  /**
   * スタッフを更新
   */
  const updateStaff = async (id: string, data: Partial<StaffFormData>): Promise<boolean> => {
    try {
      console.log('スタッフを更新中:', id, data);

      await db.staff.update(id, {
        ...data,
        updatedAt: new Date(),
      });

      await loadStaff();

      console.log('スタッフの更新に成功しました:', id);
      return true;
    } catch (error) {
      console.error('スタッフの更新に失敗しました:', error);
      alert('スタッフの更新に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  /**
   * スタッフを削除
   */
  const deleteStaff = async (id: string): Promise<boolean> => {
    try {
      console.log('スタッフを削除中:', id);

      // 関連するシフトリクエストも削除
      const shifts = await db.shifts.where('staffId').equals(id).toArray();
      if (shifts.length > 0) {
        const shiftIds = shifts.map(s => s.id);
        await db.shifts.bulkDelete(shiftIds);
        console.log(`関連するシフトリクエスト ${shifts.length} 件を削除しました`);
      }

      await db.staff.delete(id);
      await loadStaff();

      console.log('スタッフの削除に成功しました:', id);
      return true;
    } catch (error) {
      console.error('スタッフの削除に失敗しました:', error);
      alert('スタッフの削除に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  return {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    reload: loadStaff,
  };
}
