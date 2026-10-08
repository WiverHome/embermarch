'use strict';
/**
 * Live real-time PvP: open matchmaking queue + invite-by-code duels, with the
 * SERVER as the sole authority over combat outcomes (per the project's chosen
 * architecture — see ROADMAP.md's 21st-pass entry). Clients submit an
 * {abilityId, targetUid} action on their turn; the server validates legality
 * and resolves it with the ported combat-engine.js, then broadcasts the
 * authoritative result. A client reporting its own "I dealt 9000 damage" is
 * never trusted — the server recomputes everything.
 *
 * Transport: a `ws` WebSocket server mounted at /api/arena/live, upgraded
 * only for connections presenting a valid session JWT as ?token=... (same
 * JWT_SECRET/signToken as the rest of the API). One socket per connected
 * player; a player can only be in one queue/match at a time.
 *
 * The async arena (fight a saved champion snapshot) runs through the same
 * match loop: 'arena_bot_start' redeems the battle token issued by
 * GET /api/arena/opponent and the defender's side is piloted by a server bot
 * (botChooseAction), so the async result is server-decided too.
 *
 * This module is deliberately self-contained (attachLivePvp(...)) so it can
 * be wired into server.js with a single call and unit-tested / rolled back
 * independently of the REST endpoints.
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const engine = require('./combat-engine');
const { cleanText } = require('./champion');

const TURN_TIMEOUT_MS = 30 * 1000; // a player who doesn't act in time auto-passes (first usable ability, random legal target)
const DISCONNECT_GRACE_MS = 20 * 1000; // time a disconnected player's opponent waits before an auto-forfeit
const MAX_ROUNDS = 60; // hard safety cap so a pathological stalemate (e.g. two pure-healers) can't hang a match forever
const INVITE_CODE_TTL_MS = 10 * 60 * 1000;
const BOT_THINK_MS = 700; // pause before the arena bot acts, so the client can show each turn
const ELO_K = 24;

function eloExpected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function eloDelta(myRating, oppRating, didWin) {
  return Math.round(ELO_K * ((didWin ? 1 : 0) - eloExpected(myRating, oppRating)));
}

function makeInviteCode() {
  // Short, human-typeable: 6 chars, uppercase letters + digits, ambiguous
  // characters (0/O, 1/I) excluded.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function attachLivePvp(opts) {
  const { server, jwt, JWT_SECRET, stmts, findUserById, fightingSquad, saveReplay } = opts;

  const wss = new WebSocketServer({ noServer: true });

  // userId -> { ws, user, queued:boolean, matchId:string|null, inviteCode:string|null }
  const conns = new Map();
  // open matchmaking queue, oldest first
  const queue = []; // array of userId
  // code -> { userId, expiresAt }
  const invites = new Map();
  // matchId -> Match
  const matches = new Map();

  function liveConn(userId) { const c = conns.get(userId); return c && c.ws ? c : null; }

  function send(userId, msg) {
    const c = conns.get(userId);
    if (c && c.ws && c.ws.readyState === c.ws.OPEN) {
      try { c.ws.send(JSON.stringify(msg)); } catch (e) { /* socket going away; ignore */ }
    }
  }

  function removeFromQueue(userId) {
    const i = queue.indexOf(userId);
    if (i !== -1) queue.splice(i, 1);
  }

  function loadChampion(userId) {
    const row = stmts.getChampion.get(userId);
    if (!row) return null;
    // Rebuilt from the owner's progress (champion.js), never the uploaded numbers.
    const heroes = fightingSquad(userId, row.data_json);
    if (!heroes || !heroes.length) return null;
    // The whole saved squad (1-3 heroes, same cap as the async arena) fights
    // together — squad vs squad, not just the first hero. Nothing else here
    // special-cases squad size: buildTurnOrder/getValidTargets/etc. in
    // combat-engine.js already operate over state.party/enemies as lists
    // (shared code with the main PvE combat screen, which already does
    // 3-vs-many), so this is the only place that needed to stop truncating.
    return { champions: heroes, rating: row.rating, name: cleanText(row.name, 24) };
  }

  function sanitizeUnit(u) {
    // Nothing secret about a unit's own state in this game (no hidden info
    // combat mechanic), so the full unit is sent as-is; just drop internal
    // engine bookkeeping that the client has no use for.
    return u;
  }

  function publicState(match) {
    return {
      matchId: match.id,
      round: match.round,
      party: match.state.party.map(sanitizeUnit),
      enemies: match.state.enemies.map(sanitizeUnit),
    };
  }

  function otherSide(side) { return side === 'hero' ? 'enemy' : 'hero'; }

  // Ultimates (minLevel) stay locked for level-1 champions, same as the client UI.
  function abilityUsable(match, unit, a) {
    return a.cdLeft <= 0 && (!a.minLevel || (unit.level || 1) >= a.minLevel) && engine.abilityHasTargets(match.state, a, unit);
  }
  function legalAbilities(match, unit) {
    return unit.abilities.filter(function (a) { return abilityUsable(match, unit, a); });
  }

  // Sends to one side of a match; the arena bot side has no socket.
  function sendSide(match, side, msg) {
    const p = match.players[side];
    if (p && !p.bot) send(p.userId, msg);
  }
  function sendBoth(match, msg) { sendSide(match, 'hero', msg); sendSide(match, 'enemy', msg); }
  function releasePlayers(match) {
    ['hero', 'enemy'].forEach(function (side) {
      const p = match.players[side];
      if (p.bot) return;
      const c = conns.get(p.userId);
      if (c && c.matchId === match.id) c.matchId = null;
    });
  }
  // Replay recording (seasons.js stores it): start state + one step per broadcast.
  function replayStep(match, logs) {
    if (!match.replay) return;
    match.replay.steps.push({
      l: logs,
      // [uid, hp, alive, row, status]: statuses too, so buffs/stuns appear and expire in the replay
      hp: match.state.party.concat(match.state.enemies).map(function (u) { return [u.uid, u.hp, u.alive ? 1 : 0, u.row, u.status || []]; }),
    });
  }
  function finishReplay(match, result) {
    if (!match.replay || !saveReplay) return;
    saveReplay({
      kind: match.replay.kind, result: result,
      heroUserId: match.players.hero.userId, enemyUserId: match.players.enemy.userId,
      heroName: match.players.hero.name, enemyName: match.players.enemy.name,
      data: { v: 1, start: match.replay.start, steps: match.replay.steps,
        heroUsername: match.players.hero.username, enemyUsername: match.players.enemy.username },
    });
    match.replay = null;
  }
  function closeMatch(match) {
    match.over = true;
    clearTurnTimer(match);
    clearTimeout(match.disconnectTimer);
    matches.delete(match.id);
  }
  // Draw: no rating change for anyone.
  function drawMatch(match, reason) {
    if (match.over) return;
    closeMatch(match);
    finishReplay(match, 'draw');
    sendBoth(match, { type: 'match_end', result: 'draw', reason: reason, ratingDelta: 0, newRating: null });
    releasePlayers(match);
  }

  function clearTurnTimer(match) {
    if (match.turnTimer) { clearTimeout(match.turnTimer); match.turnTimer = null; }
  }

  function endMatch(match, winnerUserId, reason) {
    if (match.over) return;
    closeMatch(match);

    const heroUserId = match.players.hero.userId;
    const enemyUserId = match.players.enemy.userId;
    const heroWon = winnerUserId === heroUserId;
    finishReplay(match, heroWon ? 'hero' : 'enemy');

    const heroChamp = stmts.getChampion.get(heroUserId);
    const enemyChamp = stmts.getChampion.get(enemyUserId);
    let heroDelta = 0, enemyDelta = 0, heroNewRating = heroChamp ? heroChamp.rating : 1000, enemyNewRating = enemyChamp ? enemyChamp.rating : 1000;
    if (heroChamp && enemyChamp) {
      heroDelta = eloDelta(heroChamp.rating, enemyChamp.rating, heroWon);
      enemyDelta = eloDelta(enemyChamp.rating, heroChamp.rating, !heroWon);
      heroNewRating = Math.max(0, heroChamp.rating + heroDelta);
      enemyNewRating = Math.max(0, enemyChamp.rating + enemyDelta);
      stmts.setRatingStats.run(heroNewRating, heroChamp.wins + (heroWon ? 1 : 0), heroChamp.losses + (heroWon ? 0 : 1), heroUserId);
      stmts.setRatingStats.run(enemyNewRating, enemyChamp.wins + (heroWon ? 0 : 1), enemyChamp.losses + (heroWon ? 1 : 0), enemyUserId);
    }

    sendSide(match, 'hero', { type: 'match_end', result: heroWon ? 'win' : 'loss', reason: reason, ratingDelta: heroDelta, newRating: heroNewRating });
    sendSide(match, 'enemy', { type: 'match_end', result: heroWon ? 'loss' : 'win', reason: reason, ratingDelta: enemyDelta, newRating: enemyNewRating });
    releasePlayers(match);
  }

  function checkMatchOver(match) {
    const heroAlive = engine.anyAlive(match.state.party).length > 0;
    const enemyAlive = engine.anyAlive(match.state.enemies).length > 0;
    if (heroAlive && enemyAlive) return false;
    if (!heroAlive && !enemyAlive) {
      // Mutual KO (simultaneous DoT deaths, say) — treat as a draw: no rating change.
      drawMatch(match, 'mutual_ko');
      return true;
    }
    endMatch(match, heroAlive ? match.players.hero.userId : match.players.enemy.userId, 'defeated');
    return true;
  }

  function broadcastTurnPrompt(match) {
    if (match.over) return;
    const order = match.queue;
    while (match.qi < order.length && !order[match.qi].alive) match.qi++;
    if (match.qi >= order.length) {
      // Round complete — start a new one (fresh turn order; spd/status can change round to round).
      match.round++;
      // Previously endMatch(match, null) here, which scored the draw as a defender win.
      if (match.round > MAX_ROUNDS) { drawMatch(match, 'round_limit'); return; }
      match.queue = engine.buildTurnOrder(match.state);
      match.qi = 0;
      if (!match.queue.length) { drawMatch(match, 'no_combatants'); return; }
    }
    const unit = match.queue[match.qi];
    const dlogs = engine.tickStatus(unit);
    if (dlogs.length) broadcastLog(match, dlogs, []);
    if (checkMatchOver(match)) return;
    if (!unit.alive) { match.qi++; return broadcastTurnPrompt(match); }

    const actingSide = unit.side; // 'hero' | 'enemy'
    const actingUserId = match.players[actingSide].userId;
    const abilities = legalAbilities(match, unit);
    match.pendingTurn = { unitUid: unit.uid, side: actingSide, userId: actingUserId };

    const payload = {
      type: 'turn_prompt',
      state: publicState(match),
      activeUid: unit.uid,
      yourTurn: true,
      legalAbilityIds: abilities.map(function (a) { return a.id; }),
      timeoutMs: TURN_TIMEOUT_MS,
    };
    clearTurnTimer(match);
    if (match.players[actingSide].bot) {
      sendSide(match, otherSide(actingSide), Object.assign({}, payload, { yourTurn: false }));
      match.turnTimer = setTimeout(function () { botResolveTurn(match); }, BOT_THINK_MS);
      return;
    }
    sendSide(match, actingSide, payload);
    sendSide(match, otherSide(actingSide), Object.assign({}, payload, { yourTurn: false }));
    match.turnTimer = setTimeout(function () { autoResolveTurn(match); }, TURN_TIMEOUT_MS);
  }

  function broadcastLog(match, logs, fx) {
    replayStep(match, logs);
    sendBoth(match, { type: 'combat_log', logs: logs, fx: fx || [], state: publicState(match) });
  }

  function resolveTurn(match, ability, targetUid) {
    const pending = match.pendingTurn;
    match.pendingTurn = null;
    clearTurnTimer(match);
    const unit = match.state[pending.side === 'hero' ? 'party' : 'enemies'].find(function (u) { return u.uid === pending.unitUid; });
    if (!unit || !unit.alive) { match.qi++; return broadcastTurnPrompt(match); }
    let target = null;
    if (targetUid) {
      target = match.state.party.concat(match.state.enemies).find(function (u) { return u.uid === targetUid; });
    }
    const logs = engine.applyAbilityEffect(match.state, unit, ability, target);
    ability.cdLeft = ability.cd || 0;
    unit.abilities.forEach(function (a) { if (a !== ability && a.cdLeft > 0) a.cdLeft--; });
    broadcastLog(match, logs, logs.fx || []);
    if (checkMatchOver(match)) return;
    match.qi++;
    broadcastTurnPrompt(match);
  }

  function autoResolveTurn(match) {
    if (match.over || !match.pendingTurn) return;
    const pending = match.pendingTurn;
    const unit = match.state[pending.side === 'hero' ? 'party' : 'enemies'].find(function (u) { return u.uid === pending.unitUid; });
    if (!unit || !unit.alive) { match.pendingTurn = null; match.qi++; return broadcastTurnPrompt(match); }
    const abilities = legalAbilities(match, unit);
    if (!abilities.length) { match.pendingTurn = null; match.qi++; return broadcastTurnPrompt(match); }
    const ability = abilities[0];
    const targets = engine.getValidTargets(match.state, ability, unit);
    const target = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
    resolveTurn(match, ability, target ? target.uid : null);
  }

  function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

  // Arena bot: same priorities the client used to pilot a snapshot squad
  // (buildEnemyIntent): heal a hurt ally, else mostly the hardest-hitting
  // damage ability, finishing low targets first.
  function botChooseAction(match, unit) {
    const usable = legalAbilities(match, unit);
    if (!usable.length) return null;
    const allies = engine.anyAlive(unit.side === 'hero' ? match.state.party : match.state.enemies);
    const hurt = allies.filter(function (a) { return a.hp / a.maxHp < 0.55; });
    const heal = usable.find(function (a) { return a.type === 'heal'; });
    let ability;
    if (heal && hurt.length && Math.random() < 0.85) {
      ability = heal;
    } else {
      const dmg = usable.filter(function (a) { return a.type === 'damage'; });
      const util = usable.filter(function (a) { return a.type !== 'damage' && a.type !== 'heal'; });
      if (dmg.length) {
        if (util.length && Math.random() < 0.18) ability = pickRandom(util);
        else {
          dmg.sort(function (a, b) { return (b.mult || 0) - (a.mult || 0); });
          ability = Math.random() < 0.72 ? dmg[0] : pickRandom(dmg);
        }
      } else ability = usable[0];
    }
    let target = null;
    if (ability.targets === 'single' || ability.targets === 'single-ally') {
      const valid = engine.getValidTargets(match.state, ability, unit);
      if (!valid.length) return null;
      const byHp = valid.slice().sort(function (a, b) { return (a.hp / a.maxHp) - (b.hp / b.maxHp); });
      if (ability.type === 'heal') target = byHp[0];
      else if (ability.targets === 'single-ally') target = pickRandom(valid);
      else {
        const healers = valid.filter(function (t) { return t.abilities && t.abilities.some(function (a) { return a.type === 'heal' && a.cdLeft <= 0; }); });
        target = byHp[0].hp / byHp[0].maxHp < 0.3 ? byHp[0] : (healers.length && Math.random() < 0.45 ? pickRandom(healers) : byHp[0]);
      }
    }
    return { ability: ability, targetUid: target ? target.uid : null };
  }

  function botResolveTurn(match) {
    if (match.over || !match.pendingTurn) return;
    const pending = match.pendingTurn;
    const unit = match.state[pending.side === 'hero' ? 'party' : 'enemies'].find(function (u) { return u.uid === pending.unitUid; });
    const choice = unit && unit.alive ? botChooseAction(match, unit) : null;
    if (!choice) { match.pendingTurn = null; match.qi++; return broadcastTurnPrompt(match); }
    resolveTurn(match, choice.ability, choice.targetUid);
  }

  // opts.botB: side B is an offline champion snapshot piloted by the server.
  function startMatch(userIdA, userIdB, opts) {
    const botB = !!(opts && opts.botB);
    const a = loadChampion(userIdA);
    const b = loadChampion(userIdB);
    if (!a || !b) {
      // Shouldn't happen (both must have a saved champion to queue/invite), but fail safe.
      if (!a) send(userIdA, { type: 'error', message: 'Save a champion before dueling.' });
      if (!b && !botB) send(userIdB, { type: 'error', message: 'Save a champion before dueling.' });
      [userIdA].concat(botB ? [] : [userIdB]).forEach(function (uid) { const c = conns.get(uid); if (c) { c.matchId = null; c.queued = false; } });
      if (botB && !b) send(userIdA, { type: 'error', message: 'That opponent is no longer available.' });
      return;
    }
    const userB = botB ? findUserById(userIdB) : conns.get(userIdB).user;
    const matchId = crypto.randomUUID();
    const state = engine.createDuelState(a.champions, b.champions);
    const match = {
      id: matchId,
      state: state,
      players: {
        hero: { userId: userIdA, username: conns.get(userIdA).user.username, name: a.name, rating: a.rating },
        enemy: { userId: userIdB, username: userB ? userB.username : '?', name: b.name, rating: b.rating, bot: botB },
      },
      round: 0,
      queue: [],
      qi: 0,
      over: false,
      turnTimer: null,
      disconnectTimer: null,
      pendingTurn: null,
    };
    match.replay = { kind: botB ? 'async' : 'live', start: JSON.parse(JSON.stringify(publicState(match))), steps: [] };
    matches.set(matchId, match);
    [userIdA].concat(botB ? [] : [userIdB]).forEach(function (uid) {
      const c = conns.get(uid);
      c.matchId = matchId;
      c.queued = false;
    });
    sendSide(match, 'hero', { type: 'match_found', matchId: matchId, side: 'hero', vsBot: botB, you: match.players.hero, opponent: match.players.enemy, state: publicState(match) });
    sendSide(match, 'enemy', { type: 'match_found', matchId: matchId, side: 'enemy', you: match.players.enemy, opponent: match.players.hero, state: publicState(match) });
    broadcastTurnPrompt(match);
  }

  function tryMatchQueue() {
    while (queue.length >= 2) {
      const a = queue.shift();
      const b = queue.shift();
      // Both might have disconnected between queueing and now.
      if (!liveConn(a)) { continue; }
      if (!liveConn(b)) { queue.unshift(a); continue; }
      startMatch(a, b);
    }
  }

  // One bad message must never take the whole process (and every live match) down.
  function handleMessage(userId, raw) {
    try { handleMessageUnsafe(userId, raw); } catch (e) {
      console.error('live-pvp message from user ' + userId + ' failed: ' + (e && e.stack || e));
      send(userId, { type: 'error', message: 'Server error.' });
    }
  }
  function handleMessageUnsafe(userId, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return send(userId, { type: 'error', message: 'Malformed message.' }); }
    const c = conns.get(userId);
    if (!c) return;

    if (msg.type === 'queue_join') {
      if (c.matchId) return send(userId, { type: 'error', message: 'Already in a match.' });
      if (!stmts.getChampion.get(userId)) return send(userId, { type: 'error', message: 'Save a champion before queueing.' });
      if (!c.queued) { c.queued = true; queue.push(userId); }
      send(userId, { type: 'queue_joined' });
      tryMatchQueue();
      return;
    }
    if (msg.type === 'queue_leave') {
      c.queued = false;
      removeFromQueue(userId);
      send(userId, { type: 'queue_left' });
      return;
    }
    if (msg.type === 'invite_create') {
      if (c.matchId) return send(userId, { type: 'error', message: 'Already in a match.' });
      if (!stmts.getChampion.get(userId)) return send(userId, { type: 'error', message: 'Save a champion before dueling.' });
      const code = makeInviteCode();
      invites.set(code, { userId: userId, expiresAt: Date.now() + INVITE_CODE_TTL_MS });
      c.inviteCode = code;
      send(userId, { type: 'invite_created', code: code, expiresInMs: INVITE_CODE_TTL_MS });
      return;
    }
    if (msg.type === 'invite_cancel') {
      if (c.inviteCode) { invites.delete(c.inviteCode); c.inviteCode = null; }
      return;
    }
    if (msg.type === 'invite_join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const inv = invites.get(code);
      if (!inv || inv.expiresAt < Date.now()) { invites.delete(code); return send(userId, { type: 'error', message: 'Invite code not found or expired.' }); }
      if (inv.userId === userId) return send(userId, { type: 'error', message: "You can't duel yourself." });
      if (!stmts.getChampion.get(userId)) return send(userId, { type: 'error', message: 'Save a champion before dueling.' });
      const hostConn = conns.get(inv.userId);
      if (!hostConn || !hostConn.ws || hostConn.matchId) { invites.delete(code); return send(userId, { type: 'error', message: 'That player is no longer available.' }); }
      invites.delete(code);
      hostConn.inviteCode = null;
      removeFromQueue(inv.userId); removeFromQueue(userId);
      if (hostConn) hostConn.queued = false;
      c.queued = false;
      startMatch(inv.userId, userId);
      return;
    }
    if (msg.type === 'arena_bot_start') {
      if (c.matchId) return send(userId, { type: 'error', message: 'Already in a match.' });
      let payload;
      try { payload = jwt.verify(String(msg.battleToken || ''), JWT_SECRET); } catch (e) { payload = null; }
      if (!payload || payload.typ !== 'arena' || typeof payload.jti !== 'string') {
        return send(userId, { type: 'error', message: 'Invalid or expired battle token.' });
      }
      const row = stmts.consumeToken.get(payload.jti, Date.now());
      if (!row) return send(userId, { type: 'error', message: 'This matchup was already fought, or has expired.' });
      if (row.atk_user_id !== userId) return send(userId, { type: 'error', message: 'This battle token belongs to a different account.' });
      c.queued = false;
      removeFromQueue(userId);
      startMatch(userId, row.def_user_id, { botB: true });
      return;
    }
    if (msg.type === 'action') {
      const match = matches.get(c.matchId);
      if (!match || match.over) return send(userId, { type: 'error', message: 'No active match.' });
      const pending = match.pendingTurn;
      if (!pending || pending.userId !== userId) return send(userId, { type: 'error', message: 'Not your turn.' });
      const unit = match.state[pending.side === 'hero' ? 'party' : 'enemies'].find(function (u) { return u.uid === pending.unitUid; });
      const ability = unit.abilities.find(function (a) { return a.id === msg.abilityId; });
      if (!ability || !abilityUsable(match, unit, ability)) {
        return send(userId, { type: 'error', message: 'That ability is not usable right now.' });
      }
      let targetUid = msg.targetUid || null;
      if (ability.targets === 'single' || ability.targets === 'single-ally') {
        const valid = engine.getValidTargets(match.state, ability, unit);
        if (!valid.some(function (t) { return t.uid === targetUid; })) {
          return send(userId, { type: 'error', message: 'Invalid target.' });
        }
      } else {
        targetUid = null; // row/all/self abilities resolve their own target set server-side
      }
      resolveTurn(match, ability, targetUid);
      return;
    }
    if (msg.type === 'forfeit') {
      const match = matches.get(c.matchId);
      if (!match || match.over) return;
      const winnerSide = match.players.hero.userId === userId ? 'enemy' : 'hero';
      endMatch(match, match.players[winnerSide].userId, 'forfeit');
      return;
    }
  }

  // ws: the socket that closed. A second tab replaces the connection record, so
  // the old socket's late close must not delete the new one. While a match is
  // running the record is kept (ws = null) so a reconnect restores the match.
  function handleClose(userId, ws) {
    const c = conns.get(userId);
    if (!c || c.ws !== ws) return;
    removeFromQueue(userId);
    c.queued = false;
    if (c.inviteCode) { invites.delete(c.inviteCode); c.inviteCode = null; }
    const match = c.matchId && matches.get(c.matchId);
    if (!match || match.over) { conns.delete(userId); return; }
    c.ws = null;
    if (match && !match.over) {
      // Grace period: a refresh or brief network blip shouldn't instantly lose the
      // match. If the player hasn't reconnected (conns.has) by the deadline, forfeit.
      const mySide = match.players.hero.userId === userId ? 'hero' : 'enemy';
      const winnerSide = otherSide(mySide);
      match.disconnectTimer = setTimeout(function () {
        if (match.over) return;
        const now = conns.get(userId);
        if (now && now.ws) return; // reconnected under a new socket for the same userId
        if (now && !now.ws) conns.delete(userId);
        sendSide(match, winnerSide, { type: 'opponent_disconnected_final' });
        endMatch(match, match.players[winnerSide].userId, 'disconnect');
      }, DISCONNECT_GRACE_MS);
      sendSide(match, winnerSide, { type: 'opponent_disconnected', graceMs: DISCONNECT_GRACE_MS });
    }
  }

  server.on('upgrade', function (req, socket, head) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { socket.destroy(); return; }
    if (url.pathname !== '/api/arena/live') return; // not ours; let other upgrade handlers (if any) see it
    const token = url.searchParams.get('token');
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { socket.destroy(); return; }
    if (!payload || payload.typ || payload.sub == null) { socket.destroy(); return; }
    const user = findUserById(payload.sub);
    // Same session rules as REST requireAuth: revoked token version or banned account.
    if (!user || user.banned || (payload.tv || 0) !== (user.token_version || 0)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, function (ws) {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', function (ws, req, user) {
    const existing = conns.get(user.id);
    if (existing && existing.ws && existing.ws.readyState === existing.ws.OPEN) {
      // Only one live connection per account; the new one wins (covers a stale
      // tab left open elsewhere). The old socket is closed, not the match.
      try { existing.ws.close(4000, 'replaced_by_new_connection'); } catch (e) {}
    }
    if (existing && existing.matchId && matches.has(existing.matchId)) {
      clearTimeout(matches.get(existing.matchId).disconnectTimer);
    }
    conns.set(user.id, { ws: ws, user: user, queued: existing ? existing.queued : false, matchId: existing ? existing.matchId : null, inviteCode: existing ? existing.inviteCode : null });
    send(user.id, { type: 'auth_ok', username: user.username });
    const reconnectedMatch = existing && existing.matchId && matches.get(existing.matchId);
    if (reconnectedMatch) {
      const side = reconnectedMatch.players.hero.userId === user.id ? 'hero' : 'enemy';
      send(user.id, { type: 'match_found', matchId: reconnectedMatch.id, side: side, vsBot: !!reconnectedMatch.players.enemy.bot, you: reconnectedMatch.players[side], opponent: reconnectedMatch.players[otherSide(side)], state: publicState(reconnectedMatch) });
      if (reconnectedMatch.pendingTurn) {
        const unit = reconnectedMatch.state[reconnectedMatch.pendingTurn.side === 'hero' ? 'party' : 'enemies'].find(function (u) { return u.uid === reconnectedMatch.pendingTurn.unitUid; });
        send(user.id, { type: 'turn_prompt', state: publicState(reconnectedMatch), activeUid: unit.uid, yourTurn: reconnectedMatch.pendingTurn.userId === user.id, legalAbilityIds: legalAbilities(reconnectedMatch, unit).map(function (a) { return a.id; }), timeoutMs: TURN_TIMEOUT_MS });
      }
    }

    ws.on('message', function (raw) { handleMessage(user.id, raw); });
    ws.on('close', function () { handleClose(user.id, ws); });
    ws.on('error', function () { /* 'close' follows; handled there */ });
  });

  // Admin hooks: drop a user's socket (ban / rename / password reset / force
  // logout). An open match then follows the normal disconnect-grace path.
  function kick(userId) {
    const c = conns.get(userId);
    if (c && c.ws) { try { c.ws.close(4001, 'session_revoked'); } catch (e) {} }
  }
  function isOnline(userId) { return !!liveConn(userId); }
  function stats() {
    let online = 0;
    conns.forEach(function (c) { if (c.ws) online++; });
    return { online: online, queued: queue.length, matches: matches.size };
  }

  return {
    kick: kick, isOnline: isOnline, stats: stats,
    // exposed for tests/metrics
    _internals: { conns: conns, queue: queue, invites: invites, matches: matches },
  };
}

module.exports = { attachLivePvp: attachLivePvp };
