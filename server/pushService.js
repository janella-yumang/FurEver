const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

async function sendExpoPushMessages(messages = []) {
  if (!messages.length) return { sent: 0, failed: 0, staleTokens: new Set() };

  let sent = 0;
  let failed = 0;
  const staleTokens = new Set();

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
        sent += 1;
        const receipts = response.body?.data;
        if (Array.isArray(receipts)) {
          for (const receipt of receipts) {
            if (receipt?.status === 'error' && receipt?.details?.error === 'DeviceNotRegistered') {
              staleTokens.add(message.token);
            }
          }
        }
      } else {
        failed += 1;
      }
    } catch (_) {
      failed += 1;
    }
  }

  return { sent, failed, staleTokens };
}

async function sendFcmMessages(messages = []) {
  if (!messages.length) return { sent: 0, failed: 0, staleTokens: new Set() };

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { sent: 0, failed: messages.length, staleTokens: new Set() };
  }

  let sent = 0;
  let failed = 0;
  const staleTokens = new Set();

  for (const message of messages) {
    try {
      await messaging.send({
        token: message.token,
        notification: {
          title: String(message.title || ''),
          body: String(message.body || ''),
        },
        data: serializeData(message.data),
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'max',
            visibility: 'public',
          },
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      const code = String(err?.code || '');
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        staleTokens.add(message.token);
      }
    }
  }

  return { sent, failed, staleTokens };
}

async function sendPushMessages(messages = []) {
  if (!messages.length) {
    return { sent: 0, failed: 0, staleTokens: new Set() };
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

  const [expoResult, fcmResult] = await Promise.all([
    sendExpoPushMessages(expoMessages),
    sendFcmMessages(fcmMessages),
  ]);

  return {
    sent: expoResult.sent + fcmResult.sent,
    failed: expoResult.failed + fcmResult.failed,
    staleTokens: new Set([...expoResult.staleTokens, ...fcmResult.staleTokens]),
  };
}

module.exports = {
  isExpoPushToken,
  isLikelyFcmToken,
  sendPushMessages,
};
