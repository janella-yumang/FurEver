import React, { useEffect, useReducer, useState } from "react";
// import "core-js/stable/atob";
import { jwtDecode } from "jwt-decode"
import * as SecureStore from 'expo-secure-store'

import authReducer from "../Reducers/Auth.reducer";
import { setCurrentUser } from "../Actions/Auth.actions";
import AuthGlobal from './AuthGlobal'
import { registerPushTokenForUser } from '../../assets/common/pushNotifications';

const Auth = props => {
    // console.log(props.children)
    const [stateUser, dispatch] = useReducer(authReducer, {
        isAuthenticated: null,
        user: {}
    });
    const [showChild, setShowChild] = useState(false);

    useEffect(() => {
        setShowChild(true);
        SecureStore.getItemAsync('jwt').then((token) => {
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    dispatch(setCurrentUser(decoded));
                    registerPushTokenForUser(decoded?.userId, token).catch((error) => {
                        console.log('Push bootstrap registration failed:', error?.message || error);
                    });
                } catch (_) {}
            }
        }).catch(() => {});
        return () => setShowChild(false);
    }, [])


    if (!showChild) {
        return null;
    } else {
        return (
            <AuthGlobal.Provider
                value={{
                    stateUser,
                    dispatch
                }}
            >
                {props.children}
            </AuthGlobal.Provider>
        )
    }
};

export default Auth