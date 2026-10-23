import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'ctime-focus';

let handlerRegistered = false;
let channelReady: Promise<void> | null = null;

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

function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '专注提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    })
      .then(() => {})
      .catch(() => {});
  }
  return channelReady;
}

/** Safe to call from the root: registers foreground presentation and the Android channel early. */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  registerHandler();
  await configureAndroidChannel();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  initNotifications();
  try {
    const status = await Notifications.getPermissionsAsync();
    if (status.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Alerts are scheduled up front so they still fire with the app backgrounded.
 * The engine keeps exactly one armed alert for the live phase.
 */
export async function schedulePhaseAlert(atMs: number, title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    await initNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(atMs),
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // Permission revoked or the OS scheduler refused; in-app timing stays correct regardless.
  }
}

export async function cancelPhaseAlert() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing was armed.
  }
}
