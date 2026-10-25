const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  record.count += 1;
  return next();
}

router.post('/login', rateLimit, async (req, res, next) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT userID, username, password, role FROM Users WHERE username = ? LIMIT 1',
      [username]
    );
    const user = rows[0];

    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userID: user.userID, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
    });

    return res.json({ username: user.username, role: user.role });
  } catch (err) {
    return next(err);
  }
});

router.use(requireAuth);

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ username: req.user.username, role: req.user.role, companyName: config.companyName });
});

module.exports = router;
