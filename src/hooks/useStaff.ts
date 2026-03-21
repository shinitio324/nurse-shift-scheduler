import { useEffect, useState } from 'react';
import { db } from '../db';
import type { Staff, StaffFormData } from '../types';

function safeDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStaff(raw: any): Staff {
  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    name: String(raw?.name ?? ''),
    position: raw?.position ?? 'その他',
    employmentType: raw?.employmentType ?? '常勤',
    qualifications: Array.isArray(raw?.qualifications) ? raw.qualifications : [],
    gender: raw?.gender ?? '女性',
    minWorkDaysPerMonth: safeNumber(raw?.minWorkDaysPerMonth, 0),
    maxNightShiftsPerMonth: safeNumber(raw?.maxNightShiftsPerMonth, 0),
    canWorkNightShift: raw?.canWorkNightShift !== false,
    createdAt: safeDate(raw?.createdAt),
    updatedAt: safeDate(raw?.updatedAt),
  };
}

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStaff = async () => {
    try {
      setLoading(true);

      const allStaffRaw = await db.staff.toArray();
      const allStaff = allStaffRaw.map(normalizeStaff);

      allStaff.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

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

  const addStaff = async (data: StaffFormData): Promise<boolean> => {
    try {
      if (!data.name || !data.name.trim()) {
        console.error('スタッフ名が空です');
        alert('スタッフ名を入力してください');
        return false;
      }

      const now = new Date();

      const newStaff: Staff = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        position: data.position,
        employmentType: data.employmentType,
        qualifications: Array.isArray(data.qualifications)
          ? data.qualifications
          : [],
        gender: data.gender ?? '女性',
        minWorkDaysPerMonth: safeNumber(data.minWorkDaysPerMonth, 0),
        maxNightShiftsPerMonth:
          data.canWorkNightShift === false
            ? 0
            : safeNumber(data.maxNightShiftsPerMonth, 0),
        canWorkNightShift: data.canWorkNightShift !== false,
        createdAt: now,
        updatedAt: now,
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

  const updateStaff = async (
    id: string,
    data: Partial<StaffFormData>
  ): Promise<boolean> => {
    try {
      console.log('スタッフを更新中:', id, data);

      const nextCanWorkNightShift =
        data.canWorkNightShift !== undefined ? data.canWorkNightShift : undefined;

      const updatePayload: Partial<Staff> = {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.employmentType !== undefined
          ? { employmentType: data.employmentType }
          : {}),
        ...(data.qualifications !== undefined
          ? {
              qualifications: Array.isArray(data.qualifications)
                ? data.qualifications
                : [],
            }
          : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.minWorkDaysPerMonth !== undefined
          ? {
              minWorkDaysPerMonth: safeNumber(data.minWorkDaysPerMonth, 0),
            }
          : {}),
        ...(nextCanWorkNightShift !== undefined
          ? { canWorkNightShift: nextCanWorkNightShift !== false }
          : {}),
        ...(data.maxNightShiftsPerMonth !== undefined || nextCanWorkNightShift === false
          ? {
              maxNightShiftsPerMonth:
                nextCanWorkNightShift === false
                  ? 0
                  : safeNumber(data.maxNightShiftsPerMonth, 0),
            }
          : {}),
        updatedAt: new Date(),
      };

      await db.staff.update(id, updatePayload);
      await loadStaff();

      console.log('スタッフの更新に成功しました:', id);
      return true;
    } catch (error) {
      console.error('スタッフの更新に失敗しました:', error);
      alert('スタッフの更新に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  const deleteStaff = async (id: string): Promise<boolean> => {
    try {
      console.log('スタッフを削除中:', id);

      try {
        const shifts = await db.shifts.where('staffId').equals(id).toArray();
        if (shifts.length > 0) {
          const shiftIds = shifts.map((s: any) => s.id).filter(Boolean);
          if (shiftIds.length > 0) {
            await db.shifts.bulkDelete(shiftIds);
            console.log(`関連する shifts ${shiftIds.length} 件を削除しました`);
          }
        }
      } catch (e) {
        console.warn('shifts 削除をスキップしました:', e);
      }

      try {
        const shiftRequestsTable = (db as any).shiftRequests;
        if (
          shiftRequestsTable &&
          typeof shiftRequestsTable.where === 'function'
        ) {
          const requests = await shiftRequestsTable
            .where('staffId')
            .equals(id)
            .toArray();

          const requestIds = requests
            .map((r: any) => r?.id)
            .filter((rid: unknown) => rid != null);

          if (requestIds.length > 0) {
            await shiftRequestsTable.bulkDelete(requestIds);
            console.log(
              `関連する shiftRequests ${requestIds.length} 件を削除しました`
            );
          }
        }
      } catch (e) {
        console.warn('shiftRequests 削除をスキップしました:', e);
      }

      try {
        const generatedSchedulesTable = (db as any).generatedSchedules;
        if (
          generatedSchedulesTable &&
          typeof generatedSchedulesTable.where === 'function'
        ) {
          const generated = await generatedSchedulesTable
            .where('staffId')
            .equals(id)
            .toArray();

          const generatedIds = generated
            .map((g: any) => g?.id)
            .filter((gid: unknown) => gid != null);

          if (generatedIds.length > 0) {
            await generatedSchedulesTable.bulkDelete(generatedIds);
            console.log(
              `関連する generatedSchedules ${generatedIds.length} 件を削除しました`
            );
          }
        }
      } catch (e) {
        console.warn('generatedSchedules 削除をスキップしました:', e);
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
