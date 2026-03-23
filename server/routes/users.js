const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';
const SMTP_CONFIGURED = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const REQUIRE_EMAIL_VERIFICATION = false;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

if (!process.env.JWT_SECRET) {
  console.warn('⚠ JWT_SECRET is not set. Using development fallback secret. Set JWT_SECRET in .env for stable auth.');
}
console.warn('⚠ Email verification is disabled for this deployment.');

// ─── Email transporter ──────────────────────────────────────
let transporter = null;
let emailMode = 'disabled';
(async () => {
  try {
    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    if (smtpConfigured) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
      });
      await transporter.verify();
      emailMode = 'smtp';
      console.log('✓ User routes: Gmail SMTP ready');
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      emailMode = 'ethereal';
      console.warn('⚠ SMTP not configured. Verification emails are sent to Ethereal test inbox only.');
      console.log('✓ User routes: Ethereal test email ready');
    }
  } catch (err) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      emailMode = 'ethereal';
      console.warn('⚠ User routes: SMTP fallback to Ethereal:', err.message);
    } catch (_) {}
  }
})();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, code) => {
  if (!transporter) {
    return { delivered: false, mode: 'disabled' };
  }
  const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
  try {
    // Add timeout to prevent email service from hanging
    const info = await Promise.race([
      transporter.sendMail({
        from: `"FurEver Pet Shop" <${fromEmail}>`,
        to: email,
        subject: `🐾 Your Verification Code: ${code}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;text-align:center">
          <h2 style="color:#FF8C42">🐾 Welcome to FurEver!</h2>
          <p style="font-size:16px">Your email verification code is:</p>
          <div style="background:#FFF3E0;border-radius:12px;padding:24px;margin:20px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#FF8C42">${code}</span>
          </div>
          <p style="color:#666;font-size:14px">This code expires in <strong>10 minutes</strong>.</p>
        </div>`,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timeout')), 5000))
    ]);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    console.log('Verification email sent to:', email);
    if (previewUrl) {
      console.log('Ethereal preview URL:', previewUrl);
    }
    return { delivered: true, mode: emailMode, previewUrl };
  } catch (err) { 
    console.error('Verification email error:', err.message); 
    return { delivered: false, mode: emailMode, error: 'send-failed' };
  }
};

const safeParseArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
};

// ─── REGISTER ───────────────────────────────────────────────
router.post('/register', upload.single('image'), async (req, res) => {
  try {
    const { name, email, password, phone, isAdmin, role, shippingAddress, preferredPets } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password || !phone) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email: normalizedEmail, password: hashedPassword, phone,
      isAdmin: String(isAdmin) === 'true', role: role || 'customer',
      shippingAddress: shippingAddress || '', preferredPets: safeParseArray(preferredPets),
      image: '', emailVerified: true, verificationCode: null, verificationExpires: null,
    });

    const response = {
      message: 'Registration successful. You can now log in.',
      user: User.toJSON(user),
      requiresVerification: false,
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Registration failed.' });
  }
});

// ─── VERIFY EMAIL ───────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    return res.status(410).json({ message: 'Email verification has been removed from this server.' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ message: 'Verification failed.' });
  }
});

// ─── RESEND CODE ────────────────────────────────────────────
router.post('/resend-code', async (req, res) => {
  try {
    return res.status(410).json({ message: 'Email verification has been removed from this server.' });
  } catch (err) {
    console.error('Resend code error:', err);
    return res.status(500).json({ message: 'Failed to resend code.' });
  }
});

// ─── LOGIN ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials.' });
    if (!user.emailVerified) {
      await User.update(user.id, { emailVerified: true, verificationCode: null, verificationExpires: null });
      user.emailVerified = true;
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const token = jwt.sign(
      { userId: String(user.id || user._id), isAdmin: user.isAdmin, email: user.email, name: user.name, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    return res.status(200).json({ token, user: User.toJSON(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

// ─── GOOGLE LOGIN ───────────────────────────────────────────
router.post('/google-login', async (req, res) => {
  try {
    const { googleId, email, name, profilePhoto } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ message: 'Email is required for Google login.' });

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10);
      user = await User.create({
        email: normalizedEmail, name: name || 'Google User',
        password: hashedPassword, phone: '', image: profilePhoto || '',
        emailVerified: true, isAdmin: false, role: 'customer', googleId: googleId || null,
      });
    } else if (!user.emailVerified) {
      await User.update(user.id, { emailVerified: true, googleId: googleId || user.googleId });
      user = await User.findById(user.id);
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const token = jwt.sign(
      { userId: String(user.id || user._id), isAdmin: user.isAdmin, email: user.email, name: user.name, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    return res.status(200).json({ token, user: User.toJSON(user) });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ message: 'Google login failed.' });
  }
});

// ─── GET ALL USERS (admin) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    return res.status(200).json(users.map(User.toJSON));
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ─── GET USER BY ID ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(User.toJSON(user));
  } catch (err) {
    console.error('User fetch error:', err);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// ─── UPDATE USER ────────────────────────────────────────────
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { name, email, phone, shippingAddress, preferredPets } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (shippingAddress !== undefined) updates.shippingAddress = shippingAddress;
    if (preferredPets) updates.preferredPets = safeParseArray(preferredPets);
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      updates.image = `data:${req.file.mimetype};base64,${b64}`;
    }

    user = await User.update(req.params.id, updates);
    return res.status(200).json(User.toJSON(user));
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// ─── TOGGLE ACTIVE ──────────────────────────────────────────
router.put('/:id/toggle-active', async (req, res) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user = await User.update(req.params.id, { isActive: !user.isActive });
    return res.status(200).json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      user: User.toJSON(user),
    });
  } catch (err) {
    console.error('Toggle user active error:', err);
    return res.status(500).json({ message: 'Failed to update user status.' });
  }
});

// ─── CHANGE ROLE ────────────────────────────────────────────
router.put('/:id/change-role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be admin or customer.' });
    }
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user = await User.update(req.params.id, { role, isAdmin: role === 'admin' });
    return res.status(200).json({ message: `User role changed to ${role} successfully.`, user: User.toJSON(user) });
  } catch (err) {
    console.error('Change user role error:', err);
    return res.status(500).json({ message: 'Failed to change user role.' });
  }
});

// ─── DEV: MANUAL VERIFY ────────────────────────────────────
router.post('/dev/verify-manual/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: normalizeEmail(req.params.email) });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'Email verification is disabled. User accounts are already treated as verified.', user: User.toJSON(user) });
  } catch (err) {
    console.error('Manual verify error:', err);
    return res.status(500).json({ message: 'Failed to verify email.' });
  }
});

module.exports = router;
