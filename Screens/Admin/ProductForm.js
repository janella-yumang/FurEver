import React, { useState } from "react"
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ScrollView
} from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import { Surface } from "react-native-paper"
import { Picker } from "@react-native-picker/picker"

import FormContainer from "../../Shared/FormContainer"
import Input from "../../Shared/Input"
import EasyButton from "../../Shared/StyledComponents/EasyButton"

import Toast from "react-native-toast-message"
import AsyncStorage from '@react-native-async-storage/async-storage'
import baseURL from "../../assets/common/baseurl"
import Error from "../../Shared/Error"
import axios from "axios"
import * as ImagePicker from "expo-image-picker"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { useCallback } from "react"
import mime from "mime";
import { Ionicons } from "@expo/vector-icons";

const PET_TYPES = ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster', 'Reptile', 'Other'];
const PRODUCT_CATEGORIES = [
    'Pet Food', 'Treats', 'Toys', 'Grooming', 'Health', 'Accessories', 'Habitat'
];

const ProductForm = (props) => {
    const [pickerValue, setPickerValue] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState(0);
    const [description, setDescription] = useState('');
    const [image, setImage] = useState('');
    const [mainImage, setMainImage] = useState();
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [token, setToken] = useState();
    const [error, setError] = useState();
    const [countInStock, setCountInStock] = useState();
    const [item, setItem] = useState(null);
    const [petType, setPetType] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [sizeVariants, setSizeVariants] = useState('');
    const [lowStockThreshold, setLowStockThreshold] = useState('10');

    let navigation = useNavigation()

    useFocusEffect(
        useCallback(() => {
            if (!props.route.params) {
                // Reset form for adding new product
                setItem(null);
                setName('');
                setPrice('');
                setDescription('');
                setImage('');
                setMainImage(undefined);
                setCategory('');
                setPickerValue('');
                setCountInStock('');
                setLowStockThreshold('10');
                setPetType('');
                setExpirationDate('');
                setSizeVariants('');
                setError(null);
            } else {
                const editItem = props.route.params.item;
                setItem(editItem);
                setName(editItem.name || '');
                setPrice(editItem.price?.toString() || '');
                setDescription(editItem.description || '');
                setMainImage(editItem.image);
                setImage(editItem.image || '');
                setCategory(String(editItem.category?._id || editItem.category?.id || editItem.category || ''));
                setPickerValue(String(editItem.category?._id || editItem.category?.id || editItem.category || ''));
                setCountInStock(editItem.countInStock?.toString() || '');
                setLowStockThreshold(editItem.lowStockThreshold?.toString() || '10');
                setPetType(editItem.petType || '');
                setExpirationDate(editItem.expirationDate || '');
                setSizeVariants(editItem.variants ? editItem.variants.join(', ') : '');
                setError(null);
            }
            AsyncStorage.getItem("jwt")
                .then((res) => {
                    setToken(res)
                })
                .catch((error) => console.log(error))
            axios
                .get(`${baseURL}categories`)
                .then((res) => setCategories(res.data))
                .catch((error) => alert("Error to load categories"));
            (async () => {
                if (Platform.OS !== "web") {
                    const {
                        status,
                    } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== "granted") {
                        alert("Sorry, we need camera roll permissions to make this work!")
                    }
                }
            })();
            return () => {
                setCategories([])
            }
        }, [props.route.params])
    )

    const takePhoto = async () => {
        try {
            let result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
            });

            if (!result.canceled) {
                setMainImage(result.assets[0].uri);
                setImage(result.assets[0].uri);
                Toast.show({
                    topOffset: 60,
                    type: 'success',
                    text1: 'Photo captured successfully',
                });
            }
        } catch (error) {
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: 'Error capturing photo',
                text2: error.message,
            });
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images',],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1
        });

        if (!result.canceled) {
            setMainImage(result.assets[0].uri);
            setImage(result.assets[0].uri);
        }
    }

    const addProduct = () => {
        if (
            name === "" ||
            price === "" ||
            description === "" ||
            category === "" ||
            countInStock === ""
        ) {
            setError("Please fill in all required fields")
            return;
        }

        let formData = new FormData();

        formData.append("name", name);
        formData.append("price", price);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("countInStock", countInStock);
        formData.append("lowStockThreshold", lowStockThreshold || '10');
        formData.append("petType", petType);
        formData.append("expirationDate", expirationDate);
        if (sizeVariants) {
            formData.append("variants", JSON.stringify(sizeVariants.split(',').map(v => v.trim())));
        }

        if (image && !image.startsWith('http') && !image.startsWith('data:')) {
            // New image picked from device - send as file upload
            const newImageUri = "file:///" + image.split("file:/").join("");
            formData.append("image", {
                uri: newImageUri,
                type: mime.getType(newImageUri),
                name: newImageUri.split("/").pop()
            });
        } else if (image && image.startsWith('http')) {
            // HTTP URL - send as text
            formData.append("image", image);
        }
        // If image is a data: URI (existing stored image), don't resend it — server already has it

        const config = {
            headers: {
                "Content-Type": "multipart/form-data",
                "Authorization": `Bearer ${token}`
            }
        }
        if (item !== null) {
            axios
                .put(`${baseURL}products/${item._id || item.id}`, formData, config)
                .then((res) => {
                    if (res.status === 200 || res.status === 201) {
                        Toast.show({
                            topOffset: 60,
                            type: "success",
                            text1: "Product successfully updated",
                            text2: ""
                        });
                        setTimeout(() => {
                            navigation.navigate("Products");
                        }, 500)
                    }
                })
                .catch((error) => {
                    const errorMsg = error?.response?.data?.message || error?.message || "Failed to update product";
                    const statusCode = error?.response?.status || "unknown";
                    console.error('[ProductForm] Error updating product:', {
                        status: statusCode,
                        message: errorMsg,
                        response: error?.response?.data,
                        error: error
                    });
                    Toast.show({
                        topOffset: 60,
                        type: "error",
                        text1: "Error updating product",
                        text2: errorMsg
                    })
                })
        } else {
            axios
                .post(`${baseURL}products`, formData, config)
                .then((res) => {
                    if (res.status === 200 || res.status === 201) {
                        Toast.show({
                            topOffset: 60,
                            type: "success",
                            text1: "New Product added",
                            text2: ""
                        });
                        setTimeout(() => {
                            navigation.navigate("Products");
                        }, 500)
                    }
                })
                .catch((error) => {
                    const errorMsg = error?.response?.data?.message || error?.message || "Failed to create product";
                    const statusCode = error?.response?.status || "unknown";
                    console.error('[ProductForm] Error creating product:', {
                        status: statusCode,
                        message: errorMsg,
                        response: error?.response?.data,
                        error: error
                    });
                    Toast.show({
                        topOffset: 60,
                        type: "error",
                        text1: "Error creating product",
                        text2: errorMsg
                    })
                })
        }
    }

    return (
        <KeyboardAwareScrollView
            viewIsInsideTabBar={true}
            extraHeight={200}
            enableOnAndroid={true}
            contentContainerStyle={{ paddingBottom: 40 }}
        >
        <FormContainer title={item ? "Edit Product" : "Add Product"}>
            <View style={styles.imageContainer}>
                {mainImage ? (
                    <Image style={styles.image} source={{ uri: mainImage }} />
                ) : (
                    <View style={[styles.image, styles.placeholder]} />
                )}
                <View style={styles.imagePickerButtons}>
                    <TouchableOpacity
                        onPress={takePhoto}
                        style={[styles.imagePicker, styles.cameraButton]}
                        title="Capture Photo">
                        <Ionicons style={{ color: "white" }} name="camera" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={pickImage}
                        style={[styles.imagePicker, styles.uploadButton]}
                        title="Upload Photo">
                        <Ionicons style={{ color: "white" }} name="image" size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Basic Info */}
            <Text style={styles.sectionHeader}>Basic Information</Text>
            <View style={styles.label}>
                <Text style={styles.labelText}>Product Name *</Text>
            </View>
            <Input
                placeholder="Product Name"
                name="name"
                id="name"
                value={name}
                onChangeText={(text) => setName(text)}
            />
            <View style={styles.label}>
                <Text style={styles.labelText}>Price *</Text>
            </View>
            <Input
                placeholder="Price"
                name="price"
                id="price"
                value={price}
                keyboardType={"numeric"}
                onChangeText={(text) => setPrice(text)}
            />
            <View style={styles.label}>
                <Text style={styles.labelText}>Stock *</Text>
            </View>
            <Input
                placeholder="Count in Stock"
                name="stock"
                id="stock"
                value={countInStock}
                keyboardType={"numeric"}
                onChangeText={(text) => setCountInStock(text)}
            />
            <View style={styles.label}>
                <Text style={styles.labelText}>Low Stock Alert Threshold</Text>
                <Text style={styles.helperText}>
                    Alert when stock falls below this number (default: 10)
                </Text>
            </View>
            <Input
                placeholder="Low Stock Threshold"
                name="lowStockThreshold"
                id="lowStockThreshold"
                value={lowStockThreshold}
                keyboardType={"numeric"}
                onChangeText={(text) => setLowStockThreshold(text)}
            />

            {/* Category & Pet Type */}
            <Text style={styles.sectionHeader}>Classification</Text>
            <View style={styles.label}>
                <Text style={styles.labelText}>Category *</Text>
            </View>
            <View style={styles.pickerContainer}>
                <Picker
                    selectionColor="#FF8C42"
                    style={styles.picker}
                    selectedValue={pickerValue}
                    onValueChange={(e) => [setPickerValue(e), setCategory(e)]} >
                    <Picker.Item label="Select Category" value="" />
                    {categories.map((c, index) => {
                        return (
                            <Picker.Item
                                key={c._id || c.id}
                                label={c.name}
                                value={String(c._id || c.id)} />
                        )
                    })}
                </Picker>
            </View>

            <View style={styles.label}>
                <Text style={styles.labelText}>Pet Type</Text>
            </View>
            <View style={styles.petTypeGrid}>
                {PET_TYPES.map((pet) => (
                    <TouchableOpacity
                        key={pet}
                        style={[
                            styles.petChip,
                            petType === pet && styles.petChipActive
                        ]}
                        onPress={() => setPetType(petType === pet ? '' : pet)}
                    >
                        <Text style={[
                            styles.petChipText,
                            petType === pet && styles.petChipTextActive
                        ]}>{pet}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Details */}
            <Text style={styles.sectionHeader}>Product Details</Text>
            <View style={styles.label}>
                <Text style={styles.labelText}>Description *</Text>
            </View>
            <Input
                placeholder="Include ingredients, usage, safety info, size guide..."
                name="description"
                id="description"
                value={description}
                multiline
                numberOfLines={4}
                onChangeText={(text) => setDescription(text)}
            />
            <View style={styles.label}>
                <Text style={styles.labelText}>Size Variants (comma-separated)</Text>
            </View>
            <Input
                placeholder="e.g., Small, Medium, Large"
                name="sizeVariants"
                id="sizeVariants"
                value={sizeVariants}
                onChangeText={(text) => setSizeVariants(text)}
            />
            <View style={styles.label}>
                <Text style={styles.labelText}>Expiration Date (for food/treats)</Text>
            </View>
            <Input
                placeholder="YYYY-MM-DD"
                name="expirationDate"
                id="expirationDate"
                value={expirationDate}
                onChangeText={(text) => setExpirationDate(text)}
            />

            {error ? <Error message={error} /> : null}
            <View style={styles.buttonContainer}>
                <EasyButton
                    large
                    primary
                    onPress={() => addProduct()}
                ><Text style={styles.buttonText}>
                    {item ? "Update Product" : "Add Product"}
                </Text>
                </EasyButton>
            </View>
        </FormContainer>
        </KeyboardAwareScrollView>
    )
}


const styles = StyleSheet.create({
    label: {
        width: "80%",
        marginTop: 10
    },
    labelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    helperText: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
        fontStyle: 'italic',
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FF8C42',
        width: '80%',
        marginTop: 20,
        marginBottom: 5,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#FFD9B3',
    },
    buttonContainer: {
        width: "80%",
        marginBottom: 100,
        marginTop: 20,
        alignItems: "center"
    },
    buttonText: {
        color: "white"
    },
    imageContainer: {
        width: 200,
        height: 200,
        borderStyle: "solid",
        borderWidth: 8,
        padding: 0,
        justifyContent: "center",
        borderRadius: 100,
        borderColor: "#E0E0E0",
        elevation: 10
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: 100
    },
    placeholder: {
        backgroundColor: "#E0E0E0"
    },
    imagePickerButtons: {
        position: "absolute",
        right: 5,
        bottom: 5,
        flexDirection: 'row',
        gap: 8,
    },
    imagePicker: {
        backgroundColor: "grey",
        padding: 8,
        borderRadius: 50,
        elevation: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraButton: {
        backgroundColor: '#FF8C42',
    },
    uploadButton: {
        backgroundColor: '#20C997',
    },
    pickerContainer: {
        width: '80%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginTop: 5,
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
    },
    petTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '80%',
        gap: 8,
        marginTop: 8,
    },
    petChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#ddd',
        backgroundColor: '#f9f9f9',
    },
    petChipActive: {
        backgroundColor: '#FF8C42',
        borderColor: '#FF8C42',
    },
    petChipText: {
        fontSize: 13,
        color: '#666',
    },
    petChipTextActive: {
        color: 'white',
        fontWeight: '600',
    },
})

export default ProductForm;