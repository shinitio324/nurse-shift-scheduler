import { useState } from 'react';
import { X } from 'lucide-react';
import type { Staff, StaffFormData } from '../types';

interface StaffFormProps {
  onSubmit: (data: StaffFormData) => Promise<boolean>;
  onClose: () => void;
  initialData?: Staff;
  isEdit?: boolean;
}

export function StaffForm({ onSubmit, onClose, initialData, isEdit = false }: StaffFormProps) {
  const [formData, setFormData] = useState<StaffFormData>({
    name: initialData?.name || '',
    position: initialData?.position || '正看護師',
    employmentType: initialData?.employmentType || '常勤',
    qualifications: initialData?.qualifications || [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const qualificationOptions = [
    '看護師免許',
    '准看護師免許',
    '助産師免許',
    '保健師免許',
    '専門看護師',
    '認定看護師',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!formData.name.trim()) {
      alert('氏名を入力してください');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('スタッフフォーム: 送信開始', formData);
      
      const success = await onSubmit(formData);
      
      console.log('スタッフフォーム: 送信結果', success);
      
      if (success) {
        console.log('スタッフフォーム: 成功、フォームを閉じます');
        onClose();
      } else {
        console.error('スタッフフォーム: 失敗しました');
        // エラーは useStaff.ts で既に表示されているので、ここでは何もしない
      }
    } catch (error) {
      console.error('スタッフフォーム: 例外発生', error);
      alert('予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleQualification = (qualification: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(qualification)
        ? prev.qualifications.filter(q => q !== qualification)
        : [...prev.qualifications, qualification],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-800">
              {isEdit ? 'スタッフ情報を編集' : '新しいスタッフを追加'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* フォーム本体 */}
          <div className="px-6 py-4 space-y-4">
            {/* 氏名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例: 田中 花子"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* 職種 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                職種 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                disabled={isSubmitting}
              >
                <option value="正看護師">正看護師</option>
                <option value="准看護師">准看護師</option>
                <option value="看護助手">看護助手</option>
                <option value="その他">その他</option>
              </select>
            </div>

            {/* 雇用形態 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                雇用形態 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                disabled={isSubmitting}
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
                {qualificationOptions.map((qualification) => (
                  <label
                    key={qualification}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.qualifications.includes(qualification)}
                      onChange={() => toggleQualification(qualification)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">{qualification}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : isEdit ? '更新する' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
