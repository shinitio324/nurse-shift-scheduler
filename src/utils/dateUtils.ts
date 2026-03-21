export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeDateString(input: string | Date): string {
  if (input instanceof Date) return formatLocalDate(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return formatLocalDate(new Date(input));
}

export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function getMonthStartDateString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function getMonthEndDateString(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function getWeekdayLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}

export function isWeekendDateString(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}
