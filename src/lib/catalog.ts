import type { CategoryId, Priority } from './types';

export const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: 'work', label: '工作', color: '#3B82F6' },
  { id: 'study', label: '学习', color: '#DB2777' },
  { id: 'life', label: '生活', color: '#F59E0B' },
  { id: 'health', label: '健康', color: '#10B981' },
  { id: 'other', label: '其他', color: '#94A3B8' },
];

export const CATEGORY_MAP: Record<CategoryId, (typeof CATEGORIES)[number]> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CategoryId, (typeof CATEGORIES)[number]>,
);

export const PRIORITIES: { id: Priority; label: string; color: string; weight: number }[] = [
  { id: 'high', label: '高', color: '#EF4444', weight: 0 },
  { id: 'medium', label: '中', color: '#F59E0B', weight: 1 },
  { id: 'low', label: '低', color: '#64748B', weight: 2 },
];

export const PRIORITY_MAP: Record<Priority, (typeof PRIORITIES)[number]> = PRIORITIES.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<Priority, (typeof PRIORITIES)[number]>,
);

export const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120];
