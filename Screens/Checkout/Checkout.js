import React, { useEffect, useState, useContext } from 'react'
import { Text, View, Button, SafeAreaView, Select, TouchableOpacity, StyleSheet } from 'react-native'

import Icon from 'react-native-vector-icons/FontAwesome'
import { Ionicons } from '@expo/vector-icons'
import FormContainer from '../../Shared/FormContainer'
import Input from '../../Shared/Input'
import AddressMapPicker from '../../Shared/AddressMapPicker'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import { useSelector } from 'react-redux'
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker'

const countries = require("../../assets/data/countries.json");
import AuthGlobal from '../../Context/Store/AuthGlobal'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import axios from 'axios'
import baseURL from '../../assets/common/baseurl'
const Checkout = (props) => {
    const [user, setUser] = useState('')
    const [orderItems, setOrderItems] = useState([])
    const [address, setAddress] = useState('')
    const [address2, setAddress2] = useState('')
    const [phone, setPhone] = useState('')
    const [showMapPicker, setShowMapPicker] = useState(false)
    const [coordinates, setCoordinates] = useState(null)
    const [availableVouchers, setAvailableVouchers] = useState([])
    const [selectedVoucherId, setSelectedVoucherId] = useState('')

    const navigation = useNavigation()
    const cartItems = useSelector(state => state.cartItems)
    const context = useContext(AuthGlobal);

    const getAuthToken = async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        if (secureToken) return secureToken;
        
        const asyncToken = await AsyncStorage.getItem('jwt');
        return asyncToken || null;
    };

    const isVoucherCurrentlyAvailable = (voucher) => {
        if (!voucher || voucher.isActive === false) return false;

        const now = Date.now();
        const startsAt = voucher.startsAt ? new Date(voucher.startsAt).getTime() : null;
        const expiresAt = voucher.expiresAt ? new Date(voucher.expiresAt).getTime() : null;

        if (startsAt && startsAt > now) return false;
        if (expiresAt && expiresAt <= now) return false;

        if ((voucher.maxClaims || 0) > 0 && (voucher.claimedCount || 0) >= (voucher.maxClaims || 0)) return false;

        return true;
    };

    const loadAvailableVouchers = (tokenValue, userId) => {
        axios
            .get(`${baseURL}notifications/promotions/vouchers/available/${userId}`, {
                headers: { Authorization: `Bearer ${tokenValue}` },
            })
            .then((res) => {
                const vouchers = (Array.isArray(res.data) ? res.data : []).filter(isVoucherCurrentlyAvailable);
                setAvailableVouchers(vouchers);
                setSelectedVoucherId((currentId) => {
                    if (!currentId) return '';
                    const stillExists = vouchers.some((voucher) => String(voucher.id) === String(currentId));
                    return stillExists ? currentId : '';
                });
            })
            .catch((err) => {
                console.log('Error loading vouchers:', err?.response?.data || err?.message || err);
                setAvailableVouchers([]);
            });
    };

    useEffect(() => {
        setOrderItems(cartItems)
        if (context.stateUser.isAuthenticated) {
            setUser(context.stateUser.user.userId)
            // Fetch user profile to pre-populate address fields
            getAuthToken()
                .then((token) => {
                    if (token && context.stateUser.user.userId) {
                        loadAvailableVouchers(token, context.stateUser.user.userId);
                    }
                    axios
                        .get(`${baseURL}users/${context.stateUser.user.userId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        })
                        .then((res) => {
                            const userData = res.data;
                            if (userData.phone) setPhone(userData.phone);
                            if (userData.shippingAddress) setAddress(userData.shippingAddress);
                        })
                        .catch((err) => {
                            console.log('Error loading user profile:', err);
                            const contextUser = context?.stateUser?.user || {};
                            if (contextUser.phone) setPhone(contextUser.phone);
                            if (contextUser.shippingAddress) setAddress(contextUser.shippingAddress);
                        });
                })
                .catch((err) => console.log('Error getting token:', err));
        } else {
            navigation.navigate("User", { screen: 'Login' });
            Toast.show({
                topOffset: 60,
                type: "error",
                text1: "Please Login to Checkout",
                text2: ""
            });
        }

        return () => {
            setOrderItems([]);
        }
    }, [])

    const checkOut = () => {
        console.log('\n💳 CHECKOUT INITIATED');
        console.log('  Cart items count:', orderItems?.length || 0);
        
        if (!orderItems || orderItems.length === 0) {
            Toast.show({ topOffset: 60, type: 'error', text1: 'Cart is empty!', text2: 'Add products to proceed' });
            return;
        }
        
        // Calculate subtotal
        const subtotal = orderItems.reduce((t, i) => {
            const itemTotal = i.price * (i.quantity || 1);
            console.log(`  - ${i.name}: $${i.price} x ${i.quantity || 1} = $${itemTotal}`);
            return t + itemTotal;
        }, 0);
        console.log(`  Subtotal: $${subtotal}`);

        const selectedVoucher = availableVouchers.find((v) => String(v.id) === String(selectedVoucherId));
        let discount = 0;
        if (selectedVoucher) {
            const minimumOrder = Number(selectedVoucher.minOrderAmount || 0);
            if (minimumOrder > 0 && subtotal < minimumOrder) {
                Toast.show({
                    topOffset: 60,
                    type: 'info',
                    text1: 'Voucher minimum order not reached',
                    text2: `Minimum order is $${minimumOrder.toFixed(2)}`,
                });
                setSelectedVoucherId('');
            } else {
                if ((selectedVoucher.discountType || 'percent') === 'fixed') {
                    discount = Number(selectedVoucher.discountValue || 0);
                } else {
                    discount = (subtotal * (selectedVoucher.discountValue || 0)) / 100;
                }

                if ((selectedVoucher.maxDiscount || 0) > 0) {
                    discount = Math.min(discount, selectedVoucher.maxDiscount);
                }
                discount = Math.min(discount, subtotal);
            }
        }

        console.log(`  Voucher discount preview: $${discount}`);
        console.log(`  Total after discount preview: $${subtotal - discount}`);
        
        const order = {
            dateOrdered: Date.now(),
            orderItems,
            phone,
            shippingAddress1: address,
            shippingAddress2: address2,
            status: "Pending",
            user,
            voucherId: selectedVoucher ? selectedVoucher.id : null,
            voucherCode: selectedVoucher ? selectedVoucher.promoCode : null,
            voucherPreviewDiscount: discount,
        }
        console.log('✅ Order forwarding to Payment with items:', order.orderItems?.length);
        console.log('   Total should be $' + subtotal + '\n');
        
        navigation.navigate("Payment", { order })
    }

    const handleLocationSelect = (locationData) => {
        setAddress(locationData.address);
        setCoordinates(locationData.coordinates);
        
        Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Location Selected",
            text2: "Address has been updated"
        });
    }

    return (

        <KeyboardAwareScrollView
            viewIsInsideTabBar={true}
            extraHeight={200}
            enableOnAndroid={true}
        >
            <FormContainer title={"Shipping Address"}>
                <Input
                    placeholder={"Phone"}
                    name={"phone"}
                    value={phone}
                    keyboardType={"numeric"}
                    onChangeText={(text) => setPhone(text)}
                />

                {/* Map Picker Button */}
                <TouchableOpacity 
                    style={styles.mapButton}
                    onPress={() => setShowMapPicker(true)}
                >
                    <Ionicons name="map" size={24} color="#fff" />
                    <Text style={styles.mapButtonText}>Select Address from Map</Text>
                </TouchableOpacity>

                <Input
                    placeholder={"Shipping Address 1"}
                    name={"ShippingAddress1"}
                    value={address}
                    onChangeText={(text) => setAddress(text)}
                />
                <Input
                    placeholder={"Shipping Address 2"}
                    name={"ShippingAddress2"}
                    value={address2}
                    onChangeText={(text) => setAddress2(text)}
                />

                {availableVouchers.length > 0 && (
                    <View style={styles.voucherSection}>
                        <Text style={styles.voucherTitle}>Available Vouchers</Text>
                        {availableVouchers.map((voucher) => {
                            const isSelected = String(selectedVoucherId) === String(voucher.id);
                            return (
                                <TouchableOpacity
                                    key={voucher.id}
                                    style={[styles.voucherCard, isSelected && styles.voucherCardSelected]}
                                    onPress={() => setSelectedVoucherId(isSelected ? '' : String(voucher.id))}
                                >
                                    <Text style={styles.voucherCode}>{voucher.promoCode}</Text>
                                    <Text style={styles.voucherMeta}>
                                        {(voucher.discountType || 'percent') === 'fixed'
                                            ? `$${Number(voucher.discountValue || 0).toFixed(2)} off`
                                            : `${voucher.discountValue}% off`}
                                    </Text>
                                    {!!voucher.minOrderAmount && Number(voucher.minOrderAmount) > 0 && (
                                        <Text style={styles.voucherMeta}>Min order: ${Number(voucher.minOrderAmount).toFixed(2)}</Text>
                                    )}
                                    {!!voucher.expiresAt && (
                                        <Text style={styles.voucherMeta}>Expires: {new Date(voucher.expiresAt).toLocaleString()}</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <View style={{ width: '80%', alignItems: "center" }}>
                    <Button title="Confirm" onPress={() => checkOut()} />
                </View>
            </FormContainer>

            {/* Address Map Picker Modal */}
            <AddressMapPicker
                visible={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onSelectLocation={handleLocationSelect}
            />
        </KeyboardAwareScrollView>

    )
}

const styles = StyleSheet.create({
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ff6347',
        padding: 15,
        borderRadius: 8,
        marginVertical: 10,
        width: '80%',
        alignSelf: 'center',
    },
    mapButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    voucherSection: {
        width: '80%',
        marginTop: 10,
        marginBottom: 12,
    },
    voucherTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    voucherCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 10,
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    voucherCardSelected: {
        borderColor: '#FF8C42',
        backgroundColor: '#FFF3E8',
    },
    voucherCode: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FF8C42',
    },
    voucherMeta: {
        fontSize: 12,
        color: '#555',
        marginTop: 2,
    },
});

export default Checkout