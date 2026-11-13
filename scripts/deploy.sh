#!/usr/bin/env bash
# Deploys the code already pulled on an o2switch app (staging or production): installs, builds, migrates and restarts.
# Run from anywhere, after `git pull`: `bash scripts/deploy.sh`. BACKUP=1 dumps the database before migrating.
# FIXTURES=1 (staging only: the main branch, without BACKUP) reloads the fixtures after the restart.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${FIXTURES:-0}" == 1 ]] && { [[ "${BACKUP:-0}" == 1 ]] || [[ "$(git branch --show-current)" != main ]]; }; then
  echo "Fixtures are loaded on staging only (main branch, no backup): never in production." >&2
  exit 1
fi

# cPanel's npm wrapper installs in its own folder and ignores workspaces: the real Node of the app's version.
export PATH="${NODE_BIN:-/opt/alt/alt-nodejs24/root/usr/bin}:$PATH"

if [[ ! -L .env ]]; then
  echo "Missing .env -> apps/api/.env link: the API reads the .env of the app root." >&2
  exit 1
fi

echo "▶ Install (node $(node -v), npm $(npm -v))"
# Development dependencies too: Prisma CLI, tsup and Vite build the app.
NODE_ENV=development npm ci --no-audit --no-fund

echo "▶ Build"
(cd apps/api && npx --no-install prisma generate)
# The sub-domain serves apps/web/dist, where cPanel writes the .htaccess that hands requests to Passenger: the web
# build empties the folder, so it is put back.
htaccess="$(mktemp)"
if [[ -f apps/web/dist/.htaccess ]]; then cp apps/web/dist/.htaccess "$htaccess"; fi
npm run build
if [[ -s "$htaccess" ]]; then cp "$htaccess" apps/web/dist/.htaccess; fi
rm -f "$htaccess"

if [[ "${BACKUP:-0}" == 1 ]]; then
  echo "▶ Database backup"
  url="$(sed -n 's/^DATABASE_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' apps/api/.env)"
  dir="$HOME/backups/$(basename "$PWD")"
  mkdir -p "$dir"
  # pg_dump rejects Prisma's URL parameters (?schema=…).
  pg_dump "${url%%\?*}" -Fc -f "$dir/$(date +%Y%m%d-%H%M%S).dump"
  # The 10 latest backups are kept (timestamped names: ls is safe).
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.dump | tail -n +11 | xargs -r rm --
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.dump | head -1
fi

echo "▶ Migrations"
(cd apps/api && npx --no-install prisma migrate deploy)

echo "▶ Restart"
mkdir -p tmp
touch tmp/restart.txt

if [[ "${FIXTURES:-0}" == 1 ]]; then
  # The demo data of the staging: both workspaces purged and filled again (no prompt, no mailbox without GreenMail).
  echo "▶ Fixtures"
  (cd apps/api && ALLOW_FIXTURES=staging npx --no-install prisma db seed -- --force)
fi
echo "✔ Deployed $(git log --oneline -1)"
