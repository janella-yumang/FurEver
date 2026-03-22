import React, { useState, useContext, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Image, Alert, ActivityIndicator
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserOrders } from '../../Redux/Actions/orderActions';

var { width } = Dimensions.get('window');

const STATUS_CONFIG = {
    Pending: { label: 'Pending', color: '#FF8C42', icon: 'time', step: 0 },
    Processing: { label: 'Processing', color: '#339AF0', icon: 'construct', step: 1 },
    Shipped: { label: 'Shipped', color: '#FFD43B', icon: 'airplane', step: 2 },
    Delivered: { label: 'Delivered', color: '#51CF66', icon: 'checkmark-circle', step: 3 },
    Canceled: { label: 'Canceled', color: '#FF6B6B', icon: 'close-circle', step: -1 },
};

const TRACKING_STEPS = ['Pending', 'Processing', 'Shipped', 'Delivered'];

const OrderHistory = () => {
    const context = useContext(AuthGlobal);
    const navigation = useNavigation();
    const route = useRoute();
    const dispatch = useDispatch();
    const orders = useSelector((state) => state.orders?.data || []);
    const [loading, setLoading] = useState(true);

    const getAuthToken = async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        if (secureToken) return secureToken;
        
        const asyncToken = await AsyncStorage.getItem('jwt');
        return asyncToken || null;
    };

    const focusedOrderId = route.params?.focusOrderId
        ? String(route.params.focusOrderId)
        : null;
    const openedFromPush = route.params?.source === 'push';

    const displayedOrders = useMemo(() => {
        if (!focusedOrderId) return orders;

        const targetIndex = orders.findIndex(
            (order) => String(order.id || order._id || '') === focusedOrderId
        );

        if (targetIndex < 0) return orders;

        const next = [...orders];
        const [targetOrder] = next.splice(targetIndex, 1);
        next.unshift(targetOrder);
        return next;
    }, [orders, focusedOrderId]);

    const fetchOrders = useCallback(() => {
        if (
            context.stateUser.isAuthenticated === false ||
            context.stateUser.isAuthenticated === null
        ) {
            navigation.navigate('Login');
            return;
        }

        setLoading(true);
        const userId = context.stateUser.user.userId;

        getAuthToken()
            .then((token) => {
                dispatch(fetchUserOrders(userId, token))
                    .finally(() => {
                        setLoading(false);
                    });
            })
            .catch((err) => {
                console.log(err);
                setLoading(false);
            });
    }, [context.stateUser.isAuthenticated, context.stateUser.user, dispatch]);

    useFocusEffect(fetchOrders);

    const handleCancelOrder = (order) => {
        const status = order.status || 'Pending';
        if (['Shipped', 'Delivered'].includes(status)) {
            Alert.alert(
                'Cannot Cancel',
                'This order has already been shipped or delivered and cannot be canceled.'
            );
            return;
        }
        if (status === 'Canceled') {
            Alert.alert('Already Canceled', 'This order has already been canceled.');
            return;
        }

        Alert.alert(
            'Cancel Order',
            `Are you sure you want to cancel order #${(order.id || order._id || '').toString().slice(-8)}?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: () => {
                        getAuthToken().then((token) => {
                            axios
                                .put(
                                    `${baseURL}orders/${order.id || order._id}`,
                                    { status: 'Canceled' },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                )
                                .then(() => {
                                    Toast.show({
                                        topOffset: 60,
                                        type: 'success',
                                        text1: 'Order Canceled',
                                        text2: 'Your order has been canceled.',
                                    });
                                    fetchOrders();
                                })
                                .catch((err) => {
                                    Toast.show({
                                        topOffset: 60,
                                        type: 'error',
                                        text1: 'Cancel Failed',
                                        text2: err.response?.data?.message || 'Please try again.',
                                    });
                                });
                        });
                    },
                },
            ]
        );
    };

    const handleMarkDelivered = (order) => {
        Alert.alert(
            'Confirm Delivery',
            `Have you received order #${(order.id || order._id || '').toString().slice(-8)}?`,
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Yes, Received',
                    onPress: () => {
                        getAuthToken().then((token) => {
                            axios
                                .put(
                                    `${baseURL}orders/${order.id || order._id}`,
                                    { status: 'Delivered' },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                )
                                .then(() => {
                                    Toast.show({
                                        topOffset: 60,
                                        type: 'success',
                                        text1: 'Order Delivered',
                                        text2: 'Thank you for confirming delivery!',
                                    });
                                    fetchOrders();
                                })
                                .catch((err) => {
                                    Toast.show({
                                        topOffset: 60,
                                        type: 'error',
                                        text1: 'Update Failed',
                                        text2: err.response?.data?.message || 'Please try again.',
                                    });
                                });
                        });
                    },
                },
            ]
        );
    };

    const renderTrackingSteps = (currentStatus) => {
        const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.Pending;
        if (cfg.step === -1) {
            return (
                <View style={styles.canceledBanner}>
                    <Ionicons name="close-circle" size={16} color="#FF6B6B" />
                    <Text style={styles.canceledText}>This order has been canceled</Text>
                </View>
            );
        }

        return (
            <View style={styles.trackingContainer}>
                {TRACKING_STEPS.map((step, index) => {
                    const isCompleted = index <= cfg.step;
                    const isCurrent = index === cfg.step;
                    const stepCfg = STATUS_CONFIG[step];
                    return (
                        <View key={step} style={styles.trackingStep}>
                            <View style={styles.trackingDotRow}>
                                <View
                                    style={[
                                        styles.trackingDot,
                                        isCompleted && { backgroundColor: stepCfg.color },
                                        isCurrent && { borderWidth: 2, borderColor: stepCfg.color },
                                    ]}
                                >
                                    {isCompleted && (
                                        <Ionicons name="checkmark" size={10} color="white" />
                                    )}
                                </View>
                                {index < TRACKING_STEPS.length - 1 && (
                                    <View
                                        style={[
                                            styles.trackingLine,
                                            isCompleted && { backgroundColor: stepCfg.color },
                                        ]}
                                    />
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.trackingLabel,
                                    isCompleted && { color: '#333', fontWeight: '600' },
                                ]}
                            >
                                {step}
                            </Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderOrderItem = ({ item }) => {
        const isFocusedOrder = focusedOrderId && String(item.id || item._id || '') === focusedOrderId;
        const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
        const date = new Date(item.dateOrdered).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

        const canCancel = !['Shipped', 'Delivered', 'Canceled'].includes(item.status);
        const canMarkDelivered = item.status === 'Shipped';

        return (
            <View style={[styles.orderCard, isFocusedOrder && styles.focusedOrderCard]}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderId}>
                            Order #{(item.id || item._id || '').toString().slice(-8) || 'N/A'}
                        </Text>
                        <Text style={styles.orderDate}>{date}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                        <Ionicons name={status.icon} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>
                            {status.label}
                        </Text>
                    </View>
                </View>

                {isFocusedOrder && openedFromPush && (
                    <View style={styles.focusTag}>
                        <Ionicons name="notifications" size={14} color="#FF8C42" />
                        <Text style={styles.focusTagText}>Opened from notification</Text>
                    </View>
                )}

                {/* Order Tracking */}
                {renderTrackingSteps(item.status)}

                <View style={styles.orderDetails}>
                    <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={16} color="#888" />
                        <Text style={styles.detailText}>
                            {item.shippingAddress1}{item.shippingAddress2 ? ', ' + item.shippingAddress2 : ''}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="card-outline" size={16} color="#888" />
                        <Text style={styles.detailText}>
                            Total: ${item.totalPrice ? item.totalPrice.toFixed(2) : '0.00'}
                        </Text>
                    </View>
                    {item.paymentMethod && (
                        <View style={styles.detailRow}>
                            <Ionicons name="wallet-outline" size={16} color="#888" />
                            <Text style={styles.detailText}>
                                Payment: {item.paymentMethod === 'gcash' ? 'GCash' : item.paymentMethod === 'card' ? 'Card' : item.paymentMethod === 'cod' ? 'Cash on Delivery' : item.paymentMethod}
                            </Text>
                        </View>
                    )}
                </View>

                {item.orderItems && item.orderItems.length > 0 && (
                    <View style={styles.itemsPreview}>
                        {item.orderItems.slice(0, 3).map((orderItem, index) => (
                            <Image
                                key={index}
                                source={{
                                    uri: orderItem.image ||
                                        'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png',
                                }}
                                style={styles.itemImage}
                            />
                        ))}
                        {item.orderItems.length > 3 && (
                            <View style={styles.moreItems}>
                                <Text style={styles.moreItemsText}>
                                    +{item.orderItems.length - 3}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtonsContainer}>
                    {canMarkDelivered && (
                        <TouchableOpacity
                            style={styles.deliveredButton}
                            onPress={() => handleMarkDelivered(item)}
                        >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#51CF66" />
                            <Text style={styles.deliveredButtonText}>Mark as Delivered</Text>
                        </TouchableOpacity>
                    )}
                    {canCancel && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => handleCancelOrder(item)}
                        >
                            <Ionicons name="close-circle-outline" size={16} color="#FF6B6B" />
                            <Text style={styles.cancelButtonText}>Cancel Order</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#FF8C42" />
                <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Order History</Text>
            {displayedOrders.length > 0 ? (
                <FlatList
                    data={displayedOrders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item, index) => item.id || item._id || index.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.centerContainer}>
                    <Ionicons name="receipt-outline" size={60} color="#ccc" />
                    <Text style={styles.emptyText}>No orders yet</Text>
                    <TouchableOpacity
                        style={styles.shopButton}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.shopButtonText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    heading: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        padding: 20,
        paddingBottom: 10,
    },
    listContainer: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#888',
        marginTop: 10,
    },
    orderCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    focusedOrderCard: {
        borderWidth: 1,
        borderColor: '#FF8C42',
        backgroundColor: '#FFF8F0',
    },
    focusTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 10,
        gap: 6,
    },
    focusTagText: {
        color: '#FF8C42',
        fontSize: 12,
        fontWeight: '600',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    orderId: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    orderDate: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Tracking steps
    trackingContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        marginBottom: 12,
    },
    trackingStep: {
        alignItems: 'center',
        flex: 1,
    },
    trackingDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    trackingDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackingLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#e0e0e0',
    },
    trackingLabel: {
        fontSize: 10,
        color: '#bbb',
        marginTop: 4,
    },
    canceledBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
    },
    canceledText: {
        color: '#FF6B6B',
        fontWeight: '600',
        fontSize: 13,
    },
    orderDetails: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#555',
    },
    itemsPreview: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    moreItems: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#FF8C42',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreItemsText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    deliveredButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E8F8F0',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: '#51CF66',
    },
    deliveredButtonText: {
        color: '#51CF66',
        fontSize: 14,
        fontWeight: '600',
    },
    cancelButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF0F0',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FF6B6B',
    },
    cancelButtonText: {
        color: '#FF6B6B',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 18,
        color: '#999',
        marginTop: 16,
    },
    shopButton: {
        marginTop: 20,
        backgroundColor: '#FF8C42',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    shopButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
});

export default OrderHistory;
