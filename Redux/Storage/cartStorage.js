import AsyncStorage from '@react-native-async-storage/async-storage';

const normalizeUserId = (userId) => String(userId || 'guest');
const cartKey = (userId) => `@cart_${normalizeUserId(userId)}`;

export const saveCartItems = async (userId, items = []) => {
    await AsyncStorage.setItem(cartKey(userId), JSON.stringify(Array.isArray(items) ? items : []));
};

export const getCartItems = async (userId) => {
    const data = await AsyncStorage.getItem(cartKey(userId));
    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const clearCartItems = async (userId) => {
    await AsyncStorage.removeItem(cartKey(userId));
};
