
import React, { useState, useContext, useEffect } from "react";
import { View, Text, StyleSheet, Button, Dimensions, TouchableOpacity, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage'
import FormContainer from "../../Shared/FormContainer";
import { Ionicons } from "@expo/vector-icons";
import { jwtDecode } from "jwt-decode";
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import AuthGlobal from '../../Context/Store/AuthGlobal'
import { loginUser, setCurrentUser } from '../../Context/Actions/Auth.actions'
import { loadUserCart, loadUserWishlist, setCartUserId } from '../../Redux/Actions/cartActions'
import { useDispatch } from 'react-redux'
import Input from "../../Shared/Input";
import Toast from "react-native-toast-message";
import baseURL from "../../assets/common/baseurl";
import { findQuickLoginAccount, generateOfflineJWT } from "../../assets/common/quickLoginAccounts";

var { width } = Dimensions.get('window')

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '664610879987-0nnaap8m3cqeho1d5kanddnus8t8o969.apps.googleusercontent.com';

// Expo auth proxy URL — this goes in Google Cloud Console as the Authorized redirect URI
const EXPO_PROXY_REDIRECT = 'https://auth.expo.io/@erp15/ITCP239-s-2026';

const Login = (props) => {
    const context = useContext(AuthGlobal)
    const navigation = useNavigation()
    const reduxDispatch = useDispatch()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState("")
    const [googleLoading, setGoogleLoading] = useState(false);

    // ─── Google Sign-In via Expo Auth Proxy ───
    // This manually builds the proxy flow so it works reliably in Expo Go
    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            // Where Expo Go should return after auth
            const returnUrl = Linking.createURL('expo-auth-session');

            // Generate a random nonce for id_token request
            const nonce = Math.random().toString(36).substring(2, 18);

            // Build the Google OAuth URL with the proxy as redirect_uri
            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}` +
                `&redirect_uri=${encodeURIComponent(EXPO_PROXY_REDIRECT)}` +
                `&response_type=id_token` +
                `&scope=${encodeURIComponent('openid profile email')}` +
                `&nonce=${nonce}` +
                `&prompt=select_account`;

            // Build the proxy start URL — this is the key to making it work in Expo Go
            const proxyStartUrl = `${EXPO_PROXY_REDIRECT}/start?` +
                `authUrl=${encodeURIComponent(googleAuthUrl)}` +
                `&returnUrl=${encodeURIComponent(returnUrl)}`;

            console.log('🔗 Opening Google Sign-In via Expo proxy...');
            console.log('📋 Return URL:', returnUrl);

            // Open browser via proxy
            const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, returnUrl);

            if (result.type === 'success' && result.url) {
                // Parse the returned URL for the id_token
                const params = new URLSearchParams(result.url.split('#')[1] || result.url.split('?')[1] || '');
                const idToken = params.get('id_token');

                if (idToken) {
                    await handleGoogleLogin(idToken);
                } else {
                    const errorMsg = params.get('error') || 'No ID token received';
                    console.error('Google auth error:', errorMsg);
                    Toast.show({
                        topOffset: 60,
                        type: 'error',
                        text1: 'Google Sign-In Error',
                        text2: errorMsg,
                    });
                }
            } else if (result.type === 'cancel' || result.type === 'dismiss') {
                console.log('Google Sign-In cancelled by user');
            }
        } catch (err) {
            console.error('Google Sign-In error:', err);
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: 'Google Sign-In Error',
                text2: err.message || 'Something went wrong',
            });
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleGoogleLogin = async (idToken) => {
        setGoogleLoading(true);
        try {
            // Decode the Google ID token to get user info
            const decoded = jwtDecode(idToken);
            const { sub: googleId, email: googleEmail, name: googleName, picture: googlePhoto } = decoded;

            // Send to backend for verification and JWT generation
            const res = await fetch(`${baseURL}users/google-login`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    googleId,
                    email: googleEmail,
                    name: googleName,
                    profilePhoto: googlePhoto,
                }),
            });

            const data = await res.json();

            if (data.token) {
                // Save JWT and set auth context
                await AsyncStorage.setItem('jwt', data.token);
                const tokenDecoded = jwtDecode(data.token);
                
                context.dispatch(setCurrentUser(tokenDecoded, data.user));
                setCartUserId(tokenDecoded.userId);
                reduxDispatch(loadUserCart(tokenDecoded.userId));
                reduxDispatch(loadUserWishlist(tokenDecoded.userId));

                Toast.show({
                    topOffset: 60,
                    type: 'success',
                    text1: `Welcome, ${data.user.name}!`,
                    text2: 'Logged in with Google',
                });
                navigation.navigate('Home');
            } else {
                Toast.show({
                    topOffset: 60,
                    type: 'error',
                    text1: 'Google login failed',
                    text2: data.message || 'Please try again',
                });
            }
        } catch (err) {
            console.error('Google login error:', err);
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: 'Google login failed',
                text2: err.message || 'Please try again',
            });
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSubmit = () => {
        const user = {
            email,
            password,
        };

        if (email === "" || password === "") {
            setError("Please fill in your credentials");
        } else {
            loginUser(user, context.dispatch, navigation);
        }
    };

    // Quick-login helper — offline mode (works without internet/database)
    const quickLogin = async (email, accountType) => {
        try {
            // Offline quick login - works without internet
            const account = findQuickLoginAccount(email, "password123");
            
            if (account) {
                // Generate offline token for development
                const token = generateOfflineJWT(account);
                await AsyncStorage.setItem("jwt", token);
                
                const decoded = jwtDecode(token);
                
                // Set authentication context
                context.dispatch(setCurrentUser(decoded, account));

                // Load persisted cart & wishlist for this user
                setCartUserId(decoded.userId);
                reduxDispatch(loadUserCart(decoded.userId));
                reduxDispatch(loadUserWishlist(decoded.userId));

                Toast.show({
                    topOffset: 60,
                    type: "success",
                    text1: `Logged in as ${account.name}`,
                    text2: `${account.type === "admin" ? "Admin" : "Customer"} (Offline)`,
                });
            } else {
                Toast.show({
                    topOffset: 60,
                    type: "error",
                    text1: "Quick login failed",
                    text2: "Account not found in local system",
                });
            }
        } catch (err) {
            console.error("Quick login error:", err);
            Toast.show({
                topOffset: 60,
                type: "error",
                text1: "Offline auth error",
                text2: err.message || "Please try manual login",
            });
        }
    };

    useEffect(() => {
        if (context.stateUser.isAuthenticated === true) {
            navigation.navigate("Home")
        }
    }, [context.stateUser.isAuthenticated])

    return (
        <FormContainer title="🐾 Furever Pet Store" >
            <Input
                placeholder={"Enter email"}
                name={"email"}
                id={"email"}
                value={email}
                onChangeText={(text) => setEmail(text.toLowerCase())}
            />
            <Input
                placeholder={"Enter Password"}
                name={"password"}
                id={"password"}
                secureTextEntry={true}
                value={password}
                onChangeText={(text) => setPassword(text)}
            />
            <View style={styles.authRow}>
                <TouchableOpacity
                    style={[styles.authBtn, styles.loginBtn]}
                    onPress={() => handleSubmit()}
                >
                    <Text style={styles.authBtnText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.authBtn, styles.registerBtn]}
                    onPress={() => navigation.navigate("Register")}
                >
                    <Text style={styles.authBtnText}>Register</Text>
                </TouchableOpacity>
            </View>

            {/* ── Google Login Button ── */}
            <TouchableOpacity
                style={styles.googleLoginBtn}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
            >
                <Ionicons name="logo-google" size={20} color="white" />
                <Text style={styles.googleLoginBtnText}>
                    {googleLoading ? 'Signing in...' : 'Sign in with Google'}
                </Text>
            </TouchableOpacity>

            {/* ── Quick-login test accounts ── */}
            <View style={styles.quickSection}>
                <Text style={styles.quickLabel}>— Quick Login (no password) —</Text>
                <View style={styles.quickRow}>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#20C997' }]}
                        onPress={() => quickLogin('user@furever.com', 'user')}
                    >
                        <Ionicons name="person" size={18} color="white" />
                        <Text style={styles.quickBtnText}>User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: '#FF8C42' }]}
                        onPress={() => quickLogin('admin@furever.com', 'admin')}
                    >
                        <Ionicons name="shield" size={18} color="white" />
                        <Text style={styles.quickBtnText}>Admin</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.quickHint}>Emma Pascua  ·  Jannella Yumang</Text>
            </View>

            <View style={styles.buttonGroup}>
                <Text style={styles.middleText}>Don't have an account yet?</Text>
            </View>
        </FormContainer>
    )
}
const styles = StyleSheet.create({
    buttonGroup: {
        width: "80%",
        alignItems: "center",
    },
    authRow: {
        width: "80%",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 10,
    },
    authBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    loginBtn: {
        backgroundColor: "#FF8C42",
    },
    registerBtn: {
        backgroundColor: "#20C997",
    },
    authBtnText: {
        color: "white",
        fontSize: 16,
        fontWeight: "700",
    },
    middleText: {
        marginBottom: 60,
        alignSelf: "center",
    },
    quickSection: {
        width: "80%",
        alignItems: "center",
        marginVertical: 20,
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    quickLabel: {
        fontSize: 13,
        color: '#999',
        marginBottom: 12,
    },
    quickRow: {
        flexDirection: 'row',
        gap: 12,
    },
    quickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 8,
    },
    quickBtnText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
    },
    quickHint: {
        fontSize: 11,
        color: '#bbb',
        marginTop: 10,
    },
    googleLoginBtn: {
        width: '80%',
        backgroundColor: '#4285F4',
        paddingVertical: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
    },
    googleLoginBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
});
export default Login;