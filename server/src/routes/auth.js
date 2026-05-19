const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const generateToken = require('../utils/generateToken');
const { protect, loginRateLimiter } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/emailService');

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  preferences: { theme: user.theme, dashboardLayout: user.dashboardLayout },
  lastLogin: user.lastLogin,
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, password } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword },
      });

      sendWelcomeEmail({ to: email, name }).catch(console.error);

      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: safeUser(user),
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  loginRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      let passwordCheck = false;
      if (user) {
        passwordCheck = await bcrypt.compare(password, user.password);
      } else {
        await bcrypt.hash(password, 12); // Timing attack prevention
      }

      if (!user || !passwordCheck || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const token = generateToken(user.id);

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: safeUser(updatedUser),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Server error during login.' });
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, preferences, emailNotifications } = req.body;
      const updateData = {};

      if (name) updateData.name = name;
      if (email) {
        const existing = await prisma.user.findFirst({
          where: { email, NOT: { id: req.user.id } },
        });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Email already in use.' });
        }
        updateData.email = email;
      }
      if (preferences?.theme) updateData.theme = preferences.theme;
      if (preferences?.dashboardLayout !== undefined) updateData.dashboardLayout = preferences.dashboardLayout;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
      });

      res.json({ success: true, message: 'Profile updated.', user: safeUser(user) });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      });

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

module.exports = router;
