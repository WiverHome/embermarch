// gen-hero-defs.js
// Exports the hero tables the server needs to rebuild arena champions on its
// own (server/hero-defs.json): HERO_DEFS (stats + ability mechanics), the
// damage-type map, upgrade rank caps and prices, achievement rewards, custom-hero rules. Run after changing
// any of those in index.html:  node tools/gen-hero-defs.js
// parity-check.js verifies the server-built champion equals makeHeroInstance().
'use strict';

const fs = require('fs');
const path = require('path');
const { loadClient } = require('./load-client');

const client = loadClient({ quiet: true });
const run = client.run;

const data = run(`JSON.parse(JSON.stringify({
  heroes: HERO_DEFS,
  dmgType: HERO_DMG_TYPE,
  unlockAchievement: HERO_UNLOCK_ACHIEVEMENT,
  upgradeMax: UPGRADE_DEFS.reduce(function(o,u){o[u.key]=u.max;return o;},{}),
  /* For server/progress-guard.js: ember price of each rank, and achievement rewards. */
  upgradeCost: UPGRADE_DEFS.reduce(function(o,u){o[u.key]=[];for(let r=0;r<u.max;r++)o[u.key].push(u.cost(r));return o;},{}),
  achievementReward: ACHIEVEMENTS.reduce(function(o,a){o[a.id]=a.reward;return o;},{}),
  custom: {
    points: CUSTOM_HERO_POINTS,
    max: CUSTOM_HERO_MAX,
    hpPerPoint: CUSTOM_HP_PER_POINT,
    passives: CUSTOM_PASSIVES.map(function(p){return p.id;}),
    colors: CUSTOM_COLOR_SWATCHES.map(function(s){return s.c;}),
    icons: CUSTOM_ICON_SWATCHES.map(function(s){return s.icon;}),
  },
}))`);

const out = path.join(__dirname, '..', 'server', 'hero-defs.json');
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log('wrote ' + out + ' (' + Object.keys(data.heroes).length + ' heroes)');
