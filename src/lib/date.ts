const pad = (n: number) => String(n).padStart(2, '0');

/** Local-calendar key, avoids UTC day-shift bugs. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = fromKey(b).getTime() - fromKey(a).getTime();
  return Math.round(ms / 86400000);
}

/** Week starts Monday. */
export function startOfWeek(key: string): string {
  const dow = (fromKey(key).getDay() + 6) % 7;
  return addDays(key, -dow);
}

export function weekDates(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthDates(key: string): string[] {
  const d = fromKey(key);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i + 1)}`);
}

/** Whole weeks that cover the month, so the grid starts on Monday and ends on Sunday. */
export function monthGrid(key: string): string[] {
  const dates = monthDates(key);
  const start = startOfWeek(dates[0]);
  const days = daysBetween(start, addDays(startOfWeek(dates[dates.length - 1]), 6)) + 1;
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function monthLabel(key: string): string {
  const d = fromKey(key);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

export function addMonths(key: string, n: number): string {
  const d = fromKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return dateKey(target);
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayLabel(key: string): string {
  return WEEKDAYS[fromKey(key).getDay()];
}

export function shortDateLabel(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function dayHeadline(key: string): string {
  const today = todayKey();
  const delta = daysBetween(today, key);
  if (delta === 0) return '今天';
  if (delta === 1) return '明天';
  if (delta === -1) return '昨天';
  return `${shortDateLabel(key)} ${weekdayLabel(key)}`;
}

export function dueLabel(key?: string): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  if (!key) return { text: '无截止', tone: 'normal' };
  const delta = daysBetween(todayKey(), key);
  if (delta < 0) return { text: `逾期 ${-delta} 天`, tone: 'overdue' };
  if (delta === 0) return { text: '今天到期', tone: 'soon' };
  if (delta === 1) return { text: '明天', tone: 'soon' };
  if (delta <= 7) return { text: `${delta} 天后`, tone: 'normal' };
  return { text: shortDateLabel(key), tone: 'normal' };
}

export function minToLabel(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, min));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function labelToMin(label: string): number {
  const [h, m] = label.split(':').map(Number);
  return Math.max(0, Math.min(24 * 60 - 1, (h || 0) * 60 + (m || 0)));
}

export function durationLabel(min: number): string {
  if (min <= 0) return '0 分钟';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} 分钟`;
  if (!m) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${pad(m)}:${pad(s % 60)}`;
}

export function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
