import { useState } from 'react';
import { Edit2, Trash2, Users } from 'lucide-react';
import { Staff, StaffFormData } from '../types';
import { StaffForm } from './StaffForm';

interface StaffListProps {
  staff: Staff[];
  onAdd: (data: StaffFormData) => Promise<boolean>;
  onUpdate: (id: string, data: Partial<StaffFormData>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  loading: boolean;
}

export function StaffList({ staff, onAdd, onUpdate, onDelete, loading }: StaffListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`${name} を削除してもよろしいですか？`)) {
      await onDelete(id);
    }
  };

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingStaff(null);
  };

  const handleSubmit = async (data: StaffFormData) => {
    if (editingStaff) {
      return await onUpdate(editingStaff.id, data);
    } else {
      return await onAdd(data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">スタッフ管理</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          スタッフを追加
        </button>
      </div>

      {/* スタッフ一覧 */}
      {staff.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">スタッフが登録されていません</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            最初のスタッフを登録
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  氏名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  役職
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  勤務形態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  資格
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{s.position}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {s.employmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {s.qualifications.length > 0 ? s.qualifications.join(', ') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                      title="編集"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="text-red-600 hover:text-red-900"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* フォームモーダル */}
      {showForm && (
        <StaffForm
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          initialData={editingStaff ? {
            name: editingStaff.name,
            position: editingStaff.position,
            employmentType: editingStaff.employmentType,
            qualifications: editingStaff.qualifications
          } : undefined}
          isEdit={!!editingStaff}
        />
      )}
    </div>
  );
}
