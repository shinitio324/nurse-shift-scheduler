import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Settings as SettingsIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { db } from '../db';
import type { ScheduleConstraints, ConstraintsFormData } from '../types';

export function ConstraintSettings() {
  const [constraints, setConstraints] = useState<ScheduleConstraints[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<ScheduleConstraints | null>(null);

  const [formData, setFormData] = useState<ConstraintsFormData>({
    name: '',
    description: '',
    maxConsecutiveWorkDays: 5,
    maxConsecutiveNightShifts: 2,
    minRestDaysPerWeek: 2,
    minRestDaysPerMonth: 8,
    maxNightShiftsPerWeek: 2,
    maxNightShiftsPerMonth: 8,
    maxWorkHoursPerWeek: 40,
    maxWorkHoursPerMonth: 160,
    isActive: true,
    priority: 5,
  });

  /**
   * 制約条件を読み込み
   */
  const loadConstraints = async () => {
    try {
      setLoading(true);
      const allConstraints = await db.scheduleConstraints.toArray();
      // 優先度の高い順にソート
      allConstraints.sort((a, b) => b.priority - a.priority);
      setConstraints(allConstraints);
    } catch (error) {
      console.error('制約条件の読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConstraints();
  }, []);

  /**
   * フォームを開く（新規作成）
   */
  const handleAddNew = () => {
    setEditingConstraint(null);
    setFormData({
      name: '',
      description: '',
      maxConsecutiveWorkDays: 5,
      maxConsecutiveNightShifts: 2,
      minRestDaysPerWeek: 2,
      minRestDaysPerMonth: 8,
      maxNightShiftsPerWeek: 2,
      maxNightShiftsPerMonth: 8,
      maxWorkHoursPerWeek: 40,
      maxWorkHoursPerMonth: 160,
      isActive: true,
      priority: 5,
    });
    setIsFormOpen(true);
  };

  /**
   * フォームを開く（編集）
   */
  const handleEdit = (constraint: ScheduleConstraints) => {
    setEditingConstraint(constraint);
    setFormData({
      name: constraint.name,
      description: constraint.description,
      maxConsecutiveWorkDays: constraint.maxConsecutiveWorkDays,
      maxConsecutiveNightShifts: constraint.maxConsecutiveNightShifts,
      minRestDaysPerWeek: constraint.minRestDaysPerWeek,
      minRestDaysPerMonth: constraint.minRestDaysPerMonth,
      maxNightShiftsPerWeek: constraint.maxNightShiftsPerWeek,
      maxNightShiftsPerMonth: constraint.maxNightShiftsPerMonth,
      maxWorkHoursPerWeek: constraint.maxWorkHoursPerWeek,
      maxWorkHoursPerMonth: constraint.maxWorkHoursPerMonth,
      isActive: constraint.isActive,
      priority: constraint.priority,
    });
    setIsFormOpen(true);
  };

  /**
   * フォームを閉じる
   */
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingConstraint(null);
  };

  /**
   * フォーム送信
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!formData.name.trim()) {
      alert('制約名を入力してください');
      return;
    }

    try {
      if (editingConstraint) {
        // 更新
        await db.scheduleConstraints.update(editingConstraint.id, {
          ...formData,
          updatedAt: new Date(),
        });
        console.log('制約条件を更新しました');
      } else {
        // 新規作成
        const newConstraint: ScheduleConstraints = {
          id: crypto.randomUUID(),
          ...formData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.scheduleConstraints.add(newConstraint);
        console.log('制約条件を追加しました');
      }

      await loadConstraints();
      handleCloseForm();
    } catch (error) {
      console.error('制約条件の保存に失敗しました:', error);
      alert('制約条件の保存に失敗しました');
    }
  };

  /**
   * 削除
   */
  const handleDelete = async (id: string, name: string) => {
    const confirmDelete = window.confirm(
      `制約条件「${name}」を削除してもよろしいですか？`
    );

    if (confirmDelete) {
      try {
        await db.scheduleConstraints.delete(id);
        await loadConstraints();
        console.log('制約条件を削除しました');
      } catch (error) {
        console.error('制約条件の削除に失敗しました:', error);
        alert('制約条件の削除に失敗しました');
      }
    }
  };

  /**
   * 有効/無効を切り替え
   */
  const toggleActive = async (constraint: ScheduleConstraints) => {
    try {
      await db.scheduleConstraints.update(constraint.id, {
        isActive: !constraint.isActive,
        updatedAt: new Date(),
      });
      await loadConstraints();
    } catch (error) {
      console.error('制約条件の切り替えに失敗しました:', error);
    }
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
          <h3 className="text-xl font-bold text-gray-800">スケジュール制約条件</h3>
          <p className="text-sm text-gray-600 mt-1">
            自動スケジュール生成時に適用される制約条件を管理します
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span>新しい制約を追加</span>
        </button>
      </div>

      {/* 注意事項 */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              <strong>制約条件について:</strong> 自動スケジュール生成時、有効な制約条件が適用されます。
              優先度が高い制約ほど優先的に守られます。Phase 3-3で自動生成機能が実装されます。
            </p>
          </div>
        </div>
      </div>

      {/* 制約条件リスト */}
      {constraints.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <SettingsIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-800 mb-2">
            制約条件が登録されていません
          </h4>
          <p className="text-gray-600 mb-6">
            「新しい制約を追加」ボタンから制約条件を登録しましょう
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {constraints.map((constraint) => (
            <div
              key={constraint.id}
              className={`
                bg-white rounded-lg shadow-md p-6 border-2 transition-all
                ${constraint.isActive ? 'border-green-400' : 'border-gray-200'}
              `}
            >
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-bold text-gray-800">
                      {constraint.name}
                    </h4>
                    {constraint.isActive ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>有効</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                        無効
                      </span>
                    )}
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">
                      優先度: {constraint.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{constraint.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleActive(constraint)}
                    className={`
                      px-3 py-1 rounded-lg text-sm font-medium transition-colors
                      ${constraint.isActive 
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                        : 'bg-green-500 text-white hover:bg-green-600'
                      }
                    `}
                  >
                    {constraint.isActive ? '無効化' : '有効化'}
                  </button>
                  <button
                    onClick={() => handleEdit(constraint)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(constraint.id, constraint.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 制約詳細 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">最大連続勤務</p>
                  <p className="font-bold text-gray-800">{constraint.maxConsecutiveWorkDays}日</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">最大連続夜勤</p>
                  <p className="font-bold text-gray-800">{constraint.maxConsecutiveNightShifts}日</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">週の最低休日</p>
                  <p className="font-bold text-gray-800">{constraint.minRestDaysPerWeek}日</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">月の最低休日</p>
                  <p className="font-bold text-gray-800">{constraint.minRestDaysPerMonth}日</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">週の最大夜勤</p>
                  <p className="font-bold text-gray-800">{constraint.maxNightShiftsPerWeek}回</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">月の最大夜勤</p>
                  <p className="font-bold text-gray-800">{constraint.maxNightShiftsPerMonth}回</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">週の最大勤務時間</p>
                  <p className="font-bold text-gray-800">{constraint.maxWorkHoursPerWeek}h</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">月の最大勤務時間</p>
                  <p className="font-bold text-gray-800">{constraint.maxWorkHoursPerMonth}h</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* フォームモーダル */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* モーダルヘッダー */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingConstraint ? '制約条件を編集' : '新しい制約条件を追加'}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {/* モーダルボディ */}
              <div className="px-6 py-4 space-y-6">
                {/* 基本情報 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center">
                    <span className="w-1 h-5 bg-indigo-600 rounded-full mr-2"></span>
                    基本情報
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      制約名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="例: 標準制約（常勤看護師）"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      説明
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                      placeholder="この制約条件についての説明を入力してください"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        優先度（1〜10）
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">数字が大きいほど優先されます</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        状態
                      </label>
                      <label className="flex items-center space-x-2 mt-2">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">この制約を有効にする</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 連続勤務制約 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center">
                    <span className="w-1 h-5 bg-green-600 rounded-full mr-2"></span>
                    連続勤務制約
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大連続勤務日数
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="14"
                        value={formData.maxConsecutiveWorkDays}
                        onChange={(e) => setFormData({ ...formData, maxConsecutiveWorkDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大連続夜勤回数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={formData.maxConsecutiveNightShifts}
                        onChange={(e) => setFormData({ ...formData, maxConsecutiveNightShifts: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 休日制約 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center">
                    <span className="w-1 h-5 bg-blue-600 rounded-full mr-2"></span>
                    休日制約
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        週あたりの最低休日数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={formData.minRestDaysPerWeek}
                        onChange={(e) => setFormData({ ...formData, minRestDaysPerWeek: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        月あたりの最低休日数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="31"
                        value={formData.minRestDaysPerMonth}
                        onChange={(e) => setFormData({ ...formData, minRestDaysPerMonth: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 夜勤制約 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center">
                    <span className="w-1 h-5 bg-purple-600 rounded-full mr-2"></span>
                    夜勤制約
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        週あたりの最大夜勤回数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={formData.maxNightShiftsPerWeek}
                        onChange={(e) => setFormData({ ...formData, maxNightShiftsPerWeek: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        月あたりの最大夜勤回数
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="31"
                        value={formData.maxNightShiftsPerMonth}
                        onChange={(e) => setFormData({ ...formData, maxNightShiftsPerMonth: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 勤務時間制約 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center">
                    <span className="w-1 h-5 bg-orange-600 rounded-full mr-2"></span>
                    勤務時間制約
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        週あたりの最大勤務時間
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="168"
                        value={formData.maxWorkHoursPerWeek}
                        onChange={(e) => setFormData({ ...formData, maxWorkHoursPerWeek: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        月あたりの最大勤務時間
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="744"
                        value={formData.maxWorkHoursPerMonth}
                        onChange={(e) => setFormData({ ...formData, maxWorkHoursPerMonth: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* モーダルフッター */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingConstraint ? '更新する' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
