import React from "react"
import { createStackNavigator } from "@react-navigation/stack"

import AdminDashboard from "../Screens/Admin/AdminDashboard"
import Orders from "../Screens/Admin/Orders"
import Products from "../Screens/Admin/Products"
import ProductForm from "../Screens/Admin/ProductForm"
import Categories from "../Screens/Admin/Categories"
import Reviews from "../Screens/Admin/Reviews"
import ReportsAnalytics from "../Screens/Admin/ReportsAnalytics"
import ManageUsers from "../Screens/Admin/ManageUsers"
import PromotionBroadcast from "../Screens/Admin/PromotionBroadcast"
import VoucherManagement from "../Screens/Admin/VoucherManagement"

const Stack = createStackNavigator();

const AdminNavigator = () => {

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#FF8C42' },
                headerTintColor: 'white',
                headerTitleStyle: { fontWeight: '700' },
            }}
        >
            <Stack.Screen
                name="Dashboard"
                component={AdminDashboard}
                options={{
                    headerShown: false
                }}
            />
            <Stack.Screen
                name="Products"
                component={Products}
                options={{
                    title: "Manage Products"
                }}
            />
            <Stack.Screen 
                name="Categories" 
                component={Categories}
                options={{
                    title: "Categories"
                }}
            />
            <Stack.Screen 
                name="Orders" 
                component={Orders}
                options={{
                    title: "Orders"
                }}
            />
            <Stack.Screen 
                name="ProductForm" 
                component={ProductForm}
                options={{
                    title: "Add / Edit Product"
                }}
            />
            <Stack.Screen 
                name="Reviews" 
                component={Reviews}
                options={{
                    title: "Manage Reviews"
                }}
            />
            <Stack.Screen 
                name="ReportsAnalytics" 
                component={ReportsAnalytics}
                options={{
                    title: "Reports & Analytics"
                }}
            />
            <Stack.Screen 
                name="ManageUsers" 
                component={ManageUsers}
                options={{
                    title: "Manage Users"
                }}
            />
            <Stack.Screen 
                name="PromotionBroadcast" 
                component={PromotionBroadcast}
                options={{
                    title: "Promotion Broadcast"
                }}
            />
            <Stack.Screen 
                name="VoucherManagement" 
                component={VoucherManagement}
                options={{
                    title: "Voucher Management"
                }}
            />
        </Stack.Navigator>
    )
}
export default AdminNavigator