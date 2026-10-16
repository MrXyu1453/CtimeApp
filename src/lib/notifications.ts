import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'ctime-focus';

let handlerRegistered = false;

function registerHandler() {
  if (handlerRegistered || Platform.OS === 'web') return;
  handlerRegistered = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '专注提醒',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  registerHandler();
  await configureAndroidChannel();
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Alerts are scheduled up front so they still fire with the app backgrounded.
 * Any pending alert is cancelled first, leaving only the live phase armed.
 */
export async function schedulePhaseAlert(atMs: number, title: string, body: string) {
  if (Platform.OS === 'web') return;
  registerHandler();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(atMs),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelPhaseAlert() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
