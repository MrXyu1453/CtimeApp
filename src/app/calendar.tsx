import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackdrop, ChromeDivider, GlassPanel, GlassTarget, useScrollChrome, ChromeScrollView } from '@/components/glass';
import { Button, Card, Chip, EmptyState, PressableScale, SectionTitle } from '@/components/kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EASE_UI, DURATION } from '@/constants/motion';
import { CATEGORY_MAP } from '@/lib/catalog';
import {
  addMonths,
  dateKey,
  dayHeadline,
  durationLabel,
  fromKey,
  minToLabel,
  monthDates,
  monthGrid,
  monthLabel,
  todayKey,
} from '@/lib/date';
import { blocksOn, useStore } from '@/lib/store';
import type { CategoryId } from '@/lib/types';
import { useEnter } from '@/hooks/use-enter';
import { useTheme } from '@/hooks/use-theme';

type DayCell = {
  date: string;
  plannedMin: number;
  focusMin: number;
  /** categories ranked by planned minutes, for the dots */
  cats: CategoryId[];
  due: number;
  done: number;
};

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'];

/** Accent color with a hex alpha suffix, so the heat tint rides on one token. */
function heat(color: string, alpha: number): string {
  const hex = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${hex}`;
}

export default function CalendarScreen() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const enter = useEnter(6);
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const selected = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);

  const today = todayKey();
  const [month, setMonth] = useState(selected.slice(0, 7));
  const { edge, scrollHandler } = useScrollChrome();
  const [headerH, setHeaderH] = useState(66);

  const grid = useMemo(() => monthGrid(`${month}-01`), [month]);
  const rows = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < grid.length; i += 7) out.push(grid.slice(i, i + 7));
    return out;
  }, [grid]);

  const capacity = Math.max(60, settings.dayEndMin - settings.dayStartMin);

  const { cells, peak } = useMemo(() => {
    const range = new Set(grid);
    const map = new Map<string, DayCell>();
    for (const date of grid) map.set(date, { date, plannedMin: 0, focusMin: 0, cats: [], due: 0, done: 0 });

    const catMin = new Map<string, Map<CategoryId, number>>();
    for (const block of blocks) {
      const cell = map.get(block.date);
      if (!cell) continue;
      cell.plannedMin += block.durationMin;
      const byCat = catMin.get(block.date) ?? new Map<CategoryId, number>();
      byCat.set(block.category, (byCat.get(block.category) ?? 0) + block.durationMin);
      catMin.set(block.date, byCat);
    }
    for (const [date, byCat] of catMin) {
      const cell = map.get(date);
      if (!cell) continue;
      cell.cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
    }

    for (const session of sessions) {
      if (session.status === 'running' || session.actualMin <= 0) continue;
      const date = dateKey(new Date(session.startedAt));
      const cell = map.get(date);
      if (cell) cell.focusMin += session.actualMin;
    }

    for (const task of tasks) {
      if (task.dueDate && task.status === 'todo' && range.has(task.dueDate)) {
        map.get(task.dueDate)!.due += 1;
      }
      if (task.completedAt) {
        const date = dateKey(new Date(task.completedAt));
        const cell = map.get(date);
        if (cell) cell.done += 1;
      }
    }
    // Heat and the focus bar share one reference: the fullest day in view, floored at two hours
    // so a light month still paints a visible gradient instead of one uniform pale wash.
    let peak = 120;
    for (const cell of map.values()) peak = Math.max(peak, cell.plannedMin);
    return { cells: map, peak };
  }, [blocks, grid, sessions, tasks]);

  const daysInMonth = useMemo(() => monthDates(`${month}-01`), [month]);

  const monthStats = useMemo(() => {
    let plannedMin = 0;
    let focusMin = 0;
    let due = 0;
    let done = 0;
    let plannedDays = 0;
    let busiest: DayCell | null = null;
    for (const date of daysInMonth) {
      const cell = cells.get(date);
      if (!cell) continue;
      plannedMin += cell.plannedMin;
      focusMin += cell.focusMin;
      due += cell.due;
      done += cell.done;
      if (cell.plannedMin > 0) plannedDays += 1;
      if (cell.plannedMin > (busiest?.plannedMin ?? 0)) busiest = cell;
    }
    return { plannedMin, focusMin, due, done, plannedDays, busiest, days: daysInMonth.length };
  }, [cells, daysInMonth]);

  const selectedCell = cells.get(selected) ?? null;
  const selectedBlocks = useMemo(
    () => blocksOn(blocks, selected).sort((a, b) => a.startMin - b.startMin),
    [blocks, selected],
  );
  const inMonth = (date: string) => date.slice(0, 7) === month;
  const goToday = () => {
    setSelectedDate(today);
    setMonth(today.slice(0, 7));
  };

  /** Keep the selected day-of-month when paging, clamped so it never lands on a missing 31st. */
  const shiftMonth = (delta: number) => {
    const next = addMonths(`${month}-01`, delta);
    const day = String(Math.min(Number(selected.slice(8)), monthDates(next).length)).padStart(2, '0');
    setMonth(next.slice(0, 7));
    setSelectedDate(`${next.slice(0, 7)}-${day}`);
  };

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
            <View style={styles.weekHead}>
              {WEEK_HEAD.map((label, i) => (
                <ThemedText
                  key={label}
                  type="small"
                  themeColor={i > 4 ? 'accentAlt' : 'textSecondary'}
                  style={styles.weekHeadText}>
                  {label}
                </ThemedText>
              ))}
            </View>

            {rows.map((row, rowIndex) => (
              <Animated.View key={`${month}-${rowIndex}`} entering={enter(rowIndex)} style={styles.weekRow}>
                {row.map((date) => (
                  <DayCellView
                    key={date}
                    date={date}
                    cell={cells.get(date)}
                    peak={peak}
                    dimmed={!inMonth(date)}
                    isToday={date === today}
                    selected={date === selected}
                    reduced={reduced}
                    onPress={() => setSelectedDate(date)}
                  />
                ))}
              </Animated.View>
            ))}

            <Card style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.heatSwatch, { backgroundColor: heat(theme.accent, 0.18) }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  底色越深＝计划越满（相对本月最满的一天）
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.focusSwatch} />
                <ThemedText type="small" themeColor="textSecondary">
                  底部细条＝实际专注
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <ThemedText type="small" style={{ color: theme.warning }}>
                  N
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  当天到期任务
                </ThemedText>
              </View>
            </Card>

            <SectionTitle>{dayHeadline(selected)}</SectionTitle>
            {selectedCell && selectedCell.plannedMin === 0 && selectedCell.focusMin === 0 ? (
              <EmptyState
                title="这天还是空的"
                hint="去今日页用「自动排程」把待办落进时段，或手动加一个时间块。"
              />
            ) : (
              <Card>
                <View style={styles.dayMetrics}>
                  <Metric label="计划" value={durationLabel(selectedCell?.plannedMin ?? 0)} />
                  <Metric label="专注" value={durationLabel(selectedCell?.focusMin ?? 0)} />
                  <Metric label="完成" value={`${selectedCell?.done ?? 0} 项`} />
                  {selectedCell && selectedCell.due > 0 ? (
                    <Metric label="到期" value={`${selectedCell.due} 项`} color={theme.warning} />
                  ) : null}
                </View>
                {selectedBlocks.length ? (
                  <View style={styles.blockList}>
                    {selectedBlocks.slice(0, 5).map((block) => (
                      <View key={block.id} style={styles.blockRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.blockTime}>
                          {minToLabel(block.startMin)}
                        </ThemedText>
                        <View style={[styles.blockDot, { backgroundColor: CATEGORY_MAP[block.category].color }]} />
                        <ThemedText type="small" numberOfLines={1} style={styles.blockTitle}>
                          {block.title}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {durationLabel(block.durationMin)}
                        </ThemedText>
                      </View>
                    ))}
                    {selectedBlocks.length > 5 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        还有 {selectedBlocks.length - 5} 个时间块…
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
                <Button label="在今日页编排这一天" variant="ghost" onPress={() => router.push('/')} />
              </Card>
            )}

            <SectionTitle>本月地图</SectionTitle>
            <Card>
              <View style={styles.monthGridRow}>
                <Metric label="计划时长" value={durationLabel(monthStats.plannedMin)} />
                <Metric label="专注时长" value={durationLabel(monthStats.focusMin)} />
                <Metric label="到期任务" value={`${monthStats.due} 项`} />
                <Metric label="完成" value={`${monthStats.done} 项`} color={theme.success} />
              </View>
              <View style={styles.chips}>
                {monthStats.busiest ? (
                  <Chip label={`最满 ${dayHeadline(monthStats.busiest.date)} · ${durationLabel(monthStats.busiest.plannedMin)}`} />
                ) : null}
                <Chip
                  label={`执行率 ${monthStats.plannedMin ? Math.round((monthStats.focusMin / monthStats.plannedMin) * 100) : 0}%`}
                />
                {monthStats.busiest && monthStats.busiest.plannedMin > capacity ? (
                  <Chip
                    label={`超出可用窗口 ${durationLabel(monthStats.busiest.plannedMin - capacity)}`}
                    color={theme.warning}
                  />
                ) : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {monthLabel(month)}有 {monthStats.plannedDays}/{monthStats.days} 天排入了时间块，共{' '}
                {durationLabel(monthStats.plannedMin)}，其中真正专注 {durationLabel(monthStats.focusMin)}。
              </ThemedText>
            </Card>
          </ChromeScrollView>
        </GlassTarget>

        <GlassPanel
          onLayout={(e) => setHeaderH(Math.ceil(e.nativeEvent.layout.height))}
          style={[styles.floatHeader, styles.chrome]}
          padded={false}>
          <View style={styles.monthNav}>
            <Chip label="‹" small haptic="light" accessibilityLabel="上一月" onPress={() => shiftMonth(-1)} />
            <PressableScale onPress={goToday} outerStyle={styles.monthPressable}>
              <ThemedText style={styles.monthText}>{monthLabel(month)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                点按回到本月
              </ThemedText>
            </PressableScale>
            <Chip label="›" small haptic="light" accessibilityLabel="下一月" onPress={() => shiftMonth(1)} />
          </View>
          <ChromeDivider edge={edge} />
        </GlassPanel>
      </SafeAreaView>
    </ThemedView>
  );
}

function DayCellView({
  date,
  cell,
  peak,
  dimmed,
  isToday,
  selected,
  reduced,
  onPress,
}: {
  date: string;
  cell?: DayCell;
  peak: number;
  dimmed: boolean;
  isToday: boolean;
  selected: boolean;
  reduced: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const planned = cell?.plannedMin ?? 0;
  const focus = cell?.focusMin ?? 0;
  const load = Math.min(1, planned / peak);
  const day = fromKey(date).getDate();

  return (
    <PressableScale
      accessibilityLabel={`${dayHeadline(date)}，计划 ${durationLabel(planned)}，专注 ${durationLabel(focus)}`}
      onPress={onPress}
      outerStyle={styles.cellOuter}
      style={[
        styles.cell,
        !reduced && cellFade,
        { backgroundColor: heat(theme.accent, load * 0.34) },
        focus > 0 && { paddingBottom: 10 },
        dimmed && styles.cellDimmed,
        selected && { borderColor: theme.accent, borderWidth: 2 },
        isToday && !selected && { borderColor: theme.border, borderWidth: 1.5 },
      ]}>
      <View style={styles.cellTop}>
        <View style={[styles.dayBadge, isToday && { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: isToday ? theme.onAccent : theme.text, fontSize: 12 }}>
            {day}
          </ThemedText>
        </View>
        {cell?.due ? (
          <ThemedText type="small" style={{ color: theme.warning, fontSize: 10 }}>
            {cell.due}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.dots}>
        {(cell?.cats ?? []).map((cat) => (
          <View key={cat} style={[styles.dot, { backgroundColor: CATEGORY_MAP[cat].color }]} />
        ))}
      </View>

      {focus > 0 ? (
        <View style={[styles.focusTrack, { backgroundColor: `${theme.accent}26` }]}>
          <Animated.View
            style={[
              styles.focusFill,
              !reduced && focusGrow,
              { width: `${Math.max(10, Math.min(100, (focus / peak) * 100))}%`, backgroundColor: theme.success },
            ]}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={{ fontSize: 16, color: color ?? theme.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

const cellFade = {
  transitionProperty: ['backgroundColor', 'borderColor'] as ('backgroundColor' | 'borderColor')[],
  transitionDuration: [DURATION.toggle, DURATION.toggle] as '200ms'[],
  transitionTimingFunction: [EASE_UI, EASE_UI],
};

/** The fill is absolutely positioned and childless, so `width` here costs no sibling relayout. */
const focusGrow = {
  transitionProperty: 'width',
  transitionDuration: DURATION.chart,
  transitionTimingFunction: EASE_UI,
} as const;

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
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, justifyContent: 'space-between' },
  monthPressable: { flex: 1, alignItems: 'center', gap: 2 },
  monthText: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  scroll: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
  weekHead: { flexDirection: 'row', gap: Spacing.one },
  weekHeadText: { flex: 1, textAlign: 'center', fontSize: 11 },
  weekRow: { flexDirection: 'row', gap: Spacing.one },
  cellOuter: { flex: 1 },
  cell: {
    aspectRatio: 1 / 1.06,
    borderRadius: Radius.sm,
    padding: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'space-between',
  },
  cellDimmed: { opacity: 0.4 },
  cellTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dayBadge: { borderRadius: Radius.pill, paddingHorizontal: 3, minWidth: 18, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  focusTrack: { position: 'absolute', left: Spacing.one, right: Spacing.one, bottom: 3, height: 3, borderRadius: 2 },
  focusFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  heatSwatch: { width: 14, height: 10, borderRadius: 3 },
  focusSwatch: { width: 14, height: 3, borderRadius: 2 },
  dayMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  metric: { gap: 2 },
  blockList: { gap: Spacing.one },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  blockTime: { width: 44, fontVariant: ['tabular-nums'] },
  blockDot: { width: 6, height: 6, borderRadius: 3 },
  blockTitle: { flex: 1 },
  monthGridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
