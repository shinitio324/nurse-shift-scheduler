// src/components/StaffForm.tsx
import { useState } from 'react';
import { X, Briefcase, Info } from 'lucide-react';
import type { Staff, StaffFormData } from '../types';

interface StaffFormProps {
  onSubmit: (data: StaffFormData) => Promise<boolean>;
  onClose: () => void;
  initialData?: Staff;
  isEdit?: boolean;
}

const POSITION_OPTIONS = ['正看護師', '准看護師', '看護助手', 'その他'] as const;
const EMPLOYMENT_OPTIONS = ['常勤', '非常勤', 'パート'] as const;
const QUALIFICATION_OPTIONS = [
  '看護師免許', '准看護師免許', '助産師免許',
  '保健師免許', '専門看護師', '認定看護師',
] as const;

/** 雇用形態ごとのデフォルト最低勤務日数サジェスト */
const DEFAULT_MIN_WORK_DAYS: Record<string, number> = {
  '常勤': 20,
  '非常勤': 15,
  'パート': 10,
};

export function StaffForm({ onSubmit, onClose, initialData, isEdit = false }: StaffFormProps) {
  const [formData, setFormData] = useState<StaffFormData>({
    name:               initialData?.name               ?? '',
    position:           initialData?.position           ?? '正看護師',
    employmentType:     initialData?.employmentType     ?? '常勤',
    qualifications:     initialData?.qualifications     ?? [],
    minWorkDaysPerMonth: initialData?.minWorkDaysPerMonth ?? 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 雇用形態変更時にデフォルト値をサジェスト（0のときのみ）
  const handleEmploymentTypeChange = (v: string) => {
    setFormData(prev => ({
      ...prev,
      employmentType: v,
      // まだ手動で変更していない（0のまま）ならサジェストを適用
      minWorkDaysPerMonth: prev.minWorkDaysPerMonth === 0
        ? 0
        : prev.minWorkDaysPerMonth,
    }));
  };

  const applyDefaultDays = () => {
    setFormData(prev => ({
      ...prev,
      minWorkDaysPerMonth: DEFAULT_MIN_WORK_DAYS[prev.employmentType] ?? 20,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('氏名を入力してください'); return; }
    if (formData.minWorkDaysPerMonth < 0 || formData.minWorkDaysPerMonth > 31) {
      alert('月の最低勤務日数は 0〜31 の範囲で入力してください'); return;
    }
    try {
      setIsSubmitting(true);
      const ok = await onSubmit(formData);
      if (ok) onClose();
    } catch (err) {
      console.error(err);
      alert('予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleQualification = (q: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(q)
        ? prev.qualifications.filter(x => x !== q)
        : [...prev.qualifications, q],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>

          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-gray-800">
              {isEdit ? 'スタッフ情報を編集' : '新しいスタッフを追加'}
            </h3>
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* フォーム本体 */}
          <div className="px-6 py-4 space-y-5">

            {/* 氏名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input type="text" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="例: 田中 花子" disabled={isSubmitting} />
            </div>

            {/* 職種 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                職種 <span className="text-red-500">*</span>
              </label>
              <select required value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}>
                {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* 雇用形態 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                雇用形態 <span className="text-red-500">*</span>
              </label>
              <select required value={formData.employmentType}
                onChange={e => handleEmploymentTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}>
                {EMPLOYMENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* ★NEW 月の最低勤務日数 */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  月の最低勤務日数
                </label>
                {/* デフォルト値サジェストボタン */}
                <button type="button" onClick={applyDefaultDays}
                  className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                  disabled={isSubmitting}>
                  {formData.employmentType}の目安（{DEFAULT_MIN_WORK_DAYS[formData.employmentType] ?? 20}日）を適用
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number" min={0} max={31}
                  value={formData.minWorkDaysPerMonth}
                  onChange={e => setFormData({ ...formData, minWorkDaysPerMonth: Number(e.target.value) })}
                  className="w-28 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-lg font-bold"
                  disabled={isSubmitting}
                />
                <span className="text-gray-700 font-medium">日 / 月</span>
                {formData.minWorkDaysPerMonth === 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">0 = 制約なし</span>
                )}
                {formData.minWorkDaysPerMonth > 0 && (
                  <span className="text-xs text-indigo-700 bg-indigo-100 px-2 py-1 rounded font-medium">
                    月 {formData.minWorkDaysPerMonth} 日以上勤務
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-indigo-700">
                  休み・明け・有給はカウント対象外です。スケジュール生成時に自動的に目標日数まで勤務が割り当てられます。
                  0 に設定すると制約なしになります。
                </p>
              </div>

              {/* 雇用形態ごとの目安表 */}
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <p className="text-xs font-medium text-indigo-700 mb-1">雇用形態ごとの目安</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DEFAULT_MIN_WORK_DAYS).map(([type, days]) => (
                    <div key={type}
                      className={`text-center p-1.5 rounded text-xs ${formData.employmentType === type ? 'bg-indigo-200 font-bold text-indigo-900' : 'bg-white text-gray-600'}`}>
                      <div className="font-medium">{type}</div>
                      <div>{days}日〜</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 資格 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">資格（複数選択可）</label>
              <div className="space-y-2">
                {QUALIFICATION_OPTIONS.map(q => (
                  <label key={q} className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox"
                      checked={formData.qualifications.includes(q)}
                      onChange={() => toggleQualification(q)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      disabled={isSubmitting} />
                    <span className="text-sm text-gray-700">{q}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSubmitting ? '保存中...' : isEdit ? '更新する' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
