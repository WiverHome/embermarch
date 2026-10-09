#!/usr/bin/env node
/* Builds the public landing page docs/index.html (served by GitHub Pages)
   from tools/landing.template.html, filling in the heroes and land blurbs
   straight from the client code, and warns when a number written on the page
   no longer matches the game. Development only.

   Usage: node tools/build-landing.js */
const fs = require('fs');
const path = require('path');
const { loadClient } = require('./load-client');

const ROOT = path.join(__dirname, '..');
const c = loadClient({ quiet: true });

const heroes = JSON.parse(c.run(`JSON.stringify(Object.keys(HERO_DEFS).map(function (k) {
  const h = HERO_DEFS[k];
  return { k: k, name: h.name, cls: h.cls, color: h.color, row: h.defaultRow, svg: HERO_ICON_SVG[k] || '',
    ab: (h.abilities || []).map(function (a) { return a.name; }) };
}))`));
const flavor = JSON.parse(c.run('JSON.stringify(BIOME_FLAVOR)'));

/* Numbers in the stats strip, checked against the game. */
const counts = JSON.parse(c.run(`JSON.stringify({
  heroes: Object.keys(HERO_DEFS).length, lands: Object.keys(BIOME_DEFS).length,
  enemies: Object.keys(ENEMY_DEFS).length, bosses: Object.keys(BOSS_DEFS).length,
  items: ITEM_POOL.length, relics: RELIC_POOL.length, events: EVENTS.length,
  achievements: Object.keys(ACHIEVEMENTS).length })`));

let html = fs.readFileSync(path.join(__dirname, 'landing.template.html'), 'utf8');
html = html.replace('/*HEROES*/', JSON.stringify(heroes)).replace('/*FLAVOR*/', JSON.stringify(flavor));

const stripped = html.replace(/<[^>]+>/g, ' ');
const order = ['heroes', 'lands', 'enemies', 'bosses', 'items', 'relics', 'events', 'achievements'];
const shown = [...html.matchAll(/<li><b>(\d+)<\/b>/g)].map(function (m) { return +m[1]; });
let stale = 0;
order.forEach(function (k, i) {
  if (shown[i] !== counts[k]) { stale++; console.warn('stats strip: ' + k + ' shows ' + shown[i] + ', game has ' + counts[k]); }
});
if (stripped.indexOf('/*') !== -1 && /\/\*[A-Z]+\*\//.test(html)) console.warn('unfilled placeholder left in the page');

fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), html);
console.log('docs/index.html written' + (stale ? ' (' + stale + ' stale numbers, update the template)' : ', numbers match the game'));
