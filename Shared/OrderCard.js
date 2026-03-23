import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import EasyButton from "./StyledComponents/EasyButton";
import Toast from "react-native-toast-message";
import { Picker } from "@react-native-picker/picker";

import axios from "axios";
import baseURL from "../assets/common/baseurl";
import { useNavigation } from '@react-navigation/native';
import { getStoredJwt } from "../assets/common/authToken";

const STATUS_CONFIG = {
  Pending: { color: '#FF8C42', icon: 'time', trafficLight: 'unavailable' },
  Processing: { color: '#339AF0', icon: 'construct', trafficLight: 'limited' },
  Shipped: { color: '#FFD43B', icon: 'airplane', trafficLight: 'limited' },
  Delivered: { color: '#51CF66', icon: 'checkmark-circle', trafficLight: 'available' },
  Canceled: { color: '#FF6B6B', icon: 'close-circle', trafficLight: 'unavailable' },
  Cancelled: { color: '#FF6B6B', icon: 'close-circle', trafficLight: 'unavailable' },
};

const statuses = [
  { name: "Pending", code: "Pending" },
  { name: "Processing", code: "Processing" },
  { name: "Shipped", code: "Shipped" },
  { name: "Delivered", code: "Delivered" },
  { name: "Canceled", code: "Canceled" },
  { name: "Cancelled", code: "Cancelled" },
];

const STATUS_CODES = new Set(statuses.map((s) => s.code));

const normalizeStatus = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Pending';
  if (STATUS_CODES.has(raw)) return raw;
  if (raw.toLowerCase() === 'cancelled') return 'Cancelled';
  if (raw.toLowerCase() === 'canceled') return 'Canceled';
  return 'Pending';
};

const OrderCard = ({ item = {}, update }) => {
  const [statusChange, setStatusChange] = useState(normalizeStatus(item?.status));
  const [token, setToken] = useState('');
  const [updating, setUpdating] = useState(false);

  const navigation = useNavigation();

  const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatOrderDate = (value) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 'N/A';
      if (trimmed.includes('T')) return trimmed.split('T')[0];
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().split('T')[0];
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toISOString().split('T')[0];
  };

  // Calculate total from orderItems if totalPrice not available
  const itemTotal = (Array.isArray(item?.orderItems) ? item.orderItems : []).reduce(
    (t, oi) => t + asNumber(oi?.price, 0) * asNumber(oi?.quantity, 1),
    0
  );
  const displayTotal = asNumber(item?.totalPrice, itemTotal);
  
  const normalizedItemStatus = normalizeStatus(item?.status);
  const cfg = STATUS_CONFIG[normalizedItemStatus] || STATUS_CONFIG.Pending;

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getStoredJwt();
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (error) {
        console.log('Load order card auth token error:', error?.message || error);
      }
    };

    loadToken();
  }, []);

  const updateOrder = async () => {
    let authToken = token;

    if (!authToken) {
      authToken = await getStoredJwt();
      if (authToken) setToken(authToken);
    }

    if (!authToken) {
      Toast.show({
        topOffset: 60,
        type: 'error',
        text1: 'Admin authentication missing',
        text2: 'Please log in again.',
      });
      return;
    }

    const config = {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    };

    setUpdating(true);
    axios
      .put(`${baseURL}orders/${item.id || item._id}`, { status: normalizeStatus(statusChange) }, config)
      .then((res) => {
        if (res.status === 200 || res.status === 201) {
          Toast.show({
            topOffset: 60,
            type: 'success',
            text1: 'Order Updated',
            text2: `Status changed to ${normalizeStatus(statusChange)}`,
          });
          setTimeout(() => {
            navigation.navigate('Orders');
          }, 500);
        }
      })
      .catch((error) => {
        const message = error?.response?.data?.message || error?.message || 'Please try again';
        Toast.show({
          topOffset: 60,
          type: 'error',
          text1: 'Update failed',
          text2: message,
        });
      })
      .finally(() => {
        setUpdating(false);
      });
  };

  const customerName = item?.user?.name || item?.userName || 'Unknown customer';
  const customerEmail = item?.user?.email || item?.userEmail || 'No email';
  const customerId = item?.user?._id || item?.userId || item?.user || 'N/A';
  const getOrderItems = () => {
    if (Array.isArray(item?.orderItems)) return item.orderItems;
    return [];
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>Order #{(item.id || item._id || '').toString().slice(-8)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: cfg.color }]}> 
          <Ionicons name={cfg.icon} size={14} color="white" />
          <Text style={styles.statusBadgeText}>{normalizedItemStatus}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.detailText}>{customerName}</Text>
        <Text style={styles.subtleText}>{customerEmail}</Text>
        <Text style={styles.subtleText}>Customer ID: {customerId}</Text>
        {item.phone ? <Text style={styles.subtleText}>Phone: {item.phone}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <Text style={styles.detailText}>
          {item.shippingAddress1 || ''} {item.shippingAddress2 || ''}
        </Text>
        {item.city ? <Text style={styles.subtleText}>City: {item.city}</Text> : null}
        {item.country ? <Text style={styles.subtleText}>Country: {item.country}</Text> : null}
      </View>

      <View style={styles.metaRow}>
        <View>
          <Text style={styles.subtleText}>Date Ordered</Text>
          <Text style={styles.detailText}>{formatOrderDate(item?.dateOrdered)}</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.subtleText}>Total</Text>
          <Text style={styles.price}>$ {displayTotal.toFixed(2)}</Text>
        </View>
      </View>

      {getOrderItems().length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered</Text>
          {getOrderItems().map((oi, idx) => {
            if (!oi || typeof oi !== 'object') return null;
            return (
              <View key={`${oi.id || idx}`} style={styles.orderItemRow}>
                <View style={styles.orderItemInfo}>
                  <Text style={styles.orderItemName} numberOfLines={1}>{oi.name || 'Unknown'}</Text>
                  <Text style={styles.orderItemQuantity}>Qty: {oi.quantity || 1}</Text>
                </View>
                <Text style={styles.orderItemPrice}>₱{(parseFloat(oi.price || 0) * (oi.quantity || 1)).toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {item.paymentMethod && (
        <Text style={styles.paymentText}>
          Payment: {item.paymentMethod === 'gcash' ? 'GCash' : item.paymentMethod === 'card' ? 'Card' : item.paymentMethod === 'cod' ? 'COD' : item.paymentMethod}
        </Text>
      )}

      {update ? (
        <View style={styles.actionsWrap}>
          <Picker
            style={styles.statusPicker}
            selectedValue={normalizeStatus(statusChange)}
            onValueChange={(value) => setStatusChange(normalizeStatus(value))}
            enabled={!updating}
          >
            {statuses.map((s) => (
              <Picker.Item key={s.code} label={s.name} value={s.code} />
            ))}
          </Picker>
          <EasyButton
            secondary
            large
            onPress={updateOrder}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.updateBtnText}>Update Status</Text>
            )}
          </EasyButton>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  statusBadgeText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  subtleText: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 20,
  },
  paymentText: {
    marginTop: 10,
    color: '#111827',
    fontWeight: '600',
  },
  actionsWrap: {
    marginTop: 12,
  },
  statusPicker: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 10,
  },
  updateBtnText: {
    color: 'white',
    fontWeight: '700',
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  orderItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  orderItemQuantity: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  orderItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF8C42',
  },
});

export default OrderCard;