// src/components/StaffList.tsx
import { useState } from 'react';
import { Pencil, Trash2, UserPlus, Briefcase } from 'lucide-react';
import { StaffForm } from './StaffForm';
import { useStaff } from '../hooks/useStaff';
import type { Staff, StaffFormData } from '../types';

export function StaffList() {
  const { staff, loading, addStaff, updateStaff, deleteStaff } = useStaff();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleSubmit = async (data: StaffFormData): Promise<boolean> => {
    try {
      if (editingStaff) {
        return await updateStaff(editingStaff.id, data);
      } else {
        return await addStaff(data);
      }
    } catch (error) {
      console.error('スタッフの保存に失敗しました:', error);
      alert('スタッフの保存に失敗しました。もう一度お試しください。');
      return false;
    }
  };

  const handleEdit = (s: Staff) => { setEditingStaff(s); setIsFormOpen(true); };
  const handleAddNew = () => { setEditingStaff(null); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setEditingStaff(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このスタッフを削除してもよろしいですか？')) return;
    try { await deleteStaff(id); }
    catch (e) { console.error(e); alert('スタッフの削除に失敗しました。'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">スタッフ管理</h2>
          <p className="text-sm text-gray-600 mt-1">登録スタッフ数: {staff.length}名</p>
        </div>
        <button onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
          <UserPlus className="w-5 h-5" /><span>スタッフを追加</span>
        </button>
      </div>

      {/* 凡例 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <p className="text-sm text-indigo-800">
          <strong>月の最低勤務日数</strong>はスケジュール自動生成時に反映されます。
          0 に設定したスタッフは制約なしで割り当てられます。
        </p>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">スタッフが登録されていません</h3>
          <p className="text-gray-600 mb-6">「スタッフを追加」ボタンから登録しましょう</p>
          <button onClick={handleAddNew}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">
            <UserPlus className="w-5 h-5" /><span>スタッフを追加</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['氏名', '職種', '雇用形態', '月の最低勤務日数', '資格', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  {/* 氏名 */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  </td>

                  {/* 職種 */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {s.position}
                    </span>
                  </td>

                  {/* 雇用形態 */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      s.employmentType === '常勤'
                        ? 'bg-green-100 text-green-800'
                        : s.employmentType === '非常勤'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {s.employmentType}
                    </span>
                  </td>

                  {/* ★NEW 月の最低勤務日数 */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {(s.minWorkDaysPerMonth ?? 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          月 {s.minWorkDaysPerMonth} 日以上
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">制約なし</span>
                    )}
                  </td>

                  {/* 資格 */}
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {(s.qualifications ?? []).length > 0
                        ? s.qualifications.join(', ')
                        : <span className="text-gray-400">なし</span>}
                    </div>
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <button onClick={() => handleEdit(s)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3 p-1 rounded hover:bg-indigo-50">
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* サマリー（雇用形態別） */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {(['常勤', '非常勤', 'パート'] as const).map(type => {
                const members = staff.filter(s => s.employmentType === type);
                if (members.length === 0) return null;
                const withTarget = members.filter(s => (s.minWorkDaysPerMonth ?? 0) > 0);
                return (
                  <div key={type} className="flex items-center gap-1">
                    <span className="font-medium">{type}:</span>
                    <span>{members.length}名</span>
                    {withTarget.length > 0 && (
                      <span className="text-indigo-600">（最低勤務日数設定 {withTarget.length}名）</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
