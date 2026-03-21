import { useState } from 'react';
import { X, Briefcase, Info, Moon, Users, Sun } from 'lucide-react';
import type { Staff, StaffFormData, StaffGender } from '../types';

interface StaffFormProps {
  onSubmit: (data: StaffFormData) => Promise<boolean>;
  onClose: () => void;
  initialData?: Staff;
  isEdit?: boolean;
}

const POSITION_OPTIONS = ['正看護師', '准看護師', '看護助手', 'その他'] as const;
const EMPLOYMENT_OPTIONS = ['常勤', '非常勤', 'パート'] as const;
const GENDER_OPTIONS: StaffGender[] = ['男性', '女性', 'その他'];

const QUALIFICATION_OPTIONS = [
  '看護師免許',
  '准看護師免許',
  '助産師免許',
  '保健師免許',
  '専門看護師',
  '認定看護師',
] as const;

const DEFAULT_MIN_WORK_DAYS: Record<string, number> = {
  常勤: 20,
  非常勤: 15,
  パート: 10,
};

const DEFAULT_MAX_NIGHT_SHIFTS: Record<string, number> = {
  常勤: 8,
  非常勤: 4,
  パート: 2,
};

export function StaffForm({
  onSubmit,
  onClose,
  initialData,
  isEdit = false,
}: StaffFormProps) {
  const [formData, setFormData] = useState<StaffFormData>({
    name: initialData?.name ?? '',
    position: initialData?.position ?? '正看護師',
    employmentType: initialData?.employmentType ?? '常勤',
    qualifications: initialData?.qualifications ?? [],
    gender: initialData?.gender ?? '女性',
    minWorkDaysPerMonth: initialData?.minWorkDaysPerMonth ?? 0,
    maxNightShiftsPerMonth: initialData?.maxNightShiftsPerMonth ?? 0,
    canWorkNightShift: initialData?.canWorkNightShift !== false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyDefaultMinDays = () => {
    setFormData((prev) => ({
      ...prev,
      minWorkDaysPerMonth: DEFAULT_MIN_WORK_DAYS[prev.employmentType] ?? 20,
    }));
  };

  const applyDefaultMaxNight = () => {
    if (formData.canWorkNightShift === false) return;
    setFormData((prev) => ({
      ...prev,
      maxNightShiftsPerMonth: DEFAULT_MAX_NIGHT_SHIFTS[prev.employmentType] ?? 8,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('氏名を入力してください');
      return;
    }

    if ((formData.minWorkDaysPerMonth ?? 0) < 0 || (formData.minWorkDaysPerMonth ?? 0) > 31) {
      alert('月の最低勤務日数は 0〜31 の範囲で入力してください');
      return;
    }

    if ((formData.maxNightShiftsPerMonth ?? 0) < 0 || (formData.maxNightShiftsPerMonth ?? 0) > 31) {
      alert('月の夜勤上限回数は 0〜31 の範囲で入力してください');
      return;
    }

    try {
      setIsSubmitting(true);
      const ok = await onSubmit({
        ...formData,
        name: formData.name.trim(),
        maxNightShiftsPerMonth:
          formData.canWorkNightShift === false
            ? 0
            : (formData.maxNightShiftsPerMonth ?? 0),
      });
      if (ok) onClose();
    } catch (err) {
      console.error(err);
      alert('予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleQualification = (q: string) => {
    setFormData((prev) => ({
      ...prev,
      qualifications: prev.qualifications.includes(q)
        ? prev.qualifications.filter((x) => x !== q)
        : [...prev.qualifications, q],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
            <h3 className="text-xl font-bold text-gray-800">
              {isEdit ? 'スタッフ情報を編集' : '新しいスタッフを追加'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                placeholder="例: 田中 花子"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                職種 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.position}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    position: e.target.value as StaffFormData['position'],
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                雇用形態 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.employmentType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    employmentType: e.target.value as StaffFormData['employmentType'],
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                {EMPLOYMENT_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-pink-800">
                <Users className="h-4 w-4" />
                性別（夜勤ペア最適化に使用）
              </label>
              <select
                value={formData.gender ?? '女性'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gender: e.target.value as StaffGender,
                  })
                }
                className="w-full rounded-lg border border-pink-300 px-3 py-2 focus:ring-2 focus:ring-pink-500"
                disabled={isSubmitting}
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-pink-700">
                夜勤が2名以上必要な日に、できるだけ男女混合の組み合わせを優先します。
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Sun className="h-4 w-4" />
                夜勤対応設定
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.canWorkNightShift !== false}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      canWorkNightShift: e.target.checked,
                      maxNightShiftsPerMonth: e.target.checked
                        ? prev.maxNightShiftsPerMonth ?? 0
                        : 0,
                    }))
                  }
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-medium text-amber-900">
                  夜勤対応する
                </span>
              </label>

              <p className="mt-2 text-xs text-amber-700">
                OFF にするとこのスタッフは夜勤候補から除外され、日勤・休み・有給のみ対象になります。
              </p>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                  <Briefcase className="h-4 w-4" />
                  月の最低勤務日数
                </label>
                <button
                  type="button"
                  onClick={applyDefaultMinDays}
                  className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200"
                  disabled={isSubmitting}
                >
                  {formData.employmentType}の目安を適用
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={formData.minWorkDaysPerMonth ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minWorkDaysPerMonth: Number(e.target.value),
                    })
                  }
                  className="w-28 rounded-lg border border-indigo-300 px-3 py-2 text-center text-lg font-bold focus:ring-2 focus:ring-indigo-500"
                  disabled={isSubmitting}
                />
                <span className="font-medium text-gray-700">日 / 月</span>
                {(formData.minWorkDaysPerMonth ?? 0) === 0 && (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    0 = 制約なし
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
                <p className="text-xs text-indigo-700">
                  休み・明け・有給はカウント対象外です。勤務日数の最低ラインとして使われます。
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-purple-800">
                  <Moon className="h-4 w-4" />
                  月の夜勤上限回数
                </label>
                <button
                  type="button"
                  onClick={applyDefaultMaxNight}
                  className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                  disabled={isSubmitting || formData.canWorkNightShift === false}
                >
                  {formData.employmentType}の目安を適用
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={formData.maxNightShiftsPerMonth ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxNightShiftsPerMonth: Number(e.target.value),
                    })
                  }
                  className="w-28 rounded-lg border border-purple-300 px-3 py-2 text-center text-lg font-bold focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  disabled={isSubmitting || formData.canWorkNightShift === false}
                />
                <span className="font-medium text-gray-700">回 / 月</span>
                {(formData.maxNightShiftsPerMonth ?? 0) === 0 &&
                  formData.canWorkNightShift !== false && (
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                      0 = 全体設定を使用
                    </span>
                  )}
                {formData.canWorkNightShift === false && (
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                    日勤専従のため対象外
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-500" />
                <p className="text-xs text-purple-700">
                  個別設定が 0 の場合は、制約側の全体夜勤上限を使います。
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                資格（複数選択可）
              </label>
              <div className="space-y-2">
                {QUALIFICATION_OPTIONS.map((q) => (
                  <label key={q} className="flex cursor-pointer items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.qualifications.includes(q)}
                      onChange={() => toggleQualification(q)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">{q}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end space-x-3 border-t border-gray-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : isEdit ? '更新する' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
