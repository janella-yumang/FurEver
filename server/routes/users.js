const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── Email transporter ──────────────────────────────────────
let transporter = null;
(async () => {
  try {
    if (process.env.SMTP_HOST) {
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
      console.log('✓ User routes: Gmail SMTP ready');
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('✓ User routes: Ethereal test email ready');
    }
  } catch (err) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.warn('⚠ User routes: SMTP fallback to Ethereal:', err.message);
    } catch (_) {}
  }
})();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, code) => {
  if (!transporter) return;
  const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
  try {
    await transporter.sendMail({
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
    });
    console.log('Verification email sent to:', email);
  } catch (err) { console.error('Verification email error:', err.message); }
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
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    const existing = User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateOTP();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const user = User.create({
      name, email: email.toLowerCase(), password: hashedPassword, phone,
      isAdmin: String(isAdmin) === 'true', role: role || 'customer',
      shippingAddress: shippingAddress || '', preferredPets: safeParseArray(preferredPets),
      image: '', emailVerified: false, verificationCode, verificationExpires,
    });

    sendVerificationEmail(user.email, verificationCode);

    return res.status(201).json({
      message: 'Verification code sent to your email',
      user: User.toJSON(user),
      requiresVerification: true,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Registration failed.' });
  }
});

// ─── VERIFY EMAIL ───────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and verification code are required.' });

    const user = User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.emailVerified) return res.status(200).json({ message: 'Email already verified.' });
    if (user.verificationCode !== code) return res.status(400).json({ message: 'Invalid verification code.' });
    if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    User.update(user.id, { emailVerified: true, verificationCode: null, verificationExpires: null });
    return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ message: 'Verification failed.' });
  }
});

// ─── RESEND CODE ────────────────────────────────────────────
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const user = User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.emailVerified) return res.status(200).json({ message: 'Email already verified.' });

    const newCode = generateOTP();
    User.update(user.id, {
      verificationCode: newCode,
      verificationExpires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    sendVerificationEmail(user.email, newCode);
    return res.status(200).json({ message: 'New verification code sent to your email.' });
  } catch (err) {
    console.error('Resend code error:', err);
    return res.status(500).json({ message: 'Failed to resend code.' });
  }
});

// ─── LOGIN ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials.' });
    if (!user.emailVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.', requiresVerification: true, email: user.email });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET, { expiresIn: '7d' }
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
    if (!email) return res.status(400).json({ message: 'Email is required for Google login.' });

    let user = User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10);
      user = User.create({
        email: email.toLowerCase(), name: name || 'Google User',
        password: hashedPassword, phone: '', image: profilePhoto || '',
        emailVerified: true, isAdmin: false, role: 'customer', googleId: googleId || null,
      });
    } else if (!user.emailVerified) {
      User.update(user.id, { emailVerified: true, googleId: googleId || user.googleId });
      user = User.findById(user.id);
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    return res.status(200).json({ token, user: User.toJSON(user) });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(500).json({ message: 'Google login failed.' });
  }
});

// ─── GET ALL USERS (admin) ──────────────────────────────────
router.get('/', (req, res) => {
  try {
    const users = User.find();
    return res.status(200).json(users.map(User.toJSON));
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ─── GET USER BY ID ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(User.toJSON(user));
  } catch (err) {
    console.error('User fetch error:', err);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// ─── UPDATE USER ────────────────────────────────────────────
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    let user = User.findById(req.params.id);
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

    user = User.update(req.params.id, updates);
    return res.status(200).json(User.toJSON(user));
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// ─── TOGGLE ACTIVE ──────────────────────────────────────────
router.put('/:id/toggle-active', (req, res) => {
  try {
    let user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user = User.update(req.params.id, { isActive: !user.isActive });
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
router.put('/:id/change-role', (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be admin or customer.' });
    }
    let user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user = User.update(req.params.id, { role, isAdmin: role === 'admin' });
    return res.status(200).json({ message: `User role changed to ${role} successfully.`, user: User.toJSON(user) });
  } catch (err) {
    console.error('Change user role error:', err);
    return res.status(500).json({ message: 'Failed to change user role.' });
  }
});

// ─── DEV: MANUAL VERIFY ────────────────────────────────────
router.post('/dev/verify-manual/:email', (req, res) => {
  try {
    const user = User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = User.update(user.id, { emailVerified: true, verificationCode: null, verificationExpires: null });
    return res.status(200).json({ message: 'Email manually verified (development only).', user: User.toJSON(updated) });
  } catch (err) {
    console.error('Manual verify error:', err);
    return res.status(500).json({ message: 'Failed to verify email.' });
  }
});

module.exports = router;
