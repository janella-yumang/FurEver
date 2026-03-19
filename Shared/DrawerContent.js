import { useNavigation } from '@react-navigation/native';
import React, { useState, useContext } from 'react';
import { Drawer } from 'react-native-paper';
import AuthGlobal from '../Context/Store/AuthGlobal';

const drawerTheme = {
  colors: {
    onSurface: '#1E1E1E',
    onSurfaceVariant: '#1E1E1E',
    secondaryContainer: '#FFE7D5',
  },
};

const drawerItemLabelStyle = { color: '#1E1E1E', fontSize: 18, fontWeight: '600' };
const drawerItemStyle = { borderRadius: 10, marginHorizontal: 8 };

const DrawerContent = () => {
  const [active, setActive] = useState('');
  const navigation = useNavigation();
  const context = useContext(AuthGlobal);
  const isAdmin = context?.stateUser?.user?.isAdmin === true;

  return (
    <Drawer.Section title="Menu" theme={drawerTheme} titleStyle={{ color: '#6B7280', fontWeight: '600' }}>
      <Drawer.Item
        label="My Profile"
        active={active === 'Profile'}
        onPress={() => {
          setActive('Profile');
          navigation.navigate('User', { screen: 'User Profile' });
        }}
        icon="account"
        theme={drawerTheme}
        labelStyle={drawerItemLabelStyle}
        style={drawerItemStyle}
      />
      <Drawer.Item
        label="My Orders"
        active={active === 'Orders'}
        onPress={() => {
          setActive('Orders');
          navigation.navigate('User', { screen: 'Order History' });
        }}
        icon="cart-variant"
        theme={drawerTheme}
        labelStyle={drawerItemLabelStyle}
        style={drawerItemStyle}
      />
      <Drawer.Item
        label="Wishlist"
        active={active === 'Wishlist'}
        onPress={() => {
          setActive('Wishlist');
          navigation.navigate('Wishlist');
        }}
        icon="heart"
        theme={drawerTheme}
        labelStyle={drawerItemLabelStyle}
        style={drawerItemStyle}
      />

      {isAdmin && (
        <Drawer.Item
          label="Admin Dashboard"
          active={active === 'Admin'}
          onPress={() => {
            setActive('Admin');
            navigation.navigate('Admin');
          }}
          icon="shield-account"
          theme={drawerTheme}
          labelStyle={drawerItemLabelStyle}
          style={drawerItemStyle}
        />
      )}

      <Drawer.Item
        label="Notifications"
        active={active === 'Notifications'}
        onPress={() => {
          setActive('Notifications');
          navigation.navigate('User', { screen: 'Notifications' });
        }}
        icon="bell"
        theme={drawerTheme}
        labelStyle={drawerItemLabelStyle}
        style={drawerItemStyle}
      />
    </Drawer.Section>
  );
};

export default DrawerContent;