import React, { useEffect, useReducer, userEffect, useState } from "react";
// import "core-js/stable/atob";
import { jwtDecode } from "jwt-decode"
import * as SecureStore from 'expo-secure-store'

import authReducer from "../Reducers/Auth.reducer";
import { setCurrentUser } from "../Actions/Auth.actions";
import AuthGlobal from './AuthGlobal'

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
                    dispatch(setCurrentUser(jwtDecode(token)));
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