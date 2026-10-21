#!/usr/bin/env node
/* Builds the game's audio from downloaded CC0 sources (see audio/CREDITS.md):
   background music -> audio/music/*.mp3, sound effects -> audio/sfx/*.mp3.
   Development only; the game ships the built mp3 files, never the sources.

   Usage: node tools/build-audio.js <source-dir> [--only=name,name]
     <source-dir> holds the original files under the names in MUSIC/SFX below
     (packs unzipped into kenney_rpg/, kenney_impact/, rpg80/, rubberduck_water/).
     --only rebuilds just the listed MUSIC/SFX entries (e.g. one new land)
     when the rest of the sources aren't at hand.
   ffmpeg: $FFMPEG, else the `ffmpeg-static` npm package if resolvable, else
   `ffmpeg` from PATH. */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('usage: node tools/build-audio.js <source-dir> [--only=name,name]'); process.exit(1); }
const ONLY_ARG = process.argv.slice(3).find(function (a) { return a.indexOf('--only=') === 0; });
const ONLY = ONLY_ARG ? ONLY_ARG.slice(7).split(',').filter(Boolean) : null;
function wanted(name) { return !ONLY || ONLY.indexOf(name) >= 0; }

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require('ffmpeg-static'); } catch (e) {}
  return 'ffmpeg';
}
const FF = ffmpegPath();
function ff(args) { execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y'].concat(args), { stdio: 'inherit' }); }
function probe(args) { return String(spawnSync(FF, ['-hide_banner'].concat(args), { encoding: 'utf8' }).stderr || ''); }
function duration(file) {
  const m = probe(['-i', file]).match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
}

function peakDb(file) {
  const m = probe(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']).match(/max_volume: (-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : 0;
}

/* Music: loudness-normalised, 64 kbit/s stereo. `loop` tracks are seamless
   loops and get no fades; the rest get a short fade in/out so the player can
   restart them (or move to the next track of the mood) without a hard cut. */
const MUSIC = {
  title:          { src: 'title.mp3' },
  ashfall_map:    { src: 'ashfall_map.ogg' },
  frost_map:      { src: 'frost_map.flac', loop: true },
  verdant_map:    { src: 'verdant_map.mp3' },
  ashfall_battle: { src: 'ashfall_battle.mp3' },
  frost_battle:   { src: 'frost_battle.wav' },
  verdant_battle: { src: 'verdant_battle.mp3' },
  drowned_map:    { src: 'dungeon_ambient_1.ogg', loop: true },
  drowned_battle: { src: 'ZombiesAreComing.ogg', loop: true },
  arena:          { src: 'arena.flac' },
  boss1:          { src: 'boss1.wav' },
  boss2:          { src: 'boss2.wav' },
  victory:        { src: 'victory.mp3' },
};

/* Sound effects: name -> source files (variants are picked at random in
   game, see SFX_FILES in js/util.js). Peak-normalised mono 64 kbit/s. */
const K = 'kenney_rpg', I = 'kenney_impact', R = 'rpg80', W = 'rubberduck_water';
function find(dir, name) {
  const stack = [path.join(SRC, dir)];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p); else if (e.name === name) return p;
    }
  }
  throw new Error('not found: ' + dir + '/' + name);
}
const SFX = {
  hit:     [[I, 'impactPunch_medium_000.ogg'], [I, 'impactPunch_medium_001.ogg'], [I, 'impactPunch_medium_002.ogg'], [K, 'knifeSlice.ogg'], [K, 'knifeSlice2.ogg']],
  hit_magic: [[R, 'spell_fire_01.ogg'], [R, 'spell_fire_02.ogg'], [R, 'spell_fire_03.ogg']],
  crit:    [[I, 'impactPunch_heavy_000.ogg'], [I, 'impactPunch_heavy_001.ogg'], [I, 'impactPunch_heavy_002.ogg']],
  heal:    [[R, 'spell_01.ogg'], [R, 'spell_02.ogg']],
  buff:    [[R, 'item_gem_01.ogg'], [R, 'item_gem_02.ogg']],
  dodge:   [[K, 'cloth1.ogg'], [K, 'cloth2.ogg']],
  death:   [[R, 'creature_die_01.ogg'], [I, 'impactSoft_heavy_000.ogg']],
  click:   [[K, 'metalClick.ogg']],
  coin:    [[K, 'handleCoins.ogg'], [K, 'handleCoins2.ogg'], [R, 'item_coins_01.ogg']],
  equip:   [[K, 'beltHandle1.ogg'], [K, 'clothBelt.ogg'], [K, 'drawKnife1.ogg']],
  page:    [[K, 'bookFlip1.ogg'], [K, 'bookFlip2.ogg']],
  chest:   [[K, 'metalLatch.ogg']],
  roar:    [[R, 'creature_roar_01.ogg'], [R, 'creature_roar_02.ogg']],
  step_ashfall: [[I, 'footstep_concrete_000.ogg'], [I, 'footstep_concrete_001.ogg']],
  step_frost:   [[I, 'footstep_snow_000.ogg'], [I, 'footstep_snow_001.ogg']],
  step_verdant: [[I, 'footstep_grass_000.ogg'], [I, 'footstep_grass_001.ogg']],
  step_drowned: [[W, 'splash_10.ogg'], [W, 'splash_06.ogg']],
};

const musicDir = path.join(ROOT, 'audio', 'music');
const sfxDir = path.join(ROOT, 'audio', 'sfx');
fs.mkdirSync(musicDir, { recursive: true });
fs.mkdirSync(sfxDir, { recursive: true });

for (const [name, m] of Object.entries(MUSIC)) {
  if (!wanted(name)) continue;
  const src = path.join(SRC, m.src);
  const dur = duration(src);
  let af = 'loudnorm=I=-18:TP=-1.5:LRA=11';
  if (!m.loop && dur > 6) af += ',afade=t=in:d=0.4,afade=t=out:st=' + (dur - 2.5).toFixed(2) + ':d=2.5';
  ff(['-i', src, '-vn', '-af', af, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', path.join(musicDir, name + '.mp3')]);
  console.log('music', name, Math.round(dur) + 's');
}

const manifest = {};
for (const [name, list] of Object.entries(SFX)) {
  if (!wanted(name)) continue;
  manifest[name] = list.map(function (pair, i) {
    const out = name + (list.length > 1 ? '_' + (i + 1) : '') + '.mp3';
    const src = find(pair[0], pair[1]);
    const gain = (-1 - peakDb(src)).toFixed(1);
    ff(['-i', src, '-vn', '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,volume=' + gain + 'dB', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', path.join(sfxDir, out)]);
    return out;
  });
}
console.log('sfx', JSON.stringify(manifest));
