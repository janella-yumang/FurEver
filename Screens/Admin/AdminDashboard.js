import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    FlatList,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import baseURL from "../../assets/common/baseurl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { jwtDecode } from "jwt-decode";

const { width, height } = Dimensions.get("window");

const AdminDashboard = () => {
    const navigation = useNavigation();
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState("");
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalOrders: 0,
        outOfStock: 0,
    });

    const getAuthTokenCandidates = useCallback(async () => {
        const secureToken = await SecureStore.getItemAsync("jwt");
        const asyncToken = await AsyncStorage.getItem("jwt");
        return [secureToken, asyncToken].filter((value, index, arr) => !!value && arr.indexOf(value) === index);
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const loadDashboard = async () => {
                const tokenCandidates = await getAuthTokenCandidates();
                const authToken = tokenCandidates[0] || "";
                if (isMounted) {
                    setToken(authToken);
                }

                // Fetch products
                axios
                    .get(`${baseURL}products`)
                    .then((res) => {
                        if (!isMounted) return;
                        const data = res.data || [];
                        setProducts(data);
                        const outOfStock = data.filter(
                            (p) => p.countInStock === 0 || !p.countInStock
                        ).length;
                        setStats((prev) => ({
                            ...prev,
                            totalProducts: data.length,
                            outOfStock,
                        }));
                        setLoading(false);
                    })
                    .catch(() => {
                        if (!isMounted) return;
                        setProducts([]);
                        setLoading(false);
                    });

                // Fetch orders (requires auth). Try all token candidates in case one is stale.
                if (!tokenCandidates.length) {
                    if (isMounted) {
                        setOrders([]);
                        setStats((prev) => ({
                            ...prev,
                            totalOrders: 0,
                        }));
                    }
                    return;
                }

                let loaded = false;
                for (const candidate of tokenCandidates) {
                    try {
                        const res = await axios.get(`${baseURL}orders`, {
                            headers: { Authorization: `Bearer ${candidate}` },
                        });

                        if (!isMounted) return;
                        const data = res.data || [];
                        setToken(candidate);
                        setOrders(data);
                        setStats((prev) => ({
                            ...prev,
                            totalOrders: data.length,
                        }));
                        loaded = true;
                        break;
                    } catch (_) {
                        // Try next token candidate.
                    }
                }

                if (!loaded && isMounted) {
                    setOrders([]);
                    setStats((prev) => ({
                        ...prev,
                        totalOrders: 0,
                    }));
                }
            };

            loadDashboard().catch(() => {
                if (isMounted) {
                    setOrders([]);
                    setStats((prev) => ({
                        ...prev,
                        totalOrders: 0,
                    }));
                }
            });

            return () => {
                isMounted = false;
            };
        }, [getAuthTokenCandidates])
    );

    const deleteProduct = (id) => {
        Alert.alert("Delete Product", "Are you sure you want to delete this product?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        const productId = String(id || '').trim();
                        if (!productId) {
                            Toast.show({
                                topOffset: 60,
                                type: "error",
                                text1: "Invalid product id",
                            });
                            return;
                        }

                        const tokenCandidates = await getAuthTokenCandidates();
                        const filteredCandidates = tokenCandidates.filter((candidate) => {
                            try {
                                const decoded = jwtDecode(candidate);
                                return !String(decoded?.userId || '').startsWith('quick-');
                            } catch (_decodeErr) {
                                return true;
                            }
                        });

                        if (!filteredCandidates.length) {
                            Toast.show({
                                topOffset: 60,
                                type: "error",
                                text1: "Admin login required",
                                text2: "Use an online admin account to delete products.",
                            });
                            return;
                        }

                        let deleted = false;
                        let lastError = null;

                        for (const candidate of filteredCandidates) {
                            try {
                                await axios.delete(`${baseURL}products/${productId}`, {
                                    headers: { Authorization: `Bearer ${candidate}` },
                                });
                                setToken(candidate);
                                deleted = true;
                                break;
                            } catch (err) {
                                lastError = err;
                            }
                        }

                        if (!deleted) {
                            throw lastError || new Error('Delete request failed.');
                        }

                        setProducts((prev) => prev.filter((p) => String(p._id || p.id) !== productId));
                        Toast.show({
                            topOffset: 60,
                            type: "success",
                            text1: "Product deleted",
                        });
                    } catch (error) {
                        Toast.show({
                            topOffset: 60,
                            type: "error",
                            text1: "Error deleting product",
                            text2: error?.response?.data?.message || error?.message || 'Please try again.',
                        });
                    }
                },
            },
        ]);
    };

    const StatCard = ({ icon, label, value, color }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
            </View>
        </View>
    );

    const ActionButton = ({ icon, label, onPress, color = "#FF8C42" }) => (
        <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: color }]}
            onPress={onPress}
        >
            <Ionicons name={icon} size={24} color="white" />
            <Text style={styles.actionBtnText}>{label}</Text>
        </TouchableOpacity>
    );

    const ProductRow = ({ item }) => (
        <View style={styles.productRow}>
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.productMeta}>
                    {item.brand} • ${item.price}
                </Text>
                <Text
                    style={[
                        styles.stockBadge,
                        {
                            color:
                                item.countInStock > 10
                                    ? "#20C997"
                                    : item.countInStock > 0
                                        ? "#FF8C42"
                                        : "#FF6B6B",
                        },
                    ]}
                >
                    Stock: {item.countInStock || 0}
                </Text>
            </View>
            <View style={styles.productActions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                        navigation.navigate("ProductForm", { item })
                    }
                >
                    <Ionicons name="pencil" size={16} color="#007BFF" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteProduct(item._id || item.id)}
                >
                    <Ionicons name="trash" size={16} color="#FF6B6B" />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C42" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Manage your pet store</Text>
                </View>
                <View style={styles.headerIcon}>
                    <Ionicons name="shield-checkmark" size={40} color="#FF8C42" />
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsSection}>
                <StatCard
                    icon="cube"
                    label="Total Products"
                    value={stats.totalProducts}
                    color="#FF8C42"
                />
                <StatCard
                    icon="bag"
                    label="Total Orders"
                    value={stats.totalOrders}
                    color="#20C997"
                />
                <StatCard
                    icon="alert-circle"
                    label="Out of Stock"
                    value={stats.outOfStock}
                    color="#FF6B6B"
                />
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
                <ActionButton
                    icon="add-circle"
                    label="Add Product"
                    onPress={() => navigation.navigate("ProductForm")}
                    color="#FF8C42"
                />
                <ActionButton
                    icon="list"
                    label="View Orders"
                    onPress={() => navigation.navigate("Orders")}
                    color="#20C997"
                />
                <ActionButton
                    icon="pricetag"
                    label="Categories"
                    onPress={() => navigation.navigate("Categories")}
                    color="#007BFF"
                />
                <ActionButton
                    icon="chatbubbles"
                    label="Reviews"
                    onPress={() => navigation.navigate("Reviews")}
                    color="#E8A317"
                />
                <ActionButton
                    icon="bar-chart"
                    label="Reports"
                    onPress={() => navigation.navigate("ReportsAnalytics")}
                    color="#9B59B6"
                />
                <ActionButton
                    icon="people"
                    label="Users"
                    onPress={() => navigation.navigate("ManageUsers")}
                    color="#FF6B6B"
                />
                <ActionButton
                    icon="megaphone"
                    label="Promotions"
                    onPress={() => navigation.navigate("PromotionBroadcast")}
                    color="#1E9E6A"
                />
                <ActionButton
                    icon="ticket"
                    label="Vouchers"
                    onPress={() => navigation.navigate("VoucherManagement")}
                    color="#845EF7"
                />
            </View>

            {/* Products Section */}
            <View style={styles.productsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Products</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Products")}
                    >
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {products.length > 0 ? (
                    <>
                        {products.slice(0, 5).map((item, index) => (
                            <ProductRow key={item._id || item.id || index} item={item} />
                        ))}
                        {products.length > 5 && (
                            <TouchableOpacity
                                style={styles.viewMoreBtn}
                                onPress={() => navigation.navigate("Products")}
                            >
                                <Text style={styles.viewMoreText}>
                                    View All {products.length} Products
                                </Text>
                                <Ionicons
                                    name="arrow-forward"
                                    size={18}
                                    color="#FF8C42"
                                />
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="cube-outline" size={48} color="#ddd" />
                        <Text style={styles.emptyText}>No products yet</Text>
                        <TouchableOpacity
                            style={styles.emptyBtn}
                            onPress={() => navigation.navigate("ProductForm")}
                        >
                            <Text style={styles.emptyBtnText}>Create First Product</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Orders Summary */}
            <View style={styles.productsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Orders</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Orders")}
                    >
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {Array.isArray(orders) && orders.length > 0 ? (
                    <>
                        {orders.slice(0, 3).map((order, index) => {
                            if (!order) return null;
                            const orderId = order._id || order.id;
                            const totalPrice = parseFloat(order.totalPrice || 0);
                            const status = order.status || "Pending";
                            const dateOrdered = order.dateOrdered ? new Date(order.dateOrdered).toLocaleDateString() : new Date().toLocaleDateString();
                            return (
                                <View 
                                    key={`${orderId}-${index}`} 
                                    style={styles.orderCard}
                                    onPress={() => orderId && navigation.navigate("Orders")}
                                >
                                    <View style={styles.orderLeft}>
                                        <Text style={styles.orderId}>
                                            Order #{orderId ? String(orderId).slice(-6) : "N/A"}
                                        </Text>
                                        <Text style={styles.orderDate}>{dateOrdered}</Text>
                                    </View>
                                    <View style={styles.orderRight}>
                                        <Text style={styles.orderTotal}>
                                            ₱{totalPrice.toFixed(2)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.orderStatus,
                                                {
                                                    color:
                                                        status === "Delivered"
                                                            ? "#20C997"
                                                            : status === "Shipped"
                                                                ? "#FF8C42"
                                                                : status === "Processing"
                                                                    ? "#339AF0"
                                                                    : "#007BFF",
                                                },
                                            ]}
                                        >
                                            {status}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="bag-outline" size={48} color="#ddd" />
                        <Text style={styles.emptyText}>No orders yet</Text>
                    </View>
                )}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "white",
        padding: 20,
        paddingTop: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: "#333",
    },
    headerSubtitle: {
        fontSize: 13,
        color: "#888",
        marginTop: 4,
    },
    headerIcon: {
        backgroundColor: "#FFF3E8",
        padding: 12,
        borderRadius: 12,
    },
    statsSection: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 12,
    },
    statCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    statLabel: {
        fontSize: 12,
        color: "#888",
    },
    statValue: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
        marginLeft: 16,
    },
    actionGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 10,
    },
    actionBtn: {
        width: (width - 44) / 2,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    actionBtnText: {
        color: "white",
        fontSize: 13,
        fontWeight: "600",
        marginTop: 6,
    },
    productsSection: {
        backgroundColor: "white",
        marginHorizontal: 12,
        marginVertical: 12,
        paddingVertical: 16,
        borderRadius: 12,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    viewAll: {
        fontSize: 13,
        color: "#007BFF",
        fontWeight: "600",
    },
    productRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#333",
    },
    productMeta: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
    },
    stockBadge: {
        fontSize: 12,
        fontWeight: "600",
        marginTop: 4,
    },
    productActions: {
        flexDirection: "row",
        gap: 12,
    },
    editBtn: {
        padding: 8,
        backgroundColor: "#E7F0FF",
        borderRadius: 8,
    },
    deleteBtn: {
        padding: 8,
        backgroundColor: "#FFE7E7",
        borderRadius: 8,
    },
    viewMoreBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#eee",
    },
    viewMoreText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#FF8C42",
    },
    orderCard: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    orderLeft: {
        flex: 1,
    },
    orderId: {
        fontSize: 15,
        fontWeight: "600",
        color: "#333",
    },
    orderDate: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
    },
    orderRight: {
        alignItems: "flex-end",
    },
    orderTotal: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FF8C42",
    },
    orderStatus: {
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 28,
    },
    emptyText: {
        fontSize: 15,
        color: "#888",
        marginTop: 8,
    },
    emptyBtn: {
        marginTop: 12,
        backgroundColor: "#FF8C42",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    emptyBtnText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
});

export default AdminDashboard;
