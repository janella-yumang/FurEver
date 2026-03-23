import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation, useRoute } from '@react-navigation/native';
import baseURL from '../../assets/common/baseurl';
import AuthGlobal from '../../Context/Store/AuthGlobal';

const formatDate = (value) => {
  if (!value) return 'No expiration';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No expiration';
  return parsed.toLocaleString();
};

const VoucherDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const context = useContext(AuthGlobal);

  const routeVoucher = route.params?.voucher || null;
  const voucherId = route.params?.voucherId || routeVoucher?.id || routeVoucher?._id;
  const promoCodeParam = String(route.params?.promoCode || routeVoucher?.promoCode || '').trim().toUpperCase();

  const [voucher, setVoucher] = useState(routeVoucher);
  const [loading, setLoading] = useState(!routeVoucher);
  const [claiming, setClaiming] = useState(false);

  const userId = context.stateUser?.user?.userId || context.stateUser?.user?.sub;

  const canClaim = useMemo(() => {
    return !!(voucher?.id || voucher?._id) && !!context.stateUser?.isAuthenticated;
  }, [voucher, context.stateUser?.isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    if (routeVoucher?.id && String(routeVoucher.id) === String(voucherId || routeVoucher.id)) {
      setLoading(false);
      return undefined;
    }

    if (!voucherId && !promoCodeParam) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const fetchVoucher = async () => {
      try {
        if (voucherId) {
          const res = await axios.get(`${baseURL}vouchers/public/active/${voucherId}`);
          if (!mounted) return;
          setVoucher(res.data || null);
          return;
        }

        const res = await axios.get(`${baseURL}vouchers/public/active`);
        if (!mounted) return;

        const list = Array.isArray(res.data) ? res.data : [];
        const matched = list.find(
          (entry) => String(entry?.promoCode || '').trim().toUpperCase() === promoCodeParam
        );
        setVoucher(matched || null);
      } catch (_error) {
        if (!mounted) return;
        setVoucher(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchVoucher();

    return () => {
      mounted = false;
    };
  }, [voucherId, promoCodeParam, routeVoucher]);

  const getAuthToken = async () => {
    const secureToken = await SecureStore.getItemAsync('jwt');
    if (secureToken) return secureToken;
    
    const asyncToken = await AsyncStorage.getItem('jwt');
    if (asyncToken) return asyncToken;
    
    throw new Error('No auth token found. Please log in again.');
  };

  const onClaim = async () => {
    const effectiveVoucherId = voucher?.id || voucher?._id;
    if (!effectiveVoucherId || claiming) return;

    if (!context.stateUser?.isAuthenticated || !userId) {
      Alert.alert('Login required', 'Please log in to claim this voucher.');
      return;
    }

    try {
      setClaiming(true);
      const token = await getAuthToken();

      const res = await axios.post(
        `${baseURL}notifications/promotions/vouchers/${effectiveVoucherId}/claim`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Voucher', res?.data?.message || 'Voucher claimed successfully.');
    } catch (error) {
      Alert.alert('Voucher', error?.response?.data?.message || 'Failed to claim voucher.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  if (!voucher) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Promo unavailable</Text>
        <Text style={styles.message}>This voucher is not active anymore.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voucher Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!!voucher.imageUrl && (
          <Image source={{ uri: voucher.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        )}

        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{voucher.promoCode}</Text>
        </View>

        <Text style={styles.title}>{voucher.title}</Text>
        {!!voucher.message && <Text style={styles.message}>{voucher.message}</Text>}

        <View style={styles.metaBox}>
          <Text style={styles.metaLine}>
            Discount: {voucher.discountType === 'fixed' ? `PHP ${Number(voucher.discountValue || 0).toFixed(2)} off` : `${Number(voucher.discountValue || 0)}% off`}
          </Text>
          {!!voucher.minOrderAmount && Number(voucher.minOrderAmount) > 0 && (
            <Text style={styles.metaLine}>Minimum Order: PHP {Number(voucher.minOrderAmount).toFixed(2)}</Text>
          )}
          <Text style={styles.metaLine}>Expires: {formatDate(voucher.expiresAt)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.claimBtn, !canClaim && styles.claimBtnDisabled]}
          onPress={onClaim}
          disabled={!canClaim || claiming}
        >
          <Text style={styles.claimBtnText}>
            {claiming ? 'Claiming...' : !context.stateUser?.isAuthenticated ? 'Log in to claim' : 'Claim Voucher'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
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
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF3',
    backgroundColor: '#FFFFFF',
  },
  headerBack: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#232323',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  heroImage: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#EDEFF2',
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FFD7BD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF8C42',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#555',
    lineHeight: 21,
    marginBottom: 14,
    textAlign: 'center',
  },
  metaBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    marginBottom: 18,
  },
  metaLine: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 6,
  },
  claimBtn: {
    backgroundColor: '#FF8C42',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  claimBtnDisabled: {
    backgroundColor: '#C7CDD4',
  },
  claimBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  backBtn: {
    backgroundColor: '#FF8C42',
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  backBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});

export default VoucherDetail;
