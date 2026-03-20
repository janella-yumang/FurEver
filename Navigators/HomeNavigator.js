import React from 'react'
import { createStackNavigator } from "@react-navigation/stack"
// import { Stack } from 'expo-router';
import ProductContainer from '../Screens/Product/ProductContainer';
import SingleProduct from '../Screens/Product/SingleProduct';
import VoucherDetail from '../Screens/Product/VoucherDetail';

const Stack = createStackNavigator()
function MyStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name='Main'
                component={ProductContainer}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name='Product Detail'
                component={SingleProduct}
                options={{
                    headerShown: true,
                }}
            />

            <Stack.Screen
                name='Voucher Detail'
                component={VoucherDetail}
                options={{
                    headerShown: false,
                }}
            />

        </Stack.Navigator>
    )
}

export default function HomeNavigator() {
    return <MyStack />;
}