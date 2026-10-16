import { PRIORITY_MAP } from './catalog';
import { dateKey, daysBetween, todayKey } from './date';
import type { Block, CategoryId, FocusSession, Settings, Task } from './types';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface Interval {
  start: number;
  end: number;
}

function mergeBusy(blocks: Block[], window: Interval): Interval[] {
  const items = blocks
    .map((b) => ({
      start: Math.max(window.start, b.startMin),
      end: Math.min(window.end, b.startMin + b.durationMin),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (last && item.start <= last.end) {
      last.end = Math.max(last.end, item.end);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

function freeSlots(busy: Interval[], window: Interval): Interval[] {
  const slots: Interval[] = [];
  let cursor = window.start;
  for (const b of busy) {
    if (b.start > cursor) slots.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < window.end) slots.push({ start: cursor, end: window.end });
  return slots;
}

/** Open tasks that have no block on this day yet. */
export function unplacedTasks(tasks: Task[], blocksOnDay: Block[]): Task[] {
  const placed = new Set(blocksOnDay.map((b) => b.taskId).filter(Boolean) as string[]);
  return tasks.filter((t) => t.status === 'todo' && !placed.has(t.id));
}

/** Skipping estimated tasks keeps re-running the planner idempotent. */
export function plannableTasks(tasks: Task[], blocksOnDay: Block[]): Task[] {
  return unplacedTasks(tasks, blocksOnDay).filter((t) => t.estimateMin > 0);
}

function urgencyScore(t: Task): [number, number, number] {
  return [
    PRIORITY_MAP[t.priority].weight,
    t.dueDate ? daysBetween(todayKey(), t.dueDate) : 999,
    -t.estimateMin,
  ];
}

function compareUrgency(a: Task, b: Task): number {
  const [pa, da, ea] = urgencyScore(a);
  const [pb, db, eb] = urgencyScore(b);
  return pa - pb || da - db || ea - eb;
}

/**
 * Greedy first-fit: the most urgent tasks claim the earliest free slot of the day.
 * Returns the blocks to create; the caller persists them.
 */
export function autoSchedule(
  date: string,
  tasks: Task[],
  existing: Block[],
  settings: Settings,
  floorMin = settings.dayStartMin,
): Block[] {
  const window = { start: Math.max(settings.dayStartMin, floorMin), end: settings.dayEndMin };
  if (window.end - window.start < 15) return [];

  const slots = freeSlots(mergeBusy(existing, window), window);
  const candidates = plannableTasks(tasks, existing).sort(compareUrgency);
  const created: Block[] = [];

  for (const task of candidates) {
    const index = slots.findIndex((s) => s.end - s.start >= Math.min(task.estimateMin, 15));
    if (index === -1) break;
    const slot = slots[index];
    const duration = Math.min(task.estimateMin, slot.end - slot.start);
    created.push({
      id: uid('blk'),
      date,
      startMin: slot.start,
      durationMin: duration,
      title: task.title,
      category: task.category,
      taskId: task.id,
      done: false,
    });
    slot.start += duration;
    if (slot.end - slot.start < 15) slots.splice(index, 1);
  }

  return created;
}

export interface DayStat {
  date: string;
  focusMin: number;
  plannedMin: number;
  tasksDone: number;
}

export interface Summary {
  dates: string[];
  focusMin: number;
  plannedMin: number;
  sessions: number;
  tasksDone: number;
  tasksOpen: number;
  overdue: number;
  completionRate: number;
  byCategory: { category: CategoryId; min: number }[];
  byDay: DayStat[];
  busiestDay: DayStat | null;
}

export function buildSummary(
  dates: string[],
  tasks: Task[],
  blocks: Block[],
  sessions: FocusSession[],
): Summary {
  const range = new Set(dates);
  const focusByDay = new Map<string, number>();
  const categoryMin = new Map<CategoryId, number>();
  let focusMin = 0;
  let counted = 0;

  for (const s of sessions) {
    if (s.status === 'running' || s.actualMin <= 0) continue;
    const day = dateKey(new Date(s.startedAt));
    if (!range.has(day)) continue;
    focusByDay.set(day, (focusByDay.get(day) ?? 0) + s.actualMin);
    categoryMin.set(s.category, (categoryMin.get(s.category) ?? 0) + s.actualMin);
    focusMin += s.actualMin;
    counted += 1;
  }

  const blocksInRange = blocks.filter((b) => range.has(b.date));
  const plannedMin = blocksInRange.reduce((sum, b) => sum + b.durationMin, 0);

  const doneInRange = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && range.has(dateKey(new Date(t.completedAt))),
  );
  const overdue = tasks.filter(
    (t) => t.status === 'todo' && t.dueDate && daysBetween(t.dueDate, todayKey()) > 0,
  );
  const doneEver = tasks.filter((t) => t.status === 'done');

  const byDay: DayStat[] = dates.map((date) => ({
    date,
    focusMin: focusByDay.get(date) ?? 0,
    plannedMin: blocksInRange
      .filter((b) => b.date === date)
      .reduce((sum, b) => sum + b.durationMin, 0),
    tasksDone: doneInRange.filter((t) => t.completedAt && dateKey(new Date(t.completedAt)) === date)
      .length,
  }));

  const busiestDay = byDay.reduce<DayStat | null>(
    (best, d) => (d.focusMin > (best?.focusMin ?? 0) ? d : best),
    null,
  );

  return {
    dates,
    focusMin,
    plannedMin,
    sessions: counted,
    tasksDone: doneInRange.length,
    tasksOpen: tasks.filter((t) => t.status === 'todo').length,
    overdue: overdue.length,
    completionRate: tasks.length ? doneEver.length / tasks.length : 0,
    byCategory: [...categoryMin.entries()]
      .map(([category, min]) => ({ category, min }))
      .sort((a, b) => b.min - a.min),
    byDay,
    busiestDay,
  };
}
