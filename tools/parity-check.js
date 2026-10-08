// parity-check.js
// Verifies that the server combat engine (server/combat-engine.js) and the
// client's combat (js/combat.js) produce identical results. Both now run the
// same js/combat-core.js, so this mostly guards the two bindings (texts, state,
// relic/status hooks) and champion.js vs makeHeroInstance. Plays many
// random squad-vs-squad duels through both engines in lockstep: same units,
// same decisions, same Math.random sequence before every action. After each
// step compares every unit's HP, alive flag, stats, cooldowns and statuses,
// plus the English combat log text. Dev tool only.
//
//   node tools/parity-check.js              # 300 duels
//   node tools/parity-check.js --duels 2000 --equip
'use strict';

const path = require('path');
const { loadClient } = require('./load-client');
const engine = require(path.join(__dirname, '..', 'server', 'combat-engine.js'));

const args = { duels: 300, equip: false, verbose: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--duels') args.duels = +process.argv[++i];
  else if (k === '--equip') args.equip = true;
  else if (k === '--verbose') args.verbose = true;
}

function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nativeRandom = Math.random;
function seed(n) { Math.random = mulberry32(n); }

const client = loadClient({ quiet: true });
const run = client.run;
run('LANG="en"');
const HERO_KEYS = run('Object.keys(HERO_DEFS)');

// A champion snapshot the way the client builds heroes: makeHeroInstance,
// a few random level perks, optionally random gear (incl. relic passives).
function makeChampion(key, rng) {
  client.ctx.__k = key;
  const h = run('makeHeroInstance(__k)');
  client.ctx.__h = h;
  const levels = Math.floor(rng() * 6);
  for (let i = 0; i < levels; i++) {
    h.level = (h.level || 1) + 1;
    run(`applyLevelPerkByKey(__h,LEVEL_PERKS[${Math.floor(rng() * 5)}].key)`);
  }
  if (args.equip) {
    ['weapon', 'armor', 'trinket'].forEach(() => {
      const it = run(`randomItemForHero(__h,${1 + Math.floor(rng() * 4)})`);
      client.ctx.__it = it;
      if (run('heroCanUseItem(__h,__it)')) run('applyItemToHero(__h,__it)');
    });
    if (rng() < 0.7) { client.ctx.__it = run(`randomRelic(${1 + Math.floor(rng() * 4)})`); run('applyItemToHero(__h,__it)'); }
  }
  return JSON.parse(JSON.stringify(h));
}

// What we compare after every step.
function snap(units) {
  return units.map(u => ({
    key: u.key, hp: u.hp, maxHp: u.maxHp, alive: !!u.alive,
    atk: u.atk, str: u.str || 0, int: u.int || 0, def: u.def, mdef: u.mdef || 0, spd: u.spd,
    usedPhoenix: !!u.usedPhoenix,
    cds: (u.abilities || []).map(a => a.cdLeft || 0).join(','),
    // server keeps status labels as {en,ru} by design (see combat-engine.js header)
    status: JSON.stringify((u.status || []).map(s => Object.keys(s).sort().reduce((o, k) => (o[k] = (k === 'label' && s[k] && s[k].en) ? s[k].en : s[k], o), {}))),
  }));
}
function diff(a, b, where) {
  for (let i = 0; i < a.length; i++) {
    for (const k of Object.keys(a[i])) {
      if (a[i][k] !== b[i][k]) return `${where}[${i}](${a[i].key}).${k}: server=${JSON.stringify(a[i][k])} client=${JSON.stringify(b[i][k])}`;
    }
  }
  return null;
}

function duel(n) {
  const rng = mulberry32(1000 + n);
  const size = 1 + Math.floor(rng() * 3);
  const pickKeys = () => Array.from({ length: size }, () => HERO_KEYS[Math.floor(rng() * HERO_KEYS.length)]);
  seed(n * 7919);
  const A = pickKeys().map(k => makeChampion(k, rng));
  const B = pickKeys().map(k => makeChampion(k, rng));

  // server side
  const S = engine.createDuelState(A, B);
  // client side: same units, same uids, same shape as startArenaCombat()
  client.ctx.__A = JSON.parse(JSON.stringify(S.party));
  client.ctx.__B = JSON.parse(JSON.stringify(S.enemies));
  run(`RUN={isArenaTemp:true,party:__A,gold:0,ascension:0,modifiers:{},inventory:[],combat:null,comboCount:0};
       RUN.combat={isArena:true,enemies:__B,party:RUN.party,queue:[],qi:0,round:1,log:[],over:false};`);
  const C = { party: run('RUN.combat.party'), enemies: run('RUN.combat.enemies') };

  let step = 0;
  for (let round = 1; round <= 40; round++) {
    const orderS = engine.buildTurnOrder(S).map(u => u.uid);
    const orderC = run('buildTurnOrder()').map(u => u.uid);
    if (orderS.join() !== orderC.join()) return `round ${round}: turn order differs`;
    for (const uid of orderS) {
      const find = (st, id) => st.party.concat(st.enemies).find(u => u.uid === id);
      const us = find(S, uid), uc = find(C, uid);
      if (!us.alive) continue;
      step++;
      // status tick
      seed(n * 100003 + step * 17);
      const ls = engine.tickStatus(us).map(l => l.en);
      seed(n * 100003 + step * 17);
      client.ctx.__u = uc;
      const lc = run('tickStatus(__u)');
      if (ls.join('|') !== lc.join('|')) return `step ${step}: tick log differs\n  server: ${ls.join(' | ')}\n  client: ${lc.join(' | ')}`;
      if (!us.alive) continue;
      us.abilities.forEach(a => { if (a.cdLeft > 0) a.cdLeft--; });
      uc.abilities.forEach(a => { if (a.cdLeft > 0) a.cdLeft--; });
      if (us.status.some(s => s.type === 'stun')) continue;
      // decision, made once from the server state and mirrored by index
      const usable = us.abilities.map((a, i) => ({ a, i })).filter(x => x.a.cdLeft <= 0 &&
        (!x.a.minLevel || (us.level || 1) >= x.a.minLevel) && engine.abilityHasTargets(S, x.a, us));
      if (!usable.length) continue;
      const choice = usable[Math.floor(rng() * usable.length)];
      const abS = us.abilities[choice.i], abC = uc.abilities[choice.i];
      const needsTarget = abS.targets === 'single' || abS.targets === 'single-ally';
      let tS = null, tC = null;
      if (needsTarget) {
        const valid = engine.getValidTargets(S, abS, us);
        if (!valid.length) continue;
        tS = valid[Math.floor(rng() * valid.length)];
        tC = find(C, tS.uid);
      }
      abS.cdLeft = abS.cd; abC.cdLeft = abC.cd;
      seed(n * 100003 + step * 17 + 1);
      const logS = engine.applyAbilityEffect(S, us, abS, tS).map(l => l.en);
      seed(n * 100003 + step * 17 + 1);
      client.ctx.__ab = abC; client.ctx.__t = tC;
      const logC = run('applyAbilityEffect(__u,__ab,__t)').slice();
      if (logS.join('|') !== logC.join('|')) return `step ${step} ${us.key} ${abS.id}: log differs\n  server: ${logS.join(' | ')}\n  client: ${logC.join(' | ')}`;
      const d = diff(snap(S.party), snap(C.party), 'party') || diff(snap(S.enemies), snap(C.enemies), 'enemies');
      if (d) return `step ${step} ${us.key} ${abS.id}: ${d}`;
      if (S.comboCount !== run('RUN.comboCount||0')) return `step ${step}: comboCount server=${S.comboCount} client=${run('RUN.comboCount')}`;
      if (!engine.anyAlive(S.party).length || !engine.anyAlive(S.enemies).length) return null;
    }
  }
  return null;
}

const t0 = Date.now();
let fails = 0;
const seen = new Map();
for (let n = 0; n < args.duels; n++) {
  let err;
  try { err = duel(n); } catch (e) { err = 'exception: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | '); }
  if (err) {
    fails++;
    const sig = err.split('\n')[0].replace(/^step \d+ /, '').replace(/\d+/g, '#');
    if (!seen.has(sig)) { seen.set(sig, 1); console.log(`duel ${n}: ${err}`); }
    else seen.set(sig, seen.get(sig) + 1);
  }
}
Math.random = nativeRandom;

// Arena champions: the server rebuilds them (server/champion.js) from its own
// hero-defs.json + saved progress; must equal the client's makeHeroInstance().
const { buildChampionSquad } = require(path.join(__dirname, '..', 'server', 'champion.js'));
let champFails = 0;
const UP = run('JSON.parse(JSON.stringify(UPGRADE_DEFS.map(function(u){return {key:u.key,max:u.max};})))');
const CUST = run('({tpl:Object.keys(HERO_DEFS),passives:CUSTOM_PASSIVES.map(function(p){return p.id;}),points:CUSTOM_HERO_POINTS})');
for (let n = 0; n < 200; n++) {
  const rng = mulberry32(5000 + n);
  const upgrades = {};
  UP.forEach(u => { upgrades[u.key] = Math.floor(rng() * (u.max + 1)); });
  const pts = [0, 0, 0, 0];
  for (let i = 0; i < CUST.points; i++) pts[Math.floor(rng() * 4)]++;
  const custom = { id: 'c_test', name: 'Tester', tplKey: CUST.tpl[Math.floor(rng() * CUST.tpl.length)], pow: pts[0], def: pts[1], spd: pts[2], hp: pts[3], passive: CUST.passives[Math.floor(rng() * CUST.passives.length)], color: '#c98a3b', icon: '★' };
  const progress = { upgrades: upgrades, heroesUnlocked: { ashra: true, doran: true, morwen: true, torvin: true }, customHeroes: [custom] };
  client.ctx.__p = progress;
  run('META.upgrades=Object.assign(defaultMeta().upgrades,__p.upgrades);META.customHeroes=__p.customHeroes;META.heroesUnlocked=Object.assign(defaultMeta().heroesUnlocked,__p.heroesUnlocked);');
  const keys = HERO_KEYS.concat(['c_test']);
  const res = buildChampionSquad(progress, keys.map(k => ({ key: k })), 'en', keys.length);
  if (res.error) { champFails++; console.log('champion ' + n + ': ' + res.error); continue; }
  keys.forEach((k, i) => {
    client.ctx.__k = k;
    const c = JSON.parse(JSON.stringify(run('makeHeroInstance(__k)')));
    const sv = res.heroes[i];
    delete c.uid;
    const diffKey = Object.keys(c).concat(Object.keys(sv)).find(f => f !== 'uid' && JSON.stringify(c[f]) !== JSON.stringify(sv[f]));
    if (diffKey) { champFails++; if (champFails < 5) console.log(`champion ${n} ${k}.${diffKey}: server=${JSON.stringify(sv[diffKey])} client=${JSON.stringify(c[diffKey])}`); }
  });
}
console.log(`arena champions (200 random metas): ${champFails ? champFails + ' MISMATCHED' : 'all identical'}`);
if (champFails) fails += champFails;
console.log(`\n${args.duels} duels${args.equip ? ' (with gear)' : ''} in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${fails ? fails + ' MISMATCHED' : 'all identical'}`);
if (fails) { seen.forEach((c, s) => console.log(`  x${c}  ${s}`)); process.exit(1); }
