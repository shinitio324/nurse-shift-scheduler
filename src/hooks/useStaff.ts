import { useState, useEffect } from 'react';
import { db } from '../db';
import { Staff, StaffFormData } from '../types';

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // スタッフ一覧を読み込み
  const loadStaff = async () => {
    try {
      const allStaff = await db.staff.toArray();
      setStaff(allStaff);
    } catch (error) {
      console.error('スタッフの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // スタッフを追加
  const addStaff = async (data: StaffFormData) => {
    try {
      const newStaff: Staff = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.staff.add(newStaff);
      await loadStaff();
      return true;
    } catch (error) {
      console.error('スタッフの追加に失敗しました:', error);
      return false;
    }
  };

  // スタッフを更新
  const updateStaff = async (id: string, data: Partial<StaffFormData>) => {
    try {
      await db.staff.update(id, {
        ...data,
        updatedAt: new Date()
      });
      await loadStaff();
      return true;
    } catch (error) {
      console.error('スタッフの更新に失敗しました:', error);
      return false;
    }
  };

  // スタッフを削除
  const deleteStaff = async (id: string) => {
    try {
      await db.staff.delete(id);
      await loadStaff();
      return true;
    } catch (error) {
      console.error('スタッフの削除に失敗しました:', error);
      return false;
    }
  };

  return {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    reload: loadStaff
  };
}
