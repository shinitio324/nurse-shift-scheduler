import { useState, useEffect } from 'react';
import { db } from '../db';
import { Shift, ShiftRequest, ShiftRequestFormData, Staff } from '../types';

export function useShiftRequests() {
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * シフトリクエストを読み込み
   */
  const loadShiftRequests = async () => {
    try {
      setLoading(true);
      
      // シフトデータを取得
      const shifts = await db.shifts.toArray();
      
      // スタッフ情報を結合
      const staff = await db.staff.toArray();
      const staffMap = new Map<string, Staff>();
      staff.forEach(s => staffMap.set(s.id, s));
      
      // ShiftRequest型に変換（スタッフ名を追加）
      const requests: ShiftRequest[] = shifts.map(shift => ({
        ...shift,
        staffName: staffMap.get(shift.staffId)?.name || '不明なスタッフ',
        status: 'pending' as const,
        requestedAt: shift.createdAt,
      }));
      
      // 日付順にソート（新しい順）
      requests.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setShiftRequests(requests);
    } catch (error) {
      console.error('シフトリクエストの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初期読み込み
   */
  useEffect(() => {
    loadShiftRequests();
  }, []);

  /**
   * シフトリクエストを追加
   */
  const addShiftRequest = async (data: ShiftRequestFormData): Promise<boolean> => {
    try {
      // 重複チェック（修正版）
      const existing = await db.shifts
        .where('staffId')
        .equals(data.staffId)
        .and(shift => shift.date === data.date)
        .first();
      
      if (existing) {
        console.warn('このスタッフは既にこの日のシフトが登録されています。');
        return false;
      }

      // 新しいシフトを作成
      const newShift: Shift = {
        id: crypto.randomUUID(),
        staffId: data.staffId,
        date: data.date,
        shiftType: data.shiftType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.shifts.add(newShift);
      await loadShiftRequests();
      
      console.log('シフトリクエストを追加しました:', newShift);
      return true;
    } catch (error) {
      console.error('シフトリクエストの追加に失敗しました:', error);
      return false;
    }
  };

  /**
   * シフトリクエストを更新
   */
  const updateShiftRequest = async (
    id: string,
    data: Partial<ShiftRequestFormData>
  ): Promise<boolean> => {
    try {
      await db.shifts.update(id, {
        ...data,
        updatedAt: new Date(),
      });
      
      await loadShiftRequests();
      
      console.log('シフトリクエストを更新しました:', id);
      return true;
    } catch (error) {
      console.error('シフトリクエストの更新に失敗しました:', error);
      return false;
    }
  };

  /**
   * シフトリクエストを削除
   */
  const deleteShiftRequest = async (id: string): Promise<boolean> => {
    try {
      await db.shifts.delete(id);
      await loadShiftRequests();
      
      console.log('シフトリクエストを削除しました:', id);
      return true;
    } catch (error) {
      console.error('シフトリクエストの削除に失敗しました:', error);
      return false;
    }
  };

  /**
   * 特定のスタッフのシフトリクエストを取得
   */
  const getShiftRequestsByStaff = (staffId: string): ShiftRequest[] => {
    return shiftRequests.filter(req => req.staffId === staffId);
  };

  /**
   * 特定の日付のシフトリクエストを取得
   */
  const getShiftRequestsByDate = (date: string): ShiftRequest[] => {
    return shiftRequests.filter(req => req.date === date);
  };

  /**
   * 特定の月のシフトリクエストを取得
   */
  const getShiftRequestsByMonth = (year: number, month: number): ShiftRequest[] => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return shiftRequests.filter(req => {
      const reqDate = new Date(req.date);
      return reqDate >= startDate && reqDate <= endDate;
    });
  };

  /**
   * 特定のスタッフの特定の月のシフトリクエストを取得
   */
  const getShiftRequestsByStaffAndMonth = (
    staffId: string,
    year: number,
    month: number
  ): ShiftRequest[] => {
    const monthRequests = getShiftRequestsByMonth(year, month);
    return monthRequests.filter(req => req.staffId === staffId);
  };

  /**
   * 月別のシフト統計を取得
   */
  const getMonthlyStats = (year: number, month: number) => {
    const monthRequests = getShiftRequestsByMonth(year, month);
    
    // 勤務タイプ別カウント
    const shiftTypeCounts: Record<string, number> = {};
    monthRequests.forEach(req => {
      shiftTypeCounts[req.shiftType] = (shiftTypeCounts[req.shiftType] || 0) + 1;
    });

    // スタッフ別カウント
    const staffCounts: Record<string, number> = {};
    monthRequests.forEach(req => {
      const name = req.staffName || '不明';
      staffCounts[name] = (staffCounts[name] || 0) + 1;
    });

    return {
      total: monthRequests.length,
      byShiftType: shiftTypeCounts,
      byStaff: staffCounts,
    };
  };

  /**
   * 一括追加（複数日のシフトを一度に登録）
   */
  const addBulkShiftRequests = async (
    requests: ShiftRequestFormData[]
  ): Promise<boolean> => {
    try {
      const newShifts: Shift[] = requests.map(data => ({
        id: crypto.randomUUID(),
        staffId: data.staffId,
        date: data.date,
        shiftType: data.shiftType,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.shifts.bulkAdd(newShifts);
      await loadShiftRequests();
      
      console.log(`${newShifts.length}件のシフトリクエストを一括追加しました`);
      return true;
    } catch (error) {
      console.error('シフトリクエストの一括追加に失敗しました:', error);
      return false;
    }
  };

  /**
   * 特定の期間のシフトリクエストを削除
   */
  const deleteShiftRequestsByDateRange = async (
    startDate: string,
    endDate: string
  ): Promise<boolean> => {
    try {
      const toDelete = shiftRequests.filter(req => 
        req.date >= startDate && req.date <= endDate
      );
      
      const ids = toDelete.map(req => req.id);
      await db.shifts.bulkDelete(ids);
      await loadShiftRequests();
      
      console.log(`${ids.length}件のシフトリクエストを削除しました`);
      return true;
    } catch (error) {
      console.error('シフトリクエストの削除に失敗しました:', error);
      return false;
    }
  };

  /**
   * 特定のスタッフの特定の月のシフトをクリア
   */
  const clearStaffMonthShifts = async (
    staffId: string,
    year: number,
    month: number
  ): Promise<boolean> => {
    try {
      const toDelete = getShiftRequestsByStaffAndMonth(staffId, year, month);
      const ids = toDelete.map(req => req.id);
      
      await db.shifts.bulkDelete(ids);
      await loadShiftRequests();
      
      console.log(`${ids.length}件のシフトリクエストをクリアしました`);
      return true;
    } catch (error) {
      console.error('シフトリクエストのクリアに失敗しました:', error);
      return false;
    }
  };

  return {
    shiftRequests,
    loading,
    addShiftRequest,
    updateShiftRequest,
    deleteShiftRequest,
    getShiftRequestsByStaff,
    getShiftRequestsByDate,
    getShiftRequestsByMonth,
    getShiftRequestsByStaffAndMonth,
    getMonthlyStats,
    addBulkShiftRequests,
    deleteShiftRequestsByDateRange,
    clearStaffMonthShifts,
    reload: loadShiftRequests,
  };
}
