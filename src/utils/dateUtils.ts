function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pad2(value: number | string): string {
  return String(value).padStart(2, '0');
}

export function normalizeDateString(value: unknown): string {
  const raw = safeString(value);

  if (!raw) return '';

  const directMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (directMatch) {
    const [, y, m, d] = directMatch;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return formatDate(date);
}

export function parseDateString(value: string): Date {
  const normalized = normalizeDateString(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date('') : date;
  }

  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function parseLocalDate(value: string): Date {
  return parseDateString(value);
}

export function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  return `${year}-${month}-${day}`;
}

export function compareDateStrings(a: string, b: string): number {
  const aa = normalizeDateString(a);
  const bb = normalizeDateString(b);

  if (aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

export function addDays(date: Date, amount: number): Date {
  const cloned = new Date(date.getTime());
  cloned.setDate(cloned.getDate() + amount);
  return cloned;
}

export function getDaysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return 0;
  }

  if (month < 1 || month > 12) {
    return 0;
  }

  return new Date(year, month, 0).getDate();
}

export function getMonthStartDateString(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

export function getMonthEndDateString(year: number, month: number): string {
  const lastDay = getDaysInMonth(year, month);
  return `${year}-${pad2(month)}-${pad2(lastDay)}`;
}

export function getMonthDates(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  if (days <= 0) return [];

  return Array.from({ length: days }, (_, index) => {
    return `${year}-${pad2(month)}-${pad2(index + 1)}`;
  });
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string
): boolean {
  const d = normalizeDateString(date);
  const start = normalizeDateString(startDate);
  const end = normalizeDateString(endDate);

  if (!d || !start || !end) return false;
  return d >= start && d <= end;
}

export function isSameMonth(
  date: string,
  year: number,
  month: number
): boolean {
  const normalized = normalizeDateString(date);
  if (!normalized) return false;

  const prefix = `${year}-${pad2(month)}`;
  return normalized.startsWith(prefix);
}

export function getYearMonth(
  date: string
): { year: number; month: number } | null {
  const normalized = normalizeDateString(date);
  const match = normalized.match(/^(\d{4})-(\d{2})-/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

export function getWeekdayLabel(value: string): string {
  const date = parseLocalDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const labels = ['日', '月', '火', '水', '木', '金', '土'];
  return labels[date.getDay()] ?? '';
}
