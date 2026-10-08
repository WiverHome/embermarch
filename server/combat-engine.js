// combat-engine.js
// Combat for live real-time PvP. The math itself is not ported any more: it is
// the client's own js/combat-core.js (located via client-dir.js), the same file
// the browser runs, bound here to the server's needs:
//   - Log lines and status labels are {en, ru} pairs instead of the client's
//     M()-resolved strings, so each viewer renders them in their own language.
//   - No SFX, no RUN, no march modifiers (Broken Ward etc. never apply to PvP).
//   - Everything operates on an explicit state = { party, enemies, comboCount }.
//     Each unit carries unit.side ('hero'|'enemy') exactly like the client;
//     for a 1v1 duel state.party holds side:'hero' and state.enemies side:'enemy',
//     and the room layer decides which real player is which side per match.
//   - Champion snapshots always carry equip:{weapon:null,armor:null,
//     trinket:null,relic:null}: server.js rebuilds every champion via
//     champion.js (mirror of the client's makeHeroInstance), so relic hooks
//     are inert in practice today.

'use strict';

const { CORE_PATH } = require('./client-dir');
const core = require(CORE_PATH);

function L(en, ru) { return { en: en, ru: ru }; }

const engine = core.create({ tr: L });

function rowLabel(row) { return row === 'front' ? L('front','перед') : L('back','тыл'); }

// Deep-clones a champion snapshot (as stored in champions.data_json, one
// entry per hero in the saved squad) into a fresh combat unit: full HP,
// zeroed cooldowns and status, side/row set. Mirrors what startCombat() does
// to RUN.party on the client (reset cdLeft/status) plus makeHeroInstance()'s
// isHero/side/alive defaults.
let UID_COUNTER = 0;
function nextUid() { UID_COUNTER++; return 'c' + Date.now().toString(36) + UID_COUNTER; }

function instantiateCombatant(champion, side) {
  const u = JSON.parse(JSON.stringify(champion));
  // Always mint a fresh uid rather than trusting whatever (possibly absent,
  // stale, or colliding-with-the-other-player's-own-counter) uid the saved
  // snapshot carries — fx targeting and ability-target validation both key
  // off uid, so it must be unique within this match.
  u.uid = nextUid();
  u.side = side;
  u.isHero = true;
  u.alive = true;
  u.hp = u.maxHp;
  u.status = [];
  u.usedPhoenix = false;
  if (!u.equip) u.equip = { weapon: null, armor: null, trinket: null, relic: null };
  (u.abilities || []).forEach(function (a) { a.cdLeft = 0; });
  if (typeof u.critBonus !== 'number') u.critBonus = 0;
  if (typeof u.critMultBonus !== 'number') u.critMultBonus = 0;
  return u;
}

// championsA/championsB are each the full saved squad (1-3 heroes) — squad
// vs squad, not just one champion per side. Accepts a bare single champion
// object too (wrapped into a 1-element array) so any older caller passing
// the old single-champion shape keeps working unchanged.
function createDuelState(championsA, championsB) {
  const listA = Array.isArray(championsA) ? championsA : [championsA];
  const listB = Array.isArray(championsB) ? championsB : [championsB];
  const party = listA.map(function (c) { return instantiateCombatant(c, 'hero'); });
  const enemies = listB.map(function (c) { return instantiateCombatant(c, 'enemy'); });
  return { party: party, enemies: enemies, comboCount: 0 };
}

module.exports = {
  HERO_DMG_TYPE: core.HERO_DMG_TYPE,
  RELIC_TUNING: core.RELIC_TUNING,
  L: L,
  statAbbr: engine.statAbbr,
  rowLabel: rowLabel,
  statOf: core.statOf,
  dmgTypeOf: core.dmgTypeOf,
  powerOf: core.powerOf,
  mitigationKeyFor: core.mitigationKeyFor,
  defenseOf: core.defenseOf,
  hasRelic: engine.hasRelic,
  dmgCalc: engine.dmgCalc,
  frontAlive: engine.frontAlive,
  backAlive: engine.backAlive,
  anyAlive: engine.anyAlive,
  nearestRowAlive: engine.nearestRowAlive,
  getValidTargets: engine.getValidTargets,
  targetsForRow: engine.targetsForRow,
  abilityHasTargets: engine.abilityHasTargets,
  applyAbilityEffect: engine.applyAbilityEffect,
  tickStatus: engine.tickStatus,
  buildTurnOrder: engine.buildTurnOrder,
  instantiateCombatant: instantiateCombatant,
  createDuelState: createDuelState,
};
