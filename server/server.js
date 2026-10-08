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
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const { attachLivePvp } = require('./live-pvp');
const { buildChampionSquad, rebuildStoredSquad, cleanText } = require('./champion');
const { attachAdmin } = require('./admin');
const { attachProgressGuard } = require('./progress-guard');
const { attachSeasons } = require('./seasons');
const { attachStatic, CLIENT_DIR } = require('./static');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'embermarch.sqlite');
// Extra origins allowed to call the API; the game's own origin is always allowed (see below).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

// The one account allowed into the admin panel (admin.html / server/admin.js), by user id.
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID, 10) || null;

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
  -- Arena: one persistent "champion" (a saved 1-3 hero squad snapshot) per player,
  -- used for asynchronous PvP — other players fight a snapshot of it, never the
  -- player's live client, so no real-time connection or matchmaking is needed.
  CREATE TABLE IF NOT EXISTS champions (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_json TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Single-use battle tokens (one per issued matchup) so a client can't report a
  -- result for a matchup it never actually fetched, or report the same fetched
  -- matchup twice. Rows are deleted once consumed; expires_at also bounds them.
  CREATE TABLE IF NOT EXISTS arena_tokens (
    jti TEXT PRIMARY KEY,
    atk_user_id INTEGER NOT NULL,
    def_user_id INTEGER NOT NULL,
    atk_rating INTEGER NOT NULL,
    def_rating INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Additive migrations for databases created before these columns existed.
// banned: admin ban flag. token_version: bumped to revoke every issued session
// (ban, admin password reset, force logout); tokens carry it as "tv".
(function migrateUsers() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(function (c) { return c.name; });
  if (cols.indexOf('banned') === -1) db.exec('ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0');
  if (cols.indexOf('token_version') === -1) db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
})();

const stmts = {
  findUserByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  updateUsername: db.prepare('UPDATE users SET username = ? WHERE id = ?'),
  updatePasswordHash: db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?'),
  getProgress: db.prepare('SELECT data_json FROM progress WHERE user_id = ?'),
  upsertProgress: db.prepare(`
    INSERT INTO progress (user_id, data_json, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')
  `),
  getChampion: db.prepare('SELECT * FROM champions WHERE user_id = ?'),
  upsertChampion: db.prepare(`
    INSERT INTO champions (user_id, name, data_json, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json, updated_at = datetime('now')
  `),
  setRatingStats: db.prepare('UPDATE champions SET rating = ?, wins = ?, losses = ? WHERE user_id = ?'),
  randomOpponents: db.prepare(`
    SELECT c.user_id AS user_id, u.username AS username, c.name AS name, c.data_json AS data_json, c.rating AS rating
    FROM champions c JOIN users u ON u.id = c.user_id
    WHERE c.user_id != ?
    ORDER BY RANDOM() LIMIT 5
  `),
  leaderboard: db.prepare(`
    SELECT u.username AS username, c.name AS name, c.rating AS rating, c.wins AS wins, c.losses AS losses
    FROM champions c JOIN users u ON u.id = c.user_id
    ORDER BY c.rating DESC, c.wins DESC LIMIT ?
  `),
  insertToken: db.prepare(`
    INSERT INTO arena_tokens (jti, atk_user_id, def_user_id, atk_rating, def_rating, expires_at) VALUES (?, ?, ?, ?, ?, ?)
  `),
  consumeToken: db.prepare('DELETE FROM arena_tokens WHERE jti = ? AND expires_at > ? RETURNING *'),
  purgeExpiredTokens: db.prepare('DELETE FROM arena_tokens WHERE expires_at <= ?'),
  openTokenFor: db.prepare('SELECT * FROM arena_tokens WHERE atk_user_id = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1'),
  deleteToken: db.prepare('DELETE FROM arena_tokens WHERE jti = ?'),
  getChampionWithUser: db.prepare(`
    SELECT c.user_id AS user_id, u.username AS username, c.name AS name, c.data_json AS data_json, c.rating AS rating
    FROM champions c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?
  `),
};

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
// Behind nginx (see embermarch-nginx.conf): take the client IP from the one
// X-Forwarded-For hop nginx adds, otherwise every rate limiter sees 127.0.0.1
// and all players share a single bucket.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS, 10) >= 0 ? parseInt(process.env.TRUST_PROXY_HOPS, 10) : 1);
app.use(express.json({ limit: '600kb' }));

app.use(cors(function (req, cb) {
  const origin = req.headers.origin;
  // Same-origin / non-browser requests (curl, health checks) send no Origin header — allow.
  if (!origin) return cb(null, { origin: true });
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return cb(null, { origin: true });
  // The server's own pages (the admin panel at /admin) are always allowed.
  let own = false;
  try { own = new URL(origin).host === req.get('host'); } catch (e) { own = false; }
  if (own) return cb(null, { origin: true });
  return cb(new Error('CORS: origin not allowed'));
}));

const USERNAME_RE = /^[a-zA-Z0-9_\-]{3,32}$/;
const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72; // bcrypt's own input limit
const PROGRESS_MAX_BYTES = 512 * 1024;

// ---------- Arena (async PvP) ----------
const CHAMPION_NAME_MAX_LEN = 24;
const CHAMPION_MAX_BYTES = 32 * 1024;
const CHAMPION_MAX_HEROES = 3;
const ARENA_TOKEN_TTL_MS = 10 * 60 * 1000; // battle token must be redeemed within 10 minutes

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
  return jwt.sign({ sub: user.id, username: user.username, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(hdr);
  if (!m) return err(res, 401, 'Missing or malformed Authorization header.');
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    // Only plain game tokens: arena battle tokens and admin panel tokens carry a typ.
    if (payload.typ || payload.sub == null) return err(res, 401, 'Invalid session.');
    const user = stmts.findUserById.get(payload.sub);
    if (!user) return err(res, 401, 'Invalid session.');
    if (user.banned) return err(res, 403, 'This account is banned.');
    // Tokens issued before token_version existed have no tv: they match version 0.
    if ((payload.tv || 0) !== (user.token_version || 0)) return err(res, 401, 'Session expired, please log in again.');
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
  if (user.banned) return err(res, 403, 'This account is banned.');

  const token = signToken(user);
  res.json({ token: token, username: user.username });
});

app.post('/api/logout', requireAuth, function (req, res) {
  // Tokens are stateless JWTs with a 30-day expiry; there is no server-side session to
  // revoke. The client simply forgets the token. (See README/DEPLOY notes if you want to
  // add a server-side denylist later.)
  res.json({ ok: true });
});

// ---------- Account (username / password changes) ----------
// Both require the current password as proof of intent — the JWT alone (valid for 30
// days, never revoked server-side) isn't treated as enough to change login credentials,
// the same way a stolen-but-logged-in session shouldn't be able to lock the real owner
// out. Re-uses authLimiter since these are exactly as brute-forceable as login itself.

app.put('/api/account/username', requireAuth, authLimiter, function (req, res) {
  const newUsername = (req.body && req.body.newUsername || '').trim();
  const password = (req.body && req.body.password || '');

  if (!USERNAME_RE.test(newUsername)) {
    return err(res, 400, 'Username must be 3-32 characters: letters, numbers, "_" or "-".');
  }
  const ok = bcrypt.compareSync(String(password), req.user.password_hash);
  if (!ok) return err(res, 401, 'Incorrect password.');

  if (newUsername === req.user.username) {
    const token = signToken(req.user);
    return res.json({ token: token, username: req.user.username });
  }

  const existing = stmts.findUserByName.get(newUsername);
  if (existing) return err(res, 409, 'That username is already taken.');

  stmts.updateUsername.run(newUsername, req.user.id);
  const updatedUser = { id: req.user.id, username: newUsername, token_version: req.user.token_version };
  const token = signToken(updatedUser);
  res.json({ token: token, username: newUsername });
});

app.put('/api/account/password', requireAuth, authLimiter, function (req, res) {
  const currentPassword = (req.body && req.body.currentPassword || '');
  const newPassword = (req.body && req.body.newPassword || '');

  const ok = bcrypt.compareSync(String(currentPassword), req.user.password_hash);
  if (!ok) return err(res, 401, 'Incorrect current password.');

  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN_LEN) {
    return err(res, 400, 'New password must be at least ' + PASSWORD_MIN_LEN + ' characters.');
  }
  if (newPassword.length > PASSWORD_MAX_LEN) {
    return err(res, 400, 'New password is too long.');
  }

  // Changing the password also ends every other session (token_version bump);
  // this device gets a fresh token back.
  const hash = bcrypt.hashSync(newPassword, 10);
  stmts.updatePasswordHash.run(hash, req.user.id);
  const fresh = stmts.findUserById.get(req.user.id);
  res.json({ ok: true, token: signToken(fresh), username: fresh.username });
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
  // An admin edit bumped _adminRev: a client still holding the older copy must
  // reload it (409 + fresh progress) instead of silently overwriting the edit.
  const stored = stmts.getProgress.get(req.user.id);
  let storedData = null;
  try { storedData = stored ? JSON.parse(stored.data_json) : null; } catch (e) { storedData = null; }
  const storedRev = storedData ? (Number(storedData._adminRev) || 0) : 0;
  if ((Number(body._adminRev) || 0) < storedRev) {
    return res.status(409).json({ error: 'Progress was changed by an administrator.', progress: storedData });
  }
  // The revision is server-owned: never store a client-chosen (e.g. huge) value.
  body._adminRev = storedRev;
  // Implausible gains are cut down (progress-guard.js); the client then takes the corrected copy.
  const verdict = progressGuard.check(req.user.id, storedData, body);
  stmts.upsertProgress.run(req.user.id, JSON.stringify(body));
  res.json(verdict.corrected ? { ok: true, corrected: true, progress: body } : { ok: true });
});

// Light limiter for the whole arena surface — reporting results is the one place a
// malicious client could try to grind rating by spamming requests.
const arenaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many arena requests, slow down.' },
});

function loadProgress(userId) {
  const row = stmts.getProgress.get(userId);
  if (!row) return {};
  try { return JSON.parse(row.data_json) || {}; } catch (e) { return {}; }
}

// A stored champion as it will actually fight: heroes rebuilt from the owner's
// current progress (see champion.js), never the uploaded numbers. null when
// nothing valid is left (e.g. a pre-validation row with forged heroes).
function fightingSquad(userId, dataJson) {
  try {
    return rebuildStoredSquad(loadProgress(userId), JSON.parse(dataJson), CHAMPION_MAX_HEROES);
  } catch (e) {
    console.error('fightingSquad failed for user ' + userId + ': ' + e.message);
    return null;
  }
}

function championToPublic(row, heroes) {
  return {
    username: row.username,
    name: cleanText(row.name, CHAMPION_NAME_MAX_LEN),
    heroes: heroes,
    rating: row.rating,
  };
}

function ownChampionToPublic(row) {
  return { name: cleanText(row.name, CHAMPION_NAME_MAX_LEN), heroes: fightingSquad(row.user_id, row.data_json) || [], rating: row.rating, wins: row.wins, losses: row.losses };
}

app.get('/api/arena/champion', requireAuth, function (req, res) {
  const row = stmts.getChampion.get(req.user.id);
  if (!row) return res.json(null);
  res.json(ownChampionToPublic(row));
});

app.put('/api/arena/champion', requireAuth, arenaLimiter, function (req, res) {
  const body = req.body;
  const name = cleanText(body && typeof body.name === 'string' ? body.name : '', 64);
  if (!name || name.length > CHAMPION_NAME_MAX_LEN) {
    return err(res, 400, 'Champion name must be 1-' + CHAMPION_NAME_MAX_LEN + ' characters.');
  }
  // Only hero keys (and row) are read from the request; every stat and ability
  // number is rebuilt from the server's own hero tables + saved progress.
  const built = buildChampionSquad(loadProgress(req.user.id), body && body.heroes, body && body.lang, CHAMPION_MAX_HEROES);
  if (built.error) return err(res, 400, built.error);
  const json = JSON.stringify(built.heroes);
  if (Buffer.byteLength(json, 'utf8') > CHAMPION_MAX_BYTES) {
    return err(res, 413, 'Champion payload too large.');
  }
  // Upsert leaves rating/wins/losses untouched when the row already exists (editing your
  // loadout doesn't reset your arena record) and defaults a brand-new row to 1000/0/0 via
  // the table's own column defaults.
  stmts.upsertChampion.run(req.user.id, name.slice(0, CHAMPION_NAME_MAX_LEN), json);
  const row = stmts.getChampion.get(req.user.id);
  res.json(ownChampionToPublic(row));
});

app.get('/api/arena/opponent', requireAuth, arenaLimiter, function (req, res) {
  const mine = stmts.getChampion.get(req.user.id);
  if (!mine) return err(res, 400, 'Save a champion before entering the arena.');
  stmts.purgeExpiredTokens.run(Date.now());
  // An open (unfought, unexpired) matchup is handed back as-is instead of a new
  // one, so the full-squad preview can't be rerolled until a weak opponent shows.
  const open = stmts.openTokenFor.get(req.user.id, Date.now());
  if (open) {
    const row = stmts.getChampionWithUser.get(open.def_user_id);
    const h = row && fightingSquad(row.user_id, row.data_json);
    if (h && h.length) {
      const ttl = Math.max(1, Math.floor((open.expires_at - Date.now()) / 1000));
      const tok = jwt.sign({ typ: 'arena', jti: open.jti }, JWT_SECRET, { expiresIn: ttl });
      return res.json(Object.assign(championToPublic(row, h), { battleToken: tok }));
    }
    stmts.deleteToken.run(open.jti); // defender gone or invalid: allow a fresh pick
  }
  let opp = null, oppHeroes = null;
  const candidates = stmts.randomOpponents.all(req.user.id);
  for (let i = 0; i < candidates.length && !opp; i++) {
    const h = fightingSquad(candidates[i].user_id, candidates[i].data_json);
    if (h && h.length) { opp = candidates[i]; oppHeroes = h; }
  }
  if (!opp) return err(res, 404, 'No opponents available yet.');
  const jti = crypto.randomUUID();
  const expiresAt = Date.now() + ARENA_TOKEN_TTL_MS;
  stmts.insertToken.run(jti, req.user.id, opp.user_id, mine.rating, opp.rating, expiresAt);
  const battleToken = jwt.sign({ typ: 'arena', jti: jti }, JWT_SECRET, { expiresIn: Math.floor(ARENA_TOKEN_TTL_MS / 1000) });
  res.json(Object.assign(championToPublic(opp, oppHeroes), { battleToken: battleToken }));
});

// The client used to post its own "win"/"loss" here and the server trusted it.
// Async arena fights now run on the server (live-pvp.js, 'arena_bot_start' over
// the arena WebSocket, defender piloted by a server bot), which settles rating.
app.post('/api/arena/report', requireAuth, function (req, res) {
  return err(res, 410, 'Arena results are now decided by the server. Please reload the game.');
});

app.get('/api/arena/leaderboard', requireAuth, function (req, res) {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const rows = stmts.leaderboard.all(limit).map(function (r) {
    return Object.assign({}, r, { name: cleanText(r.name, CHAMPION_NAME_MAX_LEN) });
  });
  res.json(rows);
});

const progressGuard = attachProgressGuard({ db: db });

// ---------- Admin panel ----------
// An ADMIN_USER_ID that doesn't exist yet would hand admin to whoever registers
// as that id later (AUTOINCREMENT), so it only counts if the account exists now.
let adminUserId = ADMIN_USER_ID;
if (adminUserId && !stmts.findUserById.get(adminUserId)) {
  console.error('ADMIN_USER_ID=' + adminUserId + ' matches no existing account: admin panel disabled.');
  adminUserId = null;
}
// ---------- Arena seasons + replays ----------
const seasons = attachSeasons({
  app: app, db: db, requireAuth: requireAuth, err: err, cleanText: cleanText,
  limiter: arenaLimiter, progressMaxBytes: PROGRESS_MAX_BYTES,
});

// liveHooks is filled in once the WebSocket server exists (kick / isOnline / stats).
const liveHooks = {};
attachAdmin({
  app: app, db: db, requireAuth: requireAuth, err: err, adminUserId: adminUserId, jwtSecret: JWT_SECRET,
  usernameRe: USERNAME_RE, passwordMinLen: PASSWORD_MIN_LEN, passwordMaxLen: PASSWORD_MAX_LEN,
  progressMaxBytes: PROGRESS_MAX_BYTES, live: liveHooks, progressGuard: progressGuard,
});

// The game client itself (index.html, js/, audio/ ...): see static.js.
attachStatic(app);

// Fallback error handler (e.g. CORS rejection, bad JSON body).
app.use(function (error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error) {
    const status = /CORS/.test(error.message) ? 403 : 400;
    return err(res, status, error.message || 'Bad request.');
  }
  next();
});

// ---------- Live real-time PvP (WebSocket) ----------
// Mounted on the same HTTP server/port as the REST API (ws:// upgrade at
// /api/arena/live) rather than a second port, so nginx only has to proxy one
// port for everything. See live-pvp.js for the protocol and match logic; the
// server is always the authority over combat outcomes.
const httpServer = http.createServer(app);
const livePvp = attachLivePvp({
  server: httpServer,
  jwt: jwt,
  JWT_SECRET: JWT_SECRET,
  stmts: stmts,
  findUserById: function (id) { return stmts.findUserById.get(id); },
  fightingSquad: fightingSquad,
  championMaxHeroes: CHAMPION_MAX_HEROES,
  saveReplay: seasons.saveReplay,
});
Object.assign(liveHooks, { kick: livePvp.kick, isOnline: livePvp.isOnline, stats: livePvp.stats });

httpServer.listen(PORT, function () {
  console.log('Embermarch server listening on port ' + PORT);
  console.log('Allowed CORS origins: ' + ALLOWED_ORIGINS.join(', '));
  console.log('SQLite DB: ' + DB_PATH);
  console.log('Game client: ' + CLIENT_DIR);
  console.log('Live PvP WebSocket: /api/arena/live');
  console.log('Admin panel: ' + (adminUserId ? 'enabled for user id ' + adminUserId : 'disabled'));
});
