import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const VerifyEmail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || '';
  const initialEmailDebug = route.params?.emailDebug || null;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [emailDebug, setEmailDebug] = useState(initialEmailDebug);
  const inputs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleCodeChange = (text, index) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handlePaste = (text) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
    if (digits.length === 6) {
      setCode(digits);
      inputs.current[5]?.focus();
    }
  };

  const verify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter the 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${baseURL}users/verify-email`, {
        email,
        code: fullCode,
      });
      Toast.show({
        topOffset: 60,
        type: 'success',
        text1: 'Email Verified! ✅',
        text2: 'You can now log in to your account',
      });
      setTimeout(() => navigation.navigate('Login'), 500);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Verification failed';
      Toast.show({ topOffset: 60, type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (countdown > 0) return;
    setResendLoading(true);
    try {
      const res = await axios.post(`${baseURL}users/resend-code`, { email });
      setEmailDebug(res?.data?.emailDebug || null);
      Toast.show({
        topOffset: 60,
        type: 'success',
        text1: 'New code sent! 📧',
        text2: 'Check your email inbox',
      });
      setCountdown(60);
      setCode(['', '', '', '', '', '']);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to resend code';
      Toast.show({ topOffset: 60, type: 'error', text1: msg });
    } finally {
      setResendLoading(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : '';

  const openPreview = async () => {
    if (!emailDebug?.previewUrl) return;
    try {
      await Linking.openURL(emailDebug.previewUrl);
    } catch (err) {
      Toast.show({ topOffset: 60, type: 'error', text1: 'Could not open preview URL' });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open" size={48} color="#FF8C42" />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.emailText}>{maskedEmail}</Text>
        </Text>

        {!!emailDebug && (
          <View style={styles.devCard}>
            <Text style={styles.devTitle}>Development helper</Text>
            {!!emailDebug?.fallbackCode && (
              <Text style={styles.devText}>Fallback code: {emailDebug.fallbackCode}</Text>
            )}
            {!!emailDebug?.previewUrl && (
              <TouchableOpacity onPress={openPreview}>
                <Text style={styles.previewLink}>Open email preview</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* OTP Input */}
        <View style={styles.codeRow}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputs.current[index] = ref)}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              value={digit}
              onChangeText={(text) => {
                if (text.length > 1) {
                  handlePaste(text);
                } else {
                  handleCodeChange(text, index);
                }
              }}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              caretHidden
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
          onPress={verify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the code? </Text>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={resendCode} disabled={resendLoading}>
              {resendLoading ? (
                <ActivityIndicator size="small" color="#FF8C42" />
              ) : (
                <Text style={styles.resendLink}>Resend Code</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Ionicons name="arrow-back" size={16} color="#888" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  devCard: {
    width: '100%',
    backgroundColor: '#FFF6EE',
    borderWidth: 1,
    borderColor: '#FFD7B8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  devTitle: {
    color: '#9A5A2A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  devText: {
    color: '#7A4A25',
    fontSize: 14,
    marginBottom: 6,
  },
  previewLink: {
    color: '#FF8C42',
    fontWeight: '700',
    fontSize: 14,
  },
  emailText: {
    color: '#FF8C42',
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  codeInputFilled: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFF8F0',
  },
  verifyBtn: {
    width: width * 0.7,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  resendLabel: {
    fontSize: 13,
    color: '#888',
  },
  resendTimer: {
    fontSize: 13,
    color: '#bbb',
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    color: '#FF8C42',
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 13,
    color: '#888',
  },
});

export default VerifyEmail;
