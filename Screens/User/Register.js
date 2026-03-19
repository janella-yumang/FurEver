import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Linking, Alert, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useNavigation } from '@react-navigation/native';

import FormContainer from "../../Shared/FormContainer";
import Input from "../../Shared/Input";
import Error from "../../Shared/Error"
import AddressMapPicker from "../../Shared/AddressMapPicker";
import axios from "axios";
import baseURL from "../../assets/common/baseurl";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import mime from "mime";

import * as ImagePicker from "expo-image-picker"
import * as Location from 'expo-location';
var { height, width } = Dimensions.get("window")

const PET_TYPES = ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster', 'Reptile', 'Other'];

const Register = (props) => {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [image, setImage] = useState(null);
    const [mainImage, setMainImage] = useState('');
    const [location, setLocation] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [preferredPets, setPreferredPets] = useState([]);
    const [address, setAddress] = useState("");
    const [showMapPicker, setShowMapPicker] = useState(false);
    const navigation = useNavigation()

    const togglePetType = (pet) => {
        if (preferredPets.includes(pet)) {
            setPreferredPets(preferredPets.filter(p => p !== pet));
        } else {
            setPreferredPets([...preferredPets, pet]);
        }
    };

    const handleLocationSelect = (locationData) => {
        setAddress(locationData.address);
        setShowMapPicker(false);
        Toast.show({
            topOffset: 60,
            type: 'success',
            text1: 'Address selected',
            text2: locationData.address,
        });
    };

    const takePhoto = async () => {
        const c = await ImagePicker.requestCameraPermissionsAsync();

        if (c.status === "granted") {
            let result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
            });

            if (!result.canceled) {
                setMainImage(result.assets[0].uri);
                setImage(result.assets[0].uri);
            }
        }
    };

    const handleProfileImagePress = () => {
        Alert.alert(
            'Profile Photo',
            'Choose how you want to add your photo.',
            [
                { text: 'Take Photo', onPress: takePhoto },
                { text: 'Choose from Gallery', onPress: pickImage },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const register = () => {
        if (email === "" || name === "" || phone === "" || password === "") {
            setError("Please fill in all required fields");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setError("");

        let formData = new FormData();

        if (image) {
            const newImageUri = "file:///" + image.split("file:/").join("");
            formData.append("image", {
                uri: newImageUri,
                type: mime.getType(newImageUri),
                name: newImageUri.split("/").pop()
            });
        }

        formData.append("name", name);
        formData.append("email", email);
        formData.append("password", password);
        formData.append("phone", phone);
        formData.append("isAdmin", false);
        formData.append("role", "customer");
        formData.append("shippingAddress", address);
        formData.append("preferredPets", JSON.stringify(preferredPets));

        const config = {
            headers: {
                "Content-Type": "multipart/form-data",
            }
        }
        axios
            .post(`${baseURL}users/register`, formData, config)
            .then((res) => {
                if (res.status >= 200 && res.status < 300) {
                    const emailDebug = res?.data?.emailDebug;
                    Toast.show({
                        topOffset: 60,
                        type: "success",
                        text1: "Verification Code Sent 📧",
                        text2: "Check your email for the 6-digit code",
                    });

                    if (emailDebug?.fallbackCode || emailDebug?.previewUrl) {
                        const helperLines = [];
                        if (emailDebug?.fallbackCode) {
                            helperLines.push(`Dev fallback code: ${emailDebug.fallbackCode}`);
                        }
                        if (emailDebug?.previewUrl) {
                            helperLines.push('Email preview is available from the Verify Email screen.');
                        }
                        Alert.alert('Development verification helper', helperLines.join('\n\n'));
                    }

                    setTimeout(() => {
                        navigation.navigate("Verify Email", {
                            email: email.toLowerCase(),
                            emailDebug: emailDebug || null,
                        });
                    }, 500);
                } else {
                    Toast.show({
                        position: 'bottom',
                        bottomOffset: 20,
                        type: "error",
                        text1: "Registration failed",
                        text2: `Unexpected response (${res.status}).`,
                    });
                }
            })
            .catch((error) => {
                const apiMessage =
                    error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    error?.message ||
                    "Please try again";

                Toast.show({
                    position: 'bottom',
                    bottomOffset: 20,
                    type: "error",
                    text1: "Registration failed",
                    text2: apiMessage,
                });
                console.log("Register error:", error?.response || error);
            })
    }

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setMainImage(result.assets[0].uri);
        }
    };

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
        })();
    }, []);

    return (
        <KeyboardAwareScrollView
            viewIsInsideTabBar={true}
            extraHeight={200}
            enableOnAndroid={true}
            contentContainerStyle={{ paddingBottom: 40 }}
        >
            <FormContainer title={"Create Account 🐾"}>

                <View style={styles.imageContainer}>
                    {mainImage ? (
                        <Image style={styles.image} source={{ uri: mainImage }} />
                    ) : (
                        <View style={[styles.image, styles.placeholder]} />
                    )}
                    <TouchableOpacity
                        onPress={handleProfileImagePress}
                        style={styles.imagePicker}>
                        <Ionicons style={{ color: "white" }} name="camera" />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.takePhotoButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={16} color="white" />
                    <Text style={styles.takePhotoButtonText}>Take a Photo</Text>
                </TouchableOpacity>
                <Input
                    placeholder={"Email *"}
                    name={"email"}
                    id={"email"}
                    onChangeText={(text) => setEmail(text.toLowerCase())}
                />
                <Input
                    placeholder={"Name *"}
                    name={"name"}
                    id={"name"}
                    onChangeText={(text) => setName(text)}
                />
                <Input
                    placeholder={"Phone Number *"}
                    name={"phone"}
                    id={"phone"}
                    keyboardType={"numeric"}
                    onChangeText={(text) => setPhone(text)}
                />
                <Input
                    placeholder={"Password *"}
                    name={"password"}
                    id={"password"}
                    secureTextEntry={true}
                    onChangeText={(text) => setPassword(text)}
                />
                <Input
                    placeholder={"Confirm Password *"}
                    name={"confirmPassword"}
                    id={"confirmPassword"}
                    secureTextEntry={true}
                    onChangeText={(text) => setConfirmPassword(text)}
                />

                {/* Address Picker */}
                <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() => setShowMapPicker(true)}
                >
                    <Ionicons name="location" size={18} color="white" />
                    <Text style={styles.mapButtonText}>Select Address from Map</Text>
                </TouchableOpacity>

                <Input
                    placeholder={"Delivery Address (optional)"}
                    name={"address"}
                    id={"address"}
                    value={address}
                    onChangeText={(text) => setAddress(text)}
                />

                {/* Preferred Pets Section */}
                <Text style={styles.sectionTitle}>Preferred Pets (optional)</Text>
                <View style={styles.petGrid}>
                    {PET_TYPES.map((pet) => (
                        <TouchableOpacity
                            key={pet}
                            style={[
                                styles.petChip,
                                preferredPets.includes(pet) && styles.petChipActive
                            ]}
                            onPress={() => togglePetType(pet)}
                        >
                            <Text style={[
                                styles.petChipText,
                                preferredPets.includes(pet) && styles.petChipTextActive
                            ]}>
                                {pet}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.buttonGroup}>
                    {error ? <Error message={error} /> : null}
                </View>
                <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => register()}
                >
                    <Text style={styles.registerButtonText}>Register</Text>
                </TouchableOpacity>
                <View style={styles.loginLink}>
                    <Text style={styles.loginText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                        <Text style={styles.loginLinkText}>Login</Text>
                    </TouchableOpacity>
                </View>

                {/* Address Map Picker Modal */}
                <AddressMapPicker
                    visible={showMapPicker}
                    onClose={() => setShowMapPicker(false)}
                    onSelectLocation={handleLocationSelect}
                />
            </FormContainer>
        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    buttonGroup: {
        width: "80%",
        margin: 10,
        alignItems: "center",
    },
    buttonContainer: {
        width: "80%",
        marginBottom: 80,
        marginTop: 20,
        alignItems: "center"
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
    imagePicker: {
        position: "absolute",
        right: 5,
        bottom: 5,
        backgroundColor: "grey",
        padding: 8,
        borderRadius: 100,
        elevation: 20
    },
    takePhotoButton: {
        width: '60%',
        backgroundColor: '#FF8C42',
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    takePhotoButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        alignSelf: 'flex-start',
        marginLeft: '10%',
        marginTop: 15,
        marginBottom: 8,
    },
    petGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '80%',
        gap: 8,
        marginBottom: 10,
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
    registerButton: {
        width: '80%',
        backgroundColor: '#FF8C42',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    },
    registerButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    loginLink: {
        flexDirection: 'row',
        marginTop: 20,
        marginBottom: 40,
    },
    loginText: {
        color: '#888',
    },
    loginLinkText: {
        color: '#FF8C42',
        fontWeight: '600',
    },
    mapButton: {
        width: '80%',
        backgroundColor: '#5B8DEF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        marginBottom: 8,
    },
    mapButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default Register;
