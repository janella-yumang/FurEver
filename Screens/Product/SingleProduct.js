import React, { useState, useEffect, useContext, useCallback } from "react";
import {
    Image, View, StyleSheet, Text, ScrollView, TouchableOpacity,
    TextInput, Dimensions, FlatList, Alert, Platform
} from "react-native";
import { Surface } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../../Redux/Actions/cartActions';
import { addToWishlist, removeFromWishlist } from '../../Redux/Actions/cartActions';
import AuthGlobal from '../../Context/Store/AuthGlobal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import Toast from 'react-native-toast-message';
import { fetchProductReviews } from '../../Redux/Actions/reviewActions';

var { width } = Dimensions.get('window');

const StarRating = ({ rating, size = 16, interactive = false, onRate }) => {
    const stars = [1, 2, 3, 4, 5];
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {stars.map((star) => (
                <TouchableOpacity
                    key={star}
                    onPress={() => interactive && onRate && onRate(star)}
                    disabled={!interactive}
                >
                    <Ionicons
                        name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
                        size={size}
                        color="#FFD43B"
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
};

const SingleProduct = ({ route }) => {
    const [item, setItem] = useState(route.params.item);
    const [userRating, setUserRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [editRating, setEditRating] = useState(0);
    const [editText, setEditText] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [userHasDelivered, setUserHasDelivered] = useState(false);
    const [reviewImage, setReviewImage] = useState('');
    const [editImage, setEditImage] = useState('');
    const [similarProducts, setSimilarProducts] = useState([]);
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const context = useContext(AuthGlobal);
    const wishlistItems = useSelector(state => state.wishlistItems);
    const productId = String(item._id || item.id);
    const reviews = useSelector((state) => state.reviews?.byProduct?.[productId] || []);

    const isInWishlist = wishlistItems.some(
        w => (w._id || w.id) === (item._id || item.id)
    );

    const getReviewId = (review) => review?._id || review?.id;

    const getAuthToken = useCallback(async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        if (secureToken) return secureToken;
        
        const asyncToken = await AsyncStorage.getItem('jwt');
        if (asyncToken) return asyncToken;
        
        return null; // Return null if no token found
    }, []);

    const isOfflineQuickLogin = useCallback(() => {
        const currentUserId = String(context.stateUser?.user?.userId || '');
        return currentUserId.startsWith('quick-');
    }, [context.stateUser]);

    const loadReviews = useCallback(() => {
        dispatch(fetchProductReviews(productId)).catch(() => {
            // Error state is tracked in Redux; avoid breaking the screen flow.
        });
    }, [dispatch, productId]);

    const loadSimilarProducts = useCallback(() => {
        axios.get(`${baseURL}products/${item._id || item.id}/similar`)
            .then(res => setSimilarProducts(res.data || []))
            .catch(() => setSimilarProducts([]));
    }, [item]);

    const pickReviewImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera roll access is needed to attach photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
            setReviewImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const pickEditImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera roll access is needed to attach photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
            setEditImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const checkUserPurchaseStatus = useCallback(async () => {
        if (!context.stateUser?.isAuthenticated) {
            console.log('❌ Not authenticated');
            setUserHasDelivered(false);
            return;
        }
        if (isOfflineQuickLogin()) {
            setUserHasDelivered(false);
            return;
        }
        try {
            const token = await getAuthToken();
            if (!token) {
                setUserHasDelivered(false);
                return;
            }
            const userId = context.stateUser.user?.userId;
            const productId = item._id || item.id;
            
            console.log('\n🔍 DETAILED PURCHASE CHECK:');
            console.log('  User ID:', userId, '(type: ' + typeof userId + ')');
            console.log('  Product ID:', productId, '(type: ' + typeof productId + ')');
            
            const res = await axios.get(`${baseURL}orders/user/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('  Total orders:', res.data?.length || 0);
            
            if (!res.data || res.data.length === 0) {
                console.log('  ❌ No orders found');
                setUserHasDelivered(false);
                return;
            }
            
            let foundDelivered = false;
            res.data.forEach((order, idx) => {
                console.log(`  Order ${idx}: ID=${order.id}, Status=${order.status}, Items=${order.orderItems?.length || 0}`);
                
                if (order.status === 'Delivered') {
                    console.log(`    ✅ Delivered order found`);
                    order.orderItems?.forEach((oi, itemIdx) => {
                        const oi_prodId = oi.product || oi.productId;
                        const match = String(oi_prodId) === String(productId);
                        console.log(`      Item ${itemIdx}: ProdID=${oi_prodId} ${match ? '✅ MATCH!' : '❌ no match'}`)
                        if (match) {
                            foundDelivered = true;
                        }
                    });
                }
            });
            
            console.log('Result: ' + (foundDelivered ? '✅ CAN REVIEW' : '❌ CANNOT REVIEW') + '\n');
            setUserHasDelivered(foundDelivered);
        } catch (err) {
            console.error('❌ Purchase check error:', err.message);
            setUserHasDelivered(false);
        }
    }, [item, context.stateUser, getAuthToken, isOfflineQuickLogin]);

    useFocusEffect(
        useCallback(() => {
            console.log('🔄 SingleProduct screen focused - refreshing reviews and purchase status');
            loadReviews();
            checkUserPurchaseStatus();
            loadSimilarProducts();
        }, [loadReviews, checkUserPurchaseStatus, loadSimilarProducts])
    );

    const handleAddToCart = () => {
        dispatch(addToCart({ ...item, quantity }));
        Toast.show({
            topOffset: 60,
            type: "success",
            text1: `${item.name} added to cart 🐾`,
            text2: `Quantity: ${quantity}`
        });
    };

    const handleWishlistToggle = () => {
        if (isInWishlist) {
            const wishItem = wishlistItems.find(w => (w._id || w.id) === (item._id || item.id));
            dispatch(removeFromWishlist(wishItem));
            Toast.show({ topOffset: 60, type: "info", text1: "Removed from wishlist" });
        } else {
            dispatch(addToWishlist(item));
            Toast.show({ topOffset: 60, type: "success", text1: "Added to wishlist ❤️" });
        }
    };

    const submitReview = async () => {
        if (!context.stateUser.isAuthenticated) {
            Alert.alert('Login Required', 'Please login to submit a review.');
            return;
        }
        if (userRating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }
        if (!userHasDelivered) {
            Alert.alert('Cannot Review', 'You can only review products you have purchased and received.');
            return;
        }
        if (isOfflineQuickLogin()) {
            Alert.alert('Online Login Required', 'Quick Login accounts cannot submit reviews. Please sign in with your real account.');
            return;
        }

        try {
            const token = await getAuthToken();
            if (!token) {
                Alert.alert('Login Required', 'Please login again to submit a review.');
                return;
            }
            console.log('📝 Submitting review for product:', productId, 'rating:', userRating);
            
            const res = await axios.post(
                `${baseURL}products/${productId}/reviews`,
                { rating: userRating, text: reviewText, image: reviewImage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('✅ Review submitted successfully:', res.data);
            Toast.show({ topOffset: 60, type: "success", text1: "Review submitted!", text2: "Your review is now visible." });
            setShowReviewForm(false);
            loadReviews();
            setUserRating(0);
            setReviewText('');
            setReviewImage('');
        } catch (err) {
            console.error('❌ Review submission error:', err.response?.data || err.message);
            const apiMessage =
                err?.response?.data?.message || err?.message || 'Failed to submit review';
            Toast.show({
                topOffset: 60,
                type: "error",
                text1: "Review Failed",
                text2: apiMessage
            });
        }
    };

    const isOwnReview = (review) => {
        if (!context.stateUser?.isAuthenticated) return false;
        const currentUserId = String(context.stateUser?.user?.userId || '');
        const reviewUserId = String(review?.user?._id || review?.user || '');
        return currentUserId.length > 0 && reviewUserId.length > 0 && currentUserId === reviewUserId;
    };

    const startEditReview = (review) => {
        setEditingReviewId(getReviewId(review));
        setEditRating(review.rating);
        setEditText(review.text || '');
        setEditImage(review.image || '');
    };

    const cancelEdit = () => {
        setEditingReviewId(null);
        setEditRating(0);
        setEditText('');
        setEditImage('');
    };

    const submitEditReview = async (reviewId) => {
        if (editRating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }
        try {
            if (isOfflineQuickLogin()) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Online login required' });
                return;
            }
            const token = await getAuthToken();
            if (!token) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please login again' });
                return;
            }
            await axios.put(
                `${baseURL}products/${item._id || item.id}/reviews/${reviewId}`,
                { rating: editRating, text: editText, image: editImage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            loadReviews();
            cancelEdit();
            Toast.show({ topOffset: 60, type: 'success', text1: 'Review updated!' });
        } catch (err) {
            Toast.show({ topOffset: 60, type: 'error', text1: 'Failed to update review' });
        }
    };

    const deleteReview = (reviewId) => {
        Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        if (isOfflineQuickLogin()) {
                            Toast.show({ topOffset: 60, type: 'error', text1: 'Online login required' });
                            return;
                        }
                        const token = await getAuthToken();
                        if (!token) {
                            Toast.show({ topOffset: 60, type: 'error', text1: 'Please login again' });
                            return;
                        }
                        await axios.delete(
                            `${baseURL}products/${item._id || item.id}/reviews/${reviewId}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        loadReviews();
                        Toast.show({ topOffset: 60, type: 'success', text1: 'Review deleted' });
                    } catch (err) {
                        Toast.show({ topOffset: 60, type: 'error', text1: 'Failed to delete review' });
                    }
                },
            },
        ]);
    };

    const avgRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : item.rating || 0;

    return (
        <Surface style={styles.container}>
            <ScrollView style={{ marginBottom: 80 }} showsVerticalScrollIndicator={false}>
                {/* Product Image */}
                <View style={styles.imageWrapper}>
                    <Image
                        source={{
                            uri: item.image || 'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png'
                        }}
                        resizeMode="contain"
                        style={styles.image}
                    />
                    <TouchableOpacity style={styles.wishlistButton} onPress={handleWishlistToggle}>
                        <Ionicons
                            name={isInWishlist ? "heart" : "heart-outline"}
                            size={24}
                            color={isInWishlist ? "#FF6B6B" : "#888"}
                        />
                    </TouchableOpacity>
                </View>

                {/* Product Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.productName}>{item.name}</Text>

                    {/* Rating */}
                    <View style={styles.ratingRow}>
                        <StarRating rating={parseFloat(avgRating)} size={18} />
                        <Text style={styles.ratingText}>
                            {avgRating} ({reviews.length} reviews)
                        </Text>
                    </View>

                    {/* Price */}
                    <View style={styles.priceRow}>
                        <Text style={styles.price}>${item.price?.toFixed(2)}</Text>
                        {item.countInStock > 0 ? (
                            <View style={styles.stockBadge}>
                                <Text style={styles.stockText}>In Stock ({item.countInStock})</Text>
                            </View>
                        ) : (
                            <View style={[styles.stockBadge, { backgroundColor: '#FF6B6B20' }]}>
                                <Text style={[styles.stockText, { color: '#FF6B6B' }]}>Out of Stock</Text>
                            </View>
                        )}
                    </View>

                    {/* Pet Type & Category Tags */}
                    <View style={styles.tagsRow}>
                        {item.petType && (
                            <View style={styles.tag}>
                                <Ionicons name="paw" size={12} color="#FF8C42" />
                                <Text style={styles.tagText}>{item.petType}</Text>
                            </View>
                        )}
                        {item.category && (
                            <View style={styles.tag}>
                                <Ionicons name="pricetag" size={12} color="#20C997" />
                                <Text style={styles.tagText}>
                                    {typeof item.category === 'object' ? item.category.name : item.category}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Expiration Date */}
                    {item.expirationDate && (
                        <View style={styles.expirationRow}>
                            <Ionicons name="calendar-outline" size={16} color="#888" />
                            <Text style={styles.expirationText}>
                                Expires: {new Date(item.expirationDate).toLocaleDateString()}
                            </Text>
                        </View>
                    )}

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.description}>{item.description}</Text>
                    </View>

                    {/* Size Variants */}
                    {item.variants && item.variants.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Available Sizes</Text>
                            <View style={styles.variantsRow}>
                                {item.variants.map((v, i) => (
                                    <TouchableOpacity key={i} style={styles.variantChip}>
                                        <Text style={styles.variantText}>{v}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Reviews Section */}
                    <View style={styles.section}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
                            {userHasDelivered && (
                                <TouchableOpacity
                                    onPress={() => setShowReviewForm(!showReviewForm)}
                                    style={styles.writeReviewButton}
                                >
                                    <Ionicons name="create-outline" size={16} color="#FF8C42" />
                                    <Text style={styles.writeReviewText}>Write Review</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {!context.stateUser?.isAuthenticated && (
                            <View style={styles.reviewInfo}>
                                <Ionicons name="information-circle-outline" size={16} color="#888" />
                                <Text style={styles.reviewInfoText}>Login to write a review</Text>
                            </View>
                        )}

                        {context.stateUser?.isAuthenticated && !userHasDelivered && (
                            <View style={styles.reviewInfo}>
                                <Ionicons name="information-circle-outline" size={16} color="#FF8C42" />
                                <Text style={styles.reviewInfoText}>Purchase and receive this product to write a review</Text>
                            </View>
                        )}

                        {/* Review Form */}
                        {showReviewForm && (
                            <View style={styles.reviewForm}>
                                <Text style={styles.reviewFormLabel}>Your Rating:</Text>
                                <StarRating rating={userRating} size={28} interactive onRate={setUserRating} />
                                <TextInput
                                    style={styles.reviewInput}
                                    placeholder="Share your experience with this product..."
                                    value={reviewText}
                                    onChangeText={setReviewText}
                                    multiline
                                    numberOfLines={3}
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity style={styles.imagePickerBtn} onPress={pickReviewImage}>
                                        <Ionicons name="camera-outline" size={18} color="#FF8C42" />
                                        <Text style={styles.imagePickerText}>{reviewImage ? 'Change Photo' : 'Add Photo (optional)'}</Text>
                                    </TouchableOpacity>
                                    {reviewImage ? (
                                        <TouchableOpacity onPress={() => setReviewImage('')}>
                                            <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                {reviewImage ? (
                                    <Image source={{ uri: reviewImage }} style={styles.reviewImagePreview} resizeMode="cover" />
                                ) : null}
                                <TouchableOpacity style={styles.submitReviewButton} onPress={submitReview}>
                                    <Text style={styles.submitReviewText}>Submit Review</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Review List */}
                        {reviews.map((review) => (
                            <View key={getReviewId(review)} style={styles.reviewCard}>
                                {editingReviewId === getReviewId(review) ? (
                                    /* Edit Form */
                                    <View style={styles.reviewForm}>
                                        <Text style={styles.reviewFormLabel}>Edit Your Rating:</Text>
                                        <StarRating rating={editRating} size={28} interactive onRate={setEditRating} />
                                        <TextInput
                                            style={styles.reviewInput}
                                            placeholder="Update your review..."
                                            value={editText}
                                            onChangeText={setEditText}
                                            multiline
                                            numberOfLines={3}
                                        />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickEditImage}>
                                                <Ionicons name="camera-outline" size={18} color="#FF8C42" />
                                                <Text style={styles.imagePickerText}>{editImage ? 'Change Photo' : 'Add Photo (optional)'}</Text>
                                            </TouchableOpacity>
                                            {editImage ? (
                                                <TouchableOpacity onPress={() => setEditImage('')}>
                                                    <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                        {editImage ? (
                                            <Image source={{ uri: editImage }} style={styles.reviewImagePreview} resizeMode="cover" />
                                        ) : null}
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                style={[styles.submitReviewButton, { flex: 1 }]}
                                                onPress={() => submitEditReview(getReviewId(review))}
                                            >
                                                <Text style={styles.submitReviewText}>Save</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.submitReviewButton, { flex: 1, backgroundColor: '#ccc' }]}
                                                onPress={cancelEdit}
                                            >
                                                <Text style={[styles.submitReviewText, { color: '#555' }]}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    /* Normal Display */
                                    <>
                                        <View style={styles.reviewTop}>
                                            <Text style={styles.reviewerName}>{review.user?.name || review.name || 'Anonymous'}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.reviewDate}>{review.date}</Text>
                                                {isOwnReview(review) && (
                                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                                        <TouchableOpacity onPress={() => startEditReview(review)}>
                                                            <Ionicons name="create-outline" size={16} color="#FF8C42" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => deleteReview(getReviewId(review))}>
                                                            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <StarRating rating={review.rating} size={14} />
                                        <Text style={styles.reviewTextContent}>{review.text}</Text>
                                        {review.image ? (
                                            <Image source={{ uri: review.image }} style={styles.reviewImageDisplay} resizeMode="cover" />
                                        ) : null}
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Similar Products */}
                {similarProducts.length > 0 && (
                    <View style={[styles.section, { marginBottom: 8 }]}>
                        <Text style={styles.sectionTitle}>You May Also Like</Text>
                        <FlatList
                            horizontal
                            data={similarProducts}
                            keyExtractor={(p) => String(p._id || p.id)}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                            renderItem={({ item: sp }) => (
                                <TouchableOpacity
                                    style={styles.similarCard}
                                    onPress={() => navigation.push('Product Detail', { item: sp })}
                                >
                                    <Image
                                        source={{ uri: sp.image || 'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png' }}
                                        style={styles.similarImage}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.similarName} numberOfLines={2}>{sp.name}</Text>
                                    <Text style={styles.similarPrice}>₱{sp.price?.toFixed(2)}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.quantityControl}>
                    <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                        <Ionicons name="remove" size={18} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{quantity}</Text>
                    <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => setQuantity(quantity + 1)}
                    >
                        <Ionicons name="add" size={18} color="#333" />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={[styles.addToCartButton, !item.countInStock && { backgroundColor: '#ccc' }]}
                    onPress={handleAddToCart}
                    disabled={!item.countInStock}
                >
                    <Ionicons name="cart" size={20} color="white" />
                    <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>
            </View>
        </Surface>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        height: '100%',
        backgroundColor: '#f5f5f5',
    },
    imageWrapper: {
        backgroundColor: 'white',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: 280,
    },
    wishlistButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    infoContainer: {
        padding: 16,
    },
    productName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    brand: {
        fontSize: 15,
        color: '#888',
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    ratingText: {
        fontSize: 14,
        color: '#888',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    price: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FF6B6B',
    },
    stockBadge: {
        backgroundColor: '#51CF6620',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    stockText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#51CF66',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'white',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#eee',
    },
    tagText: {
        fontSize: 12,
        color: '#555',
    },
    expirationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    expirationText: {
        fontSize: 13,
        color: '#888',
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#555',
        lineHeight: 22,
    },
    variantsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    variantChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#f9f9f9',
    },
    variantText: {
        fontSize: 13,
        color: '#555',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    writeReviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    writeReviewText: {
        color: '#FF8C42',
        fontWeight: '600',
        fontSize: 13,
    },
    reviewForm: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        gap: 8,
    },
    reviewFormLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    reviewInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        backgroundColor: 'white',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    submitReviewButton: {
        backgroundColor: '#FF8C42',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitReviewText: {
        color: 'white',
        fontWeight: '600',
    },
    reviewCard: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingVertical: 10,
    },
    reviewTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    reviewerName: {
        fontWeight: '600',
        fontSize: 14,
        color: '#333',
    },
    reviewDate: {
        fontSize: 12,
        color: '#999',
    },
    reviewTextContent: {
        fontSize: 13,
        color: '#555',
        marginTop: 4,
        lineHeight: 20,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 12,
        paddingBottom: 20,
        alignItems: 'center',
        gap: 12,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
    },
    qtyButton: {
        padding: 8,
    },
    qtyText: {
        paddingHorizontal: 12,
        fontSize: 16,
        fontWeight: '600',
    },
    addToCartButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#FF8C42',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addToCartText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    reviewInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
        gap: 8,
    },
    reviewInfoText: {
        fontSize: 13,
        color: '#666',
        flex: 1,
    },
    imagePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FF8C4240',
    },
    imagePickerText: {
        fontSize: 13,
        color: '#FF8C42',
        fontWeight: '600',
    },
    reviewImagePreview: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginTop: 4,
    },
    reviewImageDisplay: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginTop: 8,
    },
    similarCard: {
        width: 140,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    similarImage: {
        width: '100%',
        height: 90,
        borderRadius: 6,
        marginBottom: 6,
    },
    similarName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
        lineHeight: 16,
    },
    similarPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FF6B6B',
    },
})

export default SingleProduct