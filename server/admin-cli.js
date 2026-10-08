'use strict';
/**
 * Tiny server-side helper for the admin panel setup. Run on the server:
 *   node admin-cli.js find <username>   -> prints that account's numeric id
 * Put the id into .env as ADMIN_USER_ID and restart the service.
 */
require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'embermarch.sqlite');
const [cmd, name] = process.argv.slice(2);
if (cmd !== 'find' || !name) {
  console.log('Usage: node admin-cli.js find <username>');
  process.exit(1);
}
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
const row = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?').get(name);
if (!row) { console.log('No user named "' + name + '".'); process.exit(1); }
console.log('id=' + row.id + '  username=' + row.username + '  created=' + row.created_at);
console.log('Set ADMIN_USER_ID=' + row.id + ' in .env, then: sudo systemctl restart embermarch-server');
