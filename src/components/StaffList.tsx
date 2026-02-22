import { useState } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { StaffForm } from './StaffForm';
import { useStaff } from '../hooks/useStaff';
import type { Staff, StaffFormData } from '../types';

export function StaffList() {
  const { staff, loading, addStaff, updateStaff, deleteStaff } = useStaff();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleSubmit = async (data: StaffFormData) => {
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, data);
      } else {
        await addStaff(data);
      }
      setIsFormOpen(false);
      setEditingStaff(null);
    } catch (error) {
      console.error('スタッフの保存に失敗しました:', error);
      alert('スタッフの保存に失敗しました。もう一度お試しください。');
    }
  };

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('このスタッフを削除してもよろしいですか？')) {
      try {
        await deleteStaff(id);
      } catch (error) {
        console.error('スタッフの削除に失敗しました:', error);
        alert('スタッフの削除に失敗しました。もう一度お試しください。');
      }
    }
  };

  const handleAddNew = () => {
    setEditingStaff(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStaff(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">スタッフ管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            登録スタッフ数: {staff.length}名
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
        >
          <UserPlus className="w-5 h-5" />
          <span>スタッフを追加</span>
        </button>
      </div>

      {/* スタッフリスト */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            スタッフが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            「スタッフを追加」ボタンから最初のスタッフを登録しましょう
          </p>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <UserPlus className="w-5 h-5" />
            <span>スタッフを追加</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  氏名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  職種
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  雇用形態
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
              {staff.map((staffMember) => (
                <tr key={staffMember.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {staffMember.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {staffMember.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {staffMember.employmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {staffMember.qualifications.length > 0
                        ? staffMember.qualifications.join(', ')
                        : 'なし'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(staffMember)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(staffMember.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* スタッフ登録・編集フォーム */}
      {isFormOpen && (
        <StaffForm
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          initialData={editingStaff || undefined}
          isEdit={!!editingStaff}
        />
      )}
    </div>
  );
}

