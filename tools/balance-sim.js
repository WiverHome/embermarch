// balance-sim.js
// Plays whole marches headlessly on the REAL client code (index.html loaded via
// load-client.js) with a reasonable bot, and prints win/death statistics.
// Dev tool only, nothing here ships to players.
//
//   node tools/balance-sim.js                 # default matrix, 40 runs per cell
//   node tools/balance-sim.js --runs 200 --asc 0,2,4 --meta fresh,max
//   node tools/balance-sim.js --party bram,sael,yvana --runs 100
//   node tools/balance-sim.js --json out.json # also dump raw results
'use strict';

const fs = require('fs');
const { loadClient } = require('./load-client');

function parseArgs(argv) {
  const a = { runs: 40, asc: [0, 2, 4], meta: ['fresh', 'mid', 'max'], party: null, json: null, seed: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--runs') { a.runs = +v; i++; }
    else if (k === '--asc') { a.asc = v.split(',').map(Number); i++; }
    else if (k === '--meta') { a.meta = v.split(','); i++; }
    else if (k === '--party') { a.party = v.split(','); i++; }
    else if (k === '--json') { a.json = v; i++; }
    else if (k === '--seed') { a.seed = +v; i++; }
    else if (k === '--career') { a.career = +v; i++; }
    else if (k === '--career-asc') { a.careerAsc = +v; i++; }
    else if (k === '--max-runs') { a.maxRuns = +v; i++; }
    else if (k === '--set') { a.set = v; i++; } // e.g. --set "ENEMY_TUNING.rampCube=0.6;ENEMY_TUNING.ascStep=0.15"
  }
  return a;
}

// Small seedable PRNG so a sim batch is reproducible with --seed.
function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- timer queue: the client paces combat with setTimeout; we drain it synchronously.
const timers = [];
function fakeSetTimeout(fn) { if (typeof fn === 'function') timers.push(fn); return timers.length; }
function drain(limit) {
  let n = 0;
  while (timers.length) {
    if (++n > (limit || 200000)) throw new Error('timer queue did not settle');
    timers.shift()();
  }
}

const client = loadClient({ quiet: true, setTimeout: fakeSetTimeout });
const run = client.run;

// Run end: let the real handlers update META (embers, achievements, unlocks;
// their rendering hits the DOM stub), then record the outcome.
let ended = null;
run(`var __origVictory=onVictory,__origDefeat=onDefeat;
     onVictory=function(){var e0=META.embers;__origVictory();__simEnd({win:true,embers:META.embers-e0});};
     onDefeat=function(){var e0=META.embers;__origDefeat();__simEnd({win:false,embers:META.embers-e0});};
     maybeShowTutorial=function(){};
     maybeShowChapterTransition=function(){};
     scheduleMetaSync=function(){};`);
client.ctx.__simEnd = r => { ended = r; };

const HERO_KEYS = run('Object.keys(HERO_DEFS)');
{ const pre = parseArgs(process.argv); if (pre.set) { run(pre.set); console.log('set: ' + pre.set); } }
const UPG = run('UPGRADE_DEFS.map(function(u){return {key:u.key,max:u.max};})');

function setMeta(profile, asc) {
  run('META=defaultMeta()');
  const ranks = {};
  UPG.forEach(u => {
    ranks[u.key] = profile === 'max' ? u.max : profile === 'mid' ? Math.ceil(u.max / 2) : 0;
  });
  client.ctx.__ranks = ranks;
  run(`Object.keys(__ranks).forEach(function(k){META.upgrades[k]=__ranks[k];});
       META.ascensionUnlocked=5;META.ascensionChoice=${asc};
       META.tutorial=META.tutorial||{};`);
}

// ---- bot policy (all decisions live here, in plain Node) ----
const STAT_W = { atk: 1.6, str: 1.6, int: 1.6, pow: 1.6, def: 1.0, mdef: 0.8, spd: 1.4, hp: 0.25, maxHp: 0.25, crit: 0.3 };
function itemScoreFor(hero, item) {
  if (!item) return 0;
  const dt = hero.dmgType || 'str';
  let s = 0;
  Object.keys(item.mods || {}).forEach(k => {
    if ((k === 'str' || k === 'int') && k !== dt) return; // wrong primary stat is useless
    s += (STAT_W[k] || 0.5) * item.mods[k];
  });
  if (item.passive) s += 4;
  return s;
}
function bestEquipTarget(item) {
  const party = run('RUN.party');
  let best = null, bestGain = 0.01;
  party.forEach((h, i) => {
    if (!h.alive) return;
    client.ctx.__h = h; client.ctx.__it = item;
    if (!run('heroCanUseItem(__h,__it)')) return;
    const hClone = Object.assign({}, h, { dmgType: run('dmgTypeOf(__h)') });
    const gain = itemScoreFor(hClone, item) - itemScoreFor(hClone, h.equip[item.slot]);
    if (gain > bestGain) { bestGain = gain; best = i; }
  });
  return best;
}
function equipOrStash(item) {
  const i = bestEquipTarget(item);
  client.ctx.__it = item;
  if (i === null) run('RUN.inventory.push(__it)');
  else run(`applyItemToHero(RUN.party[${i}],__it)`);
}
function hpRatio() {
  return run('(function(){var a=RUN.party.filter(function(h){return h.alive;});if(!a.length)return 0;return a.reduce(function(s,h){return s+h.hp/h.maxHp;},0)/a.length;})()');
}
function lowestHeroIdx() {
  if (process.env.SIM_DEBUG && !run('RUN.party.some(function(h){return h.alive&&h.hp/h.maxHp<2;})'))
    console.log('DBG', JSON.stringify(run('RUN.party.map(function(h){return [h.key,h.alive,h.hp,h.maxHp];})')), run('RUN.combat&&RUN.combat.node.type'), new Error().stack.split('\n')[2]);
  return run('(function(){var b=-1,r=2;RUN.party.forEach(function(h,i){if(h.alive&&h.hp/h.maxHp<r){r=h.hp/h.maxHp;b=i;}});return b;})()');
}
const PERK_PREF = ['pow', 'hp', 'spd', 'def', 'mdef'];
function resolveLevelUpsSmart() {
  const pend = run('RUN.pendingLevelUps||[]');
  pend.forEach(pl => {
    const key = PERK_PREF.find(k => pl.options.indexOf(k) >= 0) || pl.options[0];
    run(`applyLevelPerkByKey(RUN.party.find(function(x){return x.key===${JSON.stringify(pl.heroKey)};}),${JSON.stringify(key)})`);
  });
  run('RUN.pendingLevelUps=[]');
}

function chooseNode(ids) {
  const nodes = ids.map(id => run(`findNode(RUN.map,${JSON.stringify(id)})`));
  const hp = hpRatio(), gold = run('RUN.gold');
  const score = n => {
    switch (n.type) {
      case 'boss': return 100;
      case 'rest': return hp < 0.55 ? 50 : 8;
      case 'shop': return gold >= 45 ? 30 : 2;
      case 'elite': return hp > 0.8 ? 25 : -10;
      case 'battle': return hp > 0.4 ? 20 : 5;
      case 'event': return 12;
      default: return 0;
    }
  };
  nodes.sort((a, b) => score(b) - score(a));
  return nodes[0];
}

function playCombat() {
  run('RUN.combat.autoBattle=true;if(RUN.combat.phase==="hero_choose"&&RUN.combat.activeHero)autoActHero(RUN.combat.activeHero);');
  drain();
}
function takeReward() {
  // reward cards are already built; mimic the best click
  const pr = run('RUN.pendingReward');
  if (!pr) return;
  resolveLevelUpsSmart();
  const hp = hpRatio();
  let pickCard = null, pickVal = -1;
  pr.cards.forEach(c => {
    let v = 0;
    if (c.type === 'item') { const i = bestEquipTarget(c.item); v = i === null ? 1 : 10 + itemScoreFor({ dmgType: 'str' }, c.item); }
    else if (c.type === 'gold') v = 4 + c.amount / 10;
    else if (c.type === 'elixir') v = hp < 0.6 ? 20 : 3;
    if (v > pickVal) { pickVal = v; pickCard = c; }
  });
  if (pickCard) {
    if (pickCard.type === 'item') equipOrStash(pickCard.item);
    else if (pickCard.type === 'gold') run(`RUN.gold+=${pickCard.amount}`);
    else if (pickCard.type === 'elixir') run(`(function(h){h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.6));})(RUN.party[${lowestHeroIdx()}])`);
  }
  run('var __n=RUN.pendingReward.node;RUN.pendingReward=null;finishRewardNode(__n);');
  drain();
}
function doEvent(node) {
  run(`startEvent(findNode(RUN.map,${JSON.stringify(node.id)}))`);
  const choices = run('currentEvent.def.choices.length');
  // Bot: random choice but avoid the last ("leave") option half the time.
  const idx = Math.floor(Math.random() * choices);
  run(`(function(){var c=currentEvent.def.choices[${idx}];RUN.pendingItemPickup=null;c.resolve(RUN);
       completeCurrentNode(currentEvent.node);})()`);
  const item = run('RUN.pendingItemPickup');
  if (item) { run('RUN.pendingItemPickup=null'); equipOrStash(item); }
}
function doShop(node) {
  run(`startShop(findNode(RUN.map,${JSON.stringify(node.id)}))`);
  const stock = run('RUN.shopStockByNode[RUN._shopNode.id]');
  stock.forEach((s, si) => {
    if (s.sold) return;
    const gold = run('RUN.gold');
    if (gold < s.price) return;
    let buy = false;
    if (s.kind === 'item') buy = bestEquipTarget(s.item) !== null;
    else if (s.kind === 'elixir') buy = hpRatio() < 0.6;
    else if (s.kind === 'vigor') buy = gold >= s.price + 30;
    if (!buy) return;
    run(`(function(s){RUN.gold-=s.price;s.sold=true;})(RUN.shopStockByNode[RUN._shopNode.id][${si}])`);
    if (s.kind === 'item') equipOrStash(s.item);
    else if (s.kind === 'elixir') run(`(function(h){h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.6));})(RUN.party[${lowestHeroIdx()}])`);
    else run(`(function(h){h.maxHp+=6;h.hp+=6;})(RUN.party[${lowestHeroIdx()}])`);
  });
  run('afterLeaveNode(RUN._shopNode)');
}
function doRest(node) {
  run(`startRest(findNode(RUN.map,${JSON.stringify(node.id)}))`);
  if (hpRatio() < 0.75) run('RUN.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*restHealFrac()));})');
  else run('(function(h){var dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+3;h.def+=1;})(RUN.party.filter(function(h){return h.alive;})[0])');
  run('afterLeaveNode(RUN._restNode)');
}

function playOneRun(party) {
  ended = null;
  timers.length = 0;
  client.ctx.__party = party;
  run('startNewRun(__party,null)');
  let guard = 0;
  while (!ended) {
    if (++guard > 200) throw new Error('run did not finish');
    const ids = run('RUN.availableNodeIds');
    if (!ids || !ids.length) throw new Error('no available nodes');
    if (!run('RUN.party.some(function(h){return h.alive;})')) throw new Error('party wiped outside combat, last node: ' + run('JSON.stringify((RUN.combat&&RUN.combat.node&&RUN.combat.node.type)||RUN.currentNodeId)') + ' over=' + run('RUN.combat&&RUN.combat.over'));
    const node = chooseNode(ids);
    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      run(`startCombat(findNode(RUN.map,${JSON.stringify(node.id)}))`);
      playCombat();
      if (!ended) takeReward();
    } else if (node.type === 'event') doEvent(node);
    else if (node.type === 'shop') doShop(node);
    else if (node.type === 'rest') doRest(node);
  }
  const res = run('({layers:RUN.layersCleared,gold:RUN.gold,levels:RUN.party.map(function(h){return h.level||1;}),alive:RUN.party.filter(function(h){return h.alive;}).length,bosses:Object.keys(RUN.bossesBeaten||{}).length})');
  return Object.assign(res, ended, { party });
}

// ---- driver ----
const args = parseArgs(process.argv);
if (args.seed != null) {
  const rng = mulberry32(args.seed);
  client.ctx.Math.random = rng; // same Math object as Node's; tools only
}
const allParties = [];
(function combos() {
  const k = HERO_KEYS.filter(h => h !== 'torvin'); // Torvin is a paid unlock
  for (let a = 0; a < k.length; a++) for (let b = a + 1; b < k.length; b++) for (let c = b + 1; c < k.length; c++) allParties.push([k[a], k[b], k[c]]);
})();

// ---- career mode: a brand-new account plays asc 0, buys upgrades greedily
// (cheapest affordable, respecting branch requirements) and only uses heroes
// it has unlocked. Measures how many marches it takes to reach the first win.
function buyUpgradesGreedy() {
  for (;;) {
    const opts = run(`UPGRADE_DEFS.filter(function(d){
        var r=META.upgrades[d.key]||0; if(r>=d.max)return false;
        if(d.requires&&(META.upgrades[d.requires.key]||0)<d.requires.rank)return false;
        if(d.requires2&&!d.requires2.every(function(q){return (META.upgrades[q.key]||0)>=q.rank;}))return false;
        return d.cost(r)<=META.embers;
      }).map(function(d){return {key:d.key,cost:d.cost(META.upgrades[d.key]||0)};})`);
    if (!opts.length) return;
    opts.sort((a, b) => a.cost - b.cost);
    run(`META.embers-=${opts[0].cost};META.upgrades[${JSON.stringify(opts[0].key)}]=(META.upgrades[${JSON.stringify(opts[0].key)}]||0)+1;`);
  }
}
function career(maxRuns) {
  run('META=defaultMeta();META.tutorial=META.tutorial||{};');
  const log = [];
  for (let i = 1; i <= maxRuns; i++) {
    const unlocked = HERO_KEYS.filter(k => run(`heroUnlockedForSelect(${JSON.stringify(k)})`));
    const pool = allParties.filter(p => p.every(k => unlocked.indexOf(k) >= 0));
    const party = args.party || pool[Math.floor(Math.random() * pool.length)];
    run('META.ascensionChoice=' + (args.careerAsc || 0));
    const res = playOneRun(party);
    log.push({ run: i, win: res.win, layers: res.layers, embers: res.embers });
    if (res.win) return { firstWin: i, log };
    buyUpgradesGreedy();
  }
  return { firstWin: null, log };
}

const results = [];
const t0 = Date.now();
if (args.career) {
  const out = [];
  for (let c = 0; c < args.career; c++) out.push(career(args.maxRuns || 120));
  const wins = out.filter(o => o.firstWin).map(o => o.firstWin).sort((a, b) => a - b);
  const q = p => wins.length ? wins[Math.min(wins.length - 1, Math.floor(p * wins.length))] : '-';
  console.log(`\n${out.length} careers in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`first win reached: ${wins.length}/${out.length}; marches to first win: median ${q(0.5)}, p25 ${q(0.25)}, p75 ${q(0.75)}, max ${q(1)}`);
  const all = out.flatMap(o => o.log);
  [[1, 5], [6, 15], [16, 30], [31, 60], [61, 120]].forEach(([a, b]) => {
    const s = all.filter(r => r.run >= a && r.run <= b);
    if (s.length) console.log(`  marches ${String(a).padStart(3)}-${String(b).padEnd(3)} avg layers ${avg(s.map(r => r.layers)).padStart(5)}  avg embers ${avg(s.map(r => r.embers || 0))}`);
  });
  process.exit(0);
}
args.meta.forEach(profile => {
  args.asc.forEach(asc => {
    for (let r = 0; r < args.runs; r++) {
      setMeta(profile, asc);
      const party = args.party || allParties[Math.floor(Math.random() * allParties.length)];
      let res;
      try { res = playOneRun(party); }
      catch (e) { res = { error: String(e.stack || e).split('\n').slice(0, 4).join(' | '), party, layers: run('RUN?RUN.layersCleared:0') }; }
      res.meta = profile; res.asc = asc;
      results.push(res);
    }
  });
});

// ---- report ----
function pct(n, d) { return d ? (100 * n / d).toFixed(0) + '%' : '-'; }
function avg(a) { return a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-'; }
const errs = results.filter(r => r.error);
const ok = results.filter(r => !r.error);
console.log(`\n${results.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors: ${errs.length}`);
if (errs.length) console.log('  first error:', errs[0].error);

console.log('\nWin rate by meta x ascension (avg layers cleared of 20):');
console.log('meta   ' + args.asc.map(a => ('asc' + a).padEnd(16)).join(''));
args.meta.forEach(m => {
  let line = m.padEnd(7);
  args.asc.forEach(a => {
    const c = ok.filter(r => r.meta === m && r.asc === a);
    line += (pct(c.filter(r => r.win).length, c.length) + ' / ' + avg(c.map(r => r.layers))).padEnd(16);
  });
  console.log(line);
});

console.log('\nWhere marches end (layers cleared, all cells):');
const buckets = {};
ok.filter(r => !r.win).forEach(r => { const b = Math.floor(r.layers / 3) * 3; buckets[b] = (buckets[b] || 0) + 1; });
Object.keys(buckets).sort((a, b) => a - b).forEach(b => console.log(`  ${String(b).padStart(2)}-${+b + 2}: ${'#'.repeat(Math.round(60 * buckets[b] / ok.length))} ${buckets[b]}`));
console.log(`  win : ${ok.filter(r => r.win).length}`);

if (!args.party) {
  console.log('\nBy hero (win rate when in party, avg layers):');
  HERO_KEYS.filter(h => h !== 'torvin').map(h => {
    const c = ok.filter(r => r.party.indexOf(h) >= 0);
    return { h, n: c.length, w: c.filter(r => r.win).length / (c.length || 1), l: avg(c.map(r => r.layers)) };
  }).sort((a, b) => b.w - a.w).forEach(x => console.log(`  ${x.h.padEnd(8)} ${(100 * x.w).toFixed(0).padStart(3)}%  layers ${x.l}  (n=${x.n})`));
}

if (args.json) fs.writeFileSync(args.json, JSON.stringify(results, null, 1));
