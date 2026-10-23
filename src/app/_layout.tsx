import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppTabs from '@/components/app-tabs';
import { useFocusEngine } from '@/hooks/use-focus-engine';
import { usePalette } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const palette = usePalette();
  const hydrated = useStore((s) => s.hydrated);
  useFocusEngine();

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <ThemeProvider value={palette === 'dark' ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Edge-to-edge puts the screen under the status bar, so the icon color is ours to set. */}
        <StatusBar style={palette === 'dark' ? 'light' : 'dark'} />
        <AppTabs />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
