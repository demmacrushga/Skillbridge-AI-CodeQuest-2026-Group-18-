// Safe wrapper around expo-notifications.
// Expo Go removed push notification support in SDK 53, so importing the module
// directly crashes the app. This wrapper catches the import error and provides
// no-op fallbacks so the rest of the app works in Expo Go.

let Notifications: any = null;

try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('[notifications] expo-notifications is not available in this environment:', e);
}

export async function requestPermissionsAsync(): Promise<{ granted: boolean }> {
  if (!Notifications) {
    return { granted: false };
  }
  return Notifications.requestPermissionsAsync();
}

export async function getExpoPushTokenAsync(): Promise<{ data: string }> {
  if (!Notifications) {
    throw new Error('Push notifications are not available in Expo Go. Use a development build.');
  }
  return Notifications.getExpoPushTokenAsync();
}
