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

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const permissionResponse = await Notifications.requestPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = await getExpoProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const pushToken = tokenResponse?.data;
    if (!pushToken) return null;

    await axios.put(
      `${baseURL}notifications/user/${userId}/push-token`,
      { pushToken },
      { headers: { Authorization: `Bearer ${jwtToken}` } }
    );

    return pushToken;
  } catch (error) {
    console.log('Push token registration skipped:', error?.message || error);
    return null;
  }
}
