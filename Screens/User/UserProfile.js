import React, { useContext, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from "axios"
import baseURL from "../../assets/common/baseurl"
import AuthGlobal from "../../Context/Store/AuthGlobal"
import { logoutUser } from "../../Context/Actions/Auth.actions"
import { Ionicons } from '@expo/vector-icons';

const ROLE_LABELS = {
    admin: { label: 'Admin', color: '#FF6B6B' },
    seller: { label: 'Seller', color: '#20C997' },
    customer: { label: 'Customer', color: '#FF8C42' },
};

const UserProfile = (props) => {
    const context = useContext(AuthGlobal)
    const [userProfile, setUserProfile] = useState('')
    const navigation = useNavigation()

    useFocusEffect(
        useCallback(() => {
            if (
                context.stateUser.isAuthenticated === false ||
                context.stateUser.isAuthenticated === null
            ) {
                navigation.navigate("Login")
            }
            AsyncStorage.getItem("jwt")
                .then((res) => {
                    axios
                        .get(`${baseURL}users/${context.stateUser.user.userId}`, {
                            headers: { Authorization: `Bearer ${res}` },
                        })
                        .then((user) => setUserProfile(user.data))
                })
                .catch((error) => console.log(error))
            return () => {
                setUserProfile();
            }
        }, [context.stateUser.isAuthenticated]))

    const role = userProfile?.role || (userProfile?.isAdmin ? 'admin' : 'customer');
    const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.customer;

    const menuItems = [
        { icon: 'person-outline', label: 'Edit Profile', screen: 'Edit Profile', color: '#FF8C42' },
        { icon: 'receipt-outline', label: 'Order History', screen: 'Order History', color: '#20C997' },
        { icon: 'heart-outline', label: 'My Wishlist', screen: 'Wishlist', tab: 'Wishlist' },
        { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications', color: '#339AF0' },
        { icon: 'scan-outline', label: 'Barcode Scanner', screen: 'Scanner', color: '#9775FA' },
        { icon: 'location-outline', label: 'Saved Addresses', screen: 'Edit Profile', color: '#5B8DEF' },
        { icon: 'paw-outline', label: 'Preferred Pets', screen: 'Edit Profile', color: '#FF6B6B' },
    ];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <Image
                        source={{
                            uri: userProfile?.image ||
                                'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'
                        }}
                        style={styles.profileImage}
                    />
                    <Text style={styles.name}>
                        {userProfile ? userProfile.name : ""}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '20' }]}>
                        <Text style={[styles.roleText, { color: roleInfo.color }]}>
                            {roleInfo.label}
                        </Text>
                    </View>
                </View>

                {/* Contact Info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={18} color="#888" />
                        <Text style={styles.infoText}>
                            {userProfile ? userProfile.email : ""}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="call-outline" size={18} color="#888" />
                        <Text style={styles.infoText}>
                            {userProfile ? userProfile.phone : "N/A"}
                        </Text>
                    </View>
                    {userProfile?.shippingAddress && (
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={18} color="#888" />
                            <Text style={styles.infoText}>
                                {userProfile.shippingAddress}
                                {userProfile.city ? `, ${userProfile.city}` : ''}
                            </Text>
                        </View>
                    )}
                    {userProfile?.preferredPets && userProfile.preferredPets.length > 0 && (
                        <View style={styles.infoRow}>
                            <Ionicons name="paw-outline" size={18} color="#888" />
                            <Text style={styles.infoText}>
                                {Array.isArray(userProfile.preferredPets)
                                    ? userProfile.preferredPets.join(', ')
                                    : JSON.parse(userProfile.preferredPets).join(', ')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Menu Items */}
                <View style={styles.menuCard}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
                            onPress={() => {
                                if (item.tab) {
                                    navigation.navigate(item.tab);
                                } else {
                                    navigation.navigate(item.screen);
                                }
                            }}
                        >
                            <View style={styles.menuLeft}>
                                <Ionicons name={item.icon} size={22} color={item.color || '#FF8C42'} />
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Sign Out */}
                <TouchableOpacity
                    style={styles.signOutButton}
                    onPress={() => [
                        AsyncStorage.removeItem("jwt"),
                        logoutUser(context.dispatch)
                    ]}
                >
                    <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        paddingBottom: 30,
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#FF8C42',
        marginBottom: 12,
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
    },
    roleBadge: {
        marginTop: 8,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 12,
    },
    roleText: {
        fontSize: 13,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: 'white',
        margin: 16,
        borderRadius: 12,
        padding: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoText: {
        fontSize: 15,
        color: '#555',
        flex: 1,
    },
    menuCard: {
        backgroundColor: 'white',
        marginHorizontal: 16,
        borderRadius: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    menuLabel: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        marginHorizontal: 16,
        padding: 14,
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FF6B6B',
    },
    signOutText: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: '600',
    },
})

export default UserProfile