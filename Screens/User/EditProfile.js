import React, { useState, useContext, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Image, TextInput, Dimensions, Alert
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import mime from 'mime';
import AddressMapPicker from '../../Shared/AddressMapPicker';

var { width } = Dimensions.get('window');

const PET_TYPES = ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster', 'Reptile', 'Other'];

const EditProfile = () => {
    const context = useContext(AuthGlobal);
    const navigation = useNavigation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState(null);
    const [address, setAddress] = useState('');
    const [preferredPets, setPreferredPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [coordinates, setCoordinates] = useState(null);

    const getAuthToken = async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        if (secureToken) return secureToken;
        return AsyncStorage.getItem('jwt');
    };

    useFocusEffect(
        useCallback(() => {
            if (
                context.stateUser.isAuthenticated === false ||
                context.stateUser.isAuthenticated === null
            ) {
                navigation.navigate('Login');
                return;
            }

            getAuthToken()
                .then((token) => {
                    axios
                        .get(`${baseURL}users/${context.stateUser.user.userId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        })
                        .then((res) => {
                            const user = res.data;
                            setName(user.name || '');
                            setEmail(user.email || '');
                            setPhone(user.phone || '');
                            setImage(user.image || null);
                            setAddress(user.shippingAddress || '');
                            // Handle preferredPets as either array or JSON string
                            let pets = user.preferredPets || [];
                            if (typeof pets === 'string') {
                                try {
                                    pets = JSON.parse(pets);
                                } catch (e) {
                                    pets = [];
                                }
                            }
                            setPreferredPets(Array.isArray(pets) ? pets : []);
                        })
                        .catch((err) => console.log(err));
                })
                .catch((err) => console.log(err));
        }, [context.stateUser.isAuthenticated])
    );

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') {
            Alert.alert('Camera Permission', 'Camera access is required to take a photo.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleProfileImagePress = () => {
        Alert.alert(
            'Profile Photo',
            'Choose how you want to update your photo.',
            [
                { text: 'Take Photo', onPress: takePhoto },
                { text: 'Choose from Gallery', onPress: pickImage },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const togglePetType = (pet) => {
        if (preferredPets.includes(pet)) {
            setPreferredPets(preferredPets.filter((p) => p !== pet));
        } else {
            setPreferredPets([...preferredPets, pet]);
        }
    };

    const handleLocationSelect = (locationData) => {
        setAddress(locationData.address);
        setCoordinates(locationData.coordinates);
        
        Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Location Selected",
            text2: "Address has been updated"
        });
    };

    const handleSave = async () => {
        if (!name || !email) {
            Alert.alert('Error', 'Name and email are required.');
            return;
        }
        setLoading(true);
        try {
            const token = await getAuthToken();
            let formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('shippingAddress', address);
            formData.append('preferredPets', JSON.stringify(preferredPets));

            if (image && image.startsWith('file')) {
                const newImageUri = "file:///" + image.split("file:/").join("");
                formData.append('image', {
                    uri: newImageUri,
                    type: mime.getType(newImageUri),
                    name: newImageUri.split("/").pop(),
                });
            }

            await axios.put(
                `${baseURL}users/${context.stateUser.user.userId}`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            Toast.show({
                topOffset: 60,
                type: 'success',
                text1: 'Profile Updated',
                text2: 'Your profile has been updated successfully.',
            });
            navigation.goBack();
        } catch (err) {
            console.log(err);
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: 'Update Failed',
                text2: 'Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAwareScrollView
            viewIsInsideTabBar={true}
            extraHeight={200}
            enableOnAndroid={true}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.heading}>Edit Profile</Text>

                {/* Profile Image */}
                <TouchableOpacity onPress={handleProfileImagePress} style={styles.imageContainer}>
                    <Image
                        source={{
                            uri: image || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png',
                        }}
                        style={styles.profileImage}
                    />
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={20} color="white" />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.takePhotoButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={16} color="white" />
                    <Text style={styles.takePhotoButtonText}>Take a Photo</Text>
                </TouchableOpacity>

                {/* Form Fields */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your name"
                    />
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                        value={email}
                        editable={false}
                    />
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Phone</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="numeric"
                        placeholder="Enter phone number"
                    />
                </View>

                {/* Delivery Address */}
                <Text style={styles.sectionTitle}>Delivery Address</Text>

                {/* Map Picker Button */}
                <TouchableOpacity 
                    style={styles.mapButton}
                    onPress={() => setShowMapPicker(true)}
                >
                    <Ionicons name="map" size={24} color="#fff" />
                    <Text style={styles.mapButtonText}>Select Address from Map</Text>
                </TouchableOpacity>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={styles.input}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Street address"
                    />
                </View>

                {/* Preferred Pets */}
                <Text style={styles.sectionTitle}>Preferred Pets</Text>
                <View style={styles.petGrid}>
                    {PET_TYPES.map((pet) => (
                        <TouchableOpacity
                            key={pet}
                            style={[
                                styles.petChip,
                                preferredPets.includes(pet) && styles.petChipActive,
                            ]}
                            onPress={() => togglePetType(pet)}
                        >
                            <Text
                                style={[
                                    styles.petChipText,
                                    preferredPets.includes(pet) && styles.petChipTextActive,
                                ]}
                            >
                                {pet}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, loading && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Address Map Picker Modal */}
            <AddressMapPicker
                visible={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onSelectLocation={handleLocationSelect}
            />
        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    heading: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginBottom: 20,
    },
    imageContainer: {
        marginBottom: 20,
        position: 'relative',
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#FF8C42',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FF8C42',
        borderRadius: 20,
        padding: 8,
    },
    takePhotoButton: {
        backgroundColor: '#FF8C42',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 16,
    },
    takePhotoButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    fieldContainer: {
        width: '100%',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        alignSelf: 'flex-start',
        marginTop: 20,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        width: '100%',
    },
    petGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        gap: 8,
        marginBottom: 20,
    },
    petChip: {
        paddingHorizontal: 16,
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
        fontSize: 14,
        color: '#666',
    },
    petChipTextActive: {
        color: 'white',
        fontWeight: '600',
    },
    saveButton: {
        width: '100%',
        backgroundColor: '#FF8C42',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8C42',
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        width: '100%',
    },
    mapButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default EditProfile;
