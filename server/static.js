// static.js
// Serves the game client itself (index.html, style.css, js/, audio/ with
// audio/sfx/ and audio/music/, icons/,
// sw.js, manifest) from CLIENT_DIR, so the game and its API share one origin.
//
// Only an explicit whitelist is served: CLIENT_DIR may be the repository root
// in a local checkout, where server/ (with .env and the database) sits right
// next to the client files and must never be reachable.
//
// Caching: pages, scripts, styles and sw.js are revalidated on every load
// (no-cache + ETag, so an unchanged file costs a 304 and a deploy shows up at
// once); audio and icons rarely change and are cached for a week.
'use strict';

const path = require('path');
const express = require('express');
const { CLIENT_DIR } = require('./client-dir');

const ROOT_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/sw.js': 'sw.js',
  '/manifest.webmanifest': 'manifest.webmanifest',
};
const DIRS = [
  { url: '/js', exts: ['.js'], maxAge: 0 },
  { url: '/audio', exts: ['.mp3'], maxAge: 7 * 24 * 3600 },
  { url: '/audio/sfx', exts: ['.mp3'], maxAge: 7 * 24 * 3600 },
  { url: '/audio/music', exts: ['.mp3'], maxAge: 7 * 24 * 3600 },
  { url: '/icons', exts: ['.png', '.svg'], maxAge: 7 * 24 * 3600 },
];

// The game page: no inline scripts or on*= handlers exist, so scripts are
// limited to our own files. Inline style attributes are used throughout.
// connect-src: 'self' plus the same host over ws/wss for live PvP (older Safari
// doesn't count ws:// as 'self'). The host comes from the request, so nothing
// about the deployment is hardcoded here.
function pageCsp(host) {
  const h = /^[a-z0-9.:\-\[\]]+$/i.test(host || '') ? host : 'localhost';
  return PAGE_CSP.replace('__WS__', 'wss://' + h + ' ws://' + h);
}
const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self' blob:", // music plays from blob URLs (see musicUrl in js/util.js)
  "connect-src 'self' __WS__",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

function setCommonHeaders(res) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
}

function attachStatic(app) {
  Object.keys(ROOT_FILES).forEach(function (url) {
    app.get(url, function (req, res, next) {
      setCommonHeaders(res);
      res.set('Cache-Control', 'no-cache');
      if (ROOT_FILES[url] === 'index.html') res.set('Content-Security-Policy', pageCsp(req.get('host')));
      res.sendFile(ROOT_FILES[url], { root: CLIENT_DIR, dotfiles: 'deny' }, function (e) { if (e) next(); });
    });
  });

  DIRS.forEach(function (d) {
    const serve = express.static(path.join(CLIENT_DIR, d.url.slice(1)), {
      index: false,
      redirect: false,
      dotfiles: 'deny',
      fallthrough: true,
      setHeaders: function (res) {
        setCommonHeaders(res);
        res.set('Cache-Control', d.maxAge ? 'public, max-age=' + d.maxAge : 'no-cache');
      },
    });
    app.use(d.url, function (req, res, next) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      // One flat level of whitelisted file types: no subfolders, nothing else.
      if (!/^\/[A-Za-z0-9_.-]+$/.test(req.path) || d.exts.indexOf(path.extname(req.path).toLowerCase()) === -1) return next();
      serve(req, res, next);
    });
  });
}

module.exports = { attachStatic: attachStatic, CLIENT_DIR: CLIENT_DIR };
