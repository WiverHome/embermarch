// Embermarch service worker: installable app + fast repeat loads.
// - index.html / navigations, style.css, js/*.js: network first (a new deploy
//   arrives immediately and the page never mixes old and new scripts), cached
//   copy only when offline.
// - audio, icons, manifest: stale-while-revalidate (they rarely change).
//   Music (audio/music/) is not precached: each track is cached the first
//   time the player reaches it.
// - The API, the admin panel and anything cross-origin (Google Fonts) are never touched.
// Bump CACHE when the precache list changes.
const CACHE = 'embermarch-v4';
const PRECACHE = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/combat-core.js', './js/lang-api.js', './js/data.js', './js/meta.js', './js/util.js', './js/run.js',
  './js/combat.js', './js/nodes.js', './js/render.js', './js/screens.js', './js/arena.js', './js/main.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './audio/levelup.mp3', './audio/victory.mp3', './audio/defeat.mp3',
  './audio/sfx/buff_1.mp3', './audio/sfx/buff_2.mp3', './audio/sfx/chest.mp3', './audio/sfx/click.mp3', './audio/sfx/coin_1.mp3',
  './audio/sfx/coin_2.mp3', './audio/sfx/coin_3.mp3', './audio/sfx/crit_1.mp3', './audio/sfx/crit_2.mp3', './audio/sfx/crit_3.mp3',
  './audio/sfx/death_1.mp3', './audio/sfx/death_2.mp3', './audio/sfx/dodge_1.mp3', './audio/sfx/dodge_2.mp3', './audio/sfx/equip_1.mp3',
  './audio/sfx/equip_2.mp3', './audio/sfx/equip_3.mp3', './audio/sfx/heal_1.mp3', './audio/sfx/heal_2.mp3', './audio/sfx/hit_1.mp3',
  './audio/sfx/hit_2.mp3', './audio/sfx/hit_3.mp3', './audio/sfx/hit_4.mp3', './audio/sfx/hit_5.mp3', './audio/sfx/hit_magic_1.mp3',
  './audio/sfx/hit_magic_2.mp3', './audio/sfx/hit_magic_3.mp3', './audio/sfx/page_1.mp3', './audio/sfx/page_2.mp3', './audio/sfx/roar_1.mp3',
  './audio/sfx/roar_2.mp3', './audio/sfx/step_ashfall_1.mp3', './audio/sfx/step_ashfall_2.mp3', './audio/sfx/step_frost_1.mp3', './audio/sfx/step_frost_2.mp3',
  './audio/sfx/step_verdant_1.mp3', './audio/sfx/step_verdant_2.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || /\/admin(\/|$)/.test(url.pathname)) return;

  const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage || /\.(js|css)$/.test(url.pathname)) {
    // no-cache: revalidate with the server, skipping the browser HTTP cache's
    // max-age, so a fresh deploy shows up on the next load.
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(isPage ? './index.html' : req, copy)); }
          return res;
        })
        .catch(() => caches.match(isPage ? './index.html' : req).then((hit) => hit || Response.error()))
    );
    return;
  }
  // Music: cache first, no revalidation (a track is ~1 MB); bump CACHE when replacing one.
  if (url.pathname.includes('/audio/music/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }
  // Assets: stale-while-revalidate — instant from cache, refreshed in the
  // background so a changed mp3/icon arrives on the following load.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      });
      if (hit) { net.catch(() => {}); return hit; }
      return net.catch(() => Response.error());
    })
  );
});
