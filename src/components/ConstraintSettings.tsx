import { useEffect, useState, type ReactNode } from 'react';
import {
  Settings as SettingsIcon,
  Pencil,
  Save,
  Moon,
  Users,
  Calendar,
  Briefcase,
  RotateCcw,
  BedDouble,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { db } from '../db';
import type { ScheduleConstraints } from '../types';

type ConstraintFormState = {
  name: string;
  description: string;
  maxConsecutiveWorkDays: number;
  minRestDaysBetweenNights: number;
  minWorkDaysPerMonth: number;
  exactRestDaysPerMonth: number;
  restAfterAke: boolean;
  maxNightShiftsPerMonth: number;
  preferMixedGenderNightShift: boolean;
  sunHolidayDayStaffRequired: number;
};

const DEFAULT_FORM: ConstraintFormState = {
  name: '標準制約',
  description: '自動生成で使用する標準設定',
  maxConsecutiveWorkDays: 5,
  minRestDaysBetweenNights: 1,
  minWorkDaysPerMonth: 20,
  exactRestDaysPerMonth: 8,
  restAfterAke: true,
  maxNightShiftsPerMonth: 8,
  preferMixedGenderNightShift: true,
  sunHolidayDayStaffRequired: 3,
};

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toFormState(value?: Partial<ScheduleConstraints> | null): ConstraintFormState {
  return {
    name: String(value?.name ?? DEFAULT_FORM.name),
    description: String(value?.description ?? DEFAULT_FORM.description),
    maxConsecutiveWorkDays: safeNumber(
      value?.maxConsecutiveWorkDays,
      DEFAULT_FORM.maxConsecutiveWorkDays
    ),
    minRestDaysBetweenNights: safeNumber(
      value?.minRestDaysBetweenNights,
      DEFAULT_FORM.minRestDaysBetweenNights
    ),
    minWorkDaysPerMonth: safeNumber(
      value?.minWorkDaysPerMonth,
      DEFAULT_FORM.minWorkDaysPerMonth
    ),
    exactRestDaysPerMonth: safeNumber(
      value?.exactRestDaysPerMonth,
      DEFAULT_FORM.exactRestDaysPerMonth
    ),
    restAfterAke:
      value?.restAfterAke === undefined
        ? DEFAULT_FORM.restAfterAke
        : Boolean(value.restAfterAke),
    maxNightShiftsPerMonth: safeNumber(
      value?.maxNightShiftsPerMonth,
      DEFAULT_FORM.maxNightShiftsPerMonth
    ),
    preferMixedGenderNightShift:
      value?.preferMixedGenderNightShift === undefined
        ? DEFAULT_FORM.preferMixedGenderNightShift
        : Boolean(value.preferMixedGenderNightShift),
    sunHolidayDayStaffRequired: safeNumber(
      value?.sunHolidayDayStaffRequired,
      DEFAULT_FORM.sunHolidayDayStaffRequired
    ),
  };
}

export function ConstraintSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentConstraint, setCurrentConstraint] = useState<ScheduleConstraints | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<ConstraintFormState>(DEFAULT_FORM);

  const loadConstraint = async () => {
    try {
      setLoading(true);
      const all = await db.constraints.toArray().catch(() => []);
      const latest = all.length > 0 ? all[all.length - 1] : null;

      if (latest) {
        setCurrentConstraint(latest);
        setFormData(toFormState(latest));
      } else {
        setCurrentConstraint(null);
        setFormData(DEFAULT_FORM);
      }
    } catch (error) {
      console.error('制約設定の読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConstraint();
  }, []);

  const openEdit = () => {
    setFormData(toFormState(currentConstraint));
    setIsFormOpen(true);
  };

  const openNew = () => {
    setFormData(DEFAULT_FORM);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
  };

  const handleResetDefault = () => {
    if (!window.confirm('入力中の内容を初期値に戻します。よろしいですか？')) return;
    setFormData(DEFAULT_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('設定名を入力してください');
      return;
    }

    if (formData.maxConsecutiveWorkDays < 1 || formData.maxConsecutiveWorkDays > 31) {
      alert('最大連続勤務日数は 1〜31 の範囲で入力してください');
      return;
    }

    if (formData.minRestDaysBetweenNights < 0 || formData.minRestDaysBetweenNights > 31) {
      alert('夜勤間隔は 0〜31 の範囲で入力してください');
      return;
    }

    if (formData.minWorkDaysPerMonth < 0 || formData.minWorkDaysPerMonth > 31) {
      alert('最低勤務日数は 0〜31 の範囲で入力してください');
      return;
    }

    if (formData.exactRestDaysPerMonth < 0 || formData.exactRestDaysPerMonth > 31) {
      alert('月の休み固定日数は 0〜31 の範囲で入力してください');
      return;
    }

    if (formData.maxNightShiftsPerMonth < 0 || formData.maxNightShiftsPerMonth > 31) {
      alert('全体夜勤上限は 0〜31 の範囲で入力してください');
      return;
    }

    if (
      formData.sunHolidayDayStaffRequired < 0 ||
      formData.sunHolidayDayStaffRequired > 31
    ) {
      alert('日曜・祝日の必要日勤人数は 0〜31 の範囲で入力してください');
      return;
    }

    try {
      setSaving(true);

      const payload: ScheduleConstraints = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        maxConsecutiveWorkDays: formData.maxConsecutiveWorkDays,
        minRestDaysBetweenNights: formData.minRestDaysBetweenNights,
        minWorkDaysPerMonth: formData.minWorkDaysPerMonth,
        exactRestDaysPerMonth: formData.exactRestDaysPerMonth,
        restAfterAke: formData.restAfterAke,
        maxNightShiftsPerMonth: formData.maxNightShiftsPerMonth,
        preferMixedGenderNightShift: formData.preferMixedGenderNightShift,
        sunHolidayDayStaffRequired: formData.sunHolidayDayStaffRequired,
        createdAt: currentConstraint?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };

      // 最新1件のみ保持
      await db.transaction('rw', db.constraints, async () => {
        await db.constraints.clear();
        await db.constraints.add(payload as any);
      });

      await loadConstraint();
      setIsFormOpen(false);
      alert('制約設定を保存しました');
    } catch (error) {
      console.error('制約設定の保存に失敗しました:', error);
      alert('制約設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const active = currentConstraint ?? DEFAULT_FORM;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">制約設定</h3>
          <p className="mt-1 text-sm text-gray-600">
            自動生成で使用する現在の制約を管理します
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openNew}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            初期値で新規作成
          </button>
          <button
            onClick={openEdit}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-indigo-700"
          >
            <Pencil className="h-4 w-4" />
            編集する
          </button>
        </div>
      </div>

      {/* 説明 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <SettingsIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">この画面で保存した設定が自動生成に使用されます</p>
            <p className="mt-1">
              日勤専従設定・個別夜勤上限はスタッフ管理側で設定し、
              ここでは全体の基準ルールを設定します。
            </p>
          </div>
        </div>
      </div>

      {/* 現在の設定概要 */}
      <div className="rounded-lg border-2 border-green-300 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-bold text-gray-800">
            {String(active.name ?? '標準制約')}
          </h4>
          <Badge color="green">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            現在適用中
          </Badge>
        </div>

        {active.description ? (
          <p className="mb-5 text-sm text-gray-600">{String(active.description)}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            icon={<Briefcase className="h-4 w-4 text-indigo-600" />}
            label="最大連続勤務"
            value={`${safeNumber(active.maxConsecutiveWorkDays, 5)}日`}
            tone="indigo"
          />
          <InfoCard
            icon={<BedDouble className="h-4 w-4 text-sky-600" />}
            label="夜勤間隔"
            value={`${safeNumber(active.minRestDaysBetweenNights, 1)}日`}
            sub="前回夜勤からの最低日数"
            tone="sky"
          />
          <InfoCard
            icon={<Briefcase className="h-4 w-4 text-emerald-600" />}
            label="最低勤務日数"
            value={`${safeNumber(active.minWorkDaysPerMonth, 20)}日`}
            sub="個別設定がないスタッフに適用"
            tone="emerald"
          />
          <InfoCard
            icon={<Calendar className="h-4 w-4 text-orange-600" />}
            label="月の休み固定"
            value={
              safeNumber(active.exactRestDaysPerMonth, 0) > 0
                ? `${safeNumber(active.exactRestDaysPerMonth, 0)}日`
                : '無効'
            }
            sub="明け・有給を除く純休み"
            tone="orange"
          />
          <InfoCard
            icon={<Moon className="h-4 w-4 text-purple-600" />}
            label="全体夜勤上限"
            value={
              safeNumber(active.maxNightShiftsPerMonth, 0) > 0
                ? `${safeNumber(active.maxNightShiftsPerMonth, 0)}回`
                : '無効'
            }
            sub="個別設定がないスタッフに適用"
            tone="purple"
          />
          <InfoCard
            icon={<Users className="h-4 w-4 text-pink-600" />}
            label="男女ペア夜勤優先"
            value={active.preferMixedGenderNightShift !== false ? '有効' : '無効'}
            sub="夜勤2名以上の日に優先"
            tone="pink"
          />
          <InfoCard
            icon={<Moon className="h-4 w-4 text-cyan-600" />}
            label="明け翌日休み"
            value={active.restAfterAke !== false ? '有効' : '無効'}
            sub="明けの翌日を休みにしやすくする"
            tone="cyan"
          />
          <InfoCard
            icon={<Calendar className="h-4 w-4 text-rose-600" />}
            label="日曜・祝日日勤"
            value={`${safeNumber(active.sunHolidayDayStaffRequired, 3)}名`}
            sub="原則この人数を目標に割当"
            tone="rose"
          />
        </div>
      </div>

      {/* 補足説明 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NoteBox
          title="男女ペア夜勤優先"
          icon={<Users className="h-4 w-4 text-pink-600" />}
          tone="pink"
        >
          夜勤が2名以上必要な日に、夜勤可能スタッフの中からできるだけ
          男性・女性の組み合わせを優先します。候補不足時は同性ペアでも割り当てます。
        </NoteBox>

        <NoteBox
          title="全体夜勤上限"
          icon={<Moon className="h-4 w-4 text-purple-600" />}
          tone="purple"
        >
          スタッフ個別の夜勤上限が未設定のときに使う標準値です。
          日勤専従スタッフには適用されません。
        </NoteBox>

        <NoteBox
          title="明け翌日休み"
          icon={<Calendar className="h-4 w-4 text-cyan-600" />}
          tone="cyan"
        >
          夜勤 → 明け → 休み の流れを優先します。
          ただし、その日に本人希望や確定シフトがある場合はそちらを優先します。
        </NoteBox>

        <NoteBox
          title="月の休み固定"
          icon={<Calendar className="h-4 w-4 text-orange-600" />}
          tone="orange"
        >
          0 の場合は無効です。1 以上を指定すると、
          明け・有給を除いた純休み日数がちょうどその日数になるよう調整します。
        </NoteBox>

        <NoteBox
          title="日曜・祝日日勤人数"
          icon={<Calendar className="h-4 w-4 text-rose-600" />}
          tone="rose"
        >
          日曜と日本の祝日は、原則としてこの人数だけ日勤を割り当てます。
          希望シフトや他制約が競合した場合は警告を出しつつ調整されます。
        </NoteBox>
      </div>

      {/* フォームモーダル */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
                <h3 className="text-xl font-bold text-gray-800">制約設定を編集</h3>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-2xl text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6 px-6 py-5">
                <Section title="基本情報" color="indigo">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField
                      label="設定名"
                      required
                      value={formData.name}
                      onChange={(v) => setFormData((prev) => ({ ...prev, name: v }))}
                      placeholder="例: 標準制約"
                    />
                    <div>
                      <Label>説明</Label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                        placeholder="例: 夜勤バランス重視"
                      />
                    </div>
                  </div>
                </Section>

                <Section title="勤務制約" color="emerald">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <NumberField
                      label="最大連続勤務日数"
                      min={1}
                      max={31}
                      value={formData.maxConsecutiveWorkDays}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxConsecutiveWorkDays: v,
                        }))
                      }
                      hint="例: 5 → 6連勤を防ぐ"
                    />
                    <NumberField
                      label="夜勤間隔（日）"
                      min={0}
                      max={31}
                      value={formData.minRestDaysBetweenNights}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          minRestDaysBetweenNights: v,
                        }))
                      }
                      hint="前回夜勤から次の夜勤までの最低日数"
                    />
                    <NumberField
                      label="月の最低勤務日数"
                      min={0}
                      max={31}
                      value={formData.minWorkDaysPerMonth}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          minWorkDaysPerMonth: v,
                        }))
                      }
                      hint="個別設定がないスタッフの標準値"
                    />
                  </div>
                </Section>

                <Section title="夜勤制約" color="purple">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <NumberField
                      label="全体夜勤上限（回 / 月）"
                      min={0}
                      max={31}
                      value={formData.maxNightShiftsPerMonth}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxNightShiftsPerMonth: v,
                        }))
                      }
                      hint="0 にすると全体上限を無効化"
                    />

                    <CheckPanel
                      checked={formData.preferMixedGenderNightShift}
                      onChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          preferMixedGenderNightShift: checked,
                        }))
                      }
                      title="男女ペア夜勤優先を有効にする"
                      description="夜勤が2名以上必要な日に、可能なら男女混合ペアを優先します"
                      tone="pink"
                    />
                  </div>
                </Section>

                <Section title="明け・休み制約" color="cyan">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <CheckPanel
                      checked={formData.restAfterAke}
                      onChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          restAfterAke: checked,
                        }))
                      }
                      title="明け翌日休みを有効にする"
                      description="夜勤 → 明け → 休み の流れを優先します"
                      tone="cyan"
                    />

                    <NumberField
                      label="月の純休み固定日数"
                      min={0}
                      max={31}
                      value={formData.exactRestDaysPerMonth}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          exactRestDaysPerMonth: v,
                        }))
                      }
                      hint="0 = 無効 / 明け・有給を除いた純休み日数"
                    />
                  </div>
                </Section>

                <Section title="日曜・祝日の日勤体制" color="rose">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <NumberField
                      label="日曜・祝日の必要日勤人数"
                      min={0}
                      max={31}
                      value={formData.sunHolidayDayStaffRequired}
                      onChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          sunHolidayDayStaffRequired: v,
                        }))
                      }
                      hint="原則この人数だけ日勤を割り当てます（既定値: 3）"
                    />
                  </div>
                </Section>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                    <div className="text-sm text-amber-900">
                      <p className="font-semibold">運用上の注意</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>日勤専従の設定はスタッフ管理側で行います。</li>
                        <li>個別夜勤上限があるスタッフは、その値が全体夜勤上限より優先されます。</li>
                        <li>夜勤可能スタッフが不足している場合、希望どおりに埋まらず警告が出ます。</li>
                        <li>日曜・祝日の3名体制は「原則」です。希望や制約競合時は超過/不足警告が出ることがあります。</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-between border-t bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  初期値に戻す
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中...' : '保存する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── small UI parts ──────────────────────────────────────────

function Badge({
  children,
  color,
}: {
  children: ReactNode;
  color: 'green' | 'indigo' | 'purple' | 'pink' | 'orange' | 'cyan' | 'rose';
}) {
  const map = {
    green: 'bg-green-100 text-green-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
    pink: 'bg-pink-100 text-pink-800',
    orange: 'bg-orange-100 text-orange-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    rose: 'bg-rose-100 text-rose-800',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${map[color]}`}>
      {children}
    </span>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: 'indigo' | 'emerald' | 'purple' | 'cyan' | 'rose';
  children: ReactNode;
}) {
  const bar = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    purple: 'bg-purple-600',
    cyan: 'bg-cyan-600',
    rose: 'bg-rose-600',
  };

  return (
    <div className="space-y-3">
      <h4 className="flex items-center text-base font-semibold text-gray-800">
        <span className={`mr-2 h-5 w-1 rounded-full ${bar[color]}`} />
        {title}
      </h4>
      {children}
    </div>
  );
}

function Label({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
      />
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function CheckPanel({
  checked,
  onChange,
  title,
  description,
  tone,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  tone: 'pink' | 'cyan';
}) {
  const style =
    tone === 'pink'
      ? checked
        ? 'border-pink-300 bg-pink-50'
        : 'border-gray-200 bg-gray-50'
      : checked
      ? 'border-cyan-300 bg-cyan-50'
      : 'border-gray-200 bg-gray-50';

  return (
    <label className={`block cursor-pointer rounded-lg border-2 p-4 transition-all ${style}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded"
        />
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="mt-1 text-xs text-gray-600">{description}</p>
        </div>
      </div>
    </label>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone:
    | 'indigo'
    | 'sky'
    | 'emerald'
    | 'orange'
    | 'purple'
    | 'pink'
    | 'cyan'
    | 'rose';
}) {
  const toneMap = {
    indigo: 'border-indigo-200 bg-indigo-50',
    sky: 'border-sky-200 bg-sky-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50',
    pink: 'border-pink-200 bg-pink-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    rose: 'border-rose-200 bg-rose-50',
  };

  return (
    <div className={`rounded-lg border p-4 ${toneMap[tone]}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium text-gray-700">{label}</p>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function NoteBox({
  title,
  icon,
  children,
  tone,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  tone: 'pink' | 'purple' | 'cyan' | 'orange' | 'rose';
}) {
  const toneMap = {
    pink: 'border-pink-200 bg-pink-50',
    purple: 'border-purple-200 bg-purple-50',
    cyan: 'border-cyan-200 bg-cyan-50',
    orange: 'border-orange-200 bg-orange-50',
    rose: 'border-rose-200 bg-rose-50',
  };

  return (
    <div className={`rounded-lg border p-4 ${toneMap[tone]}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h5 className="font-semibold text-gray-800">{title}</h5>
      </div>
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}
