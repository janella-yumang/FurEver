import React, { useContext } from "react";
import { createStackNavigator } from '@react-navigation/stack'

import Login from "../Screens/User/Login";
import Register from "../Screens/User/Register";
import UserProfile from "../Screens/User/UserProfile";
import EditProfile from "../Screens/User/EditProfile";
import OrderHistory from "../Screens/User/OrderHistory";
import Wishlist from "../Screens/Wishlist/Wishlist";
import Notifications from "../Screens/User/Notifications";
import VerifyEmail from "../Screens/User/VerifyEmail";
import ScannerDemo from "../Screens/User/ScannerDemo";
import AuthGlobal from "../Context/Store/AuthGlobal";

const Stack = createStackNavigator();

const UserNavigator = (props) => {
    const context = useContext(AuthGlobal);
    const isAuthenticated = context?.stateUser?.isAuthenticated;

    return (
        <Stack.Navigator
            key={isAuthenticated ? "auth" : "guest"}
            initialRouteName={isAuthenticated ? "User Profile" : "Login"}
        >
            <Stack.Screen
                name="Login"
                component={Login}
                options={{
                    headerShown: false
                }}
            />

            <Stack.Screen
                name="Register"
                component={Register}
                options={{
                    headerShown: false
                }}
            />

            <Stack.Screen
                name="Verify Email"
                component={VerifyEmail}
                options={{
                    headerShown: false
                }}
            />

            <Stack.Screen
                name="User Profile"
                component={UserProfile}
                options={{
                    headerShown: false
                }}
            />

            <Stack.Screen
                name="Edit Profile"
                component={EditProfile}
                options={{
                    title: 'Edit Profile',
                    headerStyle: { backgroundColor: '#FF8C42' },
                    headerTintColor: 'white',
                    headerTitleStyle: { fontWeight: '600' },
                }}
            />

            <Stack.Screen
                name="Order History"
                component={OrderHistory}
                options={{
                    title: 'My Orders',
                    headerStyle: { backgroundColor: '#FF8C42' },
                    headerTintColor: 'white',
                    headerTitleStyle: { fontWeight: '600' },
                }}
            />

            <Stack.Screen
                name="Wishlist"
                component={Wishlist}
                options={{
                    title: 'My Wishlist',
                    headerStyle: { backgroundColor: '#FF8C42' },
                    headerTintColor: 'white',
                    headerTitleStyle: { fontWeight: '600' },
                }}
            />

            <Stack.Screen
                name="Notifications"
                component={Notifications}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name="Scanner"
                component={ScannerDemo}
                options={{
                    headerShown: false,
                }}
            />
        </Stack.Navigator>
    )

}

export default UserNavigator;