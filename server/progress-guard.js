'use strict';
/**
 * Plausibility check for PUT /api/progress.
 *
 * Marches are played on the client, so the server can't verify a single run.
 * What it can bound is how fast an account gets richer. "Wealth" is embers in
 * hand plus the ember price of every upgrade rank bought (hero-defs.json,
 * exported from UPGRADE_DEFS); heroes are unlocked by achievements, not embers.
 *
 * Every account has an ember budget (token bucket): it refills at
 * EMBER_RATE_PER_MIN up to EMBER_BUDGET_CAP, and each save spends the wealth
 * it gained. Achievement rewards are credited on top, once per achievement id
 * per account (remembered here, so dropping and re-adding one pays nothing).
 * A save gaining more than the budget is corrected (embers cut, and if that is
 * not enough the upgrade purchases of that save are undone), stored corrected,
 * counted in progress_guard.flags and shown in the admin panel.
 *
 * Gains are measured from the highest wealth already accepted (peak), so a
 * stale copy saved from a second device doesn't make the next save from the
 * first one pay again for what it already paid. Admin edits reset the peak.
 *
 * Also: upgrade ranks within their caps, a newly unlocked achievement-locked
 * hero only with that achievement, Ascension at most one step per new win,
 * wins no faster than one march per MIN_WIN_MS, and a new achievement only
 * with evidence from a march recorded in the same save (ACH_RULES).
 *
 * Progress already stored when this shipped is the baseline and is not
 * re-checked. Seasons and admin edits write the stored copy directly, so they
 * never count as gains here.
 */
const DEFS = require('./hero-defs.json');

// Sustained ceiling, generous for a fast player: an Ascension 5 win pays ~70
// embers, Endless pays 3 per fight.
const EMBER_RATE_PER_MIN = 6;
// Lets several marches finished offline (or a long Endless run) sync at once.
const EMBER_BUDGET_CAP = 300;
// First upload into a fresh account (a guest's offline progress moving in on
// registration, see onAuthSubmit): only what the marches in its history (the
// client keeps the last 15) could have paid, plus this reserve; achievement
// rewards are credited on top as usual, each needing its own march evidence.
const NEW_ACCOUNT_EXTRA = 150;
const START_HISTORY_MAX = 15;
// Most one march can pay (js/render.js computeEmbers + js/util.js challenge
// bonuses): a win pays 15 + 2 per cleared step + 3 per Ascension level, a
// defeat at most 6 steps + 1.5 per level + 3 per Endless depth.
const TOTAL_STEPS = 20;
const ENDLESS_DEPTH_MAX = 200;
const DAILY_BONUS = { win: 10, loss: 5 };
const WEEKLY_BONUS = { win: 25, loss: 8 };
const EMBERS_MAX = 10000000;
const ASCENSION_MAX = 5;

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function intIn(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.floor(num(v)))); }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

function cleanUpgrades(src) {
  const s = obj(src);
  const out = {};
  Object.keys(DEFS.upgradeMax).forEach(function (k) { out[k] = intIn(s[k], 0, DEFS.upgradeMax[k]); });
  return out;
}
function upgradesCost(up) {
  let t = 0;
  Object.keys(DEFS.upgradeCost).forEach(function (k) {
    const prices = DEFS.upgradeCost[k];
    for (let r = 0; r < (up[k] || 0) && r < prices.length; r++) t += prices[r];
  });
  return t;
}
function earnedAchievements(p) {
  const a = obj(p.achievements);
  return Object.keys(a).filter(function (id) { return a[id] && Object.prototype.hasOwnProperty.call(DEFS.achievementReward, id); });
}

// ---- Achievement evidence ----
// A march ends with a history entry (js/meta.js recordRunHistory) carrying
// `proof`: the facts the achievements are judged on. A newly claimed
// achievement must be backed by an entry added since the stored copy, and a
// win only counts if the stored wins counter grew by it and the march looks
// like a played one. History is still written by the client, so this raises
// the bar for forging (a consistent, time-limited story instead of one flag),
// it does not rule it out.
const MIN_WIN_BATTLES = 5;          // a 20-step march has far more fights
const MIN_WIN_MS = 3 * 60 * 1000;   // even full auto-battle takes longer
const FUTURE_SLACK_MS = 10 * 60 * 1000;
const WEEKLY_ASCENSION = 2;         // js/util.js WEEKLY_ASCENSION: open to every account
const BOSS_ACHIEVEMENT = {
  giant_slayer: 'colossus', warden_fallen: 'warden', vessel_broken: 'vessel',
  sovereign_broken: 'rimesovereign', thornsovereign_broken: 'thornsovereign',
  tidemother_broken: 'tidemother',
};

function historyOf(p) { return Array.isArray(p && p.history) ? p.history.filter(function (e) { return e && typeof e === 'object'; }) : []; }

// lastSaveAt caps the stored timestamps, so an entry from a fast clock can't
// hide later honest marches.
function newEntries(S, N, now, lastSaveAt) {
  const lastTs = historyOf(S).reduce(function (m, e) { return Math.max(m, Math.min(num(e.ts), lastSaveAt)); }, 0);
  return historyOf(N).filter(function (e) { const ts = num(e.ts); return ts > lastTs && ts <= now + FUTURE_SLACK_MS; });
}
function playedWin(e) {
  const st = obj(e.stats);
  return e.win === true && num(st.battles) >= MIN_WIN_BATTLES && num(st.durMs) >= MIN_WIN_MS;
}
function proofOf(e) { return obj(e.proof); }

// Start upload: the march history it carries is the only evidence (distinct
// timestamps, none in the future, the latest START_HISTORY_MAX).
function startEntries(N, now) {
  const seen = {};
  return historyOf(N).filter(function (e) {
    const ts = num(e.ts);
    if (ts <= 0 || ts > now + FUTURE_SLACK_MS || seen[ts]) return false;
    seen[ts] = true;
    return true;
  }).sort(function (a, b) { return num(a.ts) - num(b.ts); }).slice(-START_HISTORY_MAX);
}
/* What a start upload's history can account for: embers (capped per march)
   and the Ascension its wins opened. Oldest first, each played win opens one
   more level (a weekly challenge runs at WEEKLY_ASCENSION for everyone). */
function startEvidence(N, now) {
  let unlocked = 0, embers = 0, prevWin = false;
  // Endless March is only offered right after a won march and ends in the next entry.
  const depthMax = intIn(N.bestEndlessDepth, 0, ENDLESS_DEPTH_MAX);
  startEntries(N, now).forEach(function (e) {
    const weekly = proofOf(e).weekly === true && num(e.ascension) === WEEKLY_ASCENSION;
    const asc = weekly ? WEEKLY_ASCENSION : intIn(e.ascension, 0, unlocked);
    const win = playedWin(e);
    const depth = !win && prevWin ? Math.min(intIn(e.endlessDepth, 0, depthMax), intIn(obj(e.stats).battles, 0, ENDLESS_DEPTH_MAX)) : 0;
    embers += entryEmbers(e, win, asc, depth);
    if (win) unlocked = Math.min(ASCENSION_MAX, Math.max(unlocked, asc + 1));
    prevWin = win;
  });
  return { embers: embers, maxAsc: unlocked };
}

// Embers a march entry may account for; asc is the Ascension already judged
// plausible, depth the Endless depth. The history entry holds only the march
// payout: a challenge bonus is paid on top of it (js/util.js), so it is added.
function entryEmbers(e, win, asc, depth) {
  const p = proofOf(e);
  const kind = win ? 'win' : 'loss';
  const cap = win ? 15 + 2 * TOTAL_STEPS + 3 * asc : 6 + Math.floor(1.5 * asc) + 3 * depth;
  const bonus = p.weekly === true ? WEEKLY_BONUS[kind] : p.daily === true ? DAILY_BONUS[kind] : 0;
  return Math.min(intIn(e.embers, 0, EMBERS_MAX), cap) + bonus;
}

/* Rules: run(entries, wins, ctx) judged on the march entries new in this save
   (for the first upload of a fresh account: its whole recent history, see
   startEntries). An id missing here needs any such march entry. */
const ACH_RULES = {
  first_win: { run: function (E, W) { return W.length > 0; } },
  flawless: { run: function (E, W) { return W.some(function (e) { return proofOf(e).heroDied === false; }); } },
  ascendant: { run: function (E, W, c) { return W.some(function (e) { return num(e.ascension) >= 2 && c.ascOk(e); }); } },
  high_ascension: { run: function (E, W, c) { return W.some(function (e) { return num(e.ascension) >= 4 && c.ascOk(e); }); } },
  collector: { run: function (E) { return E.some(function (e) { return proofOf(e).relic === true; }); } },
  veteran: { run: function (E) { return E.some(function (e) { return num(obj(e.stats).maxLvl) >= 5; }); } },
  combo_master: { run: function (E) { return E.some(function (e) { return num(proofOf(e).combos) >= 3; }); } },
  wanderer: { run: function (E, W, c) { return c.dailyWins >= 3 && W.some(function (e) { return proofOf(e).daily === true; }); } },
  individualist: { run: function (E, W) { return W.some(function (e) { return e.hadCustom === true; }); } },
  arcane_company: { run: function (E, W) { return W.some(function (e) { return partyAll(e, 'int'); }); } },
  steel_company: { run: function (E, W) { return W.some(function (e) { return partyAll(e, 'str'); }); } },
  into_eternity: { run: function (E, W, c, N) { return num(N.bestEndlessDepth) >= 10 && E.some(function (e) { return num(e.endlessDepth) >= 10; }); } },
  // Judged last (see verifyAchievements): an achievement-locked hero only counts
  // with its unlock achievement still standing, as the hero check below enforces.
  full_roster: { always: function (N, c) {
    const u = obj(N.heroesUnlocked), a = obj(N.achievements), had = obj(c.S && c.S.heroesUnlocked);
    return Object.keys(DEFS.heroes).every(function (k) {
      const need = DEFS.unlockAchievement && DEFS.unlockAchievement[k];
      return u[k] === true && (!need || had[k] || !!a[need]);
    });
  } },
  hoarder: { always: function (N) { return num(N.embers) + upgradesCost(cleanUpgrades(N.upgrades)) >= 300; } },
};
Object.keys(BOSS_ACHIEVEMENT).forEach(function (id) {
  const boss = BOSS_ACHIEVEMENT[id];
  ACH_RULES[id] = {
    run: function (E, W) { return W.some(function (e) { const b = proofOf(e).bosses; return Array.isArray(b) && b.indexOf(boss) !== -1; }); },
  };
});
// Party damage types: a known hero must match the server's own table; only a custom hero's type is taken as sent.
function partyAll(e, type) {
  const keys = Array.isArray(e.heroKeys) ? e.heroKeys : [];
  const types = Array.isArray(proofOf(e).dmgTypes) ? proofOf(e).dmgTypes : [];
  if (!keys.length || types.length !== keys.length) return false;
  return keys.every(function (k, i) {
    const known = DEFS.dmgType && DEFS.dmgType[k];
    return (known || types[i]) === type;
  });
}

/* Strips newly claimed achievements without evidence, together with the
   reward the client already added to embers. Mutates N; returns removed ids. */
function verifyAchievements(S, N, now, prevAsc, lastSaveAt) {
  const before = obj(S && S.achievements);
  const ach = obj(N.achievements);
  N.achievements = ach;
  const claimed = Object.keys(ach).filter(function (id) {
    return ach[id] && !before[id] && Object.prototype.hasOwnProperty.call(DEFS.achievementReward, id);
  }).sort(function (a, b) { return (a === 'full_roster') - (b === 'full_roster'); });
  if (!claimed.length) return [];
  const E = S ? newEntries(S, N, now, lastSaveAt) : startEntries(N, now);
  const newWins = Math.max(0, Math.floor(num(N.wins)) - (S ? Math.floor(num(S.wins)) : 0));
  // Only as many fresh wins count as the wins counter grew by (latest first).
  const W = E.filter(playedWin).sort(function (a, b) { return num(b.ts) - num(a.ts); }).slice(0, newWins);
  // Oldest first: each earlier win in this save may have opened one more Ascension step.
  const chrono = W.slice().sort(function (a, b) { return num(a.ts) - num(b.ts); });
  const ctx = {
    S: S,
    ascOk: function (e) {
      if (proofOf(e).weekly === true && num(e.ascension) === WEEKLY_ASCENSION) return true;
      return num(e.ascension) <= prevAsc + chrono.indexOf(e);
    },
    dailyWins: Math.min(Math.floor(num(N.dailyWinsCount)), Math.floor(num(N.wins))),
  };
  const removed = [];
  claimed.forEach(function (id) {
    const rule = ACH_RULES[id] || {};
    let ok;
    if (rule.always) ok = rule.always(N, ctx);
    else ok = rule.run ? rule.run(E, W, ctx, N) : E.length > 0;
    if (ok) return;
    delete ach[id];
    N.embers = Math.max(0, N.embers - num(DEFS.achievementReward[id]));
    removed.push(id);
  });
  return removed;
}

function isFresh(p) {
  return !num(p.embers) && !num(p.wins) && !upgradesCost(cleanUpgrades(p.upgrades)) && !earnedAchievements(p).length;
}

function attachProgressGuard(opts) {
  const { db } = opts;

  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_guard (
      user_id INTEGER PRIMARY KEY,
      budget REAL NOT NULL,
      budget_at INTEGER NOT NULL,
      peak REAL,
      credited TEXT NOT NULL DEFAULT '[]',
      flags INTEGER NOT NULL DEFAULT 0,
      last_flag TEXT,
      last_flag_at TEXT
    );
  `);
  const q = {
    get: db.prepare('SELECT * FROM progress_guard WHERE user_id = ?'),
    put: db.prepare(`
      INSERT INTO progress_guard (user_id, budget, budget_at, credited, peak) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET budget = excluded.budget, budget_at = excluded.budget_at, credited = excluded.credited, peak = excluded.peak
    `),
    flag: db.prepare("UPDATE progress_guard SET flags = flags + 1, last_flag = ?, last_flag_at = datetime('now') WHERE user_id = ?"),
    remove: db.prepare('DELETE FROM progress_guard WHERE user_id = ?'),
    rebase: db.prepare('UPDATE progress_guard SET peak = NULL WHERE user_id = ?'),
  };

  /**
   * stored: the progress currently saved (object) or null; incoming: the body
   * of PUT /api/progress (modified in place). Returns { corrected, details }.
   */
  function check(userId, stored, incoming, nowMs) {
    const now = nowMs || Date.now();
    const row = q.get.get(userId);
    // Registration stores an empty progress row: nothing earned yet counts as new.
    // Only the very first checked save is a start upload (S null): once the guard
    // has a row, an empty stored copy is judged like any other.
    const S = row ? obj(stored) : (stored && !isFresh(obj(stored)) ? obj(stored) : null);
    const N = incoming;
    const details = [];

    let budget, credited;
    const start = S ? null : startEvidence(N, now);
    if (row) {
      budget = Math.min(EMBER_BUDGET_CAP, row.budget + Math.max(0, now - row.budget_at) / 60000 * EMBER_RATE_PER_MIN);
      try { credited = JSON.parse(row.credited); } catch (e) { credited = []; }
      if (!Array.isArray(credited)) credited = [];
    } else {
      // Never more than the old flat allowance (every upgrade plus a full budget).
      budget = S ? EMBER_BUDGET_CAP : Math.min(start.embers + NEW_ACCOUNT_EXTRA, upgradesCost(DEFS.upgradeMax) + EMBER_BUDGET_CAP);
      credited = S ? earnedAchievements(S) : [];
    }

    // Structure: ranks within caps, embers a sane non-negative integer.
    const prevUp = cleanUpgrades(S && S.upgrades);
    N.upgrades = Object.assign(obj(N.upgrades), cleanUpgrades(N.upgrades));
    N.embers = intIn(N.embers, 0, EMBERS_MAX);
    const prevAsc = S ? intIn(S.ascensionUnlocked, 0, ASCENSION_MAX) : 0;

    // Wins can't come faster than one march per MIN_WIN_MS since the last save.
    if (S && row) {
      const prevWins = Math.floor(num(S.wins));
      const maxWins = prevWins + 1 + Math.floor(Math.max(0, now - row.budget_at) / MIN_WIN_MS);
      if (Math.floor(num(N.wins)) > maxWins) { details.push('wins ' + Math.floor(num(N.wins)) + '>' + maxWins); N.wins = maxWins; }
    }

    // New achievements need evidence from a march recorded in this save.
    const unproven = verifyAchievements(S, N, now, prevAsc, row ? row.budget_at : now);
    if (unproven.length) details.push('achievements ' + unproven.join(' '));

    // Achievement rewards: each id pays once per account.
    let achCredit = 0;
    earnedAchievements(N).forEach(function (id) {
      if (credited.indexOf(id) !== -1) return;
      credited.push(id);
      achCredit += num(DEFS.achievementReward[id]);
    });

    const wealthBefore = (S ? intIn(S.embers, 0, EMBERS_MAX) : 0) + upgradesCost(prevUp);
    const base = Math.max(wealthBefore, row && row.peak != null ? row.peak : 0);
    const gain = N.embers + upgradesCost(N.upgrades) - base - achCredit;
    if (gain <= budget) {
      budget -= Math.max(0, gain);
    } else {
      const excess = Math.ceil(gain - budget);
      const allowed = base + achCredit + Math.floor(budget);
      details.push('embers+' + excess);
      if (N.embers >= excess) {
        N.embers -= excess;
      } else {
        // Not even the embers in hand cover it: undo this save's purchases too.
        Object.assign(N.upgrades, prevUp);
        N.embers = Math.max(0, allowed - upgradesCost(prevUp));
        details.push('upgrades reverted');
      }
      budget = 0;
    }

    // hoarder was judged on the wealth as sent: re-judged on what was kept.
    const hoard = 'hoarder';
    if (obj(N.achievements)[hoard] && !(S && obj(S.achievements)[hoard]) &&
        !ACH_RULES[hoard].always(N)) {
      delete N.achievements[hoard];
      N.embers = Math.max(0, N.embers - num(DEFS.achievementReward[hoard]));
      credited = credited.filter(function (id) { return id !== hoard; });
      details.push('achievements ' + hoard);
    }

    // Achievement-locked heroes need their achievement (same rule as the client's checkHeroUnlocks).
    const unlocked = obj(N.heroesUnlocked);
    const ach = obj(N.achievements);
    Object.keys(DEFS.unlockAchievement || {}).forEach(function (k) {
      const had = S && obj(S.heroesUnlocked)[k];
      if (unlocked[k] && !had && !ach[DEFS.unlockAchievement[k]]) { unlocked[k] = false; details.push('hero ' + k); }
    });

    // Ascension opens one step per win: never more than the new wins allow.
    const newWins = Math.max(0, Math.floor(num(N.wins)) - (S ? Math.floor(num(S.wins)) : 0));
    const maxAsc = start ? start.maxAsc : Math.min(ASCENSION_MAX, prevAsc + newWins);
    const asc = intIn(N.ascensionUnlocked, 0, ASCENSION_MAX);
    if (asc > maxAsc) { details.push('ascension ' + asc + '>' + maxAsc); N.ascensionUnlocked = maxAsc; }
    else N.ascensionUnlocked = asc;

    const wealthAfter = N.embers + upgradesCost(N.upgrades);
    q.put.run(userId, budget, now, JSON.stringify(credited), Math.max(base, wealthAfter));
    if (details.length) {
      q.flag.run(details.join(', ').slice(0, 500), userId);
      console.warn('progress-guard: user ' + userId + ' corrected: ' + details.join(', '));
    }
    return { corrected: details.length > 0, details: details };
  }

  return {
    check: check,
    info: function (userId) {
      const r = q.get.get(userId);
      return r ? { flags: r.flags, lastFlag: r.last_flag, lastFlagAt: r.last_flag_at, budget: Math.floor(r.budget) } : null;
    },
    remove: function (userId) { q.remove.run(userId); },
    // After an admin edit the stored copy is the new baseline, even if it is poorer.
    rebase: function (userId) { q.rebase.run(userId); },
  };
}

module.exports = { attachProgressGuard };
