import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Dimensions, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { Surface, RadioButton, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const methods = [
    { name: 'GCash', value: 'gcash', icon: 'phone-portrait', color: '#007BFF', description: 'Pay via GCash e-wallet' },
    { name: 'Credit / Debit Card', value: 'card', icon: 'card', color: '#FF8C42', description: 'Visa, MasterCard, JCB' },
    { name: 'Cash on Delivery', value: 'cod', icon: 'cash', color: '#20C997', description: 'Pay when you receive' },
]

const Payment = ({ route }) => {
    const order = route.params?.order || route.params;
    const [selected, setSelected] = useState('');
    const navigation = useNavigation();

    // GCash fields
    const [gcashNumber, setGcashNumber] = useState('');
    const [gcashName, setGcashName] = useState('');

    // Card fields
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');

    const validateAndProceed = () => {
        if (!selected) {
            Toast.show({ topOffset: 60, type: 'error', text1: 'Please select a payment method' });
            return;
        }

        if (selected === 'gcash') {
            if (!gcashNumber || gcashNumber.length < 11) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter a valid GCash number' });
                return;
            }
            if (!gcashName) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter the GCash account name' });
                return;
            }
        }

        if (selected === 'card') {
            if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter a valid card number' });
                return;
            }
            if (!cardName) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter the cardholder name' });
                return;
            }
            if (!cardExpiry || cardExpiry.length < 5) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter the expiry date (MM/YY)' });
                return;
            }
            if (!cardCvv || cardCvv.length < 3) {
                Toast.show({ topOffset: 60, type: 'error', text1: 'Please enter the CVV' });
                return;
            }
        }

        const paymentInfo = {
            method: selected,
            ...(selected === 'gcash' && { gcashNumber, gcashName }),
            ...(selected === 'card' && { cardNumber: cardNumber.slice(-4), cardName }),
        };

        navigation.navigate("Confirm", { order: { ...order, paymentMethod: selected, payment: paymentInfo } });
    };

    const formatCardNumber = (text) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 16);
        const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
        setCardNumber(formatted);
    };

    const formatExpiry = (text) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 4);
        if (cleaned.length >= 3) {
            setCardExpiry(cleaned.slice(0, 2) + '/' + cleaned.slice(2));
        } else {
            setCardExpiry(cleaned);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Payment Method</Text>
                <Text style={styles.subtitle}>Choose how you'd like to pay</Text>

                {/* Payment Method Cards */}
                {methods.map((item) => (
                    <TouchableOpacity
                        key={item.value}
                        style={[
                            styles.methodCard,
                            selected === item.value && { borderColor: item.color, borderWidth: 2 }
                        ]}
                        onPress={() => setSelected(item.value)}
                    >
                        <View style={[styles.methodIcon, { backgroundColor: item.color + '15' }]}>
                            <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <View style={styles.methodInfo}>
                            <Text style={styles.methodName}>{item.name}</Text>
                            <Text style={styles.methodDesc}>{item.description}</Text>
                        </View>
                        <View style={[
                            styles.radio,
                            selected === item.value && { borderColor: item.color }
                        ]}>
                            {selected === item.value && (
                                <View style={[styles.radioInner, { backgroundColor: item.color }]} />
                            )}
                        </View>
                    </TouchableOpacity>
                ))}

                {/* GCash Form */}
                {selected === 'gcash' && (
                    <View style={styles.formSection}>
                        <Text style={styles.formTitle}>GCash Details</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="call" size={18} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="GCash Number (09XXXXXXXXX)"
                                value={gcashNumber}
                                onChangeText={setGcashNumber}
                                keyboardType="phone-pad"
                                maxLength={11}
                            />
                        </View>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person" size={18} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Account Name"
                                value={gcashName}
                                onChangeText={setGcashName}
                            />
                        </View>
                        <View style={styles.securityNote}>
                            <Ionicons name="shield-checkmark" size={16} color="#20C997" />
                            <Text style={styles.securityText}>Your GCash info is encrypted and secure</Text>
                        </View>
                    </View>
                )}

                {/* Card Form */}
                {selected === 'card' && (
                    <View style={styles.formSection}>
                        <Text style={styles.formTitle}>Card Details</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="card" size={18} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Card Number"
                                value={cardNumber}
                                onChangeText={formatCardNumber}
                                keyboardType="number-pad"
                                maxLength={19}
                            />
                        </View>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person" size={18} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Cardholder Name"
                                value={cardName}
                                onChangeText={setCardName}
                            />
                        </View>
                        <View style={styles.cardRow}>
                            <View style={[styles.inputWrapper, { flex: 1 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="MM/YY"
                                    value={cardExpiry}
                                    onChangeText={formatExpiry}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                />
                            </View>
                            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 12 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="CVV"
                                    value={cardCvv}
                                    onChangeText={(t) => setCardCvv(t.replace(/\D/g, '').slice(0, 4))}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                />
                            </View>
                        </View>
                        <View style={styles.securityNote}>
                            <Ionicons name="lock-closed" size={16} color="#20C997" />
                            <Text style={styles.securityText}>Your card details are protected with SSL encryption</Text>
                        </View>
                    </View>
                )}

                {/* COD Info */}
                {selected === 'cod' && (
                    <View style={styles.formSection}>
                        <View style={styles.codInfo}>
                            <Ionicons name="information-circle" size={20} color="#FF8C42" />
                            <Text style={styles.codText}>
                                Pay with cash when your order arrives. Please prepare the exact amount for a smooth transaction.
                            </Text>
                        </View>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Confirm Button */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        !selected && styles.confirmButtonDisabled
                    ]}
                    onPress={validateAndProceed}
                    disabled={!selected}
                >
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.confirmButtonText}>Continue to Review</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginTop: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    methodIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodInfo: {
        flex: 1,
        marginLeft: 14,
    },
    methodName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    methodDesc: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    formSection: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 14,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        marginBottom: 12,
        backgroundColor: '#fafafa',
    },
    inputIcon: {
        paddingLeft: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#333',
    },
    cardRow: {
        flexDirection: 'row',
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        padding: 10,
        backgroundColor: '#E8FFF5',
        borderRadius: 8,
    },
    securityText: {
        fontSize: 12,
        color: '#20C997',
        flex: 1,
    },
    codInfo: {
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        backgroundColor: '#FFF8F0',
        borderRadius: 8,
    },
    codText: {
        fontSize: 14,
        color: '#666',
        flex: 1,
        lineHeight: 20,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    confirmButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FF8C42',
        paddingVertical: 14,
        borderRadius: 10,
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default Payment;