import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import axios from 'axios'
import baseURL from "../../assets/common/baseurl";
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import OrderCard from "../../Shared/OrderCard";

const Orders = (props) => {
    const [orderList, setOrderList] = useState([]);
    const [loading, setLoading] = useState(true);

    const getAuthTokenCandidates = useCallback(async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        const asyncToken = await AsyncStorage.getItem('jwt');
        return [secureToken, asyncToken].filter((token, idx, arr) => !!token && arr.indexOf(token) === idx);
    }, []);

    useFocusEffect(
        useCallback(
            () => {
                getOrders();
                return () => {
                    setOrderList([]);
                }
            }, [],
        )
    )

    const getOrders = async () => {
        setLoading(true);
        try {
            const tokenCandidates = await getAuthTokenCandidates();
            if (!tokenCandidates.length) {
                setOrderList([]);
                Toast.show({
                    topOffset: 60,
                    type: 'info',
                    text1: 'Admin login required.',
                    text2: 'Please sign in to load orders.',
                });
                return;
            }

            let lastError = null;
            for (const candidate of tokenCandidates) {
                try {
                    const decoded = jwtDecode(candidate);
                    if (String(decoded?.userId || '').startsWith('quick-')) {
                        continue;
                    }
                } catch (_decodeErr) {
                    // Let backend validate malformed/expired tokens.
                }

                try {
                    const res = await axios.get(`${baseURL}orders`, {
                        headers: { Authorization: `Bearer ${candidate}` },
                    });
                    setOrderList(Array.isArray(res.data) ? res.data : []);
                    return;
                } catch (err) {
                    lastError = err;
                }
            }

            const looksOfflineOnly = tokenCandidates.some((candidate) => {
                try {
                    const decoded = jwtDecode(candidate);
                    return String(decoded?.userId || '').startsWith('quick-');
                } catch (_decodeErr) {
                    return false;
                }
            });

            if (looksOfflineOnly) {
                setOrderList([]);
                Toast.show({
                    topOffset: 60,
                    type: 'info',
                    text1: 'Offline admin account detected.',
                    text2: 'Use online admin login to manage orders.',
                });
                return;
            }

            throw lastError || new Error('Failed to load orders.');
        } catch (error) {
            console.log('Load admin orders error:', error?.response?.data || error?.message || error);
            setOrderList([]);
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: error?.response?.data?.message || 'Failed to load orders.',
                text2: 'Please re-login as admin and try again.',
            });
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF8C42" />
                <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Manage Orders ({orderList.length})</Text>
            {orderList.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No orders found</Text>
                </View>
            ) : (
                <FlatList
                    data={orderList}
                    renderItem={({ item }) => (
                        <OrderCard item={item} update={true} />
                    )}
                    keyExtractor={(item) => item.id || item._id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        padding: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#888',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
});

export default Orders;