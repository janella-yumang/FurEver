
import {
    StyleSheet,
    View,
    Dimensions,
    Image,
    Text,
    Button,
    TouchableOpacity,
    Platform
} from 'react-native'

var { width, height } = Dimensions.get("window");
import { addToCart, addToWishlist, removeFromWishlist } from '../../Redux/Actions/cartActions'
import { useDispatch, useSelector } from 'react-redux'
import Toast from 'react-native-toast-message'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png';

const resolveImageUri = (image) => {
    if (typeof image === 'string') {
        const trimmed = image.trim();
        return trimmed.length ? trimmed : FALLBACK_IMAGE;
    }

    if (image && typeof image === 'object') {
        if (typeof image.uri === 'string' && image.uri.trim().length) {
            return image.uri.trim();
        }
        if (Array.isArray(image) && typeof image[0] === 'string' && image[0].trim().length) {
            return image[0].trim();
        }
    }

    return FALLBACK_IMAGE;
};

const ProductCard = (props) => {
    const navigation = useNavigation();
    const { name, price, image, countInStock, petType, rating } = props;
    const dispatch = useDispatch()
    const wishlistItems = useSelector(state => state.wishlistItems);
    
    const isInWishlist = wishlistItems.some(
        w => (w._id || w.id) === (props._id || props.id)
    );

    // Calculate discount (assuming 30% off for demo)
    const originalPrice = Math.round(price / 0.7);
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

    const handleWishlistToggle = () => {
        const productData = {
            _id: props._id,
            id: props.id,
            name,
            price,
            image,
            countInStock,
            petType,
            rating,
        };
        if (isInWishlist) {
            dispatch(removeFromWishlist(productData));
            Toast.show({ topOffset: 60, type: "info", text1: "Removed from wishlist" });
        } else {
            dispatch(addToWishlist(productData));
            Toast.show({ topOffset: 60, type: "success", text1: "Added to wishlist ❤️" });
        }
    };

    return (
        <TouchableOpacity 
            style={styles.container} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Product Detail', { item: props })}
        >
            {/* Wishlist Heart */}
            <TouchableOpacity style={styles.wishlistIcon} onPress={handleWishlistToggle}>
                <Ionicons 
                    name={isInWishlist ? "heart" : "heart-outline"} 
                    size={18} 
                    color={isInWishlist ? "#FF6B6B" : "#aaa"} 
                />
            </TouchableOpacity>

            {/* Discount Badge */}
            {discount > 0 && (
                <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{discount}% OFF</Text>
                </View>
            )}
            
            <Image
                style={styles.image}
                resizeMode="contain"
                source={{
                    uri: resolveImageUri(image)
                }}
            />
            
            <View style={styles.card} />
            
            {/* Pet Type Badge */}
            {petType && (
                <View style={styles.petTypeBadge}>
                    <Ionicons name="paw" size={10} color="#FF8C42" />
                    <Text style={styles.petTypeText}>{petType}</Text>
                </View>
            )}

            <Text style={styles.title} numberOfLines={2}>
                {name}
            </Text>

            {/* Star Rating */}
            {rating > 0 && (
                <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons 
                            key={star} 
                            name={star <= rating ? 'star' : 'star-outline'} 
                            size={12} 
                            color="#FFD43B" 
                        />
                    ))}
                </View>
            )}
            
            <View style={styles.priceContainer}>
                <Text style={styles.price}>${price.toFixed(2)}</Text>
                {discount > 0 && (
                    <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
                )}
            </View>
            
            {countInStock > 0 ? (
                <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => {
                        console.log(`➕ Adding to cart: ${name} ($${price})`);
                        dispatch(addToCart({ ...props, quantity: 1, })),
                            Toast.show({
                                topOffset: 60,
                                type: "success",
                                text1: `${name} added to paw cart 🐾`,
                                text2: "Go to your cart to complete order"
                            })
                    }}
                >
                    <Text style={styles.addButtonText}>Add to Cart</Text>
                </TouchableOpacity>
            ) : (
                <Text style={styles.outOfStock}>Out of Stock</Text>
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    container: {
        width: width / 2.2,
        backgroundColor: 'white',
        borderRadius: 8,
        overflow: 'hidden',
        paddingBottom: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
            },
        }),
    },
    image: {
        width: '100%',
        height: width / 2.8,
        backgroundColor: '#f9f9f9',
    },
    wishlistIcon: {
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        backgroundColor: 'white',
        borderRadius: 14,
        padding: 4,
        elevation: 2,
    },
    discountBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#FF6B6B',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 10,
    },
    discountText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
    },
    card: {
        height: 0,
        backgroundColor: 'transparent',
    },
    petTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginLeft: 10,
        marginTop: 6,
    },
    petTypeText: {
        fontSize: 11,
        color: '#FF8C42',
        fontWeight: '500',
    },
    title: {
        fontWeight: "600",
        fontSize: 13,
        textAlign: 'left',
        paddingHorizontal: 10,
        marginTop: 4,
        color: '#333',
    },
    ratingContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        marginTop: 4,
        gap: 1,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginTop: 6,
        marginBottom: 8,
    },
    price: {
        fontSize: 16,
        color: '#FF6B6B',
        fontWeight: '700',
        marginRight: 8,
    },
    originalPrice: {
        fontSize: 12,
        color: '#999',
        textDecorationLine: 'line-through',
    },
    addButton: {
        marginHorizontal: 10,
        backgroundColor: '#FF6B6B',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    outOfStock: {
        marginHorizontal: 10,
        marginTop: 8,
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
    }
})

export default ProductCard;