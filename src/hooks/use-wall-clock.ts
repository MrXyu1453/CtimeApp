import { useSyncExternalStore } from 'react';

let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A screen re-subscribing after sleep must not read a time frozen minutes ago.
  current = Date.now();
  timer ??= setInterval(tick, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function noopSubscribe() {
  return () => {};
}

function getSnapshot() {
  return current;
}

/**
 * Wall clock shared by every visible countdown. The interval only runs while at
 * least one screen passes `enabled`, so a backgrounded app or hidden tab costs nothing.
 */
export function useWallClock(enabled: boolean): number {
  return useSyncExternalStore(enabled ? subscribe : noopSubscribe, getSnapshot, getSnapshot);
}
