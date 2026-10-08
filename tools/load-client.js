// load-client.js
// Loads the client game scripts (the js/*.js files index.html lists in
// <script src> tags, in that order) into one Node vm context with a stubbed DOM, so dev tools (balance-sim, parity-check)
// can call the real client functions without a browser. Not shipped to players.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A "deep stub": any property read returns another stub, any call returns a
// stub. Enough for render/DOM code to run as a no-op.
function deepStub() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(target, key) {
      if (key === Symbol.toPrimitive) return function () { return ''; };
      if (key === Symbol.iterator) return function* () {};
      if (key === 'length') return 0;
      if (key === 'then') return undefined; // not a thenable
      if (key in target && key !== 'name' && key !== 'prototype') return target[key];
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
    has() { return true; },
  });
  return proxy;
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null,
    get length() { return m.size; },
  };
}

// The client's script files, in the order index.html loads them.
function clientScripts(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /<script src="([^"]+)"><\/script>/g;
  const files = [];
  let m;
  while ((m = re.exec(html))) files.push(path.join(path.dirname(htmlPath), m[1]));
  if (!files.length) throw new Error('no <script src> tags found in ' + htmlPath);
  return files;
}

// All client scripts concatenated (for syntax checks).
function extractScript(htmlPath) {
  htmlPath = htmlPath || path.join(__dirname, '..', 'index.html');
  return clientScripts(htmlPath).map(f => fs.readFileSync(f, 'utf8')).join('\n');
}

// opts.setTimeout: by default setTimeout callbacks are dropped. balance-sim
// passes its own queue so the client's animation-paced turn flow can be
// drained synchronously, as fast as the CPU allows.
function loadClient(opts) {
  opts = opts || {};
  const htmlPath = opts.htmlPath || path.join(__dirname, '..', 'index.html');
  const stub = deepStub();
  const sandbox = {
    console: opts.quiet ? { log() {}, warn() {}, error() {}, info() {} } : console,
    document: stub,
    navigator: { language: 'en', userAgent: 'node', vibrate() {} },
    location: { href: 'file:///index.html', protocol: 'file:', hostname: '', search: '', hash: '', reload() {} },
    history: stub,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    fetch: () => new Promise(() => {}), // never settles: no network, no unhandled rejections
    WebSocket: function () { return stub; },
    Audio: function () { return stub; },
    AudioContext: undefined,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: opts.setTimeout || (() => 0),
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => stub,
    innerWidth: 1280,
    innerHeight: 800,
    Math, JSON, Date, Promise, Object, Array, String, Number, Boolean, Map, Set, Error,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  // Classic scripts in one context share the global scope, exactly like the
  // browser. A direct-eval hook defined last can then read and assign every
  // top-level const/let/function.
  clientScripts(htmlPath).forEach(function (f) {
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.relative(path.dirname(htmlPath), f) });
  });
  vm.runInContext('globalThis.__EM_eval=function(__c){return eval(__c);};', ctx, { filename: 'load-client#eval-hook' });
  return {
    ctx,
    // Evaluate an expression in the client's global scope (sees top-level const/let).
    run: code => ctx.__EM_eval(code),
  };
}

module.exports = { loadClient, extractScript, clientScripts };

if (require.main === module) {
  const c = loadClient({ quiet: false });
  console.log('heroes:', c.run('Object.keys(HERO_DEFS).join(",")'));
  console.log('enemies:', c.run('Object.keys(ENEMY_DEFS).length'), 'bosses:', c.run('Object.keys(BOSS_DEFS).length'));
}
