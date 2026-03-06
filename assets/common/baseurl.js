import { Platform } from 'react-native'

let baseURL = '';

if (Platform.OS === 'web') {
    baseURL = 'http://localhost:4000/api/v1/';
} else {
    baseURL = 'http://192.168.1.21:4000/api/v1/';
}

export default baseURL;