import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native'
import { useEffect, useRef } from 'react';
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
import { getStoredJwt } from './assets/common/authToken';

const ORDER_NOTIFICATION_TYPES = new Set([
  'order_confirmed',
  'order_processing',
  'order_shipped',
  'order_delivered',
  'order_canceled',
]);

const PROMO_NOTIFICATION_TYPES = new Set([
  'promo_discount',
]);

const normalizeNotificationData = (rawData) => {
  if (!rawData || typeof rawData !== 'object') return {};

  const normalized = {};
  Object.keys(rawData).forEach((key) => {
    normalized[String(key)] = rawData[key];
  });

  return normalized;
};

const resolveOrderNavigationPayload = (response) => {
  const data = normalizeNotificationData(response?.notification?.request?.content?.data || {});
  const type = String(data.type || '').trim();
  const orderId = data.orderId || data.order;

  if (!type || !ORDER_NOTIFICATION_TYPES.has(type) || !orderId) {
    return null;
  }

  return {
    orderId: String(orderId),
    type,
  };
};

const resolvePromoNavigationPayload = (response) => {
  const data = normalizeNotificationData(response?.notification?.request?.content?.data || {});
  const type = String(data.type || '').trim();

  if (!type || !PROMO_NOTIFICATION_TYPES.has(type)) {
    return null;
  }

  const voucherId = data.voucherId != null ? String(data.voucherId) : null;
  const promoCode = data.promoCode != null ? String(data.promoCode).trim() : null;

  if (!voucherId && !promoCode) {
    return null;
  }

  return {
    type,
    voucherId,
    promoCode,
  };
};

const CartBootstrapper = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const hydrateCartFromStorage = async () => {
      try {
        const token = await getStoredJwt();
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

    hydrateCartFromStorage();
  }, [dispatch]);

  return null;
};

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let responseSubscription = null;

    const handleNotificationTap = (response) => {
      if (!navigationRef.current) return;

      const orderPayload = resolveOrderNavigationPayload(response);
      if (orderPayload) {
        navigationRef.current.navigate('My app', {
          screen: 'User',
          params: {
            screen: 'Order History',
            params: {
              focusOrderId: orderPayload.orderId,
              source: 'push',
              notificationType: orderPayload.type,
            },
          },
        });
        return;
      }

      const promoPayload = resolvePromoNavigationPayload(response);
      if (promoPayload) {
        navigationRef.current.navigate('My app', {
          screen: 'Home',
          params: {
            screen: 'Voucher Detail',
            params: {
              voucherId: promoPayload.voucherId,
              promoCode: promoPayload.promoCode,
              source: 'push',
              notificationType: promoPayload.type,
            },
          },
        });
      }
    };

    const setupNotifications = async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!mounted) return;

        responseSubscription = Notifications.addNotificationResponseReceivedListener(
          handleNotificationTap
        );

        const initialResponse = await Notifications.getLastNotificationResponseAsync();
        if (initialResponse) {
          handleNotificationTap(initialResponse);
        }
      } catch (error) {
        console.log('Notification tap listener setup skipped:', error?.message || error);
      }
    };

    setupNotifications();

    return () => {
      mounted = false;
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, []);

  return (
    <Auth>
      <Provider store={store}>
        <CartBootstrapper />
        <NavigationContainer ref={navigationRef}>
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
