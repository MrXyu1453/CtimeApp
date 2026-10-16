import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';

export default function AppTabs() {
  const colors = Colors[usePalette()];
  const openCount = useStore((s) => s.tasks.filter((t) => t.status === 'todo').length);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>今日</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="sun.max"
          src={require('@/assets/images/tabIcons/today.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>日历</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="square.grid.3x3"
          src={require('@/assets/images/tabIcons/calendar.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Label>任务</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="checklist"
          src={require('@/assets/images/tabIcons/tasks.png')}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Badge>{openCount > 0 ? String(openCount) : undefined}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="focus">
        <NativeTabs.Trigger.Label>专注</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="timer"
          src={require('@/assets/images/tabIcons/focus.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>复盘</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="chart.bar.xaxis"
          src={require('@/assets/images/tabIcons/stats.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
