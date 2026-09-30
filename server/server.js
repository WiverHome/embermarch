'use strict';
/**
 * Embermarch account + save-progress server.
 *
 * Minimal Express + SQLite service. No build step: `npm install && npm start`.
 * See DEPLOY.md for a full step-by-step production deployment guide.
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'embermarch.sqlite');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://wiverhome.github.io,https://embermarch.lapochka.online')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and set a real secret.');
  process.exit(1);
}

// ---------- Database ----------
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const stmts = {
  findUserByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  getProgress: db.prepare('SELECT data_json FROM progress WHERE user_id = ?'),
  upsertProgress: db.prepare(`
    INSERT INTO progress (user_id, data_json, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')
  `),
};

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '600kb' }));

app.use(cors({
  origin: function (origin, cb) {
    // Same-origin / non-browser requests (curl, health checks) send no Origin header — allow.
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
}));

const USERNAME_RE = /^[a-zA-Z0-9_\-]{3,32}$/;
const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72; // bcrypt's own input limit
const PROGRESS_MAX_BYTES = 512 * 1024;

function err(res, status, message) {
  return res.status(status).json({ error: message });
}

// Auth endpoints get their own stricter limiter (brute force / spam registration, no email verification at all).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(hdr);
  if (!m) return err(res, 401, 'Missing or malformed Authorization header.');
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const user = stmts.findUserById.get(payload.sub);
    if (!user) return err(res, 401, 'Invalid session.');
    req.user = user;
    next();
  } catch (e) {
    return err(res, 401, 'Invalid or expired session.');
  }
}

app.get('/api/health', function (req, res) {
  res.json({ ok: true });
});

app.post('/api/register', authLimiter, function (req, res) {
  const username = (req.body && req.body.username || '').trim();
  const password = (req.body && req.body.password || '');

  if (!USERNAME_RE.test(username)) {
    return err(res, 400, 'Username must be 3-32 characters: letters, numbers, "_" or "-".');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LEN) {
    return err(res, 400, 'Password must be at least ' + PASSWORD_MIN_LEN + ' characters.');
  }
  if (password.length > PASSWORD_MAX_LEN) {
    return err(res, 400, 'Password is too long.');
  }

  const existing = stmts.findUserByName.get(username);
  if (existing) return err(res, 409, 'That username is already taken.');

  const hash = bcrypt.hashSync(password, 10);
  const info = stmts.insertUser.run(username, hash);
  const user = { id: info.lastInsertRowid, username: username };
  stmts.upsertProgress.run(user.id, JSON.stringify({}));

  const token = signToken(user);
  res.status(201).json({ token: token, username: user.username });
});

app.post('/api/login', authLimiter, function (req, res) {
  const username = (req.body && req.body.username || '').trim();
  const password = (req.body && req.body.password || '');

  const user = stmts.findUserByName.get(username);
  // Generic error for both "no such user" and "wrong password" — never leak which one.
  if (!user) return err(res, 401, 'Invalid username or password.');

  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return err(res, 401, 'Invalid username or password.');

  const token = signToken(user);
  res.json({ token: token, username: user.username });
});

app.post('/api/logout', requireAuth, function (req, res) {
  // Tokens are stateless JWTs with a 30-day expiry; there is no server-side session to
  // revoke. The client simply forgets the token. (See README/DEPLOY notes if you want to
  // add a server-side denylist later.)
  res.json({ ok: true });
});

app.get('/api/progress', requireAuth, function (req, res) {
  const row = stmts.getProgress.get(req.user.id);
  const data = row ? JSON.parse(row.data_json) : {};
  res.json(data);
});

app.put('/api/progress', requireAuth, function (req, res) {
  const body = req.body;
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return err(res, 400, 'Body must be a JSON object.');
  }
  const json = JSON.stringify(body);
  if (Buffer.byteLength(json, 'utf8') > PROGRESS_MAX_BYTES) {
    return err(res, 413, 'Progress payload too large.');
  }
  stmts.upsertProgress.run(req.user.id, json);
  res.json({ ok: true });
});

// Fallback error handler (e.g. CORS rejection, bad JSON body).
app.use(function (error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error) {
    const status = /CORS/.test(error.message) ? 403 : 400;
    return err(res, status, error.message || 'Bad request.');
  }
  next();
});

app.listen(PORT, function () {
  console.log('Embermarch server listening on port ' + PORT);
  console.log('Allowed CORS origins: ' + ALLOWED_ORIGINS.join(', '));
  console.log('SQLite DB: ' + DB_PATH);
});
