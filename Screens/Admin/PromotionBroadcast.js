import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import baseURL from '../../assets/common/baseurl';
import { jwtDecode } from 'jwt-decode';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const PromotionBroadcast = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [expiresAtDate, setExpiresAtDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxClaims, setMaxClaims] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const clearForm = () => {
    setTitle('');
    setMessage('');
    setDiscountPercent('');
    setPromoCode('');
    setExpiresAtDate(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setMaxClaims('');
    setMinOrderAmount('');
    setMaxDiscount('');
    setImageUrl('');
    setProductId('');
    setDeepLink('');
  };

  const onDatePicked = (_event, selectedDate) => {
    setShowDatePicker(false);
    if (!selectedDate) return;

    const base = expiresAtDate ? new Date(expiresAtDate) : new Date();
    base.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    setExpiresAtDate(base);
  };

  const onTimePicked = (_event, selectedTime) => {
    setShowTimePicker(false);
    if (!selectedTime) return;

    const base = expiresAtDate ? new Date(expiresAtDate) : new Date();
    base.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    setExpiresAtDate(base);
  };

  const pickPromoImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          setImageUrl(`data:${mimeType};base64,${asset.base64}`);
        } else {
          setImageUrl(asset.uri || '');
        }
      }
    } catch (error) {
      Alert.alert('Image', 'Failed to pick image.');
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }

    const parsedDiscount = discountPercent.trim() ? Number(discountPercent) : null;
    const parsedProductId = productId.trim() ? Number(productId) : null;

    if (parsedDiscount !== null && (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100)) {
      Alert.alert('Invalid discount', 'Discount must be a number between 0 and 100.');
      return;
    }

    if (!promoCode.trim()) {
      Alert.alert('Missing code', 'Promo code is required.');
      return;
    }

    if (parsedProductId !== null && (Number.isNaN(parsedProductId) || parsedProductId <= 0)) {
      Alert.alert('Invalid product ID', 'Product ID must be a positive number.');
      return;
    }

    try {
      setSending(true);
      const token = await AsyncStorage.getItem('jwt');
      if (!token) {
        Alert.alert('Not authenticated', 'Please log in again as admin.');
        return;
      }

      try {
        const decoded = jwtDecode(token);
        if (String(decoded?.userId || '').startsWith('quick-')) {
          Alert.alert(
            'Offline account detected',
            'Quick Login uses an offline token and cannot call protected backend APIs. Please sign in with a real admin account first.'
          );
          return;
        }
      } catch (_error) {
        // Let backend validate malformed/expired tokens and return the detailed error.
      }

      const payload = {
        title: title.trim(),
        message: message.trim(),
      };

      if (parsedDiscount !== null) payload.discountPercent = parsedDiscount;
      if (promoCode.trim()) payload.promoCode = promoCode.trim();
      if (expiresAtDate) payload.expiresAt = expiresAtDate.toISOString();
      if (maxClaims.trim()) payload.maxClaims = Number(maxClaims);
      if (minOrderAmount.trim()) payload.minOrderAmount = Number(minOrderAmount);
      if (maxDiscount.trim()) payload.maxDiscount = Number(maxDiscount);
      if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      if (parsedProductId !== null) payload.productId = parsedProductId;
      if (deepLink.trim()) payload.deepLink = deepLink.trim();

      const response = await axios.post(
        `${baseURL}notifications/promotions/broadcast`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLastResult(response.data);
      Toast.show({
        topOffset: 60,
        type: 'success',
        text1: 'Promotion broadcast sent',
        text2: response.data?.message || 'Success',
      });
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      Alert.alert('Broadcast failed', serverMessage || 'Could not send promotion.');
      Toast.show({
        topOffset: 60,
        type: 'error',
        text1: 'Broadcast failed',
        text2: serverMessage || 'Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Promotion Broadcast</Text>
      <Text style={styles.subheading}>
        Send one promo notification to all active non-admin users.
      </Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        placeholder="Weekend Pet Sale"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Message *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Get 20% off selected items today only."
        value={message}
        onChangeText={setMessage}
        multiline
      />

      <Text style={styles.label}>Discount Percent (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="20"
        keyboardType="numeric"
        value={discountPercent}
        onChangeText={setDiscountPercent}
      />

      <Text style={styles.label}>Promo Code *</Text>
      <TextInput
        style={styles.input}
        placeholder="WEEKEND20"
        value={promoCode}
        onChangeText={setPromoCode}
      />

      <Text style={styles.label}>Expires At (optional)</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.pickerBtnText}>Pick Date</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.pickerBtnText}>Pick Time</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.expiryPreview}>
        {expiresAtDate ? `Selected expiry: ${expiresAtDate.toLocaleString()}` : 'No expiry selected'}
      </Text>
      {!!expiresAtDate && (
        <TouchableOpacity style={styles.clearExpiryBtn} onPress={() => setExpiresAtDate(null)}>
          <Text style={styles.clearExpiryBtnText}>Clear Expiry</Text>
        </TouchableOpacity>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={expiresAtDate || new Date()}
          mode="date"
          display="default"
          onChange={onDatePicked}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={expiresAtDate || new Date()}
          mode="time"
          display="default"
          onChange={onTimePicked}
        />
      )}

      <Text style={styles.label}>Max Claims (optional, 0 = unlimited)</Text>
      <TextInput
        style={styles.input}
        placeholder="100"
        keyboardType="numeric"
        value={maxClaims}
        onChangeText={setMaxClaims}
      />

      <Text style={styles.label}>Min Order Amount (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="500"
        keyboardType="numeric"
        value={minOrderAmount}
        onChangeText={setMinOrderAmount}
      />

      <Text style={styles.label}>Max Discount Amount (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="200"
        keyboardType="numeric"
        value={maxDiscount}
        onChangeText={setMaxDiscount}
      />

      <Text style={styles.label}>Promotion Image (optional)</Text>
      <TouchableOpacity style={styles.uploadBtn} onPress={pickPromoImage}>
        <Text style={styles.uploadBtnText}>Pick Image</Text>
      </TouchableOpacity>
      {!!imageUrl && <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />}

      <Text style={styles.label}>Product ID (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="12"
        keyboardType="numeric"
        value={productId}
        onChangeText={setProductId}
      />

      <Text style={styles.label}>Deep Link (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="furever://product/12"
        value={deepLink}
        onChangeText={setDeepLink}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.clearBtn} onPress={clearForm} disabled={sending}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send Broadcast</Text>}
        </TouchableOpacity>
      </View>

      {lastResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Last Result</Text>
          <Text style={styles.resultLine}>Created notifications: {lastResult.created ?? 0}</Text>
          <Text style={styles.resultLine}>Push sent: {lastResult.push?.sent ?? 0}</Text>
          <Text style={styles.resultLine}>Push failed: {lastResult.push?.failed ?? 0}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: '#666',
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 15,
    color: '#222',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerBtnText: {
    color: '#333',
    fontWeight: '700',
  },
  expiryPreview: {
    color: '#555',
    fontSize: 13,
    marginBottom: 8,
  },
  clearExpiryBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  clearExpiryBtnText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  clearBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearText: {
    color: '#333',
    fontWeight: '600',
  },
  sendBtn: {
    flex: 2,
    backgroundColor: '#FF8C42',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
  },
  resultCard: {
    marginTop: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  resultLine: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  uploadBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadBtnText: {
    color: '#333',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#EEE',
  },
});

export default PromotionBroadcast;