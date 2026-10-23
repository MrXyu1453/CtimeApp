import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, ProgressBar, SectionTitle, Segmented, Stepper, Tag } from '@/components/kit';
import { AmbientBackdrop } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { EASE_UI, DURATION } from '@/constants/motion';
import { CATEGORY_MAP } from '@/lib/catalog';
import {
  addDays,
  durationLabel,
  minToLabel,
  monthDates,
  shortDateLabel,
  startOfWeek,
  todayKey,
  weekdayLabel,
  weekDates,
} from '@/lib/date';
import { buildSummary } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import type { Appearance } from '@/lib/types';
import { warningHaptic } from '@/lib/haptics';
import { useEnter, useTransient } from '@/hooks/use-enter';
import { useSystemInsets } from '@/hooks/use-system-insets';
import { useGradients, useTheme } from '@/hooks/use-theme';

type Range = 'thisWeek' | 'lastWeek' | 'thisMonth';

const RANGES: { id: Range; label: string }[] = [
  { id: 'thisWeek', label: '本周' },
  { id: 'lastWeek', label: '上周' },
  { id: 'thisMonth', label: '本月' },
];

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'vivid', label: '活力白天' },
  { id: 'light', label: '素白' },
  { id: 'dark', label: '夜航' },
];

const CHART_HEIGHT = 96;

export default function StatsScreen() {
  const theme = useTheme();
  const gradients = useGradients();
  const insets = useSystemInsets();
  const reduced = useReducedMotion();
  const enter = useEnter(4);
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const [range, setRange] = useState<Range>('thisWeek');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const transient = useTransient();

  const dates = useMemo(() => {
    const today = todayKey();
    if (range === 'thisMonth') return monthDates(today);
    const anchor = range === 'lastWeek' ? addDays(startOfWeek(today), -7) : startOfWeek(today);
    return weekDates(anchor);
  }, [range]);

  const summary = useMemo(
    () => buildSummary(dates, tasks, blocks, sessions),
    [dates, tasks, blocks, sessions],
  );

  const peak = Math.max(60, ...summary.byDay.map((d) => Math.max(d.focusMin, d.plannedMin)));
  const insights = buildInsights(summary, settings.dayStartMin, settings.dayEndMin);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <AmbientBackdrop />
        <View style={styles.header}>
          <ThemedText type="subtitle">复盘</ThemedText>
          <Segmented items={RANGES} value={range} onChange={setRange} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.footer + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.metricGrid}>
            <Metric label="专注时长" value={durationLabel(summary.focusMin)} accent={theme.accent} entering={enter(0)} />
            <Metric label="专注轮次" value={`${summary.sessions} 轮`} entering={enter(1)} />
            <Metric label="计划时长" value={durationLabel(summary.plannedMin)} entering={enter(2)} />
            <Metric label="完成任务" value={`${summary.tasksDone} 项`} accent={theme.success} entering={enter(3)} />
          </View>

          <Card entering={enter(0)}>
            <SectionTitle>计划 vs 专注</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
              {summary.byDay.map((day) => (
                <View key={day.date} style={styles.chartCol}>
                  <View style={styles.bars}>
                    <ChartBar ratio={day.plannedMin / peak} color={theme.backgroundSelected} reduced={reduced} />
                    <ChartBar
                      ratio={day.focusMin / peak}
                      colors={day.date === todayKey() ? gradients.break : gradients.chart}
                      reduced={reduced}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.chartLabel}>
                    {range === 'thisMonth' ? shortDateLabel(day.date).replace('月', '/').replace('日', '') : weekdayLabel(day.date).slice(1)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.chartValue}>
                    {day.focusMin ? `${Math.round(day.focusMin / 60 * 10) / 10}h` : '—'}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
            <View style={styles.legend}>
              <LegendSwatch color={theme.backgroundSelected} label="计划" />
              <LegendSwatch color={gradients.chart[0]} label="实际专注" />
            </View>
          </Card>

          <Card entering={enter(1)}>
            <SectionTitle>时间去向</SectionTitle>
            {summary.byCategory.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                还没有专注记录，先去专注页完成一轮。
              </ThemedText>
            ) : (
              summary.byCategory.map((entry, i) => (
                <Animated.View key={entry.category} entering={enter(i)} style={styles.categoryRow}>
                  <Tag label={CATEGORY_MAP[entry.category].label} color={CATEGORY_MAP[entry.category].color} />
                  <View style={styles.categoryBar}>
                    <ProgressBar
                      value={entry.min / Math.max(1, summary.focusMin)}
                      color={CATEGORY_MAP[entry.category].color}
                    />
                  </View>
                  <ThemedText type="small" style={styles.categoryValue}>
                    {durationLabel(entry.min)}
                  </ThemedText>
                </Animated.View>
              ))
            )}
          </Card>

          <Card entering={enter(2)}>
            <SectionTitle>这段时间的排程</SectionTitle>
            <View style={styles.row}>
              <Chip label={`待办 ${summary.tasksOpen}`} />
              <Chip label={`逾期 ${summary.overdue}`} color={summary.overdue ? theme.danger : undefined} />
              <Chip label={`完成率 ${Math.round(summary.completionRate * 100)}%`} />
              {summary.busiestDay ? (
                <Chip label={`最投入 ${shortDateLabel(summary.busiestDay.date)}`} />
              ) : null}
            </View>
          </Card>

          <Card entering={enter(3)}>
            <SectionTitle>外观</SectionTitle>
            <Segmented items={APPEARANCES} value={settings.appearance} onChange={(appearance) => updateSettings({ appearance })} />
            <ThemedText type="small" themeColor="textSecondary">
              活力白天是高饱和的日间配色，配彩底与磨玻璃栏；跟随系统则随系统的深/浅色切换。
            </ThemedText>
          </Card>

          {insights.length ? (
            <Card entering={enter(3)}>
              <SectionTitle>建议</SectionTitle>
              {insights.map((text) => (
                <ThemedText key={text} type="small">
                  · {text}
                </ThemedText>
              ))}
            </Card>
          ) : null}

          <Card entering={enter(4)}>
            <SectionTitle>专注与作息设置</SectionTitle>
            <Stepper
              label="每轮专注"
              value={settings.focusMin}
              suffix="分钟"
              min={5}
              max={120}
              onStep={(delta) => updateSettings({ focusMin: clamp(settings.focusMin + delta, 5, 120) })}
            />
            <Stepper
              label="休息时长"
              value={settings.breakMin}
              suffix="分钟"
              min={1}
              max={60}
              onStep={(delta) => updateSettings({ breakMin: clamp(settings.breakMin + delta, 1, 60) })}
            />
            <Stepper
              label="每天计划从"
              value={settings.dayStartMin}
              suffix="时"
              min={0}
              max={settings.dayEndMin - 60}
              onStep={(delta) =>
                updateSettings({ dayStartMin: clamp(settings.dayStartMin + delta, 0, settings.dayEndMin - 60) })
              }
              display={minToLabel(settings.dayStartMin)}
            />
            <Stepper
              label="每天计划到"
              value={settings.dayEndMin}
              suffix="时"
              min={settings.dayStartMin + 60}
              max={24 * 60 - 60}
              onStep={(delta) =>
                updateSettings({ dayEndMin: clamp(settings.dayEndMin + delta, settings.dayStartMin + 60, 24 * 60 - 60) })
              }
              display={minToLabel(settings.dayEndMin)}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {settings.notificationsEnabled
                ? '专注结束时会发送本地通知。'
                : '通知未开启，专注结束只有应用内提示。'}
            </ThemedText>
          </Card>

          {confirmingReset ? (
            <Card
              tint={theme.danger}
              entering={transient.entering}
              exiting={transient.exiting}
              style={{ borderColor: theme.danger }}>
              <ThemedText type="small">
                将删除全部 {tasks.length} 项任务、{blocks.length} 个时间块和 {sessions.length} 条专注记录，且无法恢复。
              </ThemedText>
              <View style={styles.row}>
                <Button
                  label="确认清空"
                  variant="danger"
                  onPress={() => {
                    warningHaptic();
                    resetAll();
                    setConfirmingReset(false);
                  }}
                />
                <Button label="取消" variant="ghost" onPress={() => setConfirmingReset(false)} />
              </View>
            </Card>
          ) : (
            <Button label="清空所有数据" variant="ghost" onPress={() => setConfirmingReset(true)} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Metric({
  label,
  value,
  accent,
  entering,
}: {
  label: string;
  value: string;
  accent?: string;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <Card entering={entering} style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Animated.Text
        key={value}
        entering={reduced ? undefined : FadeInDown.duration(180)}
        style={{
          fontSize: 19,
          fontWeight: '700',
          color: accent ?? theme.text,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Animated.Text>
    </Card>
  );
}

/**
 * Bars grow with scaleY on an absolutely positioned, childless fill — animating height
 * here would re-run layout for every column on each frame.
 */
function ChartBar({
  ratio,
  color,
  colors,
  reduced,
}: {
  ratio: number;
  color?: string;
  colors?: readonly [string, string, ...string[]];
  reduced: boolean;
}) {
  const clamped = Math.max(0.03, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color ?? 'transparent',
            transform: [{ scaleY: clamped }],
            ...(reduced
              ? { transitionProperty: 'none' as const }
              : {
                  transitionProperty: 'transform' as const,
                  transitionDuration: DURATION.chart,
                  transitionTimingFunction: EASE_UI,
                }),
          },
        ]}>
        {colors ? (
          <LinearGradient colors={colors} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={styles.barGradient} />
        ) : null}
      </Animated.View>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildInsights(
  summary: ReturnType<typeof buildSummary>,
  dayStart: number,
  dayEnd: number,
): string[] {
  const out: string[] = [];
  const capacity = (dayEnd - dayStart) * summary.dates.length;
  if (summary.plannedMin === 0 && summary.tasksOpen > 0) {
    out.push('还没有排入任何时间块，去今日页点「自动排程」把待办落到具体时段。');
  }
  if (summary.plannedMin > capacity * 0.8) {
    out.push('计划的时长已接近当天可用时间的上限，留出缓冲更容易坚持完成。');
  }
  if (summary.plannedMin > 0 && summary.focusMin < summary.plannedMin * 0.6) {
    out.push(
      `计划 ${durationLabel(summary.plannedMin)}，实际专注 ${durationLabel(summary.focusMin)}，执行率偏低；试着把时间块缩短到 25 分钟。`,
    );
  }
  if (summary.overdue > 0) {
    out.push(`有 ${summary.overdue} 项任务已逾期，建议重新设定截止日期或拆分到 30 分钟内。`);
  }
  if (summary.focusMin > 0 && summary.byCategory[0] && summary.byCategory[0].min > summary.focusMin * 0.75) {
    out.push(
      `${CATEGORY_MAP[summary.byCategory[0].category].label}占了大部分专注时间，注意给其他分类也留出时段。`,
    );
  }
  return out;
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  scroll: { gap: Spacing.two },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metric: { minWidth: 140, flex: 1 },
  chartRow: { gap: Spacing.three, paddingVertical: Spacing.two, alignItems: 'flex-end' },
  chartCol: { alignItems: 'center', gap: Spacing.half, width: 54 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: CHART_HEIGHT },
  barTrack: { width: 14, height: CHART_HEIGHT, borderRadius: 4, overflow: 'hidden' },
  barFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    transformOrigin: 'bottom',
  },
  barGradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  chartLabel: { fontSize: 11 },
  chartValue: { fontSize: 11 },
  legend: { flexDirection: 'row', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  categoryBar: { flex: 1 },
  categoryValue: { minWidth: 68, textAlign: 'right' },
});
