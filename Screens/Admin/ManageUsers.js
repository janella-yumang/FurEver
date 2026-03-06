import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    TextInput,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import baseURL from "../../assets/common/baseurl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");

const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all"); // all, active, inactive, admin
    const [token, setToken] = useState("");
    const [toggling, setToggling] = useState(null); // userId being toggled
    const [changingRole, setChangingRole] = useState(null); // userId whose role is being changed

    useFocusEffect(
        useCallback(() => {
            AsyncStorage.getItem("jwt")
                .then((t) => setToken(t))
                .catch(() => {});

            fetchUsers();

            return () => {
                setUsers([]);
                setFilteredUsers([]);
                setLoading(true);
            };
        }, [])
    );

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${baseURL}users`);
            const data = res.data || [];
            setUsers(data);
            applyFilters(data, search, filter);
        } catch (err) {
            console.error("Fetch users error:", err);
            Alert.alert("Error", "Failed to load users.");
        }
        setLoading(false);
    };

    const applyFilters = (data, searchText, filterType) => {
        let result = [...data];

        // Search filter
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter(
                (u) =>
                    (u.name || "").toLowerCase().includes(q) ||
                    (u.email || "").toLowerCase().includes(q) ||
                    (u.phone || "").includes(q)
            );
        }

        // Status filter
        switch (filterType) {
            case "active":
                result = result.filter((u) => u.isActive !== false);
                break;
            case "inactive":
                result = result.filter((u) => u.isActive === false);
                break;
            case "admin":
                result = result.filter((u) => u.isAdmin === true);
                break;
        }

        setFilteredUsers(result);
    };

    const handleSearch = (text) => {
        setSearch(text);
        applyFilters(users, text, filter);
    };

    const handleFilter = (f) => {
        setFilter(f);
        applyFilters(users, search, f);
    };

    const toggleUserActive = (user) => {
        const newStatus = user.isActive === false ? "activate" : "deactivate";
        Alert.alert(
            `${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} User`,
            `Are you sure you want to ${newStatus} ${user.name}?\n\n${
                newStatus === "deactivate"
                    ? "This user will not be able to log in."
                    : "This user will be able to log in again."
            }`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: newStatus === "deactivate" ? "Deactivate" : "Activate",
                    style: newStatus === "deactivate" ? "destructive" : "default",
                    onPress: async () => {
                        setToggling(user._id);
                        try {
                            const t = await AsyncStorage.getItem("jwt");
                            const res = await axios.put(
                                `${baseURL}users/${user._id}/toggle-active`,
                                {},
                                { headers: { Authorization: `Bearer ${t}` } }
                            );
                            Toast.show({
                                topOffset: 60,
                                type: "success",
                                text1: res.data.message,
                            });

                            // Update local state
                            const updated = users.map((u) =>
                                u._id === user._id
                                    ? { ...u, isActive: !u.isActive }
                                    : u
                            );
                            setUsers(updated);
                            applyFilters(updated, search, filter);
                        } catch (err) {
                            Toast.show({
                                topOffset: 60,
                                type: "error",
                                text1: "Failed to update user status",
                                text2: err?.response?.data?.message || err.message,
                            });
                        }
                        setToggling(null);
                    },
                },
            ]
        );
    };

    const changeUserRole = (user) => {
        const currentRole = user.isAdmin ? "Admin" : "Customer";
        const newRole = user.isAdmin ? "customer" : "admin";
        const newRoleLabel = user.isAdmin ? "Customer" : "Admin";

        Alert.alert(
            "Change User Role",
            `Change ${user.name}'s role from ${currentRole} to ${newRoleLabel}?\n\n${
                newRole === "admin"
                    ? "This user will gain admin privileges and access the admin dashboard."
                    : "This user will lose admin privileges and become a regular customer."
            }`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: `Make ${newRoleLabel}`,
                    style: newRole === "admin" ? "default" : "destructive",
                    onPress: async () => {
                        setChangingRole(user._id);
                        try {
                            const t = await AsyncStorage.getItem("jwt");
                            const res = await axios.put(
                                `${baseURL}users/${user._id}/change-role`,
                                { role: newRole },
                                { headers: { Authorization: `Bearer ${t}` } }
                            );
                            Toast.show({
                                topOffset: 60,
                                type: "success",
                                text1: res.data.message,
                            });

                            const updated = users.map((u) =>
                                u._id === user._id
                                    ? { ...u, isAdmin: newRole === "admin", role: newRole }
                                    : u
                            );
                            setUsers(updated);
                            applyFilters(updated, search, filter);
                        } catch (err) {
                            Toast.show({
                                topOffset: 60,
                                type: "error",
                                text1: "Failed to change role",
                                text2: err?.response?.data?.message || err.message,
                            });
                        }
                        setChangingRole(null);
                    },
                },
            ]
        );
    };

    const getStats = () => {
        const total = users.length;
        const active = users.filter((u) => u.isActive !== false).length;
        const inactive = users.filter((u) => u.isActive === false).length;
        const admins = users.filter((u) => u.isAdmin === true).length;
        return { total, active, inactive, admins };
    };

    const stats = getStats();

    const renderUser = ({ item }) => {
        const isActive = item.isActive !== false;
        const isAdmin = item.isAdmin === true;
        const initials = (item.name || "U")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);

        return (
            <View style={styles.userCard}>
                <View style={styles.userRow}>
                    {/* Avatar */}
                    {item.image ? (
                        <Image
                            source={{ uri: item.image }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View
                            style={[
                                styles.avatarPlaceholder,
                                { backgroundColor: isActive ? "#FF8C4220" : "#FF6B6B20" },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.avatarText,
                                    { color: isActive ? "#FF8C42" : "#FF6B6B" },
                                ]}
                            >
                                {initials}
                            </Text>
                        </View>
                    )}

                    {/* Info */}
                    <View style={styles.userInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.userName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {isAdmin && (
                                <View style={styles.adminBadge}>
                                    <Text style={styles.adminBadgeText}>Admin</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.userEmail} numberOfLines={1}>
                            {item.email}
                        </Text>
                        <View style={styles.metaRow}>
                            {item.phone ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Ionicons name="call-outline" size={11} color="#aaa" />
                                    <Text style={styles.metaText}>{item.phone}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.metaText}>
                                Joined{" "}
                                {new Date(item.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </Text>
                        </View>

                        {/* Status + Verification badges */}
                        <View style={styles.badgeRow}>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor: isActive ? "#20C99720" : "#FF6B6B20",
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.statusDot,
                                        { backgroundColor: isActive ? "#20C997" : "#FF6B6B" },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.statusText,
                                        { color: isActive ? "#20C997" : "#FF6B6B" },
                                    ]}
                                >
                                    {isActive ? "Active" : "Deactivated"}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor: item.emailVerified
                                            ? "#007BFF20"
                                            : "#E8A31720",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name={item.emailVerified ? "checkmark-circle" : "time"}
                                    size={12}
                                    color={item.emailVerified ? "#007BFF" : "#E8A317"}
                                />
                                <Text
                                    style={[
                                        styles.statusText,
                                        {
                                            color: item.emailVerified ? "#007BFF" : "#E8A317",
                                        },
                                    ]}
                                >
                                    {item.emailVerified ? "Verified" : "Unverified"}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionBtns}>
                        {/* Change Role Button */}
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                {
                                    backgroundColor: item.isAdmin ? "#E8A317" : "#007BFF",
                                },
                            ]}
                            onPress={() => changeUserRole(item)}
                            disabled={changingRole === item._id}
                        >
                            {changingRole === item._id ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons
                                        name={item.isAdmin ? "person" : "shield-checkmark"}
                                        size={16}
                                        color="white"
                                    />
                                    <Text style={styles.toggleBtnText}>
                                        {item.isAdmin ? "To Customer" : "To Admin"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Toggle Active Button */}
                        <TouchableOpacity
                            style={[
                                styles.toggleBtn,
                                {
                                    backgroundColor: isActive ? "#FF6B6B" : "#20C997",
                                },
                            ]}
                            onPress={() => toggleUserActive(item)}
                            disabled={toggling === item._id}
                        >
                            {toggling === item._id ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons
                                        name={isActive ? "close-circle" : "checkmark-circle"}
                                        size={16}
                                        color="white"
                                    />
                                    <Text style={styles.toggleBtnText}>
                                        {isActive ? "Deactivate" : "Activate"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C42" />
            </View>
        );
    }

    const filters = [
        { key: "all", label: "All", count: stats.total },
        { key: "active", label: "Active", count: stats.active },
        { key: "inactive", label: "Inactive", count: stats.inactive },
        { key: "admin", label: "Admins", count: stats.admins },
    ];

    return (
        <View style={styles.container}>
            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: "#FF8C42" }]}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#20C997" }]}>
                    <Text style={styles.statValue}>{stats.active}</Text>
                    <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#FF6B6B" }]}>
                    <Text style={styles.statValue}>{stats.inactive}</Text>
                    <Text style={styles.statLabel}>Inactive</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#007BFF" }]}>
                    <Text style={styles.statValue}>{stats.admins}</Text>
                    <Text style={styles.statLabel}>Admins</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#aaa" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, email, or phone..."
                    value={search}
                    onChangeText={handleSearch}
                    placeholderTextColor="#aaa"
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#ccc" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
                {filters.map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.filterBtn,
                            filter === f.key && styles.filterBtnActive,
                        ]}
                        onPress={() => handleFilter(f.key)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                filter === f.key && styles.filterTextActive,
                            ]}
                        >
                            {f.label} ({f.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* User List */}
            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item._id}
                renderItem={renderUser}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={48} color="#ddd" />
                        <Text style={styles.emptyText}>No users found</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    // Stats
    statsRow: {
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingTop: 12,
        gap: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: "white",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        borderLeftWidth: 3,
        alignItems: "center",
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
    },
    statLabel: {
        fontSize: 11,
        color: "#888",
        marginTop: 2,
    },

    // Search
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        marginHorizontal: 12,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 8,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#333",
    },

    // Filters
    filterRow: {
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 7,
        alignItems: "center",
        borderRadius: 8,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#eee",
    },
    filterBtnActive: {
        backgroundColor: "#FF8C42",
        borderColor: "#FF8C42",
    },
    filterText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#888",
    },
    filterTextActive: {
        color: "white",
    },

    // User Card
    userCard: {
        backgroundColor: "white",
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
        padding: 12,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    userRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 10,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: "700",
    },
    userInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    userName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#333",
        maxWidth: 150,
    },
    adminBadge: {
        backgroundColor: "#FF8C4220",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    adminBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#FF8C42",
    },
    userEmail: {
        fontSize: 12,
        color: "#888",
        marginTop: 1,
    },
    metaRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 3,
    },
    metaText: {
        fontSize: 11,
        color: "#aaa",
    },
    badgeRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 6,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: "600",
    },

    // Toggle button
    actionBtns: {
        flexDirection: "column",
        gap: 6,
        marginLeft: 8,
    },
    toggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 70,
    },
    toggleBtnText: {
        color: "white",
        fontSize: 10,
        fontWeight: "600",
        marginTop: 2,
    },

    // Empty
    emptyState: {
        alignItems: "center",
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 15,
        color: "#aaa",
        marginTop: 8,
    },
});

export default ManageUsers;
