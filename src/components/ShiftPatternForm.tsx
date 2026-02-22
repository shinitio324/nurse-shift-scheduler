import { useState } from 'react';
import { X } from 'lucide-react';
import { ShiftPatternFormData } from '../types';

interface ShiftPatternFormProps {
  onSubmit: (data: ShiftPatternFormData) => Promise<boolean>;
  onClose: () => void;
  initialData?: ShiftPatternFormData;
  isEdit?: boolean;
}

const colorOptions = [
  { name: '青', value: '#3B82F6' },
  { name: '緑', value: '#10B981' },
  { name: '黄', value: '#F59E0B' },
  { name: '紫', value: '#8B5CF6' },
  { name: '赤', value: '#EF4444' },
  { name: 'ピンク', value: '#EC4899' },
  { name: '水色', value: '#06B6D4' },
  { name: '灰色', value: '#6B7280' }
];

export function ShiftPatternForm({ onSubmit, onClose, initialData, isEdit = false }: ShiftPatternFormProps) {
  const [formData, setFormData] = useState<ShiftPatternFormData>(
    initialData || {
      name: '',
      shortName: '',
      startTime: '08:30',
      endTime: '17:00',
      requiredStaff: 5,
      color: '#3B82F6',
      isWorkday: true
    }
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!formData.name.trim()) {
      alert('シフト名を入力してください');
      return;
    }
    if (!formData.shortName.trim()) {
      alert('略称を入力してください');
      return;
    }
    if (formData.isWorkday && (!formData.startTime || !formData.endTime)) {
      alert('開始時刻と終了時刻を入力してください');
      return;
    }
    if (formData.isWorkday && formData.requiredStaff < 1) {
      alert('必要人数は1人以上にしてください');
      return;
    }
    
    setSubmitting(true);
    const success = await onSubmit(formData);
    setSubmitting(false);
    
    if (success) {
      onClose();
    } else {
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEdit ? 'シフトパターン編集' : '新しいシフトパターン'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* シフト名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              シフト名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 日勤"
              required
            />
          </div>

          {/* 略称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              略称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 日"
              maxLength={2}
              required
            />
            <p className="text-xs text-gray-500 mt-1">カレンダーに表示される略称（1〜2文字）</p>
          </div>

          {/* 勤務日フラグ */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isWorkday}
                onChange={(e) => setFormData({ ...formData, isWorkday: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">勤務日として扱う</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              休みの場合はチェックを外してください
            </p>
          </div>

          {/* 勤務時間（勤務日の場合のみ） */}
          {formData.isWorkday && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時刻 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.isWorkday}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時刻 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.isWorkday}
                  />
                </div>
              </div>

              {/* 必要人数 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  必要人数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.requiredStaff}
                  onChange={(e) => setFormData({ ...formData, requiredStaff: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="50"
                  required={formData.isWorkday}
                />
              </div>
            </>
          )}

          {/* 色選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              表示色 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: option.value })}
                  className={`flex flex-col items-center p-2 border-2 rounded-lg transition-all ${
                    formData.color === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full mb-1"
                    style={{ backgroundColor: option.value }}
                  />
                  <span className="text-xs text-gray-600">{option.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
            <div
              className="inline-block px-3 py-1 rounded text-white text-sm font-medium"
              style={{ backgroundColor: formData.color }}
            >
              {formData.shortName || '略'}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {formData.name || 'シフト名'}
              {formData.isWorkday && formData.startTime && formData.endTime && 
                ` (${formData.startTime} - ${formData.endTime})`
              }
            </p>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {submitting ? '保存中...' : (isEdit ? '更新' : '登録')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
