import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Alert, ActivityIndicator, Switch, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';

const EMPTY_FORM = {
    title: '', message: '', promoCode: '', discountType: 'percent',
    discountValue: '', maxDiscount: '', minOrderAmount: '',
    startsAt: '', expiresAt: '', isActive: true, maxClaims: '',
};

const VoucherManagement = () => {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const getAuthTokenCandidates = useCallback(async () => {
        const secureToken = await SecureStore.getItemAsync('jwt');
        const asyncToken = await AsyncStorage.getItem('jwt');
        return [secureToken, asyncToken].filter((token, idx, arr) => !!token && arr.indexOf(token) === idx);
    }, []);

    const loadVouchers = useCallback(async () => {
        setLoading(true);
        try {
            const tokenCandidates = await getAuthTokenCandidates();
            if (!tokenCandidates.length) {
                setVouchers([]);
                return;
            }

            let lastError = null;
            for (const candidate of tokenCandidates) {
                try {
                    const decoded = jwtDecode(candidate);
                    if (String(decoded?.userId || '').startsWith('quick-')) {
                        continue;
                    }
                } catch (_decodeErr) {
                    // Let backend validate malformed/expired tokens.
                }

                try {
                    const res = await axios.get(`${baseURL}vouchers`, { headers: { Authorization: `Bearer ${candidate}` } });
                    setToken(candidate);
                    setVouchers(Array.isArray(res.data) ? res.data : []);
                    return;
                } catch (err) {
                    lastError = err;
                }
            }

            const looksOfflineOnly = tokenCandidates.some((candidate) => {
                try {
                    const decoded = jwtDecode(candidate);
                    return String(decoded?.userId || '').startsWith('quick-');
                } catch (_decodeErr) {
                    return false;
                }
            });

            if (looksOfflineOnly) {
                Toast.show({
                    topOffset: 60,
                    type: 'info',
                    text1: 'Offline admin account detected.',
                    text2: 'Use online admin login to manage vouchers.',
                });
                setVouchers([]);
                return;
            }

            throw lastError || new Error('Failed to load vouchers.');
        } catch (err) {
            setVouchers([]);
            Toast.show({
                topOffset: 60,
                type: 'error',
                text1: err?.response?.data?.message || 'Failed to load vouchers.',
                text2: err?.message || 'Please re-login as admin and try again.',
            });
        } finally {
            setLoading(false);
        }
    }, [getAuthTokenCandidates]);

    useFocusEffect(useCallback(() => { loadVouchers(); }, [loadVouchers]));

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setModalVisible(true);
    };

    const openEdit = (v) => {
        setEditingId(v.id || v._id);
        setForm({
            title: v.title || '',
            message: v.message || '',
            promoCode: v.promoCode || '',
            discountType: v.discountType || 'percent',
            discountValue: String(v.discountValue ?? ''),
            maxDiscount: String(v.maxDiscount ?? ''),
            minOrderAmount: String(v.minOrderAmount ?? ''),
            startsAt: v.startsAt ? v.startsAt.slice(0, 10) : '',
            expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : '',
            isActive: v.isActive !== false,
            maxClaims: String(v.maxClaims ?? ''),
        });
        setModalVisible(true);
    };

    const saveVoucher = async () => {
        if (!form.title.trim()) return Toast.show({ topOffset: 60, type: 'error', text1: 'Title is required.' });
        if (!form.promoCode.trim()) return Toast.show({ topOffset: 60, type: 'error', text1: 'Promo code is required.' });
        if (!form.discountValue) return Toast.show({ topOffset: 60, type: 'error', text1: 'Discount value is required.' });

        setSaving(true);
        const payload = {
            title: form.title.trim(),
            message: form.message.trim(),
            promoCode: form.promoCode.toUpperCase().trim(),
            discountType: form.discountType,
            discountValue: parseFloat(form.discountValue) || 0,
            maxDiscount: parseFloat(form.maxDiscount) || 0,
            minOrderAmount: parseFloat(form.minOrderAmount) || 0,
            startsAt: form.startsAt || null,
            expiresAt: form.expiresAt || null,
            isActive: form.isActive,
            maxClaims: parseInt(form.maxClaims) || 0,
        };

        try {
            if (editingId) {
                await axios.put(`${baseURL}vouchers/${editingId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
                Toast.show({ topOffset: 60, type: 'success', text1: 'Voucher updated!' });
            } else {
                await axios.post(`${baseURL}vouchers`, payload, { headers: { Authorization: `Bearer ${token}` } });
                Toast.show({ topOffset: 60, type: 'success', text1: 'Voucher created!' });
            }
            setModalVisible(false);
            loadVouchers();
        } catch (err) {
            Toast.show({ topOffset: 60, type: 'error', text1: err.response?.data?.message || 'Failed to save voucher.' });
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (v) => {
        try {
            await axios.patch(`${baseURL}vouchers/${v.id || v._id}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
            loadVouchers();
        } catch {
            Toast.show({ topOffset: 60, type: 'error', text1: 'Failed to toggle voucher.' });
        }
    };

    const deleteVoucher = (v) => {
        Alert.alert('Delete Voucher', `Delete voucher "${v.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await axios.delete(`${baseURL}vouchers/${v.id || v._id}`, { headers: { Authorization: `Bearer ${token}` } });
                        Toast.show({ topOffset: 60, type: 'success', text1: 'Voucher deleted.' });
                        loadVouchers();
                    } catch {
                        Toast.show({ topOffset: 60, type: 'error', text1: 'Failed to delete voucher.' });
                    }
                },
            },
        ]);
    };

    const statusColor = (v) => {
        if (!v.isActive) return '#ccc';
        if (v.isExpired) return '#FF6B6B';
        return '#20C997';
    };
    const statusLabel = (v) => {
        if (!v.isActive) return 'Inactive';
        if (v.isExpired) return 'Expired';
        return 'Active';
    };

    const FormField = ({ label, value, onChangeText, placeholder, keyboardType, hint }) => (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder || ''}
                keyboardType={keyboardType || 'default'}
                placeholderTextColor="#bbb"
                autoCapitalize="none"
            />
            {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
        </View>
    );

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#FF8C42" /></View>;
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Voucher Management</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
                        <Ionicons name="add" size={20} color="white" />
                        <Text style={styles.createBtnText}>New Voucher</Text>
                    </TouchableOpacity>
                </View>

                {vouchers.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="ticket-outline" size={56} color="#ccc" />
                        <Text style={styles.emptyText}>No vouchers yet.</Text>
                        <Text style={styles.emptySubText}>Tap "New Voucher" to create one.</Text>
                    </View>
                ) : (
                    vouchers.map((v) => (
                        <View key={v.id || v._id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{v.title}</Text>
                                    <View style={styles.codeRow}>
                                        <View style={styles.codeBadge}>
                                            <Text style={styles.codeText}>{v.promoCode}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: statusColor(v) + '20' }]}>
                                            <Text style={[styles.statusText, { color: statusColor(v) }]}>{statusLabel(v)}</Text>
                                        </View>
                                    </View>
                                </View>
                                <Switch
                                    value={!!v.isActive}
                                    onValueChange={() => toggleActive(v)}
                                    trackColor={{ false: '#ddd', true: '#20C99780' }}
                                    thumbColor={v.isActive ? '#20C997' : '#aaa'}
                                />
                            </View>

                            <View style={styles.cardBody}>
                                <View style={styles.detailRow}>
                                    <Ionicons name="pricetag-outline" size={14} color="#888" />
                                    <Text style={styles.detailText}>
                                        {v.discountType === 'percent'
                                            ? `${v.discountValue}% off${v.maxDiscount > 0 ? ` (max ₱${v.maxDiscount})` : ''}`
                                            : `₱${v.discountValue} off`}
                                    </Text>
                                </View>
                                {v.minOrderAmount > 0 && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name="cart-outline" size={14} color="#888" />
                                        <Text style={styles.detailText}>Min order: ₱{v.minOrderAmount}</Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Ionicons name="people-outline" size={14} color="#888" />
                                    <Text style={styles.detailText}>
                                        {v.claimedCount} / {v.maxClaims > 0 ? v.maxClaims : '∞'} claimed
                                    </Text>
                                </View>
                                {v.expiresAt && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name="calendar-outline" size={14} color="#888" />
                                        <Text style={styles.detailText}>Expires: {v.expiresAt.slice(0, 10)}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(v)}>
                                    <Ionicons name="pencil-outline" size={16} color="#007BFF" />
                                    <Text style={styles.editBtnText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteVoucher(v)}>
                                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                    <Text style={styles.deleteBtnText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Create / Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{editingId ? 'Edit Voucher' : 'New Voucher'}</Text>
                        <TouchableOpacity onPress={saveVoucher} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#FF8C42" /> : (
                                <Text style={styles.modalSave}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
                        <FormField label="Title *" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. New Customer Welcome" />
                        <FormField label="Message" value={form.message} onChangeText={v => setForm(f => ({ ...f, message: v }))} placeholder="Short description shown to users" />
                        <FormField label="Promo Code *" value={form.promoCode} onChangeText={v => setForm(f => ({ ...f, promoCode: v.toUpperCase() }))} placeholder="e.g. SAVE20" hint="Auto-uppercased. Must be unique." />

                        {/* Discount Type */}
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Discount Type *</Text>
                            <View style={styles.typeRow}>
                                {['percent', 'fixed'].map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.typeBtn, form.discountType === t && styles.typeBtnActive]}
                                        onPress={() => setForm(f => ({ ...f, discountType: t }))}
                                    >
                                        <Text style={[styles.typeBtnText, form.discountType === t && styles.typeBtnTextActive]}>
                                            {t === 'percent' ? '% Percent' : '₱ Fixed Amount'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <FormField
                            label={`Discount Value * ${form.discountType === 'percent' ? '(%)' : '(₱)'}`}
                            value={form.discountValue}
                            onChangeText={v => setForm(f => ({ ...f, discountValue: v }))}
                            placeholder={form.discountType === 'percent' ? 'e.g. 20' : 'e.g. 100'}
                            keyboardType="numeric"
                        />
                        {form.discountType === 'percent' && (
                            <FormField label="Max Discount (₱, 0 = no limit)" value={form.maxDiscount} onChangeText={v => setForm(f => ({ ...f, maxDiscount: v }))} placeholder="e.g. 500" keyboardType="numeric" />
                        )}
                        <FormField label="Min Order Amount (₱, 0 = no minimum)" value={form.minOrderAmount} onChangeText={v => setForm(f => ({ ...f, minOrderAmount: v }))} placeholder="e.g. 300" keyboardType="numeric" />
                        <FormField label="Max Claims (0 = unlimited)" value={form.maxClaims} onChangeText={v => setForm(f => ({ ...f, maxClaims: v }))} placeholder="e.g. 100" keyboardType="numeric" />

                        <View style={styles.dateRow}>
                            <View style={{ flex: 1 }}>
                                <FormField label="Starts At (YYYY-MM-DD)" value={form.startsAt} onChangeText={v => setForm(f => ({ ...f, startsAt: v }))} placeholder="2026-01-01" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FormField label="Expires At (YYYY-MM-DD)" value={form.expiresAt} onChangeText={v => setForm(f => ({ ...f, expiresAt: v }))} placeholder="2026-12-31" />
                            </View>
                        </View>

                        {/* Active Toggle */}
                        <View style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                            <Text style={styles.fieldLabel}>Active</Text>
                            <Switch
                                value={form.isActive}
                                onValueChange={v => setForm(f => ({ ...f, isActive: v }))}
                                trackColor={{ false: '#ddd', true: '#20C99780' }}
                                thumbColor={form.isActive ? '#20C997' : '#aaa'}
                            />
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={saveVoucher} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="white" /> : (
                                <Text style={styles.saveBtnText}>{editingId ? 'Update Voucher' : 'Create Voucher'}</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FF8C42', paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 10,
    },
    createBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { fontSize: 16, color: '#999', fontWeight: '600' },
    emptySubText: { fontSize: 13, color: '#bbb' },
    card: {
        backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08, shadowRadius: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
    codeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    codeBadge: {
        backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 6, borderWidth: 1, borderColor: '#FF8C4240',
    },
    codeText: { fontSize: 12, fontWeight: '700', color: '#FF8C42', letterSpacing: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusText: { fontSize: 11, fontWeight: '700' },
    cardBody: { gap: 4, marginBottom: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 13, color: '#555' },
    cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    editBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E8F0FF',
    },
    editBtnText: { fontSize: 13, fontWeight: '600', color: '#007BFF' },
    deleteBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFECEC',
    },
    deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#FF6B6B' },

    // Modal
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
    modalSave: { fontSize: 16, fontWeight: '700', color: '#FF8C42' },
    field: { marginBottom: 12 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
    fieldHint: { fontSize: 11, color: '#aaa', marginTop: 4 },
    input: {
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12,
        fontSize: 14, backgroundColor: 'white', color: '#333',
    },
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
        borderColor: '#ddd', alignItems: 'center', backgroundColor: 'white',
    },
    typeBtnActive: { backgroundColor: '#FF8C42', borderColor: '#FF8C42' },
    typeBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
    typeBtnTextActive: { color: 'white' },
    dateRow: { flexDirection: 'row', gap: 10 },
    saveBtn: {
        backgroundColor: '#FF8C42', padding: 14, borderRadius: 12,
        alignItems: 'center', marginTop: 8, marginBottom: 20,
    },
    saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

export default VoucherManagement;
