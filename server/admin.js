'use strict';
/**
 * Admin panel: the page itself (GET /admin, file public/admin.html) and its
 * API (/api/admin/*). The page lives on the server's own domain, not on GitHub
 * Pages, so its session never shares localStorage with anything else.
 *
 * Exactly one account is the admin: the user whose numeric id equals
 * ADMIN_USER_ID in .env (an id rather than a username, because usernames can
 * be changed and a freed name could be re-registered by someone else). With
 * ADMIN_USER_ID unset every /api/admin route answers 404.
 *
 * The panel has its own login (POST /api/admin/login) issuing a short-lived
 * token with typ 'admin'. Only such tokens open /api/admin/*: a stolen game
 * token (30 days, kept by the game in the browser) is not enough, and admin
 * tokens are refused everywhere else (requireAuth in server.js).
 *
 * Every write is recorded in admin_log. Progress edits bump progress._adminRev,
 * so a game client still holding the old copy can't overwrite them (see
 * PUT /api/progress in server.js, which answers 409 for a stale revision).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const DEFS = require('./hero-defs.json');

const LIST_MAX = 100;
const LOG_KEEP_DAYS = 365;
const ADMIN_TOKEN_TTL = '8h';
const DUMMY_HASH = bcrypt.hashSync('embermarch-no-such-user', 10);
const PAGE_FILE = path.join(__dirname, 'public', 'admin.html');

// CSP for the panel: its inline scripts are allowed by hash only, requests go
// to this origin only, and nobody may frame it.
function pageHeaders(html) {
  const hashes = [];
  html.replace(/<script>([\s\S]*?)<\/script>/g, function (m, body) {
    hashes.push("'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'");
    return m;
  });
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src " + hashes.join(' ') + "; style-src 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex',
  };
}

function attachAdmin(opts) {
  const { app, db, requireAuth, err, adminUserId, jwtSecret, usernameRe, passwordMinLen, passwordMaxLen, progressMaxBytes, live, progressGuard } = opts;

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      target_user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.prepare("DELETE FROM admin_log WHERE created_at < datetime('now', ?)").run('-' + LOG_KEEP_DAYS + ' days');

  const q = {
    countUsers: db.prepare("SELECT COUNT(*) AS n FROM users WHERE username LIKE ? ESCAPE '\\'"),
    listUsers: db.prepare(`
      SELECT u.id, u.username, u.created_at, u.banned, p.updated_at AS progress_updated_at, p.data_json AS progress_json,
             c.name AS champion_name, c.rating, c.wins AS arena_wins, c.losses AS arena_losses
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      LEFT JOIN champions c ON c.user_id = u.id
      WHERE u.username LIKE ? ESCAPE '\\'
      ORDER BY u.id DESC LIMIT ? OFFSET ?
    `),
    user: db.prepare('SELECT id, username, created_at, banned, token_version FROM users WHERE id = ?'),
    authUser: db.prepare('SELECT * FROM users WHERE username = ?'),
    userByName: db.prepare('SELECT id FROM users WHERE username = ?'),
    progress: db.prepare('SELECT data_json, updated_at FROM progress WHERE user_id = ?'),
    upsertProgress: db.prepare(`
      INSERT INTO progress (user_id, data_json, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')
    `),
    champion: db.prepare('SELECT name, rating, wins, losses, updated_at FROM champions WHERE user_id = ?'),
    deleteChampion: db.prepare('DELETE FROM champions WHERE user_id = ?'),
    resetRating: db.prepare('UPDATE champions SET rating = 1000, wins = 0, losses = 0 WHERE user_id = ?'),
    rename: db.prepare('UPDATE users SET username = ?, token_version = token_version + 1 WHERE id = ?'),
    setPassword: db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?'),
    setBanned: db.prepare('UPDATE users SET banned = ?, token_version = token_version + 1 WHERE id = ?'),
    bumpTokens: db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?'),
    deleteProgressRow: db.prepare('DELETE FROM progress WHERE user_id = ?'),
    deleteTokens: db.prepare('DELETE FROM arena_tokens WHERE atk_user_id = ? OR def_user_id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    // arena_replays / arena_season_results are created by seasons.js, attached before this module
    deleteReplayOwners: db.prepare('DELETE FROM arena_replay_owners WHERE user_id = ?'),
    deleteOwnerlessReplays: db.prepare('DELETE FROM arena_replays WHERE id NOT IN (SELECT replay_id FROM arena_replay_owners)'),
    deleteSeasonResults: db.prepare('DELETE FROM arena_season_results WHERE user_id = ?'),
    log: db.prepare('INSERT INTO admin_log (admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?)'),
    readLog: db.prepare(`
      SELECT l.id, l.target_user_id, u.username AS target_username, l.action, l.details, l.created_at
      FROM admin_log l LEFT JOIN users u ON u.id = l.target_user_id
      ORDER BY l.id DESC LIMIT ?
    `),
    totals: db.prepare(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE banned = 1) AS banned,
      (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')) AS new7d,
      (SELECT COUNT(*) FROM progress WHERE updated_at >= datetime('now', '-1 day')) AS active24h,
      (SELECT COUNT(*) FROM progress WHERE updated_at >= datetime('now', '-7 days')) AS active7d,
      (SELECT COUNT(*) FROM champions) AS champions`),
  };

  const adminLimiter = rateLimit({
    windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many admin requests, slow down.' },
  });

  // Admin login: wrong password, unknown user and "not the admin" all get the same answer.
  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later.' },
  });

  // The panel only talks to its own origin: a browser request carrying any
  // other Origin (e.g. a page on GitHub Pages) is turned away.
  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.get('host'); } catch (e) { return false; }
  }

  // Only typ 'admin' tokens of the ADMIN_USER_ID account; 404 for everything else
  // so the panel's existence isn't advertised.
  function requireAdmin(req, res, next) {
    if (!adminUserId || !sameOrigin(req)) return err(res, 404, 'Not found.');
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    let payload = null;
    try { payload = m ? jwt.verify(m[1], jwtSecret) : null; } catch (e) { payload = null; }
    if (!payload || payload.typ !== 'admin' || payload.sub !== adminUserId) return err(res, 404, 'Not found.');
    const user = q.user.get(adminUserId);
    if (!user || user.banned || (payload.tv || 0) !== (user.token_version || 0)) {
      return err(res, 401, 'Session expired, please log in again.');
    }
    req.user = user;
    next();
  }
  const guard = [requireAdmin, adminLimiter];

  app.get('/admin', function (req, res) {
    if (!adminUserId) return res.status(404).type('text').send('Not found.');
    let html;
    try { html = fs.readFileSync(PAGE_FILE, 'utf8'); } catch (e) { return res.status(404).type('text').send('Not found.'); }
    res.set(pageHeaders(html)).send(html);
  });

  app.post('/api/admin/login', adminLoginLimiter, function (req, res) {
    if (!adminUserId || !sameOrigin(req)) return err(res, 404, 'Not found.');
    const username = String(req.body && req.body.username || '').trim();
    const password = String(req.body && req.body.password || '');
    const user = username && password.length <= passwordMaxLen ? q.authUser.get(username) : null;
    // Same bcrypt work whether or not the name exists: timing doesn't reveal accounts.
    const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH) && !!user;
    if (!ok || user.id !== adminUserId || user.banned) return err(res, 401, 'Invalid username or password.');
    const token = jwt.sign({ sub: user.id, typ: 'admin', tv: user.token_version || 0 }, jwtSecret, { expiresIn: ADMIN_TOKEN_TTL });
    res.json({ token: token });
  });

  function audit(req, targetId, action, details) {
    q.log.run(req.user.id, targetId == null ? null : targetId, action, details == null ? null : JSON.stringify(details).slice(0, 2000));
  }
  function targetUser(req, res) {
    const id = parseInt(req.params.id, 10);
    const u = Number.isInteger(id) ? q.user.get(id) : null;
    if (!u) { err(res, 404, 'User not found.'); return null; }
    return u;
  }
  function parseProgress(row) {
    if (!row) return {};
    try { const p = JSON.parse(row.data_json); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch (e) { return {}; }
  }
  // Writes progress with a bumped _adminRev, so the player's open game reloads
  // instead of overwriting the admin's edit on its next sync.
  function writeProgress(userId, data) {
    const old = parseProgress(q.progress.get(userId));
    const next = Object.assign({}, data, { _adminRev: Math.min(Number(old._adminRev) || 0, 1e9) + 1 });
    const json = JSON.stringify(next);
    if (Buffer.byteLength(json, 'utf8') > progressMaxBytes) return null;
    q.upsertProgress.run(userId, json);
    if (progressGuard) progressGuard.rebase(userId);
    return next;
  }
  function summary(p) {
    const up = p.upgrades && typeof p.upgrades === 'object' ? p.upgrades : {};
    return {
      embers: Number(p.embers) || 0, wins: Number(p.wins) || 0, bestLayer: Number(p.bestLayer) || 0,
      ascensionUnlocked: Number(p.ascensionUnlocked) || 0,
      upgradeRanks: Object.keys(up).reduce(function (s, k) { return s + (Number(up[k]) || 0); }, 0),
      runs: p.stats && Number(p.stats.runs) || (Array.isArray(p.history) ? p.history.length : 0),
    };
  }
  function nonNegInt(v, max) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  }
  // Optimistic lock: the panel sends the progress updated_at it loaded; if the
  // player saved since, the edit is refused instead of rolling their game back.
  function staleEdit(req, res, userId) {
    const base = req.body && req.body.baseUpdatedAt;
    if (base === undefined) return false;
    const row = q.progress.get(userId);
    const now = row ? row.updated_at : null;
    if (now !== base) { res.status(409).json({ error: 'The player saved new progress after you opened it. Reload and try again.' }); return true; }
    return false;
  }
  function selfGuard(req, res, u, what) {
    if (u.id === req.user.id) { err(res, 400, 'You cannot ' + what + ' your own admin account here.'); return true; }
    return false;
  }

  // /admin/me is asked by the game (game token) on every login only to show
  // the "Admin panel" link; it opens nothing by itself.
  app.get('/api/admin/me', requireAuth, function (req, res) {
    res.json({ admin: !!adminUserId && req.user.id === adminUserId });
  });

  // Reference tables for the panel's editors (exported from index.html).
  app.get('/api/admin/session', guard, function (req, res) {
    res.json({
      admin: true, id: req.user.id, username: req.user.username,
      upgradeMax: DEFS.upgradeMax,
      heroes: Object.keys(DEFS.heroes).map(function (k) { return { key: k, name: DEFS.heroes[k].name, starter: !DEFS.heroes[k].cost }; }),
    });
  });

  app.get('/api/admin/stats', guard, function (req, res) {
    res.json(Object.assign(q.totals.get(), { live: live && live.stats ? live.stats() : null }));
  });

  app.get('/api/admin/users', guard, function (req, res) {
    // LIKE wildcards in the query are matched literally (usernames often contain "_").
    const search = String(req.query.q || '').slice(0, 32).replace(/[%_\\]/g, function (c) { return '\\' + c; });
    const like = '%' + search + '%';
    const limit = Math.min(LIST_MAX, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const rows = q.listUsers.all(like, limit, offset).map(function (r) {
      const p = parseProgress(r.progress_json ? { data_json: r.progress_json } : null);
      return {
        id: r.id, username: r.username, created_at: r.created_at, banned: !!r.banned,
        progress_updated_at: r.progress_updated_at, summary: summary(p),
        champion: r.champion_name ? { name: r.champion_name, rating: r.rating, wins: r.arena_wins, losses: r.arena_losses } : null,
        isAdmin: r.id === adminUserId,
      };
    });
    res.json({ total: q.countUsers.get(like).n, users: rows });
  });

  app.get('/api/admin/users/:id', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const row = q.progress.get(u.id);
    const p = parseProgress(row);
    res.json({
      user: { id: u.id, username: u.username, created_at: u.created_at, banned: !!u.banned, isAdmin: u.id === adminUserId },
      progress: p, progress_updated_at: row ? row.updated_at : null, summary: summary(p),
      champion: q.champion.get(u.id) || null,
      online: !!(live && live.isOnline && live.isOnline(u.id)),
      guard: progressGuard ? progressGuard.info(u.id) : null,
    });
  });

  // Quick edits of the common fields; everything else via the raw JSON editor below.
  app.patch('/api/admin/users/:id/progress', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const b = req.body || {};
    if (staleEdit(req, res, u.id)) return;
    const p = parseProgress(q.progress.get(u.id));
    const changes = {};
    [['embers', 1e7], ['wins', 1e6], ['bestLayer', 1000], ['ascensionUnlocked', 5]].forEach(function (f) {
      if (b[f[0]] === undefined) return;
      const v = nonNegInt(b[f[0]], f[1]);
      if (v === null) return;
      p[f[0]] = v; changes[f[0]] = v;
    });
    ['upgrades', 'heroesUnlocked'].forEach(function (k) {
      if (!b[k] || typeof b[k] !== 'object' || Array.isArray(b[k])) return;
      p[k] = Object.assign({}, p[k] && typeof p[k] === 'object' ? p[k] : {});
      // Only known keys; upgrade ranks clamp to that upgrade's real max.
      const known = k === 'upgrades' ? DEFS.upgradeMax : DEFS.heroes;
      Object.keys(b[k]).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(known, key)) return;
        const v = b[k][key];
        if (k === 'heroesUnlocked') p[k][key] = v === true;
        else p[k][key] = Math.min(DEFS.upgradeMax[key], Math.max(0, Math.floor(Number(v)) || 0));
      });
      changes[k] = b[k];
    });
    if (!Object.keys(changes).length) return err(res, 400, 'Nothing to change.');
    const saved = writeProgress(u.id, p);
    if (!saved) return err(res, 413, 'Progress payload too large.');
    audit(req, u.id, 'progress_edit', changes);
    res.json({ progress: saved, summary: summary(saved) });
  });

  app.put('/api/admin/users/:id/progress', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const p = req.body && req.body.progress;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return err(res, 400, 'progress must be a JSON object.');
    if (staleEdit(req, res, u.id)) return;
    const saved = writeProgress(u.id, p);
    if (!saved) return err(res, 413, 'Progress payload too large.');
    audit(req, u.id, 'progress_replace', { bytes: JSON.stringify(p).length });
    res.json({ progress: saved, summary: summary(saved) });
  });

  app.post('/api/admin/users/:id/progress/reset', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const before = summary(parseProgress(q.progress.get(u.id)));
    const saved = writeProgress(u.id, {});
    if (progressGuard) progressGuard.remove(u.id); // achievements earned again pay again
    audit(req, u.id, 'progress_reset', { before: before });
    res.json({ progress: saved, summary: summary(saved) });
  });

  app.put('/api/admin/users/:id/username', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const name = String(req.body && req.body.username || '').trim();
    if (!usernameRe.test(name)) return err(res, 400, 'Username must be 3-32 characters: letters, numbers, "_" or "-".');
    const taken = q.userByName.get(name);
    if (taken && taken.id !== u.id) return err(res, 409, 'That username is already taken.');
    q.rename.run(name, u.id);
    if (live && live.kick) live.kick(u.id);
    audit(req, u.id, 'rename', { from: u.username, to: name });
    res.json({ ok: true, username: name });
  });

  app.post('/api/admin/users/:id/password', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const pw = req.body && req.body.password;
    if (typeof pw !== 'string' || pw.length < passwordMinLen || pw.length > passwordMaxLen) {
      return err(res, 400, 'Password must be ' + passwordMinLen + '-' + passwordMaxLen + ' characters.');
    }
    q.setPassword.run(bcrypt.hashSync(pw, 10), u.id);
    if (live && live.kick) live.kick(u.id);
    audit(req, u.id, 'password_reset', null); // never log the password itself
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/ban', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    const banned = !!(req.body && req.body.banned);
    if (banned && selfGuard(req, res, u, 'ban')) return;
    q.setBanned.run(banned ? 1 : 0, u.id);
    if (banned && live && live.kick) live.kick(u.id);
    audit(req, u.id, banned ? 'ban' : 'unban', null);
    res.json({ ok: true, banned: banned });
  });

  app.post('/api/admin/users/:id/logout', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    q.bumpTokens.run(u.id);
    if (live && live.kick) live.kick(u.id);
    audit(req, u.id, 'force_logout', null);
    res.json({ ok: true });
  });

  app.delete('/api/admin/users/:id/champion', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    q.deleteChampion.run(u.id);
    audit(req, u.id, 'champion_delete', null);
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/champion/reset-rating', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    q.resetRating.run(u.id);
    audit(req, u.id, 'rating_reset', null);
    res.json({ ok: true });
  });

  app.delete('/api/admin/users/:id', guard, function (req, res) {
    const u = targetUser(req, res); if (!u) return;
    if (selfGuard(req, res, u, 'delete')) return;
    if (!req.body || req.body.confirmUsername !== u.username) return err(res, 400, 'Type the exact username to confirm deletion.');
    if (live && live.kick) live.kick(u.id);
    // Explicit deletes: SQLite only cascades with PRAGMA foreign_keys=ON, which isn't set.
    // The audit row goes in the same transaction, so a logged delete is a real delete.
    db.transaction(function () {
      q.deleteTokens.run(u.id, u.id);
      q.deleteReplayOwners.run(u.id);
      q.deleteOwnerlessReplays.run();
      q.deleteSeasonResults.run(u.id);
      if (progressGuard) progressGuard.remove(u.id);
      q.deleteChampion.run(u.id);
      q.deleteProgressRow.run(u.id);
      q.deleteUser.run(u.id);
      audit(req, u.id, 'user_delete', { username: u.username });
    })();
    res.json({ ok: true });
  });

  app.get('/api/admin/log', guard, function (req, res) {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json(q.readLog.all(limit));
  });
}

module.exports = { attachAdmin: attachAdmin };
