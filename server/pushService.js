const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FCM_MAX_MESSAGE_BYTES = 3800;

const EXPO_TOKEN_RE = /^ExponentPushToken\[[\w-]+\]$/;

function isExpoPushToken(token = '') {
  return EXPO_TOKEN_RE.test(String(token || '').trim());
}

function isLikelyFcmToken(token = '') {
  const value = String(token || '').trim();
  if (!value || isExpoPushToken(value)) return false;
  // FCM tokens are opaque strings and can include ':', '-', '_' and alphanumerics.
  return value.length >= 20;
}

function postJson(url, payload) {
  if (typeof fetch === 'function') {
    return fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      let body = null;
      try {
        body = await res.json();
      } catch (_) {}
      return { ok: res.ok, body };
    });
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let body = null;
          try {
            body = JSON.parse(data);
          } catch (_) {}
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body });
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

function getFirebaseMessaging() {
  if (admin.apps.length > 0) {
    return admin.messaging();
  }

  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidatePath = explicitPath
    ? path.resolve(explicitPath)
    : path.resolve(__dirname, '../gsa-key.json');

  if (!fs.existsSync(candidatePath)) {
    console.warn('Push: Firebase service account not found, FCM sends disabled.');
    return null;
  }

  try {
    const serviceAccount = require(candidatePath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.messaging();
  } catch (err) {
    console.warn('Push: Failed to initialize Firebase Admin:', err.message);
    return null;
  }
}

function serializeData(data = {}) {
  const output = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    output[String(key)] = String(value);
  }
  return output;
}

function truncateUtf8(value = '', maxBytes = 512) {
  const input = String(value || '');
  if (!input) return '';

  if (Buffer.byteLength(input, 'utf8') <= maxBytes) {
    return input;
  }

  let low = 0;
  let high = input.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = input.slice(0, mid);
    const bytes = Buffer.byteLength(candidate, 'utf8');
    if (bytes <= maxBytes) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function estimatePayloadBytes(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch (_) {
    return Number.MAX_SAFE_INTEGER;
  }
}

function buildFcmPayload(message) {
  const title = truncateUtf8(message?.title || '', 120);
  let body = truncateUtf8(message?.body || '', 1200);
  const rawData = serializeData(message?.data || {});
  const data = {};

  for (const [key, value] of Object.entries(rawData)) {
    data[key] = truncateUtf8(value, 300);
  }

  const payload = {
    token: message.token,
    notification: {
      title,
      body,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'max',
        visibility: 'public',
      },
    },
  };

  const optionalDataKeys = ['imageUrl', 'deepLink', 'expiresAt', 'voucherId', 'productId', 'promoCode', 'discountPercent'];

  // Keep under FCM payload size limit by dropping least-critical keys first.
  for (const key of optionalDataKeys) {
    if (estimatePayloadBytes(payload) <= FCM_MAX_MESSAGE_BYTES) break;
    delete payload.data[key];
  }

  while (estimatePayloadBytes(payload) > FCM_MAX_MESSAGE_BYTES && body.length > 0) {
    body = truncateUtf8(body, Math.max(80, Buffer.byteLength(body, 'utf8') - 120));
    payload.notification.body = body;
  }

  if (estimatePayloadBytes(payload) > FCM_MAX_MESSAGE_BYTES) {
    payload.data = {};
  }

  while (estimatePayloadBytes(payload) > FCM_MAX_MESSAGE_BYTES && payload.notification.title.length > 0) {
    payload.notification.title = truncateUtf8(
      payload.notification.title,
      Math.max(20, Buffer.byteLength(payload.notification.title, 'utf8') - 40)
    );
  }

  return payload;
}

async function sendExpoPushMessages(messages = []) {
  if (!messages.length) return { sent: 0, failed: 0, staleTokens: new Set(), reports: [] };

  let sent = 0;
  let failed = 0;
  const staleTokens = new Set();
  const reports = [];

  for (const message of messages) {
    try {
      const response = await postJson(EXPO_PUSH_URL, {
        to: message.token,
        sound: 'default',
        title: message.title,
        body: message.body,
        data: message.data || {},
      });

      if (response.ok) {
        const rawReceipts = response.body?.data;
        const receipts = Array.isArray(rawReceipts)
          ? rawReceipts
          : rawReceipts
            ? [rawReceipts]
            : [];

        if (!receipts.length) {
          sent += 1;
          reports.push({
            provider: 'expo',
            token: message.token,
            userId: message.userId || null,
            status: 'sent',
          });
        } else {
          for (const receipt of receipts) {
            if (receipt?.status === 'ok') {
              sent += 1;
              reports.push({
                provider: 'expo',
                token: message.token,
                userId: message.userId || null,
                status: 'sent',
                ticketId: receipt?.id || null,
              });
            } else {
              failed += 1;
              if (receipt?.details?.error === 'DeviceNotRegistered') {
                staleTokens.add(message.token);
              }
              reports.push({
                provider: 'expo',
                token: message.token,
                userId: message.userId || null,
                status: 'failed',
                error: receipt?.message || receipt?.details?.error || 'Unknown Expo error',
              });
            }
          }
        }
      } else {
        failed += 1;
        reports.push({
          provider: 'expo',
          token: message.token,
          userId: message.userId || null,
          status: 'failed',
          error: response?.body?.errors?.[0]?.message || 'Expo push request failed',
        });
      }
    } catch (err) {
      failed += 1;
      reports.push({
        provider: 'expo',
        token: message.token,
        userId: message.userId || null,
        status: 'failed',
        error: err?.message || 'Expo push exception',
      });
    }
  }

  return { sent, failed, staleTokens, reports };
}

async function sendFcmMessages(messages = []) {
  if (!messages.length) return { sent: 0, failed: 0, staleTokens: new Set(), reports: [] };

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return {
      sent: 0,
      failed: messages.length,
      staleTokens: new Set(),
      reports: messages.map((message) => ({
        provider: 'fcm',
        token: message.token,
        userId: message.userId || null,
        status: 'failed',
        error: 'Firebase messaging is not configured',
      })),
    };
  }

  let sent = 0;
  let failed = 0;
  const staleTokens = new Set();
  const reports = [];

  for (const message of messages) {
    try {
      const ticketId = await messaging.send(buildFcmPayload(message));
      sent += 1;
      reports.push({
        provider: 'fcm',
        token: message.token,
        userId: message.userId || null,
        status: 'sent',
        ticketId: ticketId || null,
      });
    } catch (err) {
      failed += 1;
      const code = String(err?.code || '');
      console.error('[Push/FCM] Send failed:', { code, message: err?.message, userId: message.userId });
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        staleTokens.add(message.token);
        console.warn('[Push/FCM] Stale token detected:', { userId: message.userId });
      }
      reports.push({
        provider: 'fcm',
        token: message.token,
        userId: message.userId || null,
        status: 'failed',
        error: err?.message || code || 'Unknown FCM error',
      });
    }
  }

  return { sent, failed, staleTokens, reports };
}

async function sendPushMessages(messages = []) {
  if (!messages.length) {
    console.log('[Push] No messages to send');
    return { sent: 0, failed: 0, staleTokens: new Set(), reports: [] };
  }

  const expoMessages = [];
  const fcmMessages = [];

  for (const message of messages) {
    const token = String(message?.token || '').trim();
    if (!token) continue;

    if (isExpoPushToken(token)) {
      expoMessages.push({ ...message, token });
    } else if (isLikelyFcmToken(token)) {
      fcmMessages.push({ ...message, token });
    }
  }

  console.log('[Push] Sending messages:', { total: messages.length, expo: expoMessages.length, fcm: fcmMessages.length });

  const [expoResult, fcmResult] = await Promise.all([
    sendExpoPushMessages(expoMessages),
    sendFcmMessages(fcmMessages),
  ]);

  console.log('[Push] Results:', {
    expo: { sent: expoResult.sent, failed: expoResult.failed },
    fcm: { sent: fcmResult.sent, failed: fcmResult.failed },
    total: { sent: expoResult.sent + fcmResult.sent, failed: expoResult.failed + fcmResult.failed }
  });

  return {
    sent: expoResult.sent + fcmResult.sent,
    failed: expoResult.failed + fcmResult.failed,
    staleTokens: new Set([...expoResult.staleTokens, ...fcmResult.staleTokens]),
    reports: [...expoResult.reports, ...fcmResult.reports],
  };
}

module.exports = {
  isExpoPushToken,
  isLikelyFcmToken,
  sendPushMessages,
};
