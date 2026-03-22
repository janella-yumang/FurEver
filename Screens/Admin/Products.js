import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Dimensions,
    RefreshControl,
    TouchableOpacity,
    Alert,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native"
import { Searchbar } from 'react-native-paper';

import axios from "axios"
import baseURL from "../../assets/common/baseurl";
import AsyncStorage from '@react-native-async-storage/async-storage'
var { height, width } = Dimensions.get("window")
import { useNavigation } from "@react-navigation/native"
import Toast from "react-native-toast-message";

const Products = (props) => {
    const [productList, setProductList] = useState([]);
    const [productFilter, setProductFilter] = useState([]);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState();
    const navigation = useNavigation()
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const searchProduct = (text) => {
        setSearchQuery(text);
        if (text === "") {
            setProductFilter(productList)
        } else {
            setProductFilter(
                productList.filter((i) =>
                    i.name.toLowerCase().includes(text.toLowerCase()) ||
                    (i.brand && i.brand.toLowerCase().includes(text.toLowerCase()))
                )
            )
        }
    }

    const deleteProduct = (id, name) => {
        Alert.alert(
            "Delete Product",
            `Are you sure you want to delete "${name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        axios
                            .delete(`${baseURL}products/${id}`, {
                                headers: { Authorization: `Bearer ${token}` },
                            })
                            .then((res) => {
                                const filtered = productFilter.filter((item) => item._id !== id && item.id !== id);
                                setProductFilter(filtered);
                                const updated = productList.filter((item) => item._id !== id && item.id !== id);
                                setProductList(updated);
                                Toast.show({
                                    topOffset: 60,
                                    type: "success",
                                    text1: "Product deleted successfully",
                                });
                            })
                            .catch((error) => {
                                Toast.show({
                                    topOffset: 60,
                                    type: "error",
                                    text1: "Error deleting product",
                                    text2: error.message,
                                });
                            });
                    }
                }
            ]
        );
    }

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        axios
            .get(`${baseURL}products`)
            .then((res) => {
                setProductList(res.data);
                setProductFilter(res.data);
                setLoading(false);
                Toast.show({
                    topOffset: 60,
                    type: "success",
                    text1: "Products refreshed",
                });
            })
            .catch((error) => {
                Toast.show({
                    topOffset: 60,
                    type: "error",
                    text1: "Error refreshing products",
                });
            })
            .finally(() => setRefreshing(false));
    }, []);

    useFocusEffect(
        useCallback(
            () => {
                AsyncStorage.getItem("jwt")
                    .then((res) => setToken(res))
                    .catch((error) => console.log(error))

                axios
                    .get(`${baseURL}products`)
                    .then((res) => {
                        setProductList(res.data);
                        setProductFilter(res.data);
                        setLoading(false);
                    })
                    .catch((error) => {
                        console.log('Error fetching products', error);
                        setLoading(false);
                    })

                return () => {
                    setProductList([]);
                    setProductFilter([]);
                    setLoading(true);
                }
            },
            [],
        )
    )

    const ProductCard = ({ item }) => (
        <View style={styles.productCard}>
            <Image
                source={{
                    uri: item.image || 'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png'
                }}
                style={styles.productImage}
            />
            
            {/* Out of Stock Badge */}
            {item.countInStock === 0 && (
                <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                </View>
            )}
            
            {/* Low Stock Badge */}
            {item.countInStock > 0 && item.countInStock <= (item.lowStockThreshold || 10) && (
                <View style={styles.lowStockBadge}>
                    <Ionicons name="warning" size={12} color="#fff" />
                    <Text style={styles.lowStockText}>LOW STOCK</Text>
                </View>
            )}
            
            <View style={styles.productContent}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productBrand}>{item.brand || 'N/A'}</Text>
                <View style={styles.productMeta}>
                    <Text style={styles.productPrice}>${item.price?.toFixed(2)}</Text>
                    <Text
                        style={[
                            styles.stockStatus,
                            {
                                color: item.countInStock === 0 
                                    ? '#FF6B6B' 
                                    : item.countInStock <= (item.lowStockThreshold || 10) 
                                        ? '#FF8C42' 
                                        : '#20C997'
                            }
                        ]}
                    >
                        <Ionicons 
                            name={item.countInStock === 0 ? "close-circle" : item.countInStock <= (item.lowStockThreshold || 10) ? "alert-circle" : "checkmark-circle"} 
                            size={12} 
                        /> Stock: {item.countInStock || 0}
                    </Text>
                </View>
                {item.category && (
                    <Text style={styles.category}>
                        {typeof item.category === 'object' ? item.category.name : item.category}
                    </Text>
                )}
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate("ProductForm", { item })}
                >
                    <Ionicons name="pencil" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteProduct(item._id || item.id, item.name)}
                >
                    <Ionicons name="trash" size={18} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const ListHeader = () => {
        const outOfStockCount = productList.filter(p => p.countInStock === 0).length;
        const lowStockCount = productList.filter(p => p.countInStock > 0 && p.countInStock <= (p.lowStockThreshold || 10)).length;
        
        return (
            <View style={styles.headerSection}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Manage Products</Text>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => navigation.navigate("ProductForm")}
                    >
                        <Ionicons name="add" size={22} color="white" />
                    </TouchableOpacity>
                </View>
                
                {/* Inventory Alerts */}
                {(outOfStockCount > 0 || lowStockCount > 0) && (
                    <View style={styles.alertsContainer}>
                        {outOfStockCount > 0 && (
                            <View style={styles.alertBox}>
                                <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                                <Text style={styles.alertText}>
                                    {outOfStockCount} product{outOfStockCount > 1 ? 's' : ''} out of stock
                                </Text>
                            </View>
                        )}
                        {lowStockCount > 0 && (
                            <View style={styles.alertBox}>
                                <Ionicons name="alert-circle" size={18} color="#FF8C42" />
                                <Text style={styles.alertText}>
                                    {lowStockCount} product{lowStockCount > 1 ? 's' : ''} low on stock
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                
                <Searchbar
                    placeholder="Search by name or brand..."
                    onChangeText={(text) => searchProduct(text)}
                    value={searchQuery}
                    style={styles.searchbar}
                    inputStyle={styles.searchInput}
                />
                <View style={styles.stats}>
                    <Text style={styles.statsText}>Total: <Text style={styles.statsBold}>{productList.length}</Text></Text>
                    <Text style={styles.statsText}>Filtered: <Text style={styles.statsBold}>{productFilter.length}</Text></Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.spinner}>
                    <ActivityIndicator size="large" color="#FF8C42" />
                </View>
            ) : (
                <FlatList
                    ListHeaderComponent={ListHeader}
                    data={productFilter}
                    renderItem={({ item }) => <ProductCard item={item} />}
                    keyExtractor={(item, index) => item._id || item.id || index.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#FF8C42"]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="cube-outline" size={64} color="#ddd" />
                            <Text style={styles.emptyText}>
                                {searchQuery ? "No products match your search" : "No products found"}
                            </Text>
                            {!searchQuery && (
                                <TouchableOpacity
                                    style={styles.emptyBtn}
                                    onPress={() => navigation.navigate("ProductForm")}
                                >
                                    <Text style={styles.emptyBtnText}>Add First Product</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    spinner: {
        height: height / 2,
        alignItems: 'center',
        justifyContent: 'center'
    },
    listContent: {
        paddingBottom: 20,
    },
    headerSection: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 12,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
    },
    addBtn: {
        backgroundColor: '#FF8C42',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchbar: {
        marginBottom: 12,
        backgroundColor: '#f9f9f9',
    },
    searchInput: {
        fontSize: 14,
    },
    stats: {
        flexDirection: 'row',
        gap: 16,
    },
    statsText: {
        fontSize: 13,
        color: '#888',
    },
    statsBold: {
        fontWeight: '700',
        color: '#FF8C42',
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: 'white',
        marginHorizontal: 12,
        marginVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        position: 'relative',
    },
    outOfStockBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#FF6B6B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        zIndex: 10,
    },
    outOfStockText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    lowStockBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#FF8C42',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    lowStockText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    alertsContainer: {
        marginVertical: 10,
        gap: 8,
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF8C42',
        gap: 8,
    },
    alertText: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
    },
    productImage: {
        width: 90,
        height: 90,
        backgroundColor: '#f0f0f0',
    },
    productContent: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    productBrand: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    productMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    productPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF8C42',
    },
    stockStatus: {
        fontSize: 12,
        fontWeight: '600',
    },
    category: {
        fontSize: 11,
        color: '#007BFF',
        marginTop: 4,
    },
    actionButtons: {
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        gap: 8,
    },
    editBtn: {
        backgroundColor: '#007BFF',
        width: 38,
        height: 38,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBtn: {
        backgroundColor: '#FF6B6B',
        width: 38,
        height: 38,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        height: height / 2,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#888',
        marginTop: 12,
        textAlign: 'center',
    },
    emptyBtn: {
        marginTop: 20,
        backgroundColor: '#FF8C42',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyBtnText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default Products;