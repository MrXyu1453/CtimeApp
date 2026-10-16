import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimerRing } from '@/components/timer-ring';
import { Button, Card, Chip, EmptyState, PressableScale, SectionTitle, Tag } from '@/components/kit';
import { AmbientBackdrop } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { TIMING_EASE_OUT, TIMING_LINEAR } from '@/constants/motion';
import { CATEGORY_MAP } from '@/lib/catalog';
import { successHaptic } from '@/lib/haptics';
import { clockLabel, dateKey, durationLabel, minToLabel, todayKey } from '@/lib/date';
import { cancelPhaseAlert, ensureNotificationPermission, schedulePhaseAlert } from '@/lib/notifications';
import { blocksOn, openTasksUnplaced, remainingSec, useStore } from '@/lib/store';
import { useEnter } from '@/hooks/use-enter';
import { useGradients, useTheme } from '@/hooks/use-theme';

const PRESETS = [15, 25, 50];

export default function FocusScreen() {
  const theme = useTheme();
  const gradients = useGradients();
  const enter = useEnter();
  const timer = useStore((s) => s.timer);
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const sessions = useStore((s) => s.sessions);
  const date = useStore((s) => s.selectedDate);
  const updateSettings = useStore((s) => s.updateSettings);
  const startFocus = useStore((s) => s.startFocus);
  const pauseFocus = useStore((s) => s.pauseFocus);
  const resumeFocus = useStore((s) => s.resumeFocus);
  const stopFocus = useStore((s) => s.stopFocus);
  const completePhase = useStore((s) => s.completePhase);

  const [minutes, setMinutes] = useState(settings.focusMin);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [, setTick] = useState(0);
  /** Ring sweep, 0 → 1 across the current phase, driven from the deadline on the UI thread. */
  const sweep = useSharedValue(0);

  const left = remainingSec(timer);
  const running = timer.running;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const totalMs = Math.max(1, timer.plannedMin * 60_000);
    if (timer.running) {
      const leftMs = Math.max(0, timer.endAt - Date.now());
      // Resume mid-phase: place the ring where the eye last saw it, then walk to full.
      sweep.set(1 - leftMs / totalMs);
      sweep.set(withTiming(1, { duration: leftMs, easing: TIMING_LINEAR }));
    } else if (timer.startedAt === 0) {
      sweep.set(withTiming(0, { duration: 220, easing: TIMING_EASE_OUT }));
    } else {
      sweep.set(1 - (Math.max(0, timer.remainingSec) * 1000) / totalMs);
    }
  }, [timer.running, timer.endAt, timer.startedAt, timer.plannedMin, timer.remainingSec, sweep]);

  // A persisted deadline can expire while the app was closed; settle it on the next frame.
  useEffect(() => {
    if (running && left <= 0) {
      if (timer.phase === 'focus') successHaptic();
      completePhase();
    }
  }, [running, left, timer.phase, completePhase]);

  useEffect(() => {
    if (!running) {
      void cancelPhaseAlert();
      return;
    }
    const title = timer.phase === 'focus' ? '专注完成' : '休息结束';
    const body =
      timer.phase === 'focus'
        ? `${timer.plannedMin} 分钟专注已结束，去休息一下。`
        : '休息结束，回到下一轮专注。';
    void schedulePhaseAlert(timer.endAt, title, body);
  }, [running, timer.endAt, timer.phase, timer.plannedMin, timer.title]);

  useEffect(() => () => void cancelPhaseAlert(), []);

  const candidates = useMemo(() => {
    const dayBlocks = blocksOn(blocks, date);
    const placed = dayBlocks.map((b) => tasks.find((t) => t.id === b.taskId)).filter(Boolean);
    const unplaced = openTasksUnplaced({ tasks, blocks }, date);
    const seen = new Set<string>();
    return [...placed, ...unplaced].filter((task) => {
      if (!task || seen.has(task.id) || task.status !== 'todo') return false;
      seen.add(task.id);
      return true;
    }) as NonNullable<(typeof placed)[number]>[];
  }, [blocks, tasks, date]);

  const chosen = candidates.find((t) => t.id === taskId) ?? null;
  const today = todayKey();
  const todaySessions = sessions.filter((s) => dateKey(new Date(s.startedAt)) === today);
  const todayMin = todaySessions.reduce((sum, s) => sum + s.actualMin, 0);

  const begin = async () => {
    const target = chosen;
    const granted = await ensureNotificationPermission();
    if (granted !== settings.notificationsEnabled) updateSettings({ notificationsEnabled: granted });
    startFocus({
      taskId: target?.id,
      title: target?.title ?? '自由专注',
      category: target?.category ?? 'work',
      minutes,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AmbientBackdrop />
        <View style={styles.header}>
          <ThemedText type="subtitle">{timer.phase === 'break' ? '休息中' : '专注'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            今日已完成 {todaySessions.length} 轮 · {durationLabel(todayMin)} · 第 {timer.cycle + 1} 轮
          </ThemedText>
        </View>

        <Card style={styles.timerCard} tint={timer.phase === 'break' ? theme.success : theme.accent}>
          <ThemedText type="small" themeColor="textSecondary">
            {timer.running ? '进行中' : left > 0 && timer.startedAt ? '已暂停' : '准备开始'}
          </ThemedText>
          <TimerRing
            progress={sweep}
            colors={timer.phase === 'break' ? gradients.break : gradients.focus}
            running={running}
            label={clockLabel(left)}
            caption={timer.startedAt ? timer.title || '自由专注' : '选择任务或直接开始一段自由专注'}
          />

          <View style={styles.controls}>
            {timer.startedAt === 0 ? (
              <Button label="开始专注" onPress={begin} style={styles.grow} />
            ) : running ? (
              <>
                <Button label="暂停" variant="ghost" onPress={pauseFocus} style={styles.grow} />
                <Button label="结束" variant="danger" onPress={stopFocus} />
              </>
            ) : (
              <>
                <Button label="继续" onPress={resumeFocus} style={styles.grow} />
                <Button label="放弃" variant="danger" onPress={stopFocus} />
              </>
            )}
            {timer.phase === 'break' && !timer.running ? (
              <Button label="跳过休息" variant="ghost" onPress={completePhase} />
            ) : null}
          </View>
        </Card>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {timer.startedAt === 0 && timer.phase === 'focus' ? (
            <>
              <SectionTitle>专注时长</SectionTitle>
              <View style={styles.row}>
                {PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    label={`${preset} 分钟`}
                    selected={minutes === preset}
                    onPress={() => setMinutes(preset)}
                  />
                ))}
                <Chip label="−5′" small onPress={() => setMinutes((m) => Math.max(5, m - 5))} />
                <Chip label="+5′" small onPress={() => setMinutes((m) => Math.min(180, m + 5))} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                当前 {minutes} 分钟 · 休息 {settings.breakMin} 分钟
              </ThemedText>

              <SectionTitle>选择任务</SectionTitle>
              {candidates.length === 0 ? (
                <EmptyState title="没有待办任务" hint="去任务页新建一条，或直接开始自由专注。" />
              ) : (
                <View style={styles.candidates}>
                  {candidates.slice(0, 8).map((task) => (
                    <PressableScale
                      key={task.id}
                      onPress={() => setTaskId(taskId === task.id ? undefined : task.id)}
                      style={[
                        styles.candidate,
                        {
                          backgroundColor: taskId === task.id ? theme.accent : theme.backgroundElement,
                          borderColor: theme.border,
                        },
                      ]}>
                      <ThemedText numberOfLines={1} style={{ color: taskId === task.id ? theme.onAccent : theme.text }}>
                        {task.title}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: taskId === task.id ? theme.onAccent : theme.textSecondary }}>
                        {durationLabel(task.estimateMin)}
                      </ThemedText>
                    </PressableScale>
                  ))}
                </View>
              )}
            </>
          ) : null}

          <SectionTitle>今日专注记录</SectionTitle>
          {chosen && timer.startedAt === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              将为「{chosen.title}」计时
            </ThemedText>
          ) : null}
          {todaySessions.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              今天还没有完成的专注轮次。
            </ThemedText>
          ) : (
            [...todaySessions].reverse().map((session, i) => (
              <Card key={session.id} accent={CATEGORY_MAP[session.category].color} entering={enter(i)}>
                <View style={styles.sessionRow}>
                  <ThemedText numberOfLines={1} style={styles.sessionTitle}>
                    {session.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {minToLabel(new Date(session.startedAt).getHours() * 60 + new Date(session.startedAt).getMinutes())}
                  </ThemedText>
                </View>
                <View style={styles.sessionMeta}>
                  <Tag label={CATEGORY_MAP[session.category].label} color={CATEGORY_MAP[session.category].color} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.status === 'done' ? '完整' : '提前结束'} · 实际 {session.actualMin} / 计划 {session.plannedMin} 分钟
                  </ThemedText>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.half },
  timerCard: { gap: Spacing.two },
  controls: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  grow: { flex: 1 },
  scroll: { gap: Spacing.two, paddingVertical: Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  candidates: { gap: Spacing.two },
  candidate: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  sessionTitle: { flex: 1 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
