import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native'
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';


import ProductContainer from './Screens/Product/ProductContainer'
import HomeNavigator from './Navigators/HomeNavigator';
import Header from './Shared/Header';
import Main from './Navigators/Main';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider, useDispatch } from 'react-redux';
import store from './Redux/store';
import Toast from 'react-native-toast-message';
import Auth from './Context/Store/Auth';
import DrawerNavigator from './Navigators/DrawerNavigator';
import { loadUserCart, setCartUserId } from './Redux/Actions/cartActions';

const CartBootstrapper = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const hydrateCartFromSQLite = async () => {
      try {
        const token = await SecureStore.getItemAsync('jwt');
        let userId = null;

        if (token) {
          try {
            const decoded = jwtDecode(token);
            userId = decoded?.userId || null;
          } catch (decodeError) {
            console.log('JWT decode error during cart hydration:', decodeError);
          }
        }

        setCartUserId(userId);
        dispatch(loadUserCart(userId));
      } catch (error) {
        console.log('Cart hydration error:', error);
      }
    };

    hydrateCartFromSQLite();
  }, [dispatch]);

  return null;
};

export default function App() {
  return (
    <Auth>
      <Provider store={store}>
        <CartBootstrapper />
        <NavigationContainer>
          <PaperProvider>
            <Header />
            {/* <ProductContainer /> */}
            {/* <Main /> */}
            <DrawerNavigator />
          </PaperProvider>
        </NavigationContainer>
        <Toast />
      </Provider>
    </Auth>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
