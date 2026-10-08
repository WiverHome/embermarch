'use strict';
/**
 * Arena seasons + fight replays.
 *
 * Seasons: fixed ARENA_SEASON_DAYS windows. When one ends (checked lazily on
 * requests and once an hour), the final standings are frozen into
 * arena_season_results (with the names as they were) and every rating is
 * pulled halfway back to 1000 (W/L reset). Rank rewards are embers the player
 * claims once from the arena hub; the server credits them straight into the
 * saved progress (POST /api/arena/season/claim) so a closed tab can't lose them.
 *
 * Replays: live-pvp.js records every arena match (async bot fights and live
 * duels) as an initial state plus per-turn {logs, hp, status} steps and stores
 * it via saveReplay(). Each participant owns their copy (arena_replay_owners):
 * the per-user cap trims only that user's list, and a replay row is deleted
 * once nobody owns it.
 */
const ARENA_SEASON_DAYS = 28;
const SEASON_RATING_BASE = 1000;
const SEASON_RATING_KEEP = 0.5; // share of (rating - base) carried into the next season
const SEASON_MIN_GAMES = 3;     // fights needed to place / earn the participation reward
// ember reward by final rank; anyone else with SEASON_MIN_GAMES fights gets REWARD_PARTICIPATION
const SEASON_REWARDS = [{ maxRank: 1, embers: 100 }, { maxRank: 2, embers: 70 }, { maxRank: 3, embers: 50 }, { maxRank: 10, embers: 30 }];
const REWARD_PARTICIPATION = 10;
const REPLAYS_PER_USER = 20;
const REPLAY_MAX_BYTES = 200 * 1024;
const REPLAY_KEEP_DAYS = 30;
const DAY_MS = 86400000;

function attachSeasons(opts) {
  const { app, db, requireAuth, err, cleanText, limiter, progressMaxBytes } = opts;

  db.exec(`
    CREATE TABLE IF NOT EXISTS arena_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS arena_season_results (
      season_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT,
      champion_name TEXT,
      rank INTEGER,
      rating INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      reward INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_season_results_user ON arena_season_results(user_id, claimed);
    CREATE TABLE IF NOT EXISTS arena_replays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      hero_user_id INTEGER NOT NULL,
      enemy_user_id INTEGER NOT NULL,
      hero_name TEXT NOT NULL,
      enemy_name TEXT NOT NULL,
      result TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_replays_created ON arena_replays(created_at);
    CREATE TABLE IF NOT EXISTS arena_replay_owners (
      user_id INTEGER NOT NULL,
      replay_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, replay_id)
    );
    CREATE INDEX IF NOT EXISTS idx_replay_owners_replay ON arena_replay_owners(replay_id);
  `);

  const q = {
    current: db.prepare('SELECT * FROM arena_seasons WHERE closed = 0 ORDER BY id DESC LIMIT 1'),
    insertSeason: db.prepare('INSERT INTO arena_seasons (started_at, ends_at) VALUES (?, ?)'),
    closeSeason: db.prepare('UPDATE arena_seasons SET closed = 1 WHERE id = ?'),
    lastClosed: db.prepare('SELECT * FROM arena_seasons WHERE closed = 1 ORDER BY id DESC LIMIT 1'),
    standings: db.prepare(`
      SELECT c.user_id, c.rating, c.wins, c.losses, c.name, u.username
      FROM champions c LEFT JOIN users u ON u.id = c.user_id
      ORDER BY c.rating DESC, c.wins DESC, c.losses ASC, c.user_id ASC
    `),
    insertResult: db.prepare('INSERT OR REPLACE INTO arena_season_results (season_id, user_id, username, champion_name, rank, rating, wins, losses, reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    softReset: db.prepare('UPDATE champions SET rating = CAST(ROUND(? + (rating - ?) * ?) AS INTEGER), wins = 0, losses = 0'),
    myResult: db.prepare('SELECT * FROM arena_season_results WHERE season_id = ? AND user_id = ?'),
    top: db.prepare(`
      SELECT rank, rating, wins, losses, username, champion_name AS name
      FROM arena_season_results WHERE season_id = ? AND rank IS NOT NULL ORDER BY rank LIMIT 10
    `),
    claim: db.prepare('UPDATE arena_season_results SET claimed = 1 WHERE season_id = ? AND user_id = ? AND claimed = 0 AND reward > 0'),
    unclaimed: db.prepare('SELECT * FROM arena_season_results WHERE user_id = ? AND claimed = 0 AND reward > 0 ORDER BY season_id DESC LIMIT 1'),
    getProgress: db.prepare('SELECT data_json FROM progress WHERE user_id = ?'),
    upsertProgress: db.prepare(`
      INSERT INTO progress (user_id, data_json, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')
    `),
    insertReplay: db.prepare('INSERT INTO arena_replays (kind, hero_user_id, enemy_user_id, hero_name, enemy_name, result, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    addOwner: db.prepare('INSERT OR IGNORE INTO arena_replay_owners (user_id, replay_id) VALUES (?, ?)'),
    trimOwner: db.prepare(`
      DELETE FROM arena_replay_owners WHERE user_id = ? AND replay_id NOT IN (
        SELECT replay_id FROM arena_replay_owners WHERE user_id = ? ORDER BY replay_id DESC LIMIT ?
      )
    `),
    dropOwnerless: db.prepare('DELETE FROM arena_replays WHERE id NOT IN (SELECT replay_id FROM arena_replay_owners)'),
    purgeOldOwners: db.prepare('DELETE FROM arena_replay_owners WHERE replay_id IN (SELECT id FROM arena_replays WHERE created_at < ?)'),
    purgeOldReplays: db.prepare('DELETE FROM arena_replays WHERE created_at < ?'),
    listReplays: db.prepare(`
      SELECT r.id, r.kind, r.hero_user_id, r.enemy_user_id, r.hero_name, r.enemy_name, r.result, r.created_at,
             hu.username AS hero_username, eu.username AS enemy_username
      FROM arena_replay_owners o JOIN arena_replays r ON r.id = o.replay_id
      LEFT JOIN users hu ON hu.id = r.hero_user_id LEFT JOIN users eu ON eu.id = r.enemy_user_id
      WHERE o.user_id = ? ORDER BY r.id DESC LIMIT ?
    `),
    getOwnedReplay: db.prepare('SELECT r.* FROM arena_replay_owners o JOIN arena_replays r ON r.id = o.replay_id WHERE o.user_id = ? AND o.replay_id = ?'),
  };

  function rewardForRank(rank, games) {
    if (games < SEASON_MIN_GAMES) return 0;
    for (let i = 0; i < SEASON_REWARDS.length; i++) if (rank <= SEASON_REWARDS[i].maxRank) return SEASON_REWARDS[i].embers;
    return REWARD_PARTICIPATION;
  }

  // Closes the season once its end has passed and opens the next one. After
  // downtime longer than a season the next one starts "now" instead of at the
  // old boundary, so an outage closes only the season that had fights in it
  // (no extra empty seasons and no repeated soft resets).
  function rollSeasons(now) {
    now = now || Date.now();
    db.transaction(function () {
      const cur = q.current.get();
      if (cur && cur.ends_at <= now) {
        let rank = 0;
        q.standings.all().forEach(function (row) {
          const games = row.wins + row.losses;
          const placed = games >= SEASON_MIN_GAMES;
          if (placed) rank++;
          q.insertResult.run(cur.id, row.user_id, row.username || null, cleanText(row.name || '', 24),
            placed ? rank : null, row.rating, row.wins, row.losses, placed ? rewardForRank(rank, games) : 0);
        });
        q.softReset.run(SEASON_RATING_BASE, SEASON_RATING_BASE, SEASON_RATING_KEEP);
        q.closeSeason.run(cur.id);
        const start = now - cur.ends_at < DAY_MS ? cur.ends_at : now;
        q.insertSeason.run(start, start + ARENA_SEASON_DAYS * DAY_MS);
      } else if (!cur) {
        q.insertSeason.run(now, now + ARENA_SEASON_DAYS * DAY_MS);
      }
    })();
  }
  function purgeOldReplays() {
    const cutoff = Date.now() - REPLAY_KEEP_DAYS * DAY_MS;
    db.transaction(function () { q.purgeOldOwners.run(cutoff); q.purgeOldReplays.run(cutoff); })();
  }
  rollSeasons();
  purgeOldReplays();
  setInterval(function () {
    try { rollSeasons(); purgeOldReplays(); } catch (e) { console.error('season roll failed: ' + e.message); }
  }, 60 * 60 * 1000).unref();

  const guard = limiter ? [requireAuth, limiter] : [requireAuth];

  app.get('/api/arena/season', guard, function (req, res) {
    rollSeasons(); // cheap when nothing is due: one indexed read inside a transaction
    const cur = q.current.get();
    const last = q.lastClosed.get();
    const mine = last ? q.myResult.get(last.id, req.user.id) : null;
    const pending = q.unclaimed.get(req.user.id);
    res.json({
      current: { id: cur.id, startedAt: cur.started_at, endsAt: cur.ends_at },
      last: last ? {
        id: last.id,
        top: q.top.all(last.id),
        mine: mine ? { rank: mine.rank, rating: mine.rating, wins: mine.wins, losses: mine.losses, reward: mine.reward, claimed: !!mine.claimed } : null,
      } : null,
      pendingReward: pending ? { seasonId: pending.season_id, rank: pending.rank, reward: pending.reward } : null,
      rewards: { table: SEASON_REWARDS, participation: REWARD_PARTICIPATION, minGames: SEASON_MIN_GAMES },
    });
  });

  // Marks the reward claimed AND adds the embers to the saved progress in one
  // transaction, bumping _adminRev so any other open tab reloads rather than
  // overwriting it. Returns the new progress for this tab to apply.
  app.post('/api/arena/season/claim', guard, function (req, res) {
    const seasonId = parseInt(req.body && req.body.seasonId, 10);
    const row = Number.isInteger(seasonId) ? q.myResult.get(seasonId, req.user.id) : null;
    if (!row || row.reward <= 0) return err(res, 404, 'No reward for that season.');
    let progress = null;
    const ok = db.transaction(function () {
      if (!q.claim.run(seasonId, req.user.id).changes) return false;
      const stored = q.getProgress.get(req.user.id);
      let p = {};
      try { p = stored ? JSON.parse(stored.data_json) || {} : {}; } catch (e) { p = {}; }
      p.embers = (Number(p.embers) || 0) + row.reward;
      p._adminRev = Math.min(Number(p._adminRev) || 0, 1e9) + 1;
      const json = JSON.stringify(p);
      if (Buffer.byteLength(json, 'utf8') > progressMaxBytes) throw new Error('progress too large');
      q.upsertProgress.run(req.user.id, json);
      progress = p;
      return true;
    })();
    if (!ok) return err(res, 409, 'Reward already claimed.');
    res.json({ reward: row.reward, progress: progress });
  });

  function saveReplay(r) {
    try {
      const json = JSON.stringify(r.data);
      if (Buffer.byteLength(json, 'utf8') > REPLAY_MAX_BYTES) return;
      db.transaction(function () {
        const id = q.insertReplay.run(r.kind, r.heroUserId, r.enemyUserId, String(r.heroName || '').slice(0, 24), String(r.enemyName || '').slice(0, 24), r.result, json, Date.now()).lastInsertRowid;
        [r.heroUserId, r.enemyUserId].forEach(function (uid) {
          q.addOwner.run(uid, id);
          q.trimOwner.run(uid, uid, REPLAYS_PER_USER);
        });
        q.dropOwnerless.run();
      })();
    } catch (e) { console.error('saveReplay failed: ' + e.message); }
  }

  app.get('/api/arena/replays', guard, function (req, res) {
    res.json(q.listReplays.all(req.user.id, REPLAYS_PER_USER).map(function (r) {
      const mine = r.hero_user_id === req.user.id ? 'hero' : 'enemy';
      return {
        id: r.id, kind: r.kind, side: mine, createdAt: r.created_at,
        result: r.result === 'draw' ? 'draw' : ((r.result === 'hero') === (mine === 'hero') ? 'win' : 'loss'),
        opponent: { username: mine === 'hero' ? r.enemy_username : r.hero_username, name: cleanText(mine === 'hero' ? r.enemy_name : r.hero_name, 24) },
      };
    }));
  });

  app.get('/api/arena/replays/:id', guard, function (req, res) {
    // Only an owner (a participant who still has it in their list) may watch.
    const r = q.getOwnedReplay.get(req.user.id, parseInt(req.params.id, 10));
    if (!r) return err(res, 404, 'Replay not found.');
    res.json({ id: r.id, kind: r.kind, side: r.hero_user_id === req.user.id ? 'hero' : 'enemy', result: r.result, createdAt: r.created_at, data: JSON.parse(r.data_json) });
  });

  return { saveReplay: saveReplay, rollSeasons: rollSeasons };
}

module.exports = { attachSeasons: attachSeasons, ARENA_SEASON_DAYS: ARENA_SEASON_DAYS };
