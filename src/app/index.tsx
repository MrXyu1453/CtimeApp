import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockFormSheet } from '@/components/block-form';
import { TaskFormSheet } from '@/components/task-form';
import { Button, Card, Chip, EmptyState, GradientCard, ProgressBar, PressableScale, SectionTitle, Tag } from '@/components/kit';
import { AmbientBackdrop, ChromeDivider, GlassPanel, GlassTarget, useScrollChrome, ChromeScrollView } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_MAP, PRIORITY_MAP } from '@/lib/catalog';
import { addDays, dayHeadline, durationLabel, minToLabel, nowMin, todayKey, weekdayLabel } from '@/lib/date';
import { blocksOn, openTasksUnplaced, useStore } from '@/lib/store';
import type { Block, Task } from '@/lib/types';
import { successHaptic } from '@/lib/haptics';
import { useEnter, useReflow, useTransient } from '@/hooks/use-enter';
import { useGradients, useTheme } from '@/hooks/use-theme';

type Sheet =
  | { kind: 'none' }
  | { kind: 'task'; editing?: Task }
  | { kind: 'block'; editing?: Block; startMin?: number; linkedTask?: Task };

const SLOT = 30;

export default function TodayScreen() {
  const theme = useTheme();
  const gradients = useGradients();
  const enter = useEnter();
  const reflow = useReflow();
  const date = useStore((s) => s.selectedDate);
  const setDate = useStore((s) => s.setSelectedDate);
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const settings = useStore((s) => s.settings);
  const planDay = useStore((s) => s.planDay);
  const clearDay = useStore((s) => s.clearDay);
  const toggleBlock = useStore((s) => s.toggleBlock);
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' });
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [headerH, setHeaderH] = useState(66);
  const [sheen, setSheen] = useState(0);
  const { edge, scrollHandler } = useScrollChrome();
  const transient = useTransient();

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2800);
    return () => clearTimeout(id);
  }, [flash]);

  const dayBlocks = useMemo(() => blocksOn(blocks, date), [blocks, date]);
  const unplaced = useMemo(() => openTasksUnplaced({ tasks, blocks }, date), [tasks, blocks, date]);
  const openCount = useMemo(() => tasks.filter((t) => t.status === 'todo').length, [tasks]);
  const plannedMin = dayBlocks.reduce((sum, b) => sum + b.durationMin, 0);
  const windowMin = Math.max(1, settings.dayEndMin - settings.dayStartMin);
  const doneMin = dayBlocks.filter((b) => b.done).reduce((sum, b) => sum + b.durationMin, 0);
  const isToday = date === todayKey();
  const currentMin = nowMin();

  const agenda = useMemo(() => buildAgenda(dayBlocks, settings.dayStartMin, settings.dayEndMin), [dayBlocks, settings.dayStartMin, settings.dayEndMin]);

  const statusLine = !openCount
    ? '暂无待办任务'
    : unplaced.length
      ? `${unplaced.length} 项待安排`
      : '待办已全部安排';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <GlassTarget style={StyleSheet.absoluteFill}>
          <AmbientBackdrop />

          <ChromeScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scroll, { paddingTop: headerH + Spacing.four }]}
            showsVerticalScrollIndicator={false}>
            <GradientCard colors={gradients.hero} style={styles.hero} sheen={sheen} sheenColors={gradients.sheen}>
              <View style={styles.metrics}>
                <ThemedText type="smallBold" style={styles.heroStrong}>
                  已排 {durationLabel(plannedMin)}
                </ThemedText>
                <ThemedText type="small" style={styles.heroDim}>
                  完成 {durationLabel(doneMin)} · 一天 {durationLabel(windowMin)}
                </ThemedText>
              </View>
              <ProgressBar
                value={plannedMin / windowMin}
                color="rgba(255,255,255,0.55)"
                track="rgba(255,255,255,0.22)"
              />
              <ProgressBar
                value={doneMin / Math.max(1, plannedMin)}
                color="#FFFFFF"
                track="rgba(255,255,255,0.22)"
                height={4}
              />
            </GradientCard>

            <View style={styles.toolbar}>
            <Button
              label="自动排程"
              onPress={() => {
                const created = planDay(date, isToday ? currentMin : undefined);
                if (created) {
                  successHaptic();
                  setSheen((n) => n + 1);
                }
                setFlash(
                  created
                    ? `已按优先级把 ${created} 项任务排进空闲时段。`
                    : openCount
                      ? '待办任务都已安排，或预计耗时为 0；可手动添加时间块。'
                      : '还没有待办任务，先去任务页新建一条。',
                );
                setConfirmingClear(false);
              }}
              style={styles.grow}
            />
            {confirmingClear ? (
              <Button
                label={`确认清空 ${dayBlocks.length} 块`}
                variant="danger"
                onPress={() => {
                  clearDay(date);
                  setFlash(`已清空这一天的时间块，任务本身保留。`);
                  setConfirmingClear(false);
                }}
              />
            ) : (
              <Button
                label="清空"
                variant="ghost"
                onPress={() => setConfirmingClear(true)}
                disabled={!dayBlocks.length}
              />
            )}
            <Button label="+ 时间块" variant="ghost" onPress={() => setSheet({ kind: 'block', startMin: currentMin })} />
          </View>

          {isToday && currentMin >= settings.dayStartMin && currentMin <= settings.dayEndMin ? (
            <View style={styles.nowRow}>
              <ThemedText type="smallBold" style={{ color: theme.accent, minWidth: 56 }}>
                {minToLabel(currentMin)}
              </ThemedText>
              <View style={[styles.nowLine, { backgroundColor: theme.accent }]} />
            </View>
          ) : null}

          {agenda.length === 0 ? (
            <EmptyState
              title="这一天还是空的"
              hint="点「自动排程」让待办任务按优先级落进空闲时段，或手动加一个时间块。"
            />
          ) : (
            agenda.map((item, i) =>
              item.block ? (
                <BlockRow
                  key={`b-${item.block.id}`}
                  block={item.block}
                  entering={enter(i)}
                  layout={reflow}
                  onEdit={() => setSheet({ kind: 'block', editing: item.block })}
                  onToggle={() => toggleBlock(item.block!.id)}
                />
              ) : (
                <GapRow
                  key={`g-${item.start}`}
                  minutes={item.duration}
                  entering={enter(i)}
                  layout={reflow}
                  onPress={() => setSheet({ kind: 'block', startMin: item.start })}
                />
              ),
            )
          )}

          <View style={styles.taskSection}>
            <SectionTitle>待安排任务</SectionTitle>
            {unplaced.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                所有未完成任务都已经排进日程了。
              </ThemedText>
            ) : (
              unplaced.slice(0, 12).map((task, i) => (
                <Animated.View key={task.id} entering={enter(i)} layout={reflow} style={styles.unplacedRow}>
                  <PressableScale
                    onPress={() => setSheet({ kind: 'task', editing: task })}
                    outerStyle={styles.grow}
                    style={styles.unplacedMain}>
                    <View style={styles.unplacedTitle}>
                      <View style={[styles.priorityDot, { backgroundColor: PRIORITY_MAP[task.priority].color }]} />
                      <ThemedText numberOfLines={2} style={task.status === 'done' ? styles.struck : undefined}>
                        {task.title}
                      </ThemedText>
                    </View>
                    <View style={styles.tags}>
                      <Tag label={CATEGORY_MAP[task.category].label} color={CATEGORY_MAP[task.category].color} />
                      <ThemedText type="small" themeColor="textSecondary">
                        {durationLabel(task.estimateMin)}
                      </ThemedText>
                    </View>
                  </PressableScale>
                  <Chip
                    label="排入"
                    small
                    selected
                    haptic="light"
                    onPress={() => setSheet({ kind: 'block', linkedTask: task, startMin: nextFreeStart(dayBlocks, settings.dayStartMin, settings.dayEndMin) })}
                  />
                </Animated.View>
              ))
            )}
          </View>

          <View style={styles.footerActions}>
            <Button label="+ 新任务" variant="ghost" onPress={() => setSheet({ kind: 'task' })} style={styles.grow} />
          </View>
        </ChromeScrollView>
        </GlassTarget>

        <GlassPanel
          onLayout={(e) => setHeaderH(Math.ceil(e.nativeEvent.layout.height))}
          style={[styles.floatHeader, styles.chrome]}>
          <View style={styles.dateNav}>
            <Chip label="‹" small onPress={() => setDate(addDays(date, -1))} />
            <PressableScale
              onPress={() => setDate(todayKey())}
              haptic="light"
              outerStyle={styles.datePressable}
              style={styles.dateLabel}
              accessibilityLabel={isToday ? '今天' : '回到今天'}>
              <ThemedText type="default" numberOfLines={1} style={styles.dateText}>
                {dayHeadline(date)}
              </ThemedText>
              <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
                {isToday ? '今天' : weekdayLabel(date)} · {statusLine}
              </ThemedText>
            </PressableScale>
            <Chip label="›" small onPress={() => setDate(addDays(date, 1))} />
          </View>
          <ChromeDivider edge={edge} />
        </GlassPanel>

        {flash ? (
          <Animated.View
            entering={transient.entering}
            exiting={transient.exiting}
            style={styles.toastWrap}
            pointerEvents="none">
            <GlassPanel radius={Radius.pill} intensity={26} style={styles.toast} padded={false}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.toastText}>
                {flash}
              </ThemedText>
            </GlassPanel>
          </Animated.View>
        ) : null}

        <TaskFormSheet
          key={`task-${sheet.kind === 'task' ? (sheet.editing?.id ?? 'new') : 'off'}`}
          visible={sheet.kind === 'task'}
          editing={sheet.kind === 'task' ? sheet.editing ?? null : null}
          defaultDueDate={date}
          onClose={() => setSheet({ kind: 'none' })}
        />
        <BlockFormSheet
          key={`block-${sheet.kind === 'block' ? (sheet.editing?.id ?? `new-${sheet.startMin ?? 0}`) : 'off'}`}
          visible={sheet.kind === 'block'}
          date={date}
          editing={sheet.kind === 'block' ? sheet.editing ?? null : null}
          defaultStart={sheet.kind === 'block' ? sheet.startMin : undefined}
          linkedTask={sheet.kind === 'block' ? sheet.linkedTask ?? null : null}
          onClose={() => setSheet({ kind: 'none' })}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

type AgendaItem = { block?: Block; start: number; duration: number };

function buildAgenda(blocks: Block[], dayStart: number, dayEnd: number): AgendaItem[] {
  const items: AgendaItem[] = [];
  let cursor = dayStart;
  for (const block of blocks) {
    // A block that overlaps its neighbour is clipped rather than drawn backwards.
    const start = Math.max(cursor, Math.max(dayStart, block.startMin));
    const end = Math.min(dayEnd, block.startMin + block.durationMin);
    if (start > cursor) items.push({ start: cursor, duration: start - cursor });
    if (end > start) items.push({ block, start, duration: end - start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < dayEnd) items.push({ start: cursor, duration: dayEnd - cursor });
  return items.filter((i) => i.duration >= SLOT || i.block);
}

function nextFreeStart(blocks: Block[], dayStart: number, dayEnd: number): number {
  const taken = blocks.reduce((max, b) => Math.max(max, b.startMin + b.durationMin), dayStart);
  const candidate = Math.max(taken, nowMin());
  return Math.max(dayStart, Math.min(candidate, dayEnd - SLOT));
}

function BlockRow({
  block,
  onEdit,
  onToggle,
  entering,
  layout,
}: {
  block: Block;
  onEdit: () => void;
  onToggle: () => void;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const theme = useTheme();
  const category = CATEGORY_MAP[block.category];
  return (
    <Card
      accent={block.done ? undefined : category.color}
      tint={block.done ? theme.success : undefined}
      entering={entering}
      layout={layout}
      style={styles.blockCard}>
      <View style={styles.blockHeader}>
        <ThemedText type="smallBold" style={{ minWidth: 96 }}>
          {minToLabel(block.startMin)}–{minToLabel(block.startMin + block.durationMin)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {durationLabel(block.durationMin)}
        </ThemedText>
      </View>
      <PressableScale onPress={onEdit} haptic="none" style={styles.blockTitle}>
        <ThemedText style={block.done ? styles.struck : undefined}>{block.title}</ThemedText>
      </PressableScale>
      <View style={styles.blockFooter}>
        <Tag label={category.label} color={category.color} />
        <Chip
          label={block.done ? '已完成' : '标记完成'}
          small
          selected={block.done}
          haptic={block.done ? 'none' : 'light'}
          onPress={onToggle}
        />
        <Chip label="编辑" small onPress={onEdit} />
      </View>
    </Card>
  );
}

function GapRow({
  minutes,
  onPress,
  entering,
  layout,
}: {
  minutes: number;
  onPress: () => void;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={entering} layout={layout}>
      <PressableScale
        onPress={onPress}
        haptic="light"
        style={[styles.gap, { borderColor: theme.border }]}
        accessibilityLabel={`空闲 ${durationLabel(minutes)}，点按安排时间块`}>
        <ThemedText type="small" themeColor="textSecondary">
          空闲 {durationLabel(minutes)} · 点按安排
        </ThemedText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  floatHeader: { position: 'absolute', left: Spacing.three, right: Spacing.three, top: 0 },
  chrome: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  datePressable: { flex: 1 },
  dateLabel: { alignItems: 'center' },
  dateText: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  hero: { gap: Spacing.one },
  heroStrong: { color: '#FFFFFF' },
  heroDim: { color: 'rgba(255,255,255,0.82)' },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.one },
  // The scroll view lives in an absolute-fill layer, so it sits under SafeAreaView's padding
  // and has to carry its own horizontal inset.
  scroll: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
  toolbar: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  toastWrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.four,
    alignItems: 'center',
  },
  toast: { maxWidth: '100%' },
  toastText: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, textAlign: 'center' },
  grow: { flex: 1 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nowLine: { flex: 1, height: 2, borderRadius: 1 },
  blockCard: { marginLeft: 0 },
  blockTitle: { paddingVertical: 2, alignSelf: 'flex-start' },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  gap: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  taskSection: { gap: Spacing.two, marginTop: Spacing.three },
  unplacedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unplacedMain: { flex: 1, gap: Spacing.half },
  unplacedTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  struck: { textDecorationLine: 'line-through' },
  footerActions: { marginTop: Spacing.three },
});
