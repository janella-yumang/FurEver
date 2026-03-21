import { Platform } from 'react-native';
import Constants from 'expo-constants';

const FALLBACK_MOBILE_HOST = String(process.env.EXPO_PUBLIC_API_FALLBACK_HOST || '').trim();
const DEFAULT_PUBLIC_API_URL = 'https://furever-1-lekw.onrender.com';

const ensureTrailingSlash = (url = '') => {
    const withApiPath = /\/api\/v1\/?$/i.test(url) ? url : `${url.replace(/\/+$/, '')}/api/v1`;
    return withApiPath.endsWith('/') ? withApiPath : `${withApiPath}/`;
};

const isIpv4 = (value = '') => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value);

const isPrivateIpv4 = (value = '') => {
    if (!isIpv4(value)) return false;
    if (value.startsWith('10.')) return true;
    if (value.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
    return false;
};

const extractHostname = (url = '') => {
    const match = String(url).trim().match(/^(?:https?:\/\/)?([^/:?#]+)/i);
    return match ? match[1].toLowerCase() : '';
};

const isLocalHost = (host = '') => host === 'localhost' || host === '127.0.0.1';

const isLikelyPrivateOrLocalUrl = (url = '') => {
    const host = extractHostname(url);
    if (!host) return false;
    return isLocalHost(host) || isPrivateIpv4(host);
};

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

    if (fromEnv && !(!__DEV__ && isLikelyPrivateOrLocalUrl(fromEnv))) {
        resolved = ensureTrailingSlash(fromEnv);
        console.log('API base URL (mobile env):', resolved);
    } else if (fromEnv && !__DEV__) {
        resolved = ensureTrailingSlash(DEFAULT_PUBLIC_API_URL);
        console.log('API base URL (mobile env overridden to public):', resolved);
    } else if (detectedHostIsIpv4) {
        resolved = ensureTrailingSlash(`http://${detectedHost}:4000`);
        console.log('API base URL (mobile detected):', resolved);
    } else if (FALLBACK_MOBILE_HOST) {
        resolved = ensureTrailingSlash(`http://${FALLBACK_MOBILE_HOST}:4000`);
        console.log('API base URL (mobile fallback):', resolved);
    } else {
        resolved = ensureTrailingSlash(!__DEV__ ? DEFAULT_PUBLIC_API_URL : 'http://localhost:4000');
        console.log('API base URL (mobile fallback):', resolved);
    }
}

if (!resolved) {
    resolved = ensureTrailingSlash(!__DEV__ ? DEFAULT_PUBLIC_API_URL : 'http://localhost:4000');
    console.log('API base URL (final fallback):', resolved);
}

export default resolved;