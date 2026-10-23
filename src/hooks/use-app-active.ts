import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribe(onChange: () => void) {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}

function getSnapshot() {
  const state = AppState.currentState;
  // iOS reports null before the first state event; treat it as awake rather than freezing the UI.
  return state == null || state === 'active';
}

function getServerSnapshot() {
  return true;
}

/** Whether the app is in the foreground; used to stop all countdown work while asleep. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
