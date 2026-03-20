import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import baseURL from './baseurl';

async function getExpoProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

function isExpoGoClient() {
  return (
    Constants?.executionEnvironment === 'storeClient' ||
    Constants?.appOwnership === 'expo'
  );
}

async function loadNotificationsModule() {
  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  return Notifications;
}

export async function registerPushTokenForUser(userId, jwtToken) {
  try {
    if (!userId || !jwtToken) return null;
    if (Platform.OS === 'web') return null;

    // Expo Go (SDK 53+) no longer supports remote push tokens.
    if (isExpoGoClient()) {
      console.log('Push registration skipped: use a development build for remote notifications.');
      return null;
    }

    const Notifications = await loadNotificationsModule();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C42',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const permissionResponse = await Notifications.requestPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    let pushToken = null;
    let tokenProvider = null;

    try {
      const projectId = await getExpoProjectId();
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      pushToken = tokenResponse?.data || null;
      tokenProvider = 'expo';
    } catch (_expoTokenErr) {
      // Fall back to native token only when Expo token is unavailable.
    }

    if (!pushToken) {
      const nativeToken = await Notifications.getDevicePushTokenAsync();
      pushToken = nativeToken?.data || null;
      tokenProvider = nativeToken?.type === 'android' ? 'fcm' : 'native';
    }

    if (!pushToken) return null;

    await axios.put(
      `${baseURL}notifications/user/${userId}/push-token`,
      { pushToken, tokenProvider },
      { headers: { Authorization: `Bearer ${jwtToken}` } }
    );

    return pushToken;
  } catch (error) {
    console.log('Push token registration skipped:', error?.message || error);
    return null;
  }
}
