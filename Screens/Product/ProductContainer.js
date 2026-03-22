import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator, Dimensions, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { Surface, Text, TextInput, Searchbar, Chip } from 'react-native-paper';
import { Ionicons } from "@expo/vector-icons";
import ProductList from './ProductList'
import SearchedProduct from "./SearchedProduct";
import Banner from "../../Shared/Banner";
import CategoryFilter from "./CategoryFilter";
import axios from "axios";
import baseURL from "../../assets/common/baseurl";
import { useFocusEffect } from '@react-navigation/native';
import { Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../Redux/Actions/productActions';
import Toast from "react-native-toast-message";

const PET_TYPES = ['All', 'Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster'];
const PRODUCT_CATEGORIES = ['All', 'Pet Food', 'Treats', 'Toys', 'Grooming', 'Health', 'Accessories', 'Habitat'];

const mockCategories = [
    { _id: "1", name: "Pet Food" },
    { _id: "2", name: "Treats" },
    { _id: "3", name: "Toys" },
    { _id: "4", name: "Grooming" },
    { _id: "5", name: "Health" },
    { _id: "6", name: "Accessories" },
    { _id: "7", name: "Habitat" }
];

var { height, width } = Dimensions.get('window')

const ProductContainer = () => {
    const dispatch = useDispatch();
    const [productsFiltered, setProductsFiltered] = useState([]);
    const [focus, setFocus] = useState('');
    const [categories, setCategories] = useState([]);
    const [active, setActive] = useState([]);
    const [initialState, setInitialState] = useState([])
    const [productsCtg, setProductsCtg] = useState([])
    const [keyword, setKeyword] = useState('')
    const [loading, setLoading] = useState(false)

    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [selectedPetType, setSelectedPetType] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [priceRange, setPriceRange] = useState(200);
    const [showInStockOnly, setShowInStockOnly] = useState(false);

    const productsByCategory = useMemo(() => {
        const grouped = {};
        productsCtg.forEach((product) => {
            const categoryName = typeof product.category === 'object' ? product.category?.name : product.category;
            if (!categoryName) return;
            if (!grouped[categoryName]) {
                grouped[categoryName] = [];
            }
            grouped[categoryName].push(product);
        });
        return grouped;
    }, [productsCtg]);

    const searchProduct = (text) => {
        try {
            // Start with initialState (all products)
            let filtered = Array.isArray(initialState) ? [...initialState] : [];

            // Apply pet type filter from quick chips
            if (selectedPetType !== 'All') {
                filtered = filtered.filter(p => p && p.petType === selectedPetType);
            }

            // Apply price range filter
            filtered = filtered.filter(p => p && typeof p.price === 'number' && p.price <= priceRange);

            // Apply availability filter
            if (showInStockOnly) {
                filtered = filtered.filter(p => p && p.countInStock > 0);
            }

            // Apply search text
            if (text && text.trim().length > 0) {
                const searchLower = text.toLowerCase();
                filtered = filtered.filter((i) => {
                    if (!i) return false;
                    const nameMatch = i.name && i.name.toLowerCase().includes(searchLower);
                    const petTypeMatch = i.petType && i.petType.toLowerCase().includes(searchLower);
                    const categoryMatch = i.category && (typeof i.category === 'string'
                        ? i.category.toLowerCase().includes(searchLower)
                        : i.category.name && i.category.name.toLowerCase().includes(searchLower));
                    return nameMatch || petTypeMatch || categoryMatch;
                });
            }

            setProductsFiltered(filtered);
        } catch (error) {
            console.error('Search error:', error);
            setProductsFiltered([]);
        }
    }

    const onBlur = () => {
        setFocus(false);
    }

    const applyFilters = () => {
        let filtered = [...initialState];

        // Pet type filter
        if (selectedPetType !== 'All') {
            filtered = filtered.filter(p => p.petType === selectedPetType);
        }

        // Category filter
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => {
                const cat = typeof p.category === 'object' ? p.category?.name : p.category;
                return cat === selectedCategory;
            });
        }

        // Price filter
        filtered = filtered.filter(p => p.price <= priceRange);

        // Availability filter
        if (showInStockOnly) {
            filtered = filtered.filter(p => p.countInStock > 0);
        }

        // If user is searching, apply search filter too
        if (keyword && keyword.trim().length > 0) {
            filtered = filtered.filter((i) =>
                i.name.toLowerCase().includes(keyword.toLowerCase()) ||
                (i.petType && i.petType.toLowerCase().includes(keyword.toLowerCase())) ||
                (i.category && (typeof i.category === 'string'
                    ? i.category.toLowerCase().includes(keyword.toLowerCase())
                    : i.category.name && i.category.name.toLowerCase().includes(keyword.toLowerCase())))
            );
            setProductsFiltered(filtered);
        } else {
            setProductsCtg(filtered);
        }

        setShowFilters(false);
    };

    const resetFilters = () => {
        setSelectedPetType('All');
        setSelectedCategory('All');
        setPriceRange(200);
        setShowInStockOnly(false);
        setProductsCtg(initialState);
        setShowFilters(false);
    };

    const changeCtg = (ctg) => {
        try {
            if (ctg === "all") {
                setProductsCtg(Array.isArray(initialState) ? [...initialState] : []);
                setActive(true);
            } else {
                const filtered = (Array.isArray(initialState) ? initialState : []).filter(
                    (i) => i && i.category && i.category !== null && i.category.id === ctg
                );
                setProductsCtg(filtered);
                setActive(true);
            }
        } catch (error) {
            console.error('Category filter error:', error);
            setProductsCtg([]);
        }
    };

    useFocusEffect((
        useCallback(
            () => {
                let isMounted = true;
                setFocus(false);
                setActive(-1);
                setLoading(true);
                dispatch(fetchProducts())
                    .then((data) => {
                        if (!isMounted) return;
                        const productData = data || [];
                        setProductsFiltered(productData);
                        setProductsCtg(productData);
                        setInitialState(productData);
                        setLoading(false);
                    })
                    .catch(() => {
                        if (!isMounted) return;
                        setProductsFiltered([]);
                        setProductsCtg([]);
                        setInitialState([]);
                        setLoading(false);
                        Toast.show({
                            topOffset: 60,
                            type: 'error',
                            text1: 'Products unavailable',
                            text2: 'Could not load products from backend.',
                        });
                    });

                axios
                    .get(`${baseURL}categories`)
                    .then((res) => {
                        if (!isMounted) return;
                        setCategories(res.data)
                    })
                    .catch(() => {
                        if (!isMounted) return;
                        setCategories([]);
                    })

                return () => {
                    isMounted = false;
                };
            },
            [dispatch],
        )
    ))

    return (
        <Surface width="100%" style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>

            {/* Search Bar with Filter Button */}
            <View style={styles.searchRow}>
                <Searchbar
                    placeholder="Search by name, brand, pet type..."
                    onChangeText={(text) => {
                        searchProduct(text);
                        setKeyword(text);
                        setFocus(text.trim().length > 0);
                    }}
                    value={keyword}
                    onClearIconPress={() => {
                        setKeyword('');
                        searchProduct('');
                        onBlur();
                    }}
                    placeholderTextColor="#8A9099"
                    iconColor="#6B7280"
                    inputStyle={styles.searchInput}
                    style={styles.searchBar}
                />
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(true)}
                >
                    <Ionicons name="filter" size={22} color="#FF8C42" />
                </TouchableOpacity>
            </View>

            {/* Pet Type Quick Filter Chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={styles.chipContainer}
            >
                {PET_TYPES.map((pet) => (
                    <TouchableOpacity
                        key={pet}
                        style={[
                            styles.filterChip,
                            selectedPetType === pet && styles.filterChipActive
                        ]}
                        onPress={() => {
                            setSelectedPetType(pet);
                            if (pet === 'All') {
                                setProductsCtg(initialState);
                            } else {
                                setProductsCtg(initialState.filter(p => p.petType === pet));
                            }
                        }}
                    >
                        <Ionicons
                            name="paw"
                            size={14}
                            color={selectedPetType === pet ? 'white' : '#FF8C42'}
                        />
                        <Text style={[
                            styles.filterChipText,
                            selectedPetType === pet && styles.filterChipTextActive
                        ]}>{pet}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {focus === true ? (
                <SearchedProduct
                    productsFiltered={productsFiltered}
                />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: '#f5f5f5' }}>
                    <View>
                        <Banner />
                    </View>

                    {productsCtg.length > 0 ? (
                        <View>
                            {/* Organize products by category */}
                            {categories.map((category) => {
                                const catName = category.name;
                                const categoryProducts = productsByCategory[catName] || [];
                                if (categoryProducts.length === 0) return null;

                                return (
                                    <View key={category._id || category.id} style={styles.sectionContainer}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.sectionTitle}>
                                                {catName}
                                            </Text>
                                            <TouchableOpacity onPress={() => {
                                                setSelectedCategory(catName);
                                                setProductsCtg(initialState.filter(p => {
                                                    const pCat = typeof p.category === 'object' ? p.category?.name : p.category;
                                                    return pCat === catName;
                                                }));
                                            }}>
                                                <Text style={styles.viewAll}>View All</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <FlatList
                                            horizontal={true}
                                            showsHorizontalScrollIndicator={false}
                                            data={categoryProducts}
                                            renderItem={({ item }) => (
                                                <ProductList key={item._id} item={item} horizontal={true} />
                                            )}
                                            keyExtractor={(item) => item._id || item.id}
                                            scrollEnabled={true}
                                            snapToAlignment="start"
                                            decelerationRate="fast"
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={[styles.center, { height: height / 2 }]}>
                            <Text>No products found</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Filter Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilters(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter Products</Text>
                            <TouchableOpacity onPress={() => setShowFilters(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Pet Type Filter */}
                            <Text style={styles.filterLabel}>Pet Type</Text>
                            <View style={styles.filterOptions}>
                                {PET_TYPES.map((pet) => (
                                    <TouchableOpacity
                                        key={pet}
                                        style={[
                                            styles.filterOption,
                                            selectedPetType === pet && styles.filterOptionActive
                                        ]}
                                        onPress={() => setSelectedPetType(pet)}
                                    >
                                        <Text style={[
                                            styles.filterOptionText,
                                            selectedPetType === pet && styles.filterOptionTextActive
                                        ]}>{pet}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Category Filter */}
                            <Text style={styles.filterLabel}>Category</Text>
                            <View style={styles.filterOptions}>
                                {PRODUCT_CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.filterOption,
                                            selectedCategory === cat && styles.filterOptionActive
                                        ]}
                                        onPress={() => setSelectedCategory(cat)}
                                    >
                                        <Text style={[
                                            styles.filterOptionText,
                                            selectedCategory === cat && styles.filterOptionTextActive
                                        ]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Price Range */}
                            <Text style={styles.filterLabel}>Max Price: ${priceRange.toFixed(0)}</Text>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={200}
                                step={5}
                                value={priceRange}
                                onValueChange={setPriceRange}
                                minimumTrackTintColor="#FF8C42"
                                maximumTrackTintColor="#ddd"
                                thumbTintColor="#FF8C42"
                            />

                            {/* Availability */}
                            <TouchableOpacity
                                style={styles.availabilityToggle}
                                onPress={() => setShowInStockOnly(!showInStockOnly)}
                            >
                                <Ionicons
                                    name={showInStockOnly ? "checkbox" : "square-outline"}
                                    size={22}
                                    color="#FF8C42"
                                />
                                <Text style={styles.availabilityText}>In Stock Only</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Filter Actions */}
                        <View style={styles.filterActions}>
                            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                                <Text style={styles.resetButtonText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                                <Text style={styles.applyButtonText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </Surface>
    )
}

const styles = StyleSheet.create({
    container: {
        flexWrap: "wrap",
        backgroundColor: "#f5f5f5",
    },
    listContainer: {
        height: height,
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
        flexWrap: "wrap",
        backgroundColor: "#f5f5f5",
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 6,
        paddingRight: 8,
        backgroundColor: 'white',
    },
    searchBar: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 0,
    },
    searchInput: {
        color: '#1F2937',
    },
    filterButton: {
        padding: 8,
        backgroundColor: '#FFF3E8',
        borderRadius: 8,
        marginLeft: 4,
    },
    chipScroll: {
        maxHeight: 50,
        backgroundColor: 'white',
    },
    chipContainer: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FF8C42',
        backgroundColor: 'white',
    },
    filterChipActive: {
        backgroundColor: '#FF8C42',
    },
    filterChipText: {
        fontSize: 13,
        color: '#FF8C42',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: 'white',
    },
    sectionContainer: {
        backgroundColor: 'white',
        marginBottom: 20,
        paddingVertical: 15,
        paddingHorizontal: 10,
        marginHorizontal: 10,
        borderRadius: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    viewAll: {
        color: '#0077CC',
        fontSize: 14,
        fontWeight: '600',
    },
    // Filter Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginTop: 16,
        marginBottom: 10,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterOption: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#ddd',
        backgroundColor: '#f9f9f9',
    },
    filterOptionActive: {
        backgroundColor: '#FF8C42',
        borderColor: '#FF8C42',
    },
    filterOptionText: {
        fontSize: 13,
        color: '#666',
    },
    filterOptionTextActive: {
        color: 'white',
        fontWeight: '600',
    },
    availabilityToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
        paddingVertical: 8,
    },
    availabilityText: {
        fontSize: 15,
        color: '#333',
    },
    filterActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    resetButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 15,
        color: '#888',
        fontWeight: '600',
    },
    applyButton: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#FF8C42',
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 15,
        color: 'white',
        fontWeight: '700',
    },
});

export default ProductContainer;