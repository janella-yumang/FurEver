import React, { useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

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

const Notifications = () => {
  const context = useContext(AuthGlobal);
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getAuthToken = async () => {
    const secureToken = await SecureStore.getItemAsync('jwt');
    if (secureToken) return secureToken;
    return await AsyncStorage.getItem('jwt');
  };

  const fetchNotifications = useCallback(async () => {
    if (!context.stateUser.isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      const userId = context.stateUser.user?.userId || context.stateUser.user?.sub;
      const token = await getAuthToken();
      const res = await axios.get(`${baseURL}notifications/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data);
    } catch (_err) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [context.stateUser, navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const timeoutId = setTimeout(() => {
        if (isActive) {
          fetchNotifications();
        }
      }, 200);

      return () => {
        isActive = false;
        clearTimeout(timeoutId);
      };
    }, [fetchNotifications])
  );

  const markAsRead = async (id) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${baseURL}notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (_err) {
    }
  };

  const markAllAsRead = async () => {
    try {
      const userId = context.stateUser.user?.userId || context.stateUser.user?.sub;
      const token = await getAuthToken();
      await axios.put(`${baseURL}notifications/user/${userId}/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_err) {
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const handlePress = (notif) => {
    if (!notif.read) markAsRead(notif._id);

    if (notif.type === 'promo_discount') {
      navigation.navigate('Home', {
        screen: 'Voucher Detail',
        params: {
          voucherId: notif.voucherId || null,
          promoCode: notif.promoCode || null,
          source: 'notification-list',
          notificationType: notif.type,
        },
      });
      return;
    }

    navigation.navigate('Notification Detail', {
      notificationId: notif._id,
      notification: notif,
    });

    // Navigate to order history if it's an order notification
    if (notif.type?.startsWith('order_')) {
      return;
    }
    // Admin notifications: navigate to admin orders or products
    if (notif.type === 'admin_new_order' || notif.type === 'admin_order_delivered') {
      return;
    }
    if (notif.type === 'admin_low_stock' || notif.type === 'admin_out_of_stock') {
      return;
    }
  };

  const renderNotification = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || { icon: 'notifications', color: '#888', label: 'Notification' };
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.unread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon} size={24} color={cfg.color} />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.read && styles.boldText]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: cfg.color + '20' }]}>
              <Text style={[styles.tagText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="notifications" size={16} color="#FF8C42" />
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll receive updates about your orders here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications();
              }}
              colors={['#FF8C42']}
            />
          }
        />
      )}
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
    flex: 1,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FF8C42' + '15',
  },
  markAllText: {
    color: '#FF8C42',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  unreadBannerText: {
    color: '#FF8C42',
    fontSize: 13,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  unread: {
    backgroundColor: '#FFF8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#FF8C42',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  boldText: {
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: '#999',
  },
  message: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF8C42',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default Notifications;
