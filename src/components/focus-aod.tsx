import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppActive } from '@/hooks/use-app-active';
import { useWallClock } from '@/hooks/use-wall-clock';
import { clockLabel, dateKey, durationLabel, shortDateLabel, todayKey, weekdayLabel } from '@/lib/date';
import { useStore } from '@/lib/store';

/** Dim tones only: pure black plus a few lit pixels is what makes this mode cheap on OLED. */
const TONES = {
  focus: { strong: '#A9BEDC', soft: '#66748C', line: '#3D5578' },
  break: { strong: '#9FC4B1', soft: '#6A8276', line: '#3D5B4D' },
  paused: { strong: '#C6B68D', soft: '#7A7058', line: '#58503B' },
  idle: { strong: '#8A96AA', soft: '#525C6E', line: '#2F3745' },
} as const;

function KeepScreenOn() {
  useKeepAwake('ctime-aod', { suppressDeactivateWarnings: true });
  return null;
}

function wallClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FocusAod({ onClose }: { onClose: () => void }) {
  const timer = useStore((s) => s.timer);
  const sessions = useStore((s) => s.sessions);
  const appActive = useAppActive();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const started = timer.startedAt !== 0;
  const running = started && timer.running;
  // The countdown only needs a tick while running; a finished round shows a wall clock.
  const now = useWallClock(appActive && (running || !started));

  const leftSec = running
    ? Math.max(0, Math.ceil((timer.endAt - now) / 1000))
    : started
      ? Math.max(0, timer.remainingSec)
      : 0;
  const totalSec = Math.max(1, timer.plannedMin * 60);
  const progress = started ? Math.min(1, Math.max(0, 1 - leftSec / totalSec)) : 0;

  const tone = !started
    ? TONES.idle
    : !timer.running
      ? TONES.paused
      : timer.phase === 'break'
        ? TONES.break
        : TONES.focus;
  const status = !started
    ? '本轮已结束'
    : timer.phase === 'break'
      ? timer.running
        ? '休息中'
        : '休息已暂停'
      : timer.running
        ? '专注中'
        : '已暂停';
  const roundLabel = !started
    ? `${shortDateLabel(todayKey())} ${weekdayLabel(todayKey())}`
    : timer.phase === 'focus'
      ? `第 ${timer.cycle + 1} 轮`
      : `已完成 ${timer.cycle} 轮`;

  const today = todayKey();
  const todaySessions = sessions.filter((s) => dateKey(new Date(s.startedAt)) === today);
  const todayMin = todaySessions.reduce((sum, s) => sum + s.actualMin, 0);

  const display = started ? clockLabel(leftSec) : wallClock(now);
  const title = started ? timer.title || '自由专注' : '时舟 · 息屏时钟';
  const bigSize = Math.min(104, Math.round(width * 0.23));
  const fillWidth = `${Math.round(progress * 1000) / 10}%` as const;

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <StatusBar hidden />
      {started ? <KeepScreenOn /> : null}
      <Pressable
        style={styles.root}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="退出息屏显示"
        accessibilityHint="轻触屏幕任意位置返回专注页">
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.topRow}>
            <Text style={[styles.brand, { color: tone.soft }]}>时舟</Text>
            <Text style={[styles.brand, { color: tone.soft }]}>{roundLabel}</Text>
          </View>

          <View style={styles.center}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: tone.strong }]} />
              <Text style={[styles.status, { color: tone.soft }]}>{status}</Text>
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.clock, { color: tone.strong, fontSize: bigSize, lineHeight: Math.round(bigSize * 1.1) }]}>
              {display}
            </Text>
            <Text numberOfLines={1} style={[styles.task, { color: tone.soft }]}>
              {title}
            </Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: fillWidth, backgroundColor: tone.line }]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: tone.soft }]}>
                今日 {todaySessions.length} 轮 · {durationLabel(todayMin)}
              </Text>
              <Text style={[styles.meta, styles.hint]}>轻触任意位置退出</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, paddingHorizontal: 30 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 13, fontWeight: '600', letterSpacing: 1.2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.85 },
  status: { fontSize: 15, fontWeight: '600', letterSpacing: 2 },
  clock: { fontWeight: '300', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  task: { maxWidth: '86%', fontSize: 15, textAlign: 'center' },
  bottom: { gap: 14 },
  track: { height: 1, backgroundColor: '#14171D', overflow: 'hidden' },
  fill: { height: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  meta: { fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
  hint: { color: '#414A5A' },
});
