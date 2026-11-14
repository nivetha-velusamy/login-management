const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../middleware/auth');

const loginLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const ttl = () => Math.max(60, Number(process.env.SESSION_TTL_SECONDS || 900));
const safeUser = u => ({ id: u._id, name: u.name, email: u.email, createdAt: u.createdAt });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ message: 'Name must contain at least 2 characters.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash });
    res.status(201).json({ message: 'Account created. You can now sign in.', user: safeUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    // Use a generic error to avoid disclosing whether an email exists.
    if (!user) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (user.lockUntil && user.lockUntil > new Date()) {
      const seconds = Math.ceil((user.lockUntil - Date.now()) / 1000);
      return res.status(423).json({ message: `Account temporarily locked. Try again in ${seconds} seconds.`, code: 'ACCOUNT_LOCKED' });
    }
    if (user.lockUntil && user.lockUntil <= new Date()) { user.failedLoginAttempts = 0; user.lockUntil = null; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= Number(process.env.LOCKOUT_THRESHOLD || 3)) {
        user.lockUntil = new Date(Date.now() + Number(process.env.LOCKOUT_DURATION_SECONDS || 60) * 1000);
      }
      await user.save();
      return res.status(user.lockUntil ? 423 : 401).json({ message: user.lockUntil ? 'Too many failed attempts. Account temporarily locked.' : 'Email or password is incorrect.', code: user.lockUntil ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS' });
    }
    user.failedLoginAttempts = 0; user.lockUntil = null; await user.save();
    const tokenId = randomUUID();
    const expiresAt = new Date(Date.now() + ttl() * 1000);
    const token = jwt.sign({ sub: user._id.toString(), jti: tokenId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
    await Session.create({ user: user._id, tokenId, ip: req.ip, userAgent: req.get('user-agent'), expiresAt });
    res.json({ message: 'Signed in successfully.', token, expiresAt, user: safeUser(user) });
  } catch (e) { next(e); }
});

router.get('/me', auth, async (req, res, next) => {
  try { const user = await User.findById(req.userId); res.json({ user: safeUser(user), expiresAt: req.session.expiresAt }); }
  catch (e) { next(e); }
});
router.post('/logout', auth, async (req, res, next) => {
  try { req.session.revokedAt = new Date(); await req.session.save(); res.json({ message: 'Signed out. Session revoked.' }); }
  catch (e) { next(e); }
});
module.exports = router;
