import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
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
    const [refreshing, setRefreshing] = useState(false);

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
                    // Cleanup if needed
                }
            }, [],
        )
    )

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        getOrders().finally(() => setRefreshing(false));
    }, []);

    const getOrders = async () => {
        try {
            const tokenCandidates = await getAuthTokenCandidates();
            if (!tokenCandidates.length) {
                setOrderList([]);
                setLoading(false);
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
                    // Verify token is not quick login
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
                        timeout: 10000,
                    });
                    
                    const data = Array.isArray(res.data) ? res.data : [];
                    setOrderList(data);
                    setLoading(false);
                    return;
                } catch (err) {
                    lastError = err;
                    continue;
                }
            }

            // Check if it's an offline admin account
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
                setLoading(false);
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
            setLoading(false);
            const errorMsg = error?.response?.data?.message || error?.message || 'Failed to load orders.';
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: errorMsg,
                text2: 'Please re-login as admin and try again.',
            });
        }
    }

    const renderOrderCard = ({ item }) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        return <OrderCard item={item} update={true} />;
    };

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
            <Text style={styles.heading}>Manage Orders ({Array.isArray(orderList) ? orderList.length : 0})</Text>
            {Array.isArray(orderList) && orderList.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No orders found</Text>
                </View>
            ) : (
                <FlatList
                    data={Array.isArray(orderList) ? orderList : []}
                    renderItem={renderOrderCard}
                    keyExtractor={(item, index) => {
                        if (!item) return `order-${index}`;
                        return String(item._id || item.id || index);
                    }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#FF8C42"
                        />
                    }
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