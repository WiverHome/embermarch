'use strict';
/**
 * Server-side arena champion builder.
 *
 * The client used to upload whole hero objects (maxHp, str, abilities with
 * their multipliers...) and the server stored them as-is, so a forged request
 * could field a 9999-HP hero with a x50 ultimate. Now the client only names
 * which heroes it wants; every number is rebuilt here from hero-defs.json
 * (exported from index.html by tools/gen-hero-defs.js) and the account's
 * saved progress, mirroring makeHeroInstance()/customHeroToDef() 1:1.
 * parity-check.js compares the two.
 *
 * Only cosmetic text (display language) is taken from the request.
 */
const DEFS = require('./hero-defs.json');

const NAME_MAX_LEN = 18;

// Own-property lookups only: keys come from players, and a plain object would
// answer 'constructor' / '__proto__' with built-ins (crashed buildHero).
const own = Object.prototype.hasOwnProperty;
function heroDef(key) { return typeof key === 'string' && own.call(DEFS.heroes, key) ? DEFS.heroes[key] : null; }
function dmgTypeOf(key) { return typeof key === 'string' && own.call(DEFS.dmgType, key) ? DEFS.dmgType[key] : 'str'; }

function intIn(v, lo, hi) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// Plain text shown to other players: no markup characters at all.
function cleanText(s, maxLen) {
  return String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function pickLang(field, lang) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[lang] !== undefined ? field[lang] : field.en;
}

// Upgrade ranks from the saved progress, clamped to each upgrade's real cap.
function clampedUpgrades(progress) {
  const src = (progress && progress.upgrades) || {};
  const out = {};
  Object.keys(DEFS.upgradeMax).forEach(function (k) { out[k] = intIn(src[k], 0, DEFS.upgradeMax[k]); });
  return out;
}

function heroUnlocked(progress, key) {
  const def = heroDef(key);
  if (!def) return false;
  if (!def.cost) return true; // starter heroes
  const unlocked = (progress && progress.heroesUnlocked) || {};
  return own.call(unlocked, key) && unlocked[key] === true;
}

// Mirrors customHeroToDef(): template stats + allocated points + passive.
function customHeroDef(progress, customId) {
  // Only the first CUSTOM_HERO_MAX entries count: progress is client-written,
  // and a forged list could otherwise field three custom heroes.
  const list = Array.isArray(progress && progress.customHeroes) ? progress.customHeroes.slice(0, DEFS.custom.max) : [];
  const c = list.find(function (x) { return x && typeof x.id === 'string' && x.id === customId; });
  if (!c) return null;
  const tpl = heroDef(c.tplKey);
  if (!tpl) return null;
  const C = DEFS.custom;
  const dmgType = dmgTypeOf(c.tplKey);
  let pow = intIn(typeof c.pow === 'number' ? c.pow : c.atk, 0, C.points);
  let pDef = intIn(c.def, 0, C.points);
  let pSpd = intIn(c.spd, 0, C.points);
  let pHp = intIn(c.hp, 0, C.points);
  if (pow + pDef + pSpd + pHp > C.points) return null; // forged allocation
  let hp = tpl.baseHp + pHp * C.hpPerPoint;
  let str = tpl.baseStr + (dmgType === 'str' ? pow : 0);
  let intg = tpl.baseInt + (dmgType === 'int' ? pow : 0);
  let def = tpl.baseDef + pDef, spd = tpl.baseSpd + pSpd;
  const passive = C.passives.indexOf(c.passive) !== -1 ? c.passive : 'vitality';
  if (passive === 'vitality') hp = Math.round(hp * 1.15);
  else if (passive === 'ironskin') def += 3;
  else if (passive === 'swift') spd += 3;
  else if (passive === 'ferocity') { if (dmgType === 'str') str += 2; else intg += 2; }
  return {
    key: String(c.id), name: { en: cleanText(c.name, NAME_MAX_LEN) || tpl.name.en, ru: cleanText(c.name, NAME_MAX_LEN) || tpl.name.ru },
    cls: tpl.cls,
    icon: C.icons.indexOf(c.icon) !== -1 ? c.icon : tpl.icon,
    color: C.colors.indexOf(c.color) !== -1 ? c.color : tpl.color,
    baseHp: hp, baseStr: str, baseInt: intg, baseDef: def, baseSpd: spd,
    defaultRow: tpl.defaultRow, abilities: tpl.abilities, custom: true, tplKey: c.tplKey,
  };
}

// Mirrors makeHeroInstance() for a level-1 champion without gear.
function buildHero(def, up, lang, row) {
  const legacy = up.legacy_ember > 0;
  const vanguard = up.vanguard > 0;
  const lethal = up.lethal_calling > 0;
  const dmgType = dmgTypeOf(def.tplKey || def.key);
  const powBonus = up.whetstone + (vanguard ? 2 : 0) + (legacy ? 2 : 0);
  const maxHp = def.baseHp + up.bones * 5 + up.vitality_rite * 8 + (legacy ? 10 : 0);
  return {
    key: def.key, tplKey: def.tplKey || def.key,
    name: pickLang(def.name, lang), cls: pickLang(def.cls, lang),
    icon: def.icon, color: def.color, isHero: true, side: 'hero', custom: !!def.custom,
    maxHp: maxHp, hp: maxHp,
    str: def.baseStr + (dmgType === 'str' ? powBonus : 0),
    int: def.baseInt + (dmgType === 'int' ? powBonus : 0),
    def: def.baseDef + up.aegis + up.bulwark * 4 + (legacy ? 2 : 0),
    mdef: up.wardsigils + up.warding_rite * 4 + (legacy ? 1 : 0),
    spd: def.baseSpd + up.boots + (vanguard ? 2 : 0) + (legacy ? 2 : 0),
    critBonus: up.keen_edge * 0.03 + up.deadly_precision * 0.05 + (lethal ? 0.08 : 0),
    critMultBonus: lethal ? 0.15 : 0,
    row: row === 'front' || row === 'back' ? row : def.defaultRow,
    abilities: def.abilities.map(function (a) {
      return Object.assign({}, a, { name: pickLang(a.name, lang), desc: pickLang(a.desc, lang), cdLeft: 0 });
    }),
    equip: { weapon: null, armor: null, trinket: null, relic: null },
    status: [], alive: true, level: 1, xp: 0, usedPhoenix: false,
  };
}

/**
 * requested: array of {key,row?} or bare keys (the old client sends whole hero
 * objects; only .key/.row are read). Returns {heroes} or {error}.
 */
function buildChampionSquad(progress, requested, lang, maxHeroes) {
  if (!Array.isArray(requested) || requested.length < 1 || requested.length > maxHeroes) {
    return { error: 'Champion must have 1-' + maxHeroes + ' heroes.' };
  }
  lang = lang === 'ru' ? 'ru' : 'en';
  const up = clampedUpgrades(progress);
  const seen = {};
  const heroes = [];
  for (let i = 0; i < requested.length; i++) {
    const r = requested[i];
    const key = typeof r === 'string' ? r : (r && typeof r.key === 'string' ? r.key : '');
    if (!key || seen[key]) return { error: 'Invalid or duplicate hero in champion.' };
    seen[key] = true;
    let def = null;
    if (heroDef(key)) {
      if (!heroUnlocked(progress, key)) return { error: 'Hero is not unlocked: ' + key };
      def = heroDef(key);
    } else {
      def = customHeroDef(progress, key);
      if (!def) return { error: 'Unknown hero: ' + cleanText(key, 40) };
    }
    heroes.push(buildHero(def, up, lang, r && r.row));
  }
  return { heroes: heroes };
}

// Language a stored snapshot was saved in (first hero's ability name).
function snapshotLang(heroes) {
  const h = Array.isArray(heroes) && heroes[0];
  const def = h && heroDef(h.tplKey || h.key);
  const a = def && h.abilities && h.abilities[0];
  return a && def.abilities[0] && a.name === def.abilities[0].name.ru ? 'ru' : 'en';
}

/**
 * Rebuilds a stored snapshot from current progress before it fights, so rows
 * saved before validation existed (or a later-forged progress) never reach
 * combat with uploaded numbers. Returns null if nothing valid is left.
 */
function rebuildStoredSquad(progress, storedHeroes, maxHeroes) {
  if (!Array.isArray(storedHeroes)) return null;
  const req = storedHeroes.slice(0, maxHeroes).map(function (h) { return { key: h && h.key, row: h && h.row }; });
  const res = buildChampionSquad(progress, req, snapshotLang(storedHeroes), maxHeroes);
  return res.error ? null : res.heroes;
}

module.exports = { buildChampionSquad: buildChampionSquad, rebuildStoredSquad: rebuildStoredSquad, cleanText: cleanText };
