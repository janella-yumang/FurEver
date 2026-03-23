// import "core-js/stable/atob";
import { jwtDecode } from "jwt-decode"
import Toast from "react-native-toast-message"
import baseURL from "../../assets/common/baseurl"
import store from "../../Redux/store"
import { loadUserCart, loadUserWishlist, setCartUserId } from "../../Redux/Actions/cartActions"
import { SET_CART, SET_WISHLIST } from "../../Redux/constants"
import { registerPushTokenForUser } from "../../assets/common/pushNotifications"
import { setStoredJwt, getStoredJwt, clearStoredJwt } from "../../assets/common/authToken"

export const SET_CURRENT_USER = "SET_CURRENT_USER";

export const loginUser = (user, dispatch, navigation) => {
    const normalizedUser = {
        ...user,
        email: String(user?.email || '').trim().toLowerCase(),
        password: String(user?.password || ''),
    };

    fetch(`${baseURL}users/login`, {
        method: "POST",
        body: JSON.stringify(normalizedUser),
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    })
    .then((res) => {
        if (res.status === 403) {
            return res.json().then((data) => {
                Toast.show({
                    topOffset: 60,
                    type: "error",
                    text1: data.message || "Login failed",
                });
                return null;
            });
        }
        if (!res.ok) {
            return res.json().then((data) => {
                Toast.show({
                    topOffset: 60,
                    type: "error",
                    text1: data.message || "Login failed",
                    text2: `Status: ${res.status}`,
                });
                return null;
            });
        }
        return res.json();
    })
    .then(async (data) => {
        if (data && data.token) {
            const token = data.token;
            await setStoredJwt(token);
            const decoded = jwtDecode(token)
            dispatch(setCurrentUser(decoded, data.user || normalizedUser))

            registerPushTokenForUser(decoded.userId, token).catch((error) => {
                console.log('Push token registration failed:', error?.message || error);
            });

            // Load persisted cart & wishlist for this user
            const userId = decoded.userId;
            setCartUserId(userId);
            store.dispatch(loadUserCart(userId));
            store.dispatch(loadUserWishlist(userId));
        }
    })
    .catch((err) => {
        Toast.show({
            topOffset: 60,
            type: "error",
            text1: "Connection error",
            text2: "Cannot reach server. Is it running?",
        });
        logoutUser(dispatch)
    });
};

export const getUserProfile = (id) => {
    fetch(`${baseURL}users/${id}`, {
        method: "GET",
        body: JSON.stringify(user),
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
    })
    .then((res) => res.json())
    .then((data) => console.log(data));
}

export const logoutUser = async (dispatch) => {
    try {
        const token = await getStoredJwt();
        if (token) {
            const decoded = jwtDecode(token);
            if (decoded?.userId) {
                // Clear push token on server so stale tokens don't accumulate
                fetch(`${baseURL}notifications/user/${decoded.userId}/push-token`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
            }
        }
    } catch (_) {}
    await clearStoredJwt();
    setCartUserId(null);
    store.dispatch({ type: SET_CART, payload: [] });
    store.dispatch({ type: SET_WISHLIST, payload: [] });
    dispatch(setCurrentUser({}));
}

export const setCurrentUser = (decoded, user) => {
    return {
        type: SET_CURRENT_USER,
        payload: decoded,
        userProfile: user
    }
}