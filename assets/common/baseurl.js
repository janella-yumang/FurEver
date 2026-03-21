import { Platform } from 'react-native';
import Constants from 'expo-constants';

const FALLBACK_MOBILE_HOST = String(process.env.EXPO_PUBLIC_API_FALLBACK_HOST || '').trim();

const ensureTrailingSlash = (url = '') => {
    const withApiPath = /\/api\/v1\/?$/i.test(url) ? url : `${url.replace(/\/+$/, '')}/api/v1`;
    return withApiPath.endsWith('/') ? withApiPath : `${withApiPath}/`;
};

const isIpv4 = (value = '') => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value);

const fromEnv = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
let resolved = '';

if (Platform.OS === 'web') {
    if (fromEnv) {
        resolved = ensureTrailingSlash(fromEnv);
        console.log('API base URL (web env):', resolved);
    } else {
        resolved = ensureTrailingSlash('http://localhost:4000');
        console.log('API base URL (web):', resolved);
    }
} else {
    // For real devices, prefer explicit env URL (e.g. Render) when provided.
    const hostUri =
        Constants?.expoConfig?.hostUri ||
        Constants?.manifest?.debuggerHost ||
        Constants?.manifest?.hostUri ||
        '';

    const detectedHost = String(hostUri).split(':')[0];
    const detectedHostIsIpv4 = isIpv4(detectedHost);

    if (fromEnv) {
        resolved = ensureTrailingSlash(fromEnv);
        console.log('API base URL (mobile env):', resolved);
    } else if (detectedHostIsIpv4) {
        resolved = ensureTrailingSlash(`http://${detectedHost}:4000`);
        console.log('API base URL (mobile detected):', resolved);
    } else if (FALLBACK_MOBILE_HOST) {
        resolved = ensureTrailingSlash(`http://${FALLBACK_MOBILE_HOST}:4000`);
        console.log('API base URL (mobile fallback):', resolved);
    } else {
        resolved = ensureTrailingSlash('http://localhost:4000');
        console.log('API base URL (mobile fallback localhost):', resolved);
    }
}

if (!resolved) {
    resolved = ensureTrailingSlash('http://localhost:4000');
    console.log('API base URL (final fallback):', resolved);
}

export default resolved;