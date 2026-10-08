#!/usr/bin/env bash
# pack-deploy.sh — builds the deploy archive for the game server.
#
#   bash tools/pack-deploy.sh [server files, relative to server/ ...]
#   bash tools/pack-deploy.sh server.js static.js client-dir.js
#
# Creates _deploy/server-update-YYYYMMDD-HHMM.tar.gz containing the whole game
# client under client/ (the server serves it from /opt/embermarch-server/client)
# plus the listed server files at their paths relative to server/. Unpack with
#   tar -xzf <archive> -C /opt/embermarch-server
# Secrets, the database and node_modules are refused.
set -euo pipefail
cd "$(dirname "$0")/.."

stamp=$(date +%Y%m%d-%H%M)
out="_deploy/server-update-$stamp.tar.gz"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/client" _deploy
cp index.html style.css sw.js manifest.webmanifest "$stage/client/"
cp -r js audio icons "$stage/client/"

for f in "$@"; do
  case "$f" in
    .env*|*/.env*|data|data/*|*.sqlite*|*.db|node_modules|node_modules/*|client|client/*|*..*)
      echo "refusing to pack: $f" >&2; exit 1 ;;
  esac
  if [ ! -f "server/$f" ]; then echo "no such file: server/$f" >&2; exit 1; fi
  mkdir -p "$stage/$(dirname "$f")"
  cp "server/$f" "$stage/$f"
done

tar -czf "$out" -C "$stage" .
echo "$out"
tar -tzf "$out" | grep -v '/$' | sed 's#^\./##'
