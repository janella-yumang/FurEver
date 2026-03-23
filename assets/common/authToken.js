import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'jwt';

export const getStoredJwt = async () => {
  const secureToken = await SecureStore.getItemAsync(JWT_KEY);
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem(JWT_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(JWT_KEY, legacyToken);
    await AsyncStorage.removeItem(JWT_KEY);
    return legacyToken;
  }

  return null;
};

export const setStoredJwt = async (token) => {
  if (!token) {
    await clearStoredJwt();
    return;
  }

  await SecureStore.setItemAsync(JWT_KEY, token);
  await AsyncStorage.removeItem(JWT_KEY);
};

export const clearStoredJwt = async () => {
  await SecureStore.deleteItemAsync(JWT_KEY).catch(() => {});
  await AsyncStorage.removeItem(JWT_KEY).catch(() => {});
};
