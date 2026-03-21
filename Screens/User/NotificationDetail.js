import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';

const TYPE_CONFIG = {
  order_confirmed: { icon: 'checkmark-circle', color: '#51CF66', label: 'Order Confirmed' },
  order_processing: { icon: 'construct', color: '#339AF0', label: 'Processing' },
  order_shipped: { icon: 'airplane', color: '#FFD43B', label: 'Shipped' },
  order_delivered: { icon: 'gift', color: '#51CF66', label: 'Delivered' },
  order_canceled: { icon: 'close-circle', color: '#FF6B6B', label: 'Canceled' },
  review_approved: { icon: 'star', color: '#FFD43B', label: 'Review Approved' },
  review_rejected: { icon: 'star-half', color: '#FF6B6B', label: 'Review Rejected' },
  admin_new_order: { icon: 'cart', color: '#339AF0', label: 'New Order' },
  admin_order_delivered: { icon: 'checkmark-done-circle', color: '#51CF66', label: 'Order Delivered' },
  admin_low_stock: { icon: 'warning', color: '#FFD43B', label: 'Low Stock' },
  admin_out_of_stock: { icon: 'alert-circle', color: '#FF6B6B', label: 'Out of Stock' },
  promo_discount: { icon: 'pricetag', color: '#FF8C42', label: 'Promotion' },
};

const NotificationDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const context = useContext(AuthGlobal);
  const notificationId = route.params?.notificationId;

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(route.params?.notification || null);
  const [claiming, setClaiming] = useState(false);

  const getAuthToken = async () => {
    const secureToken = await SecureStore.getItemAsync('jwt');
    if (secureToken) return secureToken;
    return AsyncStorage.getItem('jwt');
  };

  const fetchNotificationDetail = useCallback(async () => {
    const userId = context.stateUser.user?.userId || context.stateUser.user?.sub;
    if (!userId || !notificationId) {
      setLoading(false);
      return;
    }

    try {
      const token = await getAuthToken();
      const res = await axios.get(
        `${baseURL}notifications/user/${userId}/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(res.data);
    } catch (error) {
      console.log('Fetch notification detail error:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [context.stateUser.user, notificationId]);

  useEffect(() => {
    fetchNotificationDetail();
  }, [fetchNotificationDetail]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const claimVoucher = async () => {
    if (!notification?.voucherId || claiming) return;
    const userId = context.stateUser.user?.userId || context.stateUser.user?.sub;
    if (!userId) return;

    try {
      setClaiming(true);
      const token = await getAuthToken();
      const res = await axios.post(
        `${baseURL}notifications/promotions/vouchers/${notification.voucherId}/claim`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Voucher', res?.data?.message || 'Voucher claimed successfully.');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Failed to claim voucher.';
      Alert.alert('Voucher', msg);
    } finally {
      setClaiming(false);
    }
  };

  const openOrderDetails = () => {
    const orderId = notification?.order || notification?.orderId;
    if (!orderId) return;

    navigation.navigate('Order History', {
      focusOrderId: String(orderId),
      source: 'notification-detail',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  if (!notification) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Notification not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backToListBtn}>
          <Text style={styles.backToListText}>Back to notifications</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfg = TYPE_CONFIG[notification.type] || {
    icon: 'notifications',
    color: '#888',
    label: 'Notification',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: `${cfg.color}20` }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>

        {!!notification.imageUrl && (
          <Image source={{ uri: notification.imageUrl }} style={styles.promoImage} resizeMode="cover" />
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Received</Text>
          <Text style={styles.metaValue}>{formatDateTime(notification.createdAt)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.metaValue}>{notification.read ? 'Read' : 'Unread'}</Text>
        </View>

        {!!notification.order && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Order ID</Text>
            <Text style={styles.metaValue}>#{notification.order}</Text>
          </View>
        )}

        {!!(notification.order || notification.orderId) && (
          <TouchableOpacity style={styles.viewOrderBtn} onPress={openOrderDetails}>
            <Ionicons name="receipt-outline" size={16} color="#fff" />
            <Text style={styles.viewOrderBtnText}>View Order Details</Text>
          </TouchableOpacity>
        )}

        {!!notification.product && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Product ID</Text>
            <Text style={styles.metaValue}>#{notification.product}</Text>
          </View>
        )}

        {!!notification.expiresAt && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Voucher Expires</Text>
            <Text style={styles.metaValue}>{formatDateTime(notification.expiresAt)}</Text>
          </View>
        )}

        {notification.type === 'promo_discount' && !!notification.voucherId && (
          <TouchableOpacity style={styles.claimBtn} onPress={claimVoucher} disabled={claiming}>
            <Text style={styles.claimBtnText}>{claiming ? 'Claiming...' : 'Claim Voucher'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    padding: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 14,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 22,
  },
  promoImage: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#EEE',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  metaLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
    color: '#333',
    maxWidth: '65%',
    textAlign: 'right',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#777',
    marginBottom: 10,
  },
  backToListBtn: {
    backgroundColor: '#FF8C42',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backToListText: {
    color: '#fff',
    fontWeight: '700',
  },
  claimBtn: {
    marginTop: 16,
    backgroundColor: '#FF8C42',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  viewOrderBtn: {
    marginTop: 14,
    backgroundColor: '#FF8C42',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  viewOrderBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default NotificationDetail;
