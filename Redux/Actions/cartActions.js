import {
    ADD_TO_CART,
    REMOVE_FROM_CART,
    CLEAR_CART,
    UPDATE_CART_QUANTITY,
    SET_CART,
    ADD_TO_WISHLIST,
    REMOVE_FROM_WISHLIST,
    CLEAR_WISHLIST,
    SET_WISHLIST
} from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCartItems, getCartItems, saveCartItems } from '../Storage/cartStorage';

// ─── Persistence helpers ─────────────────────────────────────────────
let _currentUserId = null;

export const setCartUserId = (userId) => {
    _currentUserId = userId;
};

const wishlistKey = (userId) => `@wishlist_${userId || 'guest'}`;

const persistCart = async (getState) => {
    try {
        const items = getState().cartItems;
        await saveCartItems(_currentUserId, items);
    } catch (e) {
        console.log('Persist cart error:', e);
    }
};

const persistWishlist = async (getState) => {
    try {
        const items = getState().wishlistItems;
        await AsyncStorage.setItem(wishlistKey(_currentUserId), JSON.stringify(items));
    } catch (e) {
        console.log('Persist wishlist error:', e);
    }
};

// ─── Load persisted cart & wishlist for a user ───────────────────────
export const loadUserCart = (userId) => {
    return async (dispatch) => {
        try {
            setCartUserId(userId);
            const items = await getCartItems(userId);
            dispatch({ type: SET_CART, payload: items });
        } catch (e) {
            console.log('Load cart error:', e);
        }
    };
};

export const loadUserWishlist = (userId) => {
    return async (dispatch) => {
        try {
            const data = await AsyncStorage.getItem(wishlistKey(userId));
            const items = data ? JSON.parse(data) : [];
            dispatch({ type: SET_WISHLIST, payload: items });
        } catch (e) {
            console.log('Load wishlist error:', e);
        }
    };
};

// ─── Cart actions (with persistence) ─────────────────────────────────
export const addToCart = (payload) => {
    return (dispatch, getState) => {
        dispatch({ type: ADD_TO_CART, payload });
        persistCart(getState);
    };
};

export const removeFromCart = (payload) => {
    return (dispatch, getState) => {
        dispatch({ type: REMOVE_FROM_CART, payload });
        persistCart(getState);
    };
};

export const clearCart = () => {
    return async (dispatch, getState) => {
        dispatch({ type: CLEAR_CART });
        await clearCartItems(_currentUserId);
        persistCart(getState);
    };
};

export const updateCartQuantity = (id, quantity) => {
    return (dispatch, getState) => {
        dispatch({ type: UPDATE_CART_QUANTITY, payload: { id, quantity } });
        persistCart(getState);
    };
};

// ─── Wishlist actions (with persistence) ─────────────────────────────
export const addToWishlist = (payload) => {
    return (dispatch, getState) => {
        dispatch({ type: ADD_TO_WISHLIST, payload });
        persistWishlist(getState);
    };
};

export const removeFromWishlist = (payload) => {
    return (dispatch, getState) => {
        dispatch({ type: REMOVE_FROM_WISHLIST, payload });
        persistWishlist(getState);
    };
};

export const clearWishlist = () => {
    return (dispatch, getState) => {
        dispatch({ type: CLEAR_WISHLIST });
        persistWishlist(getState);
    };
};