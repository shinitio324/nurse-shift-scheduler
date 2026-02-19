import { useState } from 'react';
import { X } from 'lucide-react';
import { StaffFormData } from '../types';

interface StaffFormProps {
  onSubmit: (data: StaffFormData) => Promise<boolean>;
  onClose: () => void;
  initialData?: StaffFormData;
  isEdit?: boolean;
}

export function StaffForm({ onSubmit, onClose, initialData, isEdit = false }: StaffFormProps) {
  const [formData, setFormData] = useState<StaffFormData>(
    initialData || {
      name: '',
      position: '正看護師',
      employmentType: '常勤',
      qualifications: []
    }
  );
  const [submitting, setSubmitting] = useState(false);

  const qualificationOptions = [
    '看護師',
    '准看護師',
    '助産師',
    '保健師',
    '専門看護師',
    '認定看護師'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('氏名を入力してください');
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

  const toggleQualification = (qual: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(qual)
        ? prev.qualifications.filter(q => q !== qual)
        : [...prev.qualifications, qual]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEdit ? 'スタッフ情報編集' : '新規スタッフ登録'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 氏名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 田中 花子"
              required
            />
          </div>

          {/* 役職 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              役職 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="正看護師">正看護師</option>
              <option value="准看護師">准看護師</option>
              <option value="看護助手">看護助手</option>
              <option value="その他">その他</option>
            </select>
          </div>

          {/* 勤務形態 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              勤務形態 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="常勤">常勤</option>
              <option value="非常勤">非常勤</option>
              <option value="パート">パート</option>
            </select>
          </div>

          {/* 資格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              資格（複数選択可）
            </label>
            <div className="space-y-2">
              {qualificationOptions.map((qual) => (
                <label key={qual} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.qualifications.includes(qual)}
                    onChange={() => toggleQualification(qual)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{qual}</span>
                </label>
              ))}
            </div>
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
