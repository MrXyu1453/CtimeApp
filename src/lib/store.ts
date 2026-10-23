import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { todayKey } from './date';
import { autoSchedule, uid, unplacedTasks } from './schedule';
import type { Block, CategoryId, FocusSession, FocusTimer, Settings, Task } from './types';

export type NewTask = {
  title: string;
  note?: string;
  category: CategoryId;
  priority: Task['priority'];
  dueDate?: string;
  estimateMin: number;
};

interface State {
  hydrated: boolean;
  tasks: Task[];
  blocks: Block[];
  sessions: FocusSession[];
  settings: Settings;
  timer: FocusTimer;
  selectedDate: string;

  addTask: (input: NewTask) => Task;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addBlock: (input: Omit<Block, 'id' | 'done'> & { done?: boolean }) => Block;
  updateBlock: (id: string, patch: Partial<Omit<Block, 'id'>>) => void;
  deleteBlock: (id: string) => void;
  toggleBlock: (id: string) => void;
  planDay: (date: string, floorMin?: number) => number;
  clearDay: (date: string) => void;

  startFocus: (opts: { taskId?: string; title: string; category: CategoryId; minutes: number }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  completePhase: () => void;
  /** Rolls an expired phase forward from its real deadline, even if the app slept through it. */
  settleTimer: () => void;

  setSelectedDate: (date: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  breakMin: 5,
  dayStartMin: 8 * 60,
  dayEndMin: 22 * 60,
  notificationsEnabled: true,
  appearance: 'vivid',
};

const idleTimer = (settings: Settings): FocusTimer => ({
  phase: 'focus',
  running: false,
  endAt: 0,
  plannedMin: settings.focusMin,
  remainingSec: settings.focusMin * 60,
  startedAt: 0,
  title: '',
  category: 'work',
  cycle: 0,
});

export function remainingMs(timer: FocusTimer, now = Date.now()): number {
  if (!timer.running) return Math.max(0, timer.remainingSec * 1000);
  return Math.max(0, timer.endAt - now);
}

/** Ceil so a countdown only shows 00:00 once the phase is actually over. */
export function remainingSec(timer: FocusTimer, now = Date.now()): number {
  return Math.ceil(remainingMs(timer, now) / 1000);
}

/** Time already spent in the current phase, derived so backgrounding cannot drift it. */
export function spentSec(timer: FocusTimer, now = Date.now()): number {
  return Math.max(0, Math.round((timer.plannedMin * 60_000 - remainingMs(timer, now)) / 1000));
}

function sessionFrom(
  timer: FocusTimer,
  status: FocusSession['status'],
  actualMin: number,
  endedAt = Date.now(),
): FocusSession {
  return {
    id: uid('ses'),
    taskId: timer.taskId,
    title: timer.title || '自由专注',
    category: timer.category,
    startedAt: timer.startedAt || endedAt,
    endedAt,
    plannedMin: timer.plannedMin,
    actualMin,
    status,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      tasks: [],
      blocks: [],
      sessions: [],
      settings: DEFAULT_SETTINGS,
      timer: idleTimer(DEFAULT_SETTINGS),
      selectedDate: todayKey(),

      addTask: (input) => {
        const task: Task = { ...input, id: uid('tsk'), status: 'todo', createdAt: Date.now() };
        set({ tasks: [task, ...get().tasks] });
        return task;
      },

      updateTask: (id, patch) => {
        set({
          tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch, id } : t)),
          blocks:
            patch.title === undefined
              ? get().blocks
              : get().blocks.map((b) => (b.taskId === id ? { ...b, title: patch.title! } : b)),
        });
      },

      toggleTask: (id) => {
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: t.status === 'done' ? 'todo' : 'done',
                  completedAt: t.status === 'done' ? undefined : Date.now(),
                }
              : t,
          ),
        });
      },

      deleteTask: (id) => {
        set({
          tasks: get().tasks.filter((t) => t.id !== id),
          blocks: get().blocks.filter((b) => b.taskId !== id),
        });
      },

      addBlock: (input) => {
        const block: Block = { ...input, id: uid('blk'), done: input.done ?? false };
        set({ blocks: [...get().blocks, block] });
        return block;
      },

      updateBlock: (id, patch) =>
        set({ blocks: get().blocks.map((b) => (b.id === id ? { ...b, ...patch, id } : b)) }),

      deleteBlock: (id) => set({ blocks: get().blocks.filter((b) => b.id !== id) }),

      toggleBlock: (id) =>
        set({ blocks: get().blocks.map((b) => (b.id === id ? { ...b, done: !b.done } : b)) }),

      planDay: (date, floorMin) => {
        const { tasks, blocks, settings } = get();
        const created = autoSchedule(date, tasks, blocks.filter((b) => b.date === date), settings, floorMin);
        if (created.length) set({ blocks: [...blocks, ...created] });
        return created.length;
      },

      clearDay: (date) => set({ blocks: get().blocks.filter((b) => b.date !== date) }),

      startFocus: ({ taskId, title, category, minutes }) => {
        const now = Date.now();
        set({
          timer: {
            phase: 'focus',
            running: true,
            endAt: now + minutes * 60_000,
            plannedMin: minutes,
            remainingSec: minutes * 60,
            startedAt: now,
            taskId,
            title,
            category,
            cycle: get().timer.cycle,
          },
        });
      },

      pauseFocus: () => {
        const before = get().timer;
        if (!before.running) return;
        // A deadline can pass between the last tick and the tap; settle instead of pausing at 00:00.
        get().settleTimer();
        if (get().timer !== before) return;
        set({ timer: { ...before, running: false, remainingSec: remainingSec(before) } });
      },

      resumeFocus: () => {
        const timer = get().timer;
        if (timer.running) return;
        const left = remainingSec(timer);
        if (left <= 0) return;
        set({ timer: { ...timer, running: true, endAt: Date.now() + left * 1000 } });
      },

      stopFocus: () => {
        const before = get().timer;
        get().settleTimer();
        // Already rolled into the next phase: touching it now would double-book the round.
        if (get().timer !== before) return;
        const minutes = Math.floor(spentSec(before) / 60);
        const sessions =
          before.phase === 'focus' && minutes >= 1
            ? [...get().sessions, sessionFrom(before, 'stopped', minutes)]
            : get().sessions;
        set({ sessions, timer: { ...idleTimer(get().settings), cycle: before.cycle } });
      },

      completePhase: () => {
        const before = get().timer;
        get().settleTimer();
        if (get().timer !== before || before.startedAt === 0) return;
        const settings = get().settings;
        if (before.phase === 'focus') {
          const now = Date.now();
          set({
            sessions: [...get().sessions, sessionFrom(before, 'done', before.plannedMin, now)],
            timer: {
              phase: 'break',
              running: true,
              endAt: now + settings.breakMin * 60_000,
              plannedMin: settings.breakMin,
              remainingSec: settings.breakMin * 60,
              startedAt: now,
              taskId: before.taskId,
              title: before.title,
              category: before.category,
              cycle: before.cycle + 1,
            },
          });
          return;
        }
        set({ timer: { ...idleTimer(settings), cycle: before.cycle } });
      },

      settleTimer: () => {
        const timer = get().timer;
        if (!timer.running) return;
        const now = Date.now();
        if (now < timer.endAt) return;
        const settings = get().settings;
        const endedAt = timer.endAt;

        if (timer.phase === 'focus') {
          const session = sessionFrom(timer, 'done', timer.plannedMin, endedAt);
          const breakEndAt = endedAt + settings.breakMin * 60_000;
          if (now < breakEndAt) {
            set({
              sessions: [...get().sessions, session],
              timer: {
                phase: 'break',
                running: true,
                endAt: breakEndAt,
                plannedMin: settings.breakMin,
                remainingSec: Math.ceil((breakEndAt - now) / 1000),
                // The break started when focus actually ended, not when the app woke up.
                startedAt: endedAt,
                taskId: timer.taskId,
                title: timer.title,
                category: timer.category,
                cycle: timer.cycle + 1,
              },
            });
          } else {
            // The whole break elapsed while the app was away; nothing is left to run.
            set({ sessions: [...get().sessions, session], timer: { ...idleTimer(settings), cycle: timer.cycle + 1 } });
          }
          return;
        }

        set({ timer: { ...idleTimer(settings), cycle: timer.cycle } });
      },

      setSelectedDate: (date) => set({ selectedDate: date }),

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch };
        const timer = get().timer;
        // A started phase keeps its own length; only an untouched timer follows the setting.
        set({
          settings,
          timer:
            timer.startedAt === 0
              ? { ...timer, plannedMin: settings.focusMin, remainingSec: settings.focusMin * 60 }
              : timer,
        });
      },

      resetAll: () =>
        set({
          tasks: [],
          blocks: [],
          sessions: [],
          settings: DEFAULT_SETTINGS,
          timer: idleTimer(DEFAULT_SETTINGS),
          selectedDate: todayKey(),
        }),
    }),
    {
      name: 'ctime-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        blocks: state.blocks,
        sessions: state.sessions,
        settings: state.settings,
        timer: state.timer,
        selectedDate: state.selectedDate,
      }),
      // A shallow merge would drop settings keys added after a version was persisted.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...saved,
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        };
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

export function blocksOn(blocks: Block[], date: string): Block[] {
  return blocks.filter((b) => b.date === date).sort((a, b) => a.startMin - b.startMin);
}

export function openTasksUnplaced(state: { tasks: Task[]; blocks: Block[] }, date: string): Task[] {
  return unplacedTasks(state.tasks, blocksOn(state.blocks, date));
}
