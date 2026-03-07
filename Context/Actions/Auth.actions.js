// import "core-js/stable/atob";
import { jwtDecode } from "jwt-decode"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Toast from "react-native-toast-message"
import baseURL from "../../assets/common/baseurl"
import store from "../../Redux/store"
import { loadUserCart, loadUserWishlist, setCartUserId } from "../../Redux/Actions/cartActions"
import { SET_CART, SET_WISHLIST } from "../../Redux/constants"

export const SET_CURRENT_USER = "SET_CURRENT_USER";

export const loginUser = (user, dispatch, navigation) => {
    fetch(`${baseURL}users/login`, {
        method: "POST",
        body: JSON.stringify(user),
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    })
    .then((res) => {
        if (res.status === 403) {
            return res.json().then((data) => {
                if (data.requiresVerification) {
                    Toast.show({
                        topOffset: 60,
                        type: "info",
                        text1: "Email not verified",
                        text2: "Please verify your email to continue.",
                    });
                    if (navigation) {
                        navigation.navigate("Verify Email", { email: data.email || user.email });
                    }
                } else {
                    Toast.show({
                        topOffset: 60,
                        type: "error",
                        text1: data.message || "Login failed",
                    });
                }
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
    .then((data) => {
        if (data && data.token) {
            const token = data.token;
            AsyncStorage.setItem("jwt", token)
            const decoded = jwtDecode(token)
            console.log("token",token)
            dispatch(setCurrentUser(decoded, data.user || user))

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

export const logoutUser = (dispatch) => {
    AsyncStorage.removeItem("jwt");
    // Clear Redux cart/wishlist state but keep AsyncStorage data for next login
    setCartUserId(null);
    store.dispatch({ type: SET_CART, payload: [] });
    store.dispatch({ type: SET_WISHLIST, payload: [] });
    dispatch(setCurrentUser({}))
}

export const setCurrentUser = (decoded, user) => {
    return {
        type: SET_CURRENT_USER,
        payload: decoded,
        userProfile: user
    }
}