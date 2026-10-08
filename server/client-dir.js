// client-dir.js
// Where the browser client (index.html, style.css, js/, audio/, icons/ ...)
// lives. The server needs it twice: it serves the game itself (static.js) and
// it runs the client's own combat math (js/combat-core.js) for live PvP.
//
//   1. CLIENT_DIR from .env, if set;
//   2. server/client/ — the production layout (/opt/embermarch-server/client);
//   3. the repository root one level up — a local checkout.
'use strict';

const fs = require('fs');
const path = require('path');

function resolveClientDir() {
  if (process.env.CLIENT_DIR) return path.resolve(process.env.CLIENT_DIR);
  const deployed = path.join(__dirname, 'client');
  if (fs.existsSync(path.join(deployed, 'index.html'))) return deployed;
  return path.resolve(__dirname, '..');
}

const CLIENT_DIR = resolveClientDir();
const CORE_PATH = path.join(CLIENT_DIR, 'js', 'combat-core.js');
if (!fs.existsSync(CORE_PATH)) {
  throw new Error('Client files not found: ' + CORE_PATH + ' is missing. Deploy the client to ' +
    path.join(__dirname, 'client') + ' or set CLIENT_DIR in .env.');
}

module.exports = { CLIENT_DIR: CLIENT_DIR, CORE_PATH: CORE_PATH };
