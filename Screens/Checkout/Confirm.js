import React, { useState, useContext, useEffect } from 'react'
import { View, StyleSheet, Dimensions, ScrollView, Button, Text, TouchableOpacity } from "react-native";
import { Surface, Avatar, Divider } from 'react-native-paper';
import { Ionicons } from "@expo/vector-icons";

import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux'
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from 'expo-secure-store'
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';
var { width, height } = Dimensions.get("window");
import Toast from 'react-native-toast-message';
import { clearCart } from '../../Redux/Actions/cartActions';

const Confirm = (props) => {
    const context = useContext(AuthGlobal)
    const [token, setToken] = useState();
    const [loading, setLoading] = useState(false);
    const params = props.route.params;
    const dispatch = useDispatch()
    const navigation = useNavigation()

    const getAuthToken = async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        if (secureToken) return secureToken;
        
        const asyncToken = await AsyncStorage.getItem("jwt");
        return asyncToken || null;
    };

    useEffect(() => {
        getAuthToken()
            .then((res) => setToken(res))
            .catch((error) => console.log(error))
    }, [])

    React.useEffect(() => {
        console.log('\n💰 CONFIRM SCREEN');
        const orderData = params?.order || params;
        console.log('  Items count:', orderData?.orderItems?.length || 0);
        if (orderData?.orderItems?.length) {
            const total = orderData.orderItems.reduce((t, i) => t + (i.price * (i.quantity || 1)), 0);
            console.log(`  Total: $${total}`);
            orderData.orderItems.forEach((item, idx) => {
                console.log(`    ${idx}: ${item.name} $${item.price} x${item.quantity || 1}`);
            });
        } else {
            console.log('  ⚠️ NO ITEMS!');
        }
        console.log('');
    }, [params]);

    if (!params) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
                <Text style={styles.emptyText}>Order data not found</Text>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.navigate('Cart Screen', { screen: 'Cart' })}
                >
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const orderData = params.order || params;
    const subtotal = orderData.orderItems?.reduce((t, i) => t + (i.price * (i.quantity || 1)), 0) || 0;
    const voucherDiscount = parseFloat(orderData.voucherPreviewDiscount) || 0;
    const finalTotal = Math.max(0, subtotal - voucherDiscount);

    const confirmOrder = async () => {
        const authToken = token || await getAuthToken();
        if (authToken && authToken !== token) {
            setToken(authToken);
        }

        if (!orderData || !authToken) {
            Toast.show({
                topOffset: 60,
                type: "error",
                text1: "Missing order or authentication data",
            });
            return;
        }

        setLoading(true);
        const config = {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        }

        // Calculate total from orderItems
        const totalPrice = finalTotal;
        console.log('💰 PLACING ORDER - Subtotal:', subtotal);
        console.log('💰 Voucher discount:', voucherDiscount);
        console.log('💰 Final total calculated:', totalPrice);

        const normalizedOrderItems = (orderData.orderItems || []).map((item) => ({
            ...item,
            product: item.product || item.productId || item._id || item.id,
        }));

        // Include paymentMethod and totalPrice in the order data sent to the server
        const orderPayload = {
            ...orderData,
            orderItems: normalizedOrderItems,
            totalPrice,
            voucherId: orderData.voucherId || null,
            voucherCode: orderData.voucherCode || null,
            paymentMethod: orderData.paymentMethod || orderData.payment?.method || '',
        };

        console.log('📤 Order payload being sent:', {
            items: orderPayload.orderItems?.length,
            total: orderPayload.totalPrice,
            method: orderPayload.paymentMethod,
        });

        axios
            .post(`${baseURL}orders`, orderPayload, config)
            .then((res) => {
                setLoading(false);
                console.log('✅ Order created successfully, ID:', res.data?.id);
                Toast.show({
                    topOffset: 60,
                    type: "success",
                    text1: "Order placed successfully!",
                    text2: "A confirmation email has been sent.",
                });

                // Save shipping info back to user profile so they don't re-enter it
                if (context.stateUser?.user?.userId && (orderData.shippingAddress1 || orderData.phone)) {
                    const profileUpdate = new FormData();
                    if (orderData.shippingAddress1) profileUpdate.append('shippingAddress', orderData.shippingAddress1);
                    if (orderData.phone) profileUpdate.append('phone', orderData.phone);
                    axios.put(
                        `${baseURL}users/${context.stateUser.user.userId}`,
                        profileUpdate,
                        { headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'multipart/form-data' } }
                    ).catch((err) => console.log('Profile update after order:', err));
                }

                setTimeout(() => {
                    dispatch(clearCart())
                    navigation.navigate('Cart Screen', { screen: 'Cart' })
                }, 500);
            })
            .catch((error) => {
                setLoading(false);
                Toast.show({
                    topOffset: 60,
                    type: "error",
                    text1: "Error placing order",
                    text2: error.message || "Please try again",
                });
            });
    }

    return (
        <Surface style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Ionicons name="checkmark-circle" size={48} color="#FF8C42" />
                    <Text style={styles.headerTitle}>Review Your Order</Text>
                </View>

                {/* Shipping Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📍 Shipping Address</Text>
                    <View style={styles.infoBox}>
                        <InfoRow label="Address" value={orderData.shippingAddress1} />
                        {orderData.shippingAddress2 && (
                            <InfoRow label="Address 2" value={orderData.shippingAddress2} />
                        )}
                        <InfoRow label="Phone" value={orderData.phone} />
                    </View>
                </View>

                {/* Order Items */}
                {orderData.orderItems && orderData.orderItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🛍️ Order Items ({orderData.orderItems.length})</Text>
                        {orderData.orderItems.map((item, index) => (
                            <View key={index} style={styles.itemCard}>
                                <Avatar.Image
                                    size={60}
                                    source={{
                                        uri: item.image ||
                                            'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png'
                                    }}
                                />
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemPrice}>${item.price?.toFixed(2)}</Text>
                                    {item.quantity && (
                                        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Payment Method */}
                {(orderData.paymentMethod || orderData.payment) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💳 Payment Method</Text>
                        <View style={styles.infoBox}>
                            <InfoRow
                                label="Method"
                                value={
                                    (orderData.paymentMethod || orderData.payment?.method || 'Not specified')
                                        === 'gcash' ? 'GCash'
                                        : (orderData.paymentMethod || orderData.payment?.method || '') === 'card' ? 'Credit / Debit Card'
                                        : (orderData.paymentMethod || orderData.payment?.method || '') === 'cod' ? 'Cash on Delivery'
                                        : (orderData.paymentMethod || orderData.payment?.method || 'Not specified').toUpperCase()
                                }
                            />
                        </View>
                    </View>
                )}

                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💰 Order Summary</Text>
                    <View style={styles.summaryBox}>
                        <SummaryRow
                            label="Subtotal"
                            value={`$${subtotal.toFixed(2)}`}
                        />
                        {voucherDiscount > 0 && (
                            <SummaryRow label="Voucher Discount" value={`-$${voucherDiscount.toFixed(2)}`} color="#FF8C42" />
                        )}
                        <SummaryRow label="Shipping" value="FREE" color="#20C997" />
                        <Divider style={styles.divider} />
                        <SummaryRow
                            label="Total"
                            value={`$${finalTotal.toFixed(2)}`}
                            isBold
                        />
                    </View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.editBtn}
                >
                    <Text style={styles.editBtnText}>Edit Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={confirmOrder}
                    disabled={loading}
                    style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.confirmBtnText}>
                        {loading ? 'Confirming...' : 'Confirm Order'}
                    </Text>
                </TouchableOpacity>
            </View>
        </Surface>
    )
}

const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
);

const SummaryRow = ({ label, value, isBold, color = '#333' }) => (
    <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, isBold && { fontWeight: '700', fontSize: 16 }]}>
            {label}
        </Text>
        <Text style={[styles.summaryValue, { color }, isBold && { fontWeight: '700', fontSize: 16 }]}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginTop: 12,
    },
    section: {
        backgroundColor: 'white',
        marginHorizontal: 12,
        marginVertical: 10,
        paddingVertical: 14,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    infoBox: {
        paddingHorizontal: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 14,
        color: '#888',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    itemPrice: {
        fontSize: 14,
        color: '#FF8C42',
        fontWeight: '700',
        marginTop: 4,
    },
    itemQty: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    summaryBox: {
        paddingHorizontal: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#888',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        marginVertical: 8,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    editBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#FF8C42',
        alignItems: 'center',
    },
    editBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF8C42',
    },
    confirmBtn: {
        flex: 1.5,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#20C997',
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: 'white',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#f5f5f5',
    },
    emptyText: {
        fontSize: 18,
        color: '#888',
        marginTop: 16,
    },
    backBtn: {
        marginTop: 24,
        backgroundColor: '#FF8C42',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backBtnText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default Confirm;