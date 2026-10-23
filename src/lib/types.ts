export type Priority = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'done';

export type CategoryId = 'work' | 'study' | 'life' | 'health' | 'other';

export interface Task {
  id: string;
  title: string;
  note?: string;
  category: CategoryId;
  priority: Priority;
  /** 'YYYY-MM-DD', empty when the task has no deadline */
  dueDate?: string;
  /** planned minutes, drives auto scheduling */
  estimateMin: number;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
}

/** A placed task (or free item) on a day's timeline. */
export interface Block {
  id: string;
  date: string;
  /** minutes from midnight, 0-1439 */
  startMin: number;
  durationMin: number;
  title: string;
  category: CategoryId;
  /** bound task; completing the block does not complete the task */
  taskId?: string;
  done: boolean;
}

/** One finished or running focus interval. */
export interface FocusSession {
  id: string;
  taskId?: string;
  title: string;
  category: CategoryId;
  startedAt: number;
  /** wall-clock moment the phase was settled; may be long before the app woke up */
  endedAt?: number;
  plannedMin: number;
  /** completed minutes; 0 while running */
  actualMin: number;
  status: 'running' | 'done' | 'stopped';
}

export interface FocusTimer {
  phase: 'focus' | 'break';
  running: boolean;
  /** absolute deadline while running; all elapsed time is derived from it, never accumulated ticks */
  endAt: number;
  plannedMin: number;
  /** seconds left, meaningful while paused */
  remainingSec: number;
  startedAt: number;
  taskId?: string;
  title: string;
  category: CategoryId;
  /** finished focus rounds in this sitting */
  cycle: number;
}

/**
 * 'system' follows the OS; 'vivid' is the saturated daytime palette with the colorful
 * ambient wash, 'light' / 'dark' pin the plain palettes.
 */
export type Appearance = 'system' | 'vivid' | 'light' | 'dark';

export interface Settings {
  focusMin: number;
  breakMin: number;
  /** day planning window in minutes from midnight */
  dayStartMin: number;
  dayEndMin: number;
  notificationsEnabled: boolean;
  appearance: Appearance;
}

export type Filters = {
  tasks: 'all' | 'today' | 'overdue' | 'done';
};
