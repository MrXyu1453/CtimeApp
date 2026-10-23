import { useEffect } from 'react';
import { AppState } from 'react-native';

import { successHaptic } from '@/lib/haptics';
import { cancelPhaseAlert, initNotifications, schedulePhaseAlert } from '@/lib/notifications';
import { useStore } from '@/lib/store';

/**
 * Global phase driver, mounted above the tabs. A phase must finish even when the
 * Focus screen was never opened, was unmounted, or the screen was off.
 */
export function useFocusEngine() {
  const hydrated = useStore((s) => s.hydrated);
  const running = useStore((s) => s.timer.running);
  const endAt = useStore((s) => s.timer.endAt);
  const phase = useStore((s) => s.timer.phase);
  const plannedMin = useStore((s) => s.timer.plannedMin);
  const settleTimer = useStore((s) => s.settleTimer);

  useEffect(() => {
    if (!hydrated) return;
    void initNotifications();
    settleTimer();
    const sub = AppState.addEventListener('change', (state) => {
      // Timers are frozen while backgrounded; the wall clock kept moving, so settle on wake.
      if (state === 'active') settleTimer();
    });
    return () => sub.remove();
  }, [hydrated, settleTimer]);

  useEffect(() => {
    if (!hydrated || !running) return;
    let id: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const timer = useStore.getState().timer;
      if (!timer.running) return;
      const delay = timer.endAt - Date.now();
      if (delay > 0) {
        id = setTimeout(arm, delay + 20);
        return;
      }
      const onTime = timer.phase === 'focus' && Date.now() - timer.endAt < 5_000;
      settleTimer();
      if (onTime && AppState.currentState === 'active') successHaptic();
    };

    arm();
    return () => {
      if (id) clearTimeout(id);
    };
  }, [hydrated, running, endAt, phase, settleTimer]);

  useEffect(() => {
    if (!hydrated) return;
    if (!running) {
      void cancelPhaseAlert();
      return;
    }
    // A deadline already in the past is settled by the driver; don't arm a stale alert.
    if (endAt <= Date.now() + 500) return;
    const focus = phase === 'focus';
    void schedulePhaseAlert(
      endAt,
      focus ? '专注完成' : '休息结束',
      focus ? `${plannedMin} 分钟专注已结束，去休息一下。` : '休息结束，回到下一轮专注。',
    );
  }, [hydrated, running, endAt, phase, plannedMin]);
}
