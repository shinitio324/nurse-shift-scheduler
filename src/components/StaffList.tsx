import { useState } from 'react';
import {
  Pencil,
  Trash2,
  UserPlus,
  Briefcase,
  Moon,
  Users,
} from 'lucide-react';

import { StaffForm } from './StaffForm';
import { useStaff } from '../hooks/useStaff';
import type { Staff, StaffFormData } from '../types';

function genderBadgeClass(gender?: string): string {
  switch (gender) {
    case '男性':
      return 'bg-blue-100 text-blue-800';
    case '女性':
      return 'bg-pink-100 text-pink-800';
    case 'その他':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

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

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingStaff(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStaff(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このスタッフを削除してもよろしいですか？')) return;
    try {
      await deleteStaff(id);
    } catch (e) {
      console.error(e);
      alert('スタッフの削除に失敗しました。');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const maleCount = staff.filter((s) => s.gender === '男性').length;
  const femaleCount = staff.filter((s) => s.gender === '女性').length;
  const otherGenderCount = staff.filter((s) => s.gender === 'その他').length;
  const nightLimitSetCount = staff.filter((s) => (s.maxNightShiftsPerMonth ?? 0) > 0).length;
  const minWorkSetCount = staff.filter((s) => (s.minWorkDaysPerMonth ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">スタッフ管理</h2>
          <p className="mt-1 text-sm text-gray-600">登録スタッフ数: {staff.length}名</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-indigo-700"
        >
          <UserPlus className="h-5 w-5" />
          <span>スタッフを追加</span>
        </button>
      </div>

      {/* 凡例: 勤務日数 */}
      <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <Briefcase className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
        <p className="text-sm text-indigo-800">
          <strong>月の最低勤務日数</strong> は自動生成時に反映されます。
          0 に設定したスタッフは個別制約なしです。
        </p>
      </div>

      {/* 凡例: 夜勤 */}
      <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
        <Moon className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
        <p className="text-sm text-purple-800">
          <strong>月の夜勤上限回数</strong> を個別設定できます。
          0 の場合は全体設定を使用し、夜勤が2名以上必要な日は <strong>できるだけ男女ペア</strong> を優先します。
        </p>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-md">
          <UserPlus className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-xl font-semibold text-gray-800">
            スタッフが登録されていません
          </h3>
          <p className="mb-6 text-gray-600">
            「スタッフを追加」ボタンから登録しましょう
          </p>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-6 py-3 text-white shadow-md hover:bg-indigo-700"
          >
            <UserPlus className="h-5 w-5" />
            <span>スタッフを追加</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  '氏名',
                  '性別',
                  '職種',
                  '雇用形態',
                  '月の最低勤務日数',
                  '月の夜勤上限',
                  '資格',
                  '操作',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  {/* 氏名 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  </td>

                  {/* 性別 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${genderBadgeClass(
                        s.gender
                      )}`}
                    >
                      {s.gender ?? '未設定'}
                    </span>
                  </td>

                  {/* 職種 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      {s.position}
                    </span>
                  </td>

                  {/* 雇用形態 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        s.employmentType === '常勤'
                          ? 'bg-green-100 text-green-800'
                          : s.employmentType === '非常勤'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {s.employmentType}
                    </span>
                  </td>

                  {/* 最低勤務日数 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    {(s.minWorkDaysPerMonth ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                        <Briefcase className="h-3 w-3" />
                        月 {s.minWorkDaysPerMonth} 日以上
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">制約なし</span>
                    )}
                  </td>

                  {/* 夜勤上限 */}
                  <td className="whitespace-nowrap px-4 py-4">
                    {(s.maxNightShiftsPerMonth ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                        <Moon className="h-3 w-3" />
                        月 {s.maxNightShiftsPerMonth} 回まで
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">全体設定を使用</span>
                    )}
                  </td>

                  {/* 資格 */}
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {(s.qualifications ?? []).length > 0 ? (
                        s.qualifications.join(', ')
                      ) : (
                        <span className="text-gray-400">なし</span>
                      )}
                    </div>
                  </td>

                  {/* 操作 */}
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <button
                      onClick={() => handleEdit(s)}
                      className="mr-3 rounded p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-900"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* サマリー */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <span className="font-medium">男性:</span>
                <span>{maleCount}名</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">女性:</span>
                <span>{femaleCount}名</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">その他:</span>
                <span>{otherGenderCount}名</span>
              </div>
              <div className="flex items-center gap-1 text-indigo-600">
                <span className="font-medium">最低勤務日数設定:</span>
                <span>{minWorkSetCount}名</span>
              </div>
              <div className="flex items-center gap-1 text-purple-600">
                <span className="font-medium">夜勤上限設定:</span>
                <span>{nightLimitSetCount}名</span>
              </div>
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
