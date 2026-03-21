import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Text, View, TouchableHighlight, StyleSheet, Dimensions, TouchableOpacity, Image, FlatList, Alert } from 'react-native'

import { useNavigation } from '@react-navigation/native';
import { removeFromCart, clearCart, updateCartQuantity } from '../../Redux/Actions/cartActions'
import { Surface, Button } from 'react-native-paper';
var { height, width } = Dimensions.get("window");
import { Ionicons } from "@expo/vector-icons";

const Cart = () => {
    const navigation = useNavigation()
    const dispatch = useDispatch()
    const cartItems = useSelector(state => state.cartItems)

    var total = 0;
    cartItems.forEach(cart => {
        const qty = cart.quantity || 1;
        return (total += cart.price * qty)
    });

    const handleQuantityChange = (item, newQty) => {
        if (newQty < 1) {
            Alert.alert(
                'Remove Item',
                `Remove ${item.name} from cart?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => dispatch(removeFromCart(item)) },
                ]
            );
            return;
        }
        dispatch(updateCartQuantity(item._id || item.id, newQty));
    };

    const renderCartItem = ({ item }) => {
        const qty = item.quantity || 1;
        const itemTotal = item.price * qty;

        return (
            <View style={styles.cartCard}>
                <Image
                    source={{
                        uri: item.image ||
                            'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png'
                    }}
                    style={styles.itemImage}
                />
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
                    <Text style={styles.itemPrice}>${item.price?.toFixed(2)}</Text>

                    <View style={styles.quantityRow}>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={styles.qtyButton}
                                onPress={() => handleQuantityChange(item, qty - 1)}
                            >
                                <Ionicons name="remove" size={18} color="#FF8C42" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity
                                style={styles.qtyButton}
                                onPress={() => handleQuantityChange(item, qty + 1)}
                            >
                                <Ionicons name="add" size={18} color="#FF8C42" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.itemTotal}>${itemTotal.toFixed(2)}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => dispatch(removeFromCart(item))}
                >
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
            </View>
        );
    };

    if (cartItems.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="cart-outline" size={80} color="#ddd" />
                <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
                <Text style={styles.emptySubtitle}>Add some pet supplies to get started!</Text>
                <TouchableOpacity
                    style={styles.shopButton}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={styles.shopButtonText}>Browse Products</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Shopping Cart ({cartItems.length})</Text>
                <TouchableOpacity onPress={() => {
                    Alert.alert('Clear Cart', 'Remove all items from cart?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: () => dispatch(clearCart()) },
                    ]);
                }}>
                    <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
            </View>

            {/* Cart Items */}
            <FlatList
                data={cartItems}
                renderItem={renderCartItem}
                keyExtractor={(item, index) => item._id || item.id || index.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Bottom Summary */}
            <View style={styles.bottomBar}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Shipping</Text>
                    <Text style={styles.shippingFree}>FREE</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                    style={styles.checkoutButton}
                    onPress={() => {
                        navigation.navigate('Checkout');
                    }}
                >
                    <Ionicons name="lock-closed" size={18} color="white" />
                    <Text style={styles.checkoutText}>Proceed to Checkout</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    clearText: {
        fontSize: 14,
        color: '#FF6B6B',
        fontWeight: '600',
    },
    listContent: {
        padding: 12,
        paddingBottom: 220,
    },
    cartCard: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 10,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    itemImage: {
        width: 85,
        height: 85,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
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
    itemBrand: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
    },
    qtyButton: {
        padding: 6,
        paddingHorizontal: 10,
    },
    qtyText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        paddingHorizontal: 8,
        minWidth: 30,
        textAlign: 'center',
    },
    itemTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF8C42',
    },
    deleteButton: {
        padding: 8,
        alignSelf: 'flex-start',
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: '#f5f5f5',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
    },
    shopButton: {
        marginTop: 24,
        backgroundColor: '#FF8C42',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 8,
    },
    shopButtonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        padding: 16,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#888',
    },
    summaryValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    shippingFree: {
        fontSize: 14,
        color: '#20C997',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 8,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FF8C42',
    },
    checkoutButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#20C997',
        paddingVertical: 14,
        borderRadius: 10,
        marginTop: 12,
    },
    checkoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
});
export default Cart