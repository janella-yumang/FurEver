const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── Email transporter (shared with orders) ─────────────────
let transporter = null;
(async () => {
  try {
    if (process.env.SMTP_HOST) {
      // Use port 587 + STARTTLS (more firewall-friendly than port 465 SSL)
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,               // false = STARTTLS on 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,    // 30 s connect timeout
        greetingTimeout: 30000,
      });
      await transporter.verify();
      console.log('✓ User routes: Gmail SMTP ready');
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }
  } catch (err) {
    console.log('User email transporter error:', err.message);
    // Fallback to Ethereal so the app keeps working without real email
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('↪ Fallback: using Ethereal test account', testAccount.user);
    } catch (_) { /* no email available */ }
  }
})();

// Generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send verification email
const sendVerificationEmail = async (email, code) => {
  if (!transporter) return;
  const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
  try {
    const info = await transporter.sendMail({
      from: `"FurEver Pet Shop" <${fromEmail}>`,
      to: email,
      subject: `🐾 Your Verification Code: ${code}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;text-align:center">
          <h2 style="color:#FF8C42">🐾 Welcome to FurEver!</h2>
          <p style="font-size:16px">Your email verification code is:</p>
          <div style="background:#FFF3E0;border-radius:12px;padding:24px;margin:20px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#FF8C42">${code}</span>
          </div>
          <p style="color:#666;font-size:14px">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color:#999;font-size:12px;margin-top:24px">If you didn't create an account, please ignore this email.</p>
        </div>`,
    });
    console.log('Verification email sent to:', email, info.messageId);
  } catch (err) {
    console.error('Verification email error:', err.message);
  }
};

const safeParseArray = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return [];
  }
};

router.post('/register', upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      isAdmin,
      role,
      shippingAddress,
      preferredPets
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = generateOTP();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      isAdmin: String(isAdmin) === 'true',
      role: role || 'customer',
      shippingAddress: shippingAddress || '',
      preferredPets: safeParseArray(preferredPets),
      image: '',
      emailVerified: false,
      verificationCode,
      verificationExpires,
    });

    const saved = await user.save();

    // Send verification email
    sendVerificationEmail(saved.email, verificationCode);

    return res.status(201).json({
      message: 'Verification code sent to your email',
      user: saved.toJSON(),
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
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: 'Email already verified.' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ message: 'Verification failed.' });
  }
});

// ─── RESEND VERIFICATION CODE ───────────────────────────────
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: 'Email already verified.' });
    }

    const newCode = generateOTP();
    user.verificationCode = newCode;
    user.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    sendVerificationEmail(user.email, newCode);

    return res.status(200).json({ message: 'New verification code sent to your email.' });
  } catch (err) {
    console.error('Resend code error:', err);
    return res.status(500).json({ message: 'Failed to resend code.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Block login if email is not verified
    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Block login if account is deactivated
    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        isAdmin: user.isAdmin,
        email: user.email,
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

// ─── ADMIN: GET ALL USERS ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password -verificationCode -verificationExpires').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(user.toJSON());
  } catch (err) {
    console.error('User fetch error:', err);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { name, email, phone, shippingAddress, preferredPets } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (shippingAddress !== undefined) user.shippingAddress = shippingAddress;
    if (preferredPets) user.preferredPets = safeParseArray(preferredPets);

    // If a new image file was uploaded, store the path or handle as needed
    if (req.file) {
      // For now store as base64 data URI so it works without cloud storage
      const b64 = req.file.buffer.toString('base64');
      user.image = `data:${req.file.mimetype};base64,${b64}`;
    }

    const saved = await user.save();
    return res.status(200).json(saved.toJSON());
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// ─── ADMIN: TOGGLE ACTIVATE / DEACTIVATE USER ──────────────
router.put('/:id/toggle-active', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.isActive = !user.isActive;
    const saved = await user.save();

    return res.status(200).json({
      message: `User ${saved.isActive ? 'activated' : 'deactivated'} successfully.`,
      user: saved.toJSON(),
    });
  } catch (err) {
    console.error('Toggle user active error:', err);
    return res.status(500).json({ message: 'Failed to update user status.' });
  }
});

// ─── ADMIN: CHANGE USER ROLE ────────────────────────────────
router.put('/:id/change-role', async (req, res) => {
  try {
    const { role } = req.body;   // 'admin' or 'customer'
    if (!role || !['admin', 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be admin or customer.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.role = role;
    user.isAdmin = role === 'admin';
    const saved = await user.save();

    return res.status(200).json({
      message: `User role changed to ${role} successfully.`,
      user: saved.toJSON(),
    });
  } catch (err) {
    console.error('Change user role error:', err);
    return res.status(500).json({ message: 'Failed to change user role.' });
  }
});

// ─── DEVELOPMENT: MANUALLY VERIFY EMAIL (for testing) ──────
router.post('/dev/verify-manual/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    return res.status(200).json({
      message: 'Email manually verified (development only).',
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Manual verify error:', err);
    return res.status(500).json({ message: 'Failed to verify email.' });
  }
});

module.exports = router;
