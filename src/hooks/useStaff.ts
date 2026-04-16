import { useCallback, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../db/index';
import type {
  Staff,
  StaffFormData,
  StaffGenderLike,
  StaffId,
} from '../types';

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeStaffId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return '';
}

function normalizeQualifications(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeString(item))
    .filter((item, index, array) => item !== '' && array.indexOf(item) === index);
}

function normalizeGender(value: unknown): StaffGenderLike | undefined {
  const normalized = safeString(value);

  if (
    normalized === '男性' ||
    normalized === '女性' ||
    normalized === 'その他' ||
    normalized === '未設定'
  ) {
    return normalized;
  }

  return undefined;
}

function sortStaffList(list: Staff[]): Staff[] {
  return [...list].sort((a, b) => {
    const nameCompare = safeString(a.name).localeCompare(safeString(b.name), 'ja');
    if (nameCompare !== 0) return nameCompare;

    const positionCompare = safeString(a.position).localeCompare(safeString(b.position), 'ja');
    if (positionCompare !== 0) return positionCompare;

    return normalizeStaffId(a.id).localeCompare(normalizeStaffId(b.id), 'ja');
  });
}

function buildStaffRecord(data: StaffFormData, existingId?: StaffId): Staff {
  const now = new Date();

  return {
    id: existingId ?? createStaffId(),
    name: safeString(data.name),
    position: safeString(data.position),
    employmentType: safeString(data.employmentType),
    qualifications: normalizeQualifications(data.qualifications),
    gender: normalizeGender(data.gender) ?? '未設定',
    minWorkDaysPerMonth: safeNumber(data.minWorkDaysPerMonth, 0),
    maxNightShiftsPerMonth: safeNumber(data.maxNightShiftsPerMonth, 0),
    canWorkNightShift:
      typeof data.canWorkNightShift === 'boolean' ? data.canWorkNightShift : true,
    createdAt: now,
    updatedAt: now,
  };
}

function createStaffId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `staff_${time}_${rand}`;
}

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);

      await initializeDatabase();

      const rows = await db.staff.toArray().catch(() => []);
      const normalized = (rows as Staff[]).map((row) => ({
        ...row,
        id: normalizeStaffId(row.id),
        name: safeString(row.name),
        position: safeString(row.position),
        employmentType: safeString(row.employmentType),
        qualifications: normalizeQualifications(row.qualifications),
        gender: normalizeGender(row.gender) ?? '未設定',
        minWorkDaysPerMonth: safeNumber(row.minWorkDaysPerMonth, 0),
        maxNightShiftsPerMonth: safeNumber(row.maxNightShiftsPerMonth, 0),
        canWorkNightShift:
          typeof row.canWorkNightShift === 'boolean' ? row.canWorkNightShift : true,
      }));

      setStaff(sortStaffList(normalized));
    } catch (error) {
      console.error('❌ スタッフの読み込みに失敗しました:', error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const addStaff = useCallback(
    async (formData: StaffFormData): Promise<boolean> => {
      try {
        const newStaff = buildStaffRecord(formData);

        if (!safeString(newStaff.name)) {
          console.warn('⚠️ スタッフ名が空です');
          return false;
        }

        if (!safeString(newStaff.position)) {
          console.warn('⚠️ 役職が空です');
          return false;
        }

        if (!safeString(newStaff.employmentType)) {
          console.warn('⚠️ 雇用形態が空です');
          return false;
        }

        const currentStaff = await db.staff.toArray().catch(() => []);
        const duplicate = (currentStaff as Staff[]).some((row) => {
          return (
            safeString(row.name) === safeString(newStaff.name) &&
            safeString(row.position) === safeString(newStaff.position) &&
            safeString(row.employmentType) === safeString(newStaff.employmentType)
          );
        });

        if (duplicate) {
          console.warn('⚠️ 同名・同役職・同雇用形態のスタッフが既に存在します');
          return false;
        }

        await db.staff.add({
          ...newStaff,
          id: normalizeStaffId(newStaff.id),
        } as Staff);

        await loadStaff();
        return true;
      } catch (error) {
        console.error('❌ スタッフの追加に失敗しました:', error);
        return false;
      }
    },
    [loadStaff]
  );

  const updateStaff = useCallback(
    async (id: StaffId, formData: Partial<StaffFormData>): Promise<boolean> => {
      try {
        const normalizedId = normalizeStaffId(id);
        if (!normalizedId) {
          console.warn('⚠️ 不正なスタッフIDです');
          return false;
        }

        const existing = await db.staff.get(normalizedId);
        if (!existing) {
          console.warn('⚠️ 更新対象のスタッフが見つかりません:', normalizedId);
          return false;
        }

        const nextName =
          formData.name !== undefined ? safeString(formData.name) : safeString(existing.name);
        const nextPosition =
          formData.position !== undefined
            ? safeString(formData.position)
            : safeString(existing.position);
        const nextEmploymentType =
          formData.employmentType !== undefined
            ? safeString(formData.employmentType)
            : safeString(existing.employmentType);

        if (!nextName || !nextPosition || !nextEmploymentType) {
          console.warn('⚠️ 氏名・役職・雇用形態は空にできません');
          return false;
        }

        const currentStaff = await db.staff.toArray().catch(() => []);
        const duplicate = (currentStaff as Staff[]).some((row) => {
          const rowId = normalizeStaffId(row.id);
          if (rowId === normalizedId) return false;

          return (
            safeString(row.name) === nextName &&
            safeString(row.position) === nextPosition &&
            safeString(row.employmentType) === nextEmploymentType
          );
        });

        if (duplicate) {
          console.warn('⚠️ 更新後に重複スタッフが発生します');
          return false;
        }

        const patch: Partial<Staff> = {
          name: nextName,
          position: nextPosition,
          employmentType: nextEmploymentType,
          updatedAt: new Date(),
        };

        if (formData.qualifications !== undefined) {
          patch.qualifications = normalizeQualifications(formData.qualifications);
        }

        if (formData.gender !== undefined) {
          patch.gender = normalizeGender(formData.gender) ?? '未設定';
        }

        if (formData.minWorkDaysPerMonth !== undefined) {
          patch.minWorkDaysPerMonth = safeNumber(formData.minWorkDaysPerMonth, 0);
        }

        if (formData.maxNightShiftsPerMonth !== undefined) {
          patch.maxNightShiftsPerMonth = safeNumber(formData.maxNightShiftsPerMonth, 0);
        }

        if (formData.canWorkNightShift !== undefined) {
          patch.canWorkNightShift = Boolean(formData.canWorkNightShift);
        }

        await db.staff.update(normalizedId, patch);
        await loadStaff();
        return true;
      } catch (error) {
        console.error('❌ スタッフの更新に失敗しました:', error);
        return false;
      }
    },
    [loadStaff]
  );

  const deleteStaff = useCallback(
    async (id: StaffId): Promise<boolean> => {
      try {
        const normalizedId = normalizeStaffId(id);
        if (!normalizedId) {
          console.warn('⚠️ 不正なスタッフIDです');
          return false;
        }

        const existing = await db.staff.get(normalizedId);
        if (!existing) {
          console.warn('⚠️ 削除対象のスタッフが見つかりません:', normalizedId);
          return false;
        }

        const [shiftRequestsCount, legacyShiftsCount, generatedSchedulesCount] =
          await Promise.all([
            db.shiftRequests
              .filter((row) => normalizeStaffId((row as { staffId?: unknown }).staffId) === normalizedId)
              .count()
              .catch(() => 0),
            db.shifts
              .filter((row) => normalizeStaffId((row as { staffId?: unknown }).staffId) === normalizedId)
              .count()
              .catch(() => 0),
            db.generatedSchedules
              .filter((row) => normalizeStaffId((row as { staffId?: unknown }).staffId) === normalizedId)
              .count()
              .catch(() => 0),
          ]);

        if (
          shiftRequestsCount > 0 ||
          legacyShiftsCount > 0 ||
          generatedSchedulesCount > 0
        ) {
          console.warn('⚠️ 参照中のスタッフは削除できません', {
            shiftRequests: shiftRequestsCount,
            legacyShifts: legacyShiftsCount,
            generatedSchedules: generatedSchedulesCount,
          });
          return false;
        }

        await db.staff.delete(normalizedId);
        await loadStaff();
        return true;
      } catch (error) {
        console.error('❌ スタッフの削除に失敗しました:', error);
        return false;
      }
    },
    [loadStaff]
  );

  const getStaffById = useCallback(
    (id: StaffId | null | undefined): Staff | undefined => {
      const normalizedId = normalizeStaffId(id);
      if (!normalizedId) return undefined;
      return staff.find((row) => normalizeStaffId(row.id) === normalizedId);
    },
    [staff]
  );

  const getStaffByName = useCallback(
    (name: string): Staff | undefined => {
      const normalizedName = safeString(name);
      if (!normalizedName) return undefined;
      return staff.find((row) => safeString(row.name) === normalizedName);
    },
    [staff]
  );

  const searchStaff = useCallback(
    (keyword: string): Staff[] => {
      const q = safeString(keyword).toLowerCase();
      if (!q) return staff;

      return staff.filter((row) => {
        const qualifications = normalizeQualifications(row.qualifications).join(' ');
        return (
          safeString(row.name).toLowerCase().includes(q) ||
          safeString(row.position).toLowerCase().includes(q) ||
          safeString(row.employmentType).toLowerCase().includes(q) ||
          safeString(row.gender).toLowerCase().includes(q) ||
          qualifications.toLowerCase().includes(q)
        );
      });
    },
    [staff]
  );

  return {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    getStaffById,
    getStaffByName,
    searchStaff,
    reload: loadStaff,
  };
}
