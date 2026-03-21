import 'react-native-gesture-handler';
import { AppRegistry, Platform } from 'react-native';

import App from './App';

if (Platform.OS === 'web' && typeof global.setImmediate !== 'function') {
	global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

AppRegistry.registerComponent('main', () => App);
