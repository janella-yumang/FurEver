import React, { useState, useEffect, useCallback } from "react";
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

const PET_TYPES = ['All', 'Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster'];
const PRODUCT_CATEGORIES = ['All', 'Pet Food', 'Treats', 'Toys', 'Grooming', 'Health', 'Accessories', 'Habitat'];

const mockProducts = [
    { _id: "1", name: "Dog Food Premium", price: 29.99, description: "High-quality dog food with real chicken. Ingredients: chicken, rice, vegetables. For adult dogs.", category: "Pet Food", petType: "Dog", image: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=300&q=80", countInStock: 50, rating: 5, variants: ['2kg', '5kg', '10kg'], expirationDate: '2026-06-30' },
    { _id: "2", name: "Cat Food Deluxe", price: 24.99, description: "Premium cat food with salmon. Rich in omega-3 and vitamins.", category: "Pet Food", petType: "Cat", image: "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=300&q=80", countInStock: 45, rating: 4, variants: ['1kg', '3kg'], expirationDate: '2026-05-15' },
    { _id: "3", name: "Bird Seed Mix", price: 19.99, description: "Nutritious bird seed blend for parakeets and finches.", category: "Pet Food", petType: "Bird", image: "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=300&q=80", countInStock: 60, rating: 4, variants: ['500g', '1kg'], expirationDate: '2026-12-01' },
    { _id: "4", name: "Fish Food Flakes", price: 14.99, description: "Premium tropical fish food flakes. Suitable for all freshwater fish.", category: "Pet Food", petType: "Fish", image: "https://images.unsplash.com/photo-1546696418-0dffeefbbe9b?w=300&q=80", countInStock: 70, rating: 3, variants: ['50g', '100g'] },
    { _id: "5", name: "Dog Collar Adjustable", price: 15.99, description: "Adjustable nylon collar for dogs. Reflective strip for safety. Size guide: S(25-35cm), M(35-50cm), L(50-65cm).", category: "Accessories", petType: "Dog", image: "https://images.unsplash.com/photo-1570649889742-f049cd451bba?w=300&q=80", countInStock: 40, rating: 5, variants: ['Small', 'Medium', 'Large'] },
    { _id: "6", name: "Cat Toy Mouse", price: 9.99, description: "Interactive cat toy mouse with catnip. Safe, non-toxic materials.", category: "Toys", petType: "Cat", image: "https://images.unsplash.com/photo-1531209869568-96b8fd6b7e78?w=300&q=80", countInStock: 35, rating: 4 },
    { _id: "7", name: "Dog Shampoo Natural", price: 18.99, description: "Natural grooming shampoo for dogs. Ingredients: aloe vera, oatmeal, coconut oil. Gentle on skin.", category: "Grooming", petType: "Dog", image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&q=80", countInStock: 25, rating: 5, variants: ['250ml', '500ml'] },
    { _id: "8", name: "Cat Health Supplement", price: 22.99, description: "Vitamins and minerals for cats. Supports immune system and coat health.", category: "Health", petType: "Cat", image: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300&q=80", countInStock: 30, rating: 4, expirationDate: '2026-09-01' },
    { _id: "9", name: "Dog Treats Chicken", price: 12.99, description: "Chicken jerky treats for dogs. No artificial preservatives. Ingredients: 100% chicken breast.", category: "Treats", petType: "Dog", image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300&q=80", countInStock: 55, rating: 5, variants: ['100g', '250g'], expirationDate: '2026-03-20' },
    { _id: "10", name: "Fish Tank Filter", price: 34.99, description: "Aquarium water filtration system. Suitable for tanks up to 100L.", category: "Habitat", petType: "Fish", image: "https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=300&q=80", countInStock: 20, rating: 4 },
    { _id: "11", name: "Bird Cage Deluxe", price: 89.99, description: "Spacious bird cage with accessories. Dimensions: 60x40x80cm.", category: "Habitat", petType: "Bird", image: "https://images.unsplash.com/photo-1506220926022-cc5c12acdb35?w=300&q=80", countInStock: 10, rating: 5, variants: ['Medium', 'Large'] },
    { _id: "12", name: "Hamster Wheel", price: 11.99, description: "Silent spinning wheel for hamsters. Safe enclosed design.", category: "Toys", petType: "Hamster", image: "https://images.unsplash.com/photo-1425082661507-3f9c4cba2aae?w=300&q=80", countInStock: 40, rating: 3, variants: ['Small', 'Medium'] },
];

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
    const productsState = useSelector((state) => state.products);
    const products = productsState?.data || [];
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

    const searchProduct = (text) => {
        setProductsFiltered(
            products.filter((i) =>
                i.name.toLowerCase().includes(text.toLowerCase()) ||
                (i.petType && i.petType.toLowerCase().includes(text.toLowerCase())) ||
                (i.category && (typeof i.category === 'string'
                    ? i.category.toLowerCase().includes(text.toLowerCase())
                    : i.category.name && i.category.name.toLowerCase().includes(text.toLowerCase())))
            )
        )
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

        setProductsCtg(filtered);
        setProductsFiltered(filtered);
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
        {
            ctg === "all"
                ? [setProductsCtg(initialState), setActive(true)]
                : [
                    setProductsCtg(
                        products.filter((i) => (i.category !== null && i.category.id) === ctg),
                        setActive(true)
                    ),
                ];
        }
    };

    useFocusEffect((
        useCallback(
            () => {
                setFocus(false);
                setActive(-1);
                if (Platform.OS === 'web') {
                    setProductsFiltered(mockProducts);
                    setProductsCtg(mockProducts);
                    setInitialState(mockProducts);
                    setCategories(mockCategories);
                    setLoading(false);
                } else {
                    dispatch(fetchProducts())
                        .then((data) => {
                            const productData = data || [];
                            setProductsFiltered(productData);
                            setProductsCtg(productData);
                            setInitialState(productData);
                            setLoading(false)
                        })
                        .catch((error) => {
                            console.log('Api call error')
                            setProductsFiltered(mockProducts);
                            setProductsCtg(mockProducts);
                            setInitialState(mockProducts);
                            setLoading(false);
                        })

                    axios
                        .get(`${baseURL}categories`)
                        .then((res) => {
                            setCategories(res.data)
                        })
                        .catch((error) => {
                            console.log('Api categories call error')
                            setCategories(mockCategories);
                        })
                }

                return () => {
                    setProductsFiltered([]);
                    setFocus(false);
                    setCategories([]);
                    setActive(-1);
                    setInitialState([]);
                    setProductsCtg([]);
                };
            },
            [],
        )
    ))

    return (
        <Surface width="100%" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>

            {/* Search Bar with Filter Button */}
            <View style={styles.searchRow}>
                <Searchbar
                    placeholder="Search by name, brand, pet type..."
                    onChangeText={(text) => [searchProduct(text), setKeyword(text), setFocus(true)]}
                    value={keyword}
                    onClearIconPress={onBlur}
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
                            {(categories.length > 0 ? categories : mockCategories).map((category) => {
                                const catName = category.name;
                                const categoryProducts = productsCtg.filter(p => {
                                    const pCat = typeof p.category === 'object' ? p.category?.name : p.category;
                                    return pCat === catName;
                                });
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
        paddingRight: 8,
        backgroundColor: 'white',
    },
    searchBar: {
        flex: 1,
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