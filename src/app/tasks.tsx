import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskFormSheet } from '@/components/task-form';
import { Button, Card, EmptyState, PressableScale, Segmented, Tag } from '@/components/kit';
import { AmbientBackdrop, ChromeDivider, GlassPanel, GlassTarget, useScrollChrome, ChromeScrollView } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_MAP, PRIORITY_MAP } from '@/lib/catalog';
import { daysBetween, dueLabel, durationLabel, minToLabel, todayKey } from '@/lib/date';
import { successHaptic, warningHaptic } from '@/lib/haptics';
import { blocksOn, useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { useEnter, useReflow } from '@/hooks/use-enter';
import { useSystemInsets } from '@/hooks/use-system-insets';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'open' | 'today' | 'overdue' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: '全部待办' },
  { id: 'today', label: '今天' },
  { id: 'overdue', label: '逾期' },
  { id: 'done', label: '已完成' },
];

export default function TasksScreen() {
  const insets = useSystemInsets();
  const enter = useEnter();
  const reflow = useReflow();
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const toggleTask = useStore((s) => s.toggleTask);
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [headerH, setHeaderH] = useState(54);
  const { edge, scrollHandler } = useScrollChrome();

  const today = todayKey();

  const visible = useMemo(() => {
    const isOpen = (t: Task) => t.status === 'todo';
    const isOverdue = (t: Task) => isOpen(t) && !!t.dueDate && daysBetween(t.dueDate, today) > 0;
    const matchers: Record<Filter, (t: Task) => boolean> = {
      open: isOpen,
      today: (t) => isOpen(t) && (t.dueDate === today || isOverdue(t)),
      overdue: isOverdue,
      done: (t) => t.status === 'done',
    };
    return tasks
      .filter(matchers[filter])
      .sort((a, b) => {
        if (filter === 'done') return (b.completedAt ?? 0) - (a.completedAt ?? 0);
        const weight = PRIORITY_MAP[a.priority].weight - PRIORITY_MAP[b.priority].weight;
        if (weight) return weight;
        const dueA = a.dueDate ? daysBetween(today, a.dueDate) : 999;
        const dueB = b.dueDate ? daysBetween(today, b.dueDate) : 999;
        return dueA - dueB || b.createdAt - a.createdAt;
      });
  }, [tasks, filter, today]);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'todo');
    return {
      open: open.length,
      today: open.filter((t) => t.dueDate === today).length,
      overdue: open.filter((t) => t.dueDate && daysBetween(t.dueDate, today) > 0).length,
      done: tasks.length - open.length,
    };
  }, [tasks, today]);

  const placedOn = useMemo(() => {
    const map = new Map<string, number>();
    for (const block of blocksOn(blocks, today)) {
      if (block.taskId && !map.has(block.taskId)) map.set(block.taskId, block.startMin);
    }
    return map;
  }, [blocks, today]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <GlassTarget style={StyleSheet.absoluteFill}>
          <AmbientBackdrop />
          <ChromeScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.scroll,
              {
                paddingTop: insets.top + headerH + Spacing.four,
                paddingBottom: insets.footer + Spacing.five,
                paddingLeft: Spacing.three + insets.left,
                paddingRight: Spacing.three + insets.right,
              },
            ]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.intro}>
              <View style={styles.summary}>
                <SummaryPill label="待办" value={counts.open} />
                <SummaryPill label="今天" value={counts.today} />
                <SummaryPill label="逾期" value={counts.overdue} tone="danger" />
                <SummaryPill label="完成" value={counts.done} tone="success" />
              </View>
            </View>

            {visible.length === 0 ? (
              <EmptyState
                title={filter === 'done' ? '还没有完成记录' : '这里很干净'}
                hint={
                  filter === 'done'
                    ? '完成任务后会自动出现在这里。'
                    : '新建任务并写好预计耗时，今日页就能一键自动排程。'
                }
              />
            ) : (
              visible.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  placedAt={placedOn.get(task.id)}
                  entering={enter(i)}
                  layout={reflow}
                  onToggle={() => {
                    if (task.status === 'todo') successHaptic();
                    else warningHaptic();
                    toggleTask(task.id);
                  }}
                  onEdit={() => setEditing(task)}
                />
              ))
            )}

            <Button label="+ 新任务" onPress={() => setCreating(true)} style={styles.create} />
          </ChromeScrollView>
        </GlassTarget>

        <GlassPanel
          onLayout={(e) => setHeaderH(Math.ceil(e.nativeEvent.layout.height))}
          style={[
            styles.floatHeader,
            { top: insets.top, left: Spacing.three + insets.left, right: Spacing.three + insets.right },
            styles.chrome,
          ]}
          padded={false}>
          <View style={styles.floatTitle}>
            <ThemedText type="subtitle">任务</ThemedText>
          </View>
          <Segmented items={FILTERS} value={filter} onChange={setFilter} />
          <ChromeDivider edge={edge} />
        </GlassPanel>

        <TaskFormSheet
          key={`create-${creating}`}
          visible={creating}
          defaultDueDate={today}
          onClose={() => setCreating(false)}
        />
        <TaskFormSheet
          key={`edit-${editing?.id ?? 'none'}`}
          visible={!!editing}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function TaskRow({
  task,
  placedAt,
  onToggle,
  onEdit,
  entering,
  layout,
}: {
  task: Task;
  placedAt?: number;
  onToggle: () => void;
  onEdit: () => void;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const category = CATEGORY_MAP[task.category];
  const priority = PRIORITY_MAP[task.priority];
  const due = dueLabel(task.dueDate);
  const done = task.status === 'done';
  const dueColor =
    due.tone === 'overdue' ? theme.danger : due.tone === 'soon' ? theme.warning : theme.textSecondary;

  return (
    <Card
      accent={done ? undefined : priority.color}
      tint={done ? theme.success : undefined}
      entering={entering}
      layout={layout}>
      <View style={styles.row}>
        <PressableScale
          onPress={onToggle}
          haptic="none"
          checked={done}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityLabel={done ? `重新打开「${task.title}」` : `完成「${task.title}」`}
          style={[
            styles.checkbox,
            {
              borderColor: done ? theme.success : priority.color,
              backgroundColor: done ? theme.success : 'transparent',
            },
          ]}>
          {done ? (
            <Animated.Text
              entering={reduced ? FadeIn.duration(140) : ZoomIn.duration(180)}
              style={styles.checkmark}>
              ✓
            </Animated.Text>
          ) : null}
        </PressableScale>

        <PressableScale onPress={onEdit} haptic="none" outerStyle={styles.rowBody} style={styles.rowBodyInner}>
          <ThemedText style={[done && styles.struck]} numberOfLines={2}>
            {task.title}
          </ThemedText>
          {task.note ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {task.note}
            </ThemedText>
          ) : null}
          <View style={styles.tags}>
            <Tag label={category.label} color={category.color} />
            {!done ? (
              <ThemedText type="small" style={{ color: priority.color }}>
                {priority.label}优先
              </ThemedText>
            ) : null}
            {!done && task.dueDate ? (
              <ThemedText type="small" style={{ color: dueColor }}>
                {due.text}
              </ThemedText>
            ) : null}
            {!done ? (
              <ThemedText type="small" themeColor="textSecondary">
                {durationLabel(task.estimateMin)}
              </ThemedText>
            ) : null}
            {!done ? (
              <ThemedText type="small" style={{ color: placedAt === undefined ? theme.warning : theme.textSecondary }}>
                {placedAt === undefined ? '未排入日程' : `已排 ${minToLabel(placedAt)}`}
              </ThemedText>
            ) : null}
          </View>
        </PressableScale>
      </View>
    </Card>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'success' }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const active = value > 0;
  const color = tone === 'danger' && active ? theme.danger : tone === 'success' && active ? theme.success : theme.text;
  const bg =
    tone === 'danger' && active
      ? `${theme.danger}14`
      : tone === 'success' && active
        ? `${theme.success}14`
        : theme.backgroundElement;
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: theme.border }]}>
      <Animated.Text
        key={value}
        entering={reduced ? undefined : FadeInDown.duration(180)}
        style={{ color, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value}
      </Animated.Text>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  floatHeader: { position: 'absolute' },
  chrome: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  intro: { gap: Spacing.two },
  summary: { flexDirection: 'row', gap: Spacing.two },
  pill: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  scroll: { gap: Spacing.two },
  floatTitle: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowBody: { flex: 1 },
  rowBodyInner: { gap: Spacing.half },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  struck: { textDecorationLine: 'line-through' },
  create: { marginTop: Spacing.two },
});
