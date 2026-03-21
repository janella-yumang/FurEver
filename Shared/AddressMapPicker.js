import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const AddressMapPicker = ({ visible, onClose, onSelectLocation, initialRegion }) => {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedCoordinates, setSelectedCoordinates] = useState(null);
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (visible) {
            getCurrentLocation();
        }
    }, [visible]);

    const getCurrentLocation = async () => {
        try {
            setLoading(true);
            // Request location permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
                setLoading(false);
                return;
            }

            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                Alert.alert(
                    'Location Service Off',
                    'Please enable device location services for accurate map positioning.'
                );
                if (Platform.OS === 'android') {
                    try {
                        await Location.enableNetworkProviderAsync();
                    } catch (_) {
                        // Keep fallback behavior below if user rejects provider dialog.
                    }
                }
            }

            // Get current location
            let currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const coords = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };

            setLocation(coords);
            setSelectedCoordinates(coords);
            
            // Get address from coordinates
            await reverseGeocode(coords.latitude, coords.longitude);
            
            setLoading(false);
        } catch (error) {
            console.error('Error getting location:', error);

            try {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 1000 * 60 * 5,
                    requiredAccuracy: 200,
                });

                if (lastKnown?.coords?.latitude && lastKnown?.coords?.longitude) {
                    const fallbackCoords = {
                        latitude: lastKnown.coords.latitude,
                        longitude: lastKnown.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    };
                    setLocation(fallbackCoords);
                    setSelectedCoordinates(fallbackCoords);
                    await reverseGeocode(fallbackCoords.latitude, fallbackCoords.longitude);
                    setLoading(false);
                    return;
                }
            } catch (lastKnownError) {
                console.error('Error getting last known location:', lastKnownError);
            }

            Alert.alert('Error', 'Failed to get current location. Using default location.');

            // Use a default location (Philippines)
            const defaultCoords = {
                latitude: 14.5995,
                longitude: 120.9842,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setLocation(defaultCoords);
            setSelectedCoordinates(defaultCoords);
            await reverseGeocode(defaultCoords.latitude, defaultCoords.longitude);
            setLoading(false);
        }
    };

    const reverseGeocode = async (latitude, longitude) => {
        try {
            const result = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (result && result.length > 0) {
                const addr = result[0];
                const fullAddress = `${addr.street || ''} ${addr.name || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.trim();
                setAddress(fullAddress);
            }
        } catch (error) {
            console.error('Error reverse geocoding:', error);
        }
    };

    const handleMapPress = async (event) => {
        const coords = event.nativeEvent.coordinate;
        setSelectedCoordinates(coords);
        await reverseGeocode(coords.latitude, coords.longitude);
    };

    const handleConfirm = () => {
        if (selectedCoordinates && address) {
            onSelectLocation({
                coordinates: selectedCoordinates,
                address: address,
            });
            onClose();
        } else {
            Alert.alert('Error', 'Please select a location on the map.');
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Select Delivery Location</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#333" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#ff6347" />
                        <Text style={styles.loadingText}>Getting your location...</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                region={location}
                                onPress={handleMapPress}
                                showsUserLocation={true}
                                showsMyLocationButton={true}
                            >
                                {selectedCoordinates && (
                                    <Marker
                                        coordinate={selectedCoordinates}
                                        draggable
                                        onDragEnd={async (e) => {
                                            const coords = e.nativeEvent.coordinate;
                                            setSelectedCoordinates(coords);
                                            await reverseGeocode(coords.latitude, coords.longitude);
                                        }}
                                    >
                                        <View style={styles.markerContainer}>
                                            <Ionicons name="location-sharp" size={40} color="#ff6347" />
                                        </View>
                                    </Marker>
                                )}
                            </MapView>
                        </View>

                        <View style={styles.infoContainer}>
                            <View style={styles.addressBox}>
                                <Ionicons name="location-outline" size={24} color="#ff6347" />
                                <View style={styles.addressTextContainer}>
                                    <Text style={styles.addressLabel}>Selected Address:</Text>
                                    <Text style={styles.addressText}>
                                        {address || 'Tap on the map to select a location'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.instructionText}>
                                📍 Drag the marker or tap on the map to select your delivery address
                            </Text>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleConfirm}
                            >
                                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                                <Text style={styles.confirmButtonText}>Confirm Location</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.currentLocationButton}
                                onPress={getCurrentLocation}
                            >
                                <Ionicons name="navigate-circle" size={24} color="#ff6347" />
                                <Text style={styles.currentLocationText}>Use Current Location</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    mapContainer: {
        flex: 1,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    addressBox: {
        flexDirection: 'row',
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    addressTextContainer: {
        flex: 1,
        marginLeft: 10,
    },
    addressLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        marginBottom: 5,
    },
    addressText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    instructionText: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
        fontStyle: 'italic',
    },
    confirmButton: {
        backgroundColor: '#ff6347',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    currentLocationButton: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ff6347',
    },
    currentLocationText: {
        color: '#ff6347',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default AddressMapPicker;
