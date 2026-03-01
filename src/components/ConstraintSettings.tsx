// src/components/ConstraintSettings.tsx
import { useState, useEffect } from 'react';
import {
  AlertCircle, CheckCircle, Settings as SettingsIcon,
  Plus, Pencil, Trash2, Moon, Calendar
} from 'lucide-react';
import { db } from '../db';
import type { ScheduleConstraints, ConstraintsFormData } from '../types';

const DEFAULT_FORM: ConstraintsFormData = {
  name: '',
  description: '',
  maxConsecutiveWorkDays: 5,
  maxConsecutiveNightShifts: 2,
  nightShiftNextDayOff: true,
  minRestDaysPerWeek: 2,
  minRestDaysPerMonth: 8,
  exactRestDaysPerMonth: 0,    // ★NEW 0=無効
  maxNightShiftsPerWeek: 2,
  maxNightShiftsPerMonth: 8,
  maxWorkHoursPerWeek: 40,
  maxWorkHoursPerMonth: 160,
  isActive: true,
  priority: 5,
};

export function ConstraintSettings() {
  const [constraints, setConstraints] = useState<ScheduleConstraints[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<ScheduleConstraints | null>(null);
  const [formData, setFormData] = useState<ConstraintsFormData>(DEFAULT_FORM);

  const load = async () => {
    try {
      setLoading(true);
      const all = await db.scheduleConstraints.toArray();
      all.sort((a, b) => b.priority - a.priority);
      setConstraints(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAddNew = () => {
    setEditingConstraint(null);
    setFormData(DEFAULT_FORM);
    setIsFormOpen(true);
  };

  const handleEdit = (c: ScheduleConstraints) => {
    setEditingConstraint(c);
    setFormData({
      name: c.name,
      description: c.description,
      maxConsecutiveWorkDays: c.maxConsecutiveWorkDays,
      maxConsecutiveNightShifts: c.maxConsecutiveNightShifts,
      nightShiftNextDayOff: c.nightShiftNextDayOff ?? true,
      minRestDaysPerWeek: c.minRestDaysPerWeek,
      minRestDaysPerMonth: c.minRestDaysPerMonth,
      exactRestDaysPerMonth: c.exactRestDaysPerMonth ?? 0,   // ★NEW
      maxNightShiftsPerWeek: c.maxNightShiftsPerWeek,
      maxNightShiftsPerMonth: c.maxNightShiftsPerMonth,
      maxWorkHoursPerWeek: c.maxWorkHoursPerWeek,
      maxWorkHoursPerMonth: c.maxWorkHoursPerMonth,
      isActive: c.isActive,
      priority: c.priority,
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => { setIsFormOpen(false); setEditingConstraint(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('制約名を入力してください'); return; }
    try {
      if (editingConstraint) {
        await db.scheduleConstraints.update(editingConstraint.id, { ...formData, updatedAt: new Date() });
      } else {
        await db.scheduleConstraints.add({
          id: crypto.randomUUID(), ...formData,
          createdAt: new Date(), updatedAt: new Date(),
        });
      }
      await load();
      handleCloseForm();
    } catch (e) { console.error(e); alert('保存に失敗しました'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`「${name}」を削除してもよろしいですか？`)) return;
    try { await db.scheduleConstraints.delete(id); await load(); } catch (e) { console.error(e); }
  };

  const toggleActive = async (c: ScheduleConstraints) => {
    try {
      await db.scheduleConstraints.update(c.id, { isActive: !c.isActive, updatedAt: new Date() });
      await load();
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">スケジュール制約条件</h3>
          <p className="text-sm text-gray-600 mt-1">自動スケジュール生成時に適用される制約条件を管理します</p>
        </div>
        <button onClick={handleAddNew}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
          <Plus className="w-5 h-5" /><span>新しい制約を追加</span>
        </button>
      </div>

      {/* シフト区分説明 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />シフト区分について
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { color: 'bg-blue-100 text-blue-800', label: '勤務', desc: '日勤・夜勤など、休み日数カウント対象外' },
            { color: 'bg-gray-100 text-gray-800', label: '休み', desc: '純粋な休日。exactRestDaysPerMonthのカウント対象' },
            { color: 'bg-purple-100 text-purple-800', label: '明け', desc: '夜勤翌日。休みカウント対象外' },
            { color: 'bg-green-100 text-green-800', label: '有給', desc: '有給休暇。休みカウント対象外' },
          ].map(item => (
            <div key={item.label} className={`p-2 rounded ${item.color}`}>
              <p className="font-bold">{item.label}</p>
              <p className="text-xs mt-1 opacity-80">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 制約一覧 */}
      {constraints.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <SettingsIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-800 mb-2">制約条件が登録されていません</h4>
          <p className="text-gray-600 mb-6">「新しい制約を追加」ボタンから制約条件を登録しましょう</p>
        </div>
      ) : (
        <div className="space-y-4">
          {constraints.map(c => (
            <div key={c.id}
              className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${c.isActive ? 'border-green-400' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="text-lg font-bold text-gray-800">{c.name}</h4>
                    {c.isActive
                      ? <Badge color="green"><CheckCircle className="w-3 h-3 mr-1" />有効</Badge>
                      : <Badge color="gray">無効</Badge>}
                    <Badge color="indigo">優先度: {c.priority}</Badge>
                    {c.nightShiftNextDayOff && <Badge color="purple"><Moon className="w-3 h-3 mr-1" />夜勤翌日=明け</Badge>}
                    {c.exactRestDaysPerMonth > 0 && <Badge color="orange">月休み{c.exactRestDaysPerMonth}日固定</Badge>}
                  </div>
                  <p className="text-sm text-gray-600">{c.description}</p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button onClick={() => toggleActive(c)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${c.isActive ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                    {c.isActive ? '無効化' : '有効化'}
                  </button>
                  <button onClick={() => handleEdit(c)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-5 h-5" /></button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <IC label="最大連続勤務" value={`${c.maxConsecutiveWorkDays}日`} />
                <IC label="最大連続夜勤" value={`${c.maxConsecutiveNightShifts}日`} />
                <IC label="週最低休日" value={`${c.minRestDaysPerWeek}日`} />
                <IC label="月最低休日（純）" value={`${c.minRestDaysPerMonth}日`} />
                <IC label="月休日（固定）" value={c.exactRestDaysPerMonth > 0 ? `${c.exactRestDaysPerMonth}日` : '無効'} highlight={c.exactRestDaysPerMonth > 0} />
                <IC label="週最大夜勤" value={`${c.maxNightShiftsPerWeek}回`} />
                <IC label="月最大夜勤" value={`${c.maxNightShiftsPerMonth}回`} />
                <IC label="週最大勤務時間" value={`${c.maxWorkHoursPerWeek}h`} />
                <IC label="月最大勤務時間" value={`${c.maxWorkHoursPerMonth}h`} />
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
              <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingConstraint ? '制約条件を編集' : '新しい制約条件を追加'}
                </h3>
                <button type="button" onClick={handleCloseForm} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
              </div>

              <div className="px-6 py-4 space-y-6">

                {/* 基本情報 */}
                <Sec color="indigo" title="基本情報">
                  <Lbl required>制約名</Lbl>
                  <input type="text" value={formData.name} required
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="例: 標準制約（常勤看護師）" />
                  <div className="mt-3">
                    <Lbl>説明</Lbl>
                    <textarea value={formData.description} rows={3}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="この制約条件の説明" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <Nf label="優先度（1〜10）" min={1} max={10} value={formData.priority}
                      onChange={v => setFormData({ ...formData, priority: v })} hint="大きいほど優先" />
                    <div>
                      <Lbl>状態</Lbl>
                      <Cbf checked={formData.isActive} label="この制約を有効にする"
                        onChange={v => setFormData({ ...formData, isActive: v })} />
                    </div>
                  </div>
                </Sec>

                {/* 連続勤務制約 */}
                <Sec color="green" title="連続勤務制約">
                  <div className="grid grid-cols-2 gap-4">
                    <Nf label="最大連続勤務日数" min={1} max={14}
                      value={formData.maxConsecutiveWorkDays}
                      onChange={v => setFormData({ ...formData, maxConsecutiveWorkDays: v })}
                      hint="例: 3 → 4日連続は不可" />
                    <Nf label="最大連続夜勤回数" min={0} max={7}
                      value={formData.maxConsecutiveNightShifts}
                      onChange={v => setFormData({ ...formData, maxConsecutiveNightShifts: v })} />
                  </div>
                </Sec>

                {/* 夜勤制約 */}
                <Sec color="purple" title="夜勤制約">
                  {/* 夜勤翌日=明け */}
                  <div onClick={() => setFormData({ ...formData, nightShiftNextDayOff: !formData.nightShiftNextDayOff })}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${formData.nightShiftNextDayOff ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex items-center space-x-3">
                      <input type="checkbox" checked={formData.nightShiftNextDayOff}
                        onChange={e => setFormData({ ...formData, nightShiftNextDayOff: e.target.checked })}
                        className="w-5 h-5 text-purple-600 rounded" onClick={e => e.stopPropagation()} />
                      <div>
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                          <Moon className="w-4 h-4 text-purple-600" />
                          夜勤の翌日を「明け」として自動割り当て
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          夜勤翌日に「明け」シフトを自動付与します。明けは<strong>休み日数のカウント対象外</strong>です。
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Nf label="週あたりの最大夜勤回数" min={0} max={7}
                      value={formData.maxNightShiftsPerWeek}
                      onChange={v => setFormData({ ...formData, maxNightShiftsPerWeek: v })} />
                    <Nf label="月あたりの最大夜勤回数" min={0} max={31}
                      value={formData.maxNightShiftsPerMonth}
                      onChange={v => setFormData({ ...formData, maxNightShiftsPerMonth: v })} />
                  </div>
                </Sec>

                {/* ★NEW 休日制約 */}
                <Sec color="blue" title="休日制約（明け・有給はカウント対象外）">
                  <div className="grid grid-cols-2 gap-4">
                    <Nf label="週あたりの最低休日数（純休み）" min={0} max={7}
                      value={formData.minRestDaysPerWeek}
                      onChange={v => setFormData({ ...formData, minRestDaysPerWeek: v })} />
                    <Nf label="月あたりの最低休日数（純休み）" min={0} max={31}
                      value={formData.minRestDaysPerMonth}
                      onChange={v => setFormData({ ...formData, minRestDaysPerMonth: v })} />
                  </div>

                  {/* ★NEW 月の休み日数を固定値にする */}
                  <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                    <p className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />月の純休み日数を固定する
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      0 にすると無効（最低休日数のみ適用）。1以上にすると、明け・有給を除いた「純休み」がぴったりN日になるよう調整します。
                    </p>
                    <div className="flex items-center gap-3">
                      <Nf label="月の純休み日数（0=無効）" min={0} max={31}
                        value={formData.exactRestDaysPerMonth}
                        onChange={v => setFormData({ ...formData, exactRestDaysPerMonth: v })} />
                      {formData.exactRestDaysPerMonth > 0 && (
                        <div className="mt-5 px-3 py-2 bg-orange-100 rounded-lg text-sm text-orange-800 font-medium whitespace-nowrap">
                          毎月ちょうど {formData.exactRestDaysPerMonth} 日休み
                        </div>
                      )}
                    </div>
                  </div>
                </Sec>

                {/* 勤務時間制約 */}
                <Sec color="orange" title="勤務時間制約">
                  <div className="grid grid-cols-2 gap-4">
                    <Nf label="週あたりの最大勤務時間" min={0} max={168}
                      value={formData.maxWorkHoursPerWeek}
                      onChange={v => setFormData({ ...formData, maxWorkHoursPerWeek: v })} hint="単位: 時間" />
                    <Nf label="月あたりの最大勤務時間" min={0} max={744}
                      value={formData.maxWorkHoursPerMonth}
                      onChange={v => setFormData({ ...formData, maxWorkHoursPerMonth: v })} hint="単位: 時間" />
                  </div>
                </Sec>
              </div>

              <div className="px-6 py-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white">
                <button type="button" onClick={handleCloseForm}
                  className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">キャンセル</button>
                <button type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
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

// ─── 小UIパーツ ──────────────────────────────────────────────────
function IC({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded ${highlight ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
      <p className="text-gray-600 text-xs mb-1">{label}</p>
      <p className={`font-bold text-sm ${highlight ? 'text-orange-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    green:  'bg-green-100 text-green-800',
    gray:   'bg-gray-100 text-gray-600',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center ${cls[color] ?? ''}`}>{children}</span>;
}
function Sec({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  const bar: Record<string, string> = { indigo: 'bg-indigo-600', green: 'bg-green-600', purple: 'bg-purple-600', blue: 'bg-blue-600', orange: 'bg-orange-600' };
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-800 flex items-center">
        <span className={`w-1 h-5 ${bar[color] ?? 'bg-gray-600'} rounded-full mr-2`} />{title}
      </h4>
      {children}
    </div>
  );
}
function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}{required && <span className="text-red-500 ml-1">*</span>}</label>;
}
function Nf({ label, min, max, value, onChange, hint }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
function Cbf({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center space-x-2 mt-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
