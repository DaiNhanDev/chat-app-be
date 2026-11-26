#!/usr/bin/env bash
set -euo pipefail

# The SSH step invokes this from a newly extracted releases/<commit>-<run>-<attempt>.
release=$(pwd -P)
root=$(dirname "$(dirname "$release")")
current="$root/current"
previous=''

fail() {
  printf 'Deploy error: %s\n' "$*" >&2
  exit 1
}

echo 'Checking server prerequisites'
if ! command -v node >/dev/null || ! command -v npm >/dev/null || ! command -v pm2 >/dev/null; then
  nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -s "$nvm_script" ]]; then
    echo 'Loading Node.js from nvm for the SSH user'
    set +u
    source "$nvm_script" || fail 'Could not load nvm for the deploy user'
    set -u
  fi
fi
for tool in node npm pm2 curl; do
  command -v "$tool" >/dev/null || fail "$tool is not available in the deploy user's SSH PATH"
done
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22 ? 1 : 0)'; then
  fail 'Node.js 22 or newer is required for chat-be'
fi
if [[ -d /proc/self ]]; then
  process_cwd() { readlink "/proc/$1/cwd"; }
else
  command -v lsof >/dev/null || fail 'lsof is required to verify PM2 when /proc is unavailable'
  process_cwd() { lsof -a -p "$1" -d cwd -Fn | sed -n 's/^n//p'; }
fi

if [[ -L "$current" ]]; then
  previous=$(cd "$current" && pwd -P) || fail 'current points to an unavailable release'
elif [[ -e "$current" ]] || pm2 describe chat-be >/dev/null 2>&1; then
  fail 'First deployment requires an unused current path and PM2 app name chat-be'
fi

[[ -f .env && ! -L .env ]] || fail 'The release is missing its generated .env file'
[[ -f dist/server.js ]] || fail 'The release is missing dist/server.js'
chmod 600 .env
export NODE_ENV=production
echo 'Installing production dependencies'
npm ci --omit=dev --no-audit --no-fund

# Load the same file that PM2 will use for this release.
echo 'Checking runtime configuration and MongoDB'
port=$(DOTENV_CONFIG_PATH="$release/.env" DOTENV_CONFIG_OVERRIDE=true node <<'NODE'
const { accessSync, constants } = require('node:fs');
const { env } = require('./dist/configs/env.config');
const { conversationLink } = require('./dist/services/push.service');
const { firebaseDatabase } = require('./dist/configs/firebase.config');
const { MongoClient } = require('mongoose').mongo;
(async () => {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentials) {
    try {
      accessSync(credentials, constants.R_OK);
    } catch {
      console.error('GOOGLE_APPLICATION_CREDENTIALS is not readable by the deploy user');
      process.exitCode = 1;
      return;
    }
  }
  try {
    conversationLink(env.pwaBaseUrl, 'check');
    firebaseDatabase();
  } catch {
    console.error('Check FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS and PWA_BASE_URL');
    process.exitCode = 1;
    return;
  }
  const db = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  try {
    await db.connect();
    await db.db().command({ ping: 1 });
    console.log(env.port);
  } catch {
    console.error('MongoDB readiness check failed');
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})().catch(() => {
  console.error('Deployment configuration check failed');
  process.exitCode = 1;
});
NODE
)

switch_to() {
  ln -s "$1" "$release/.next-current"
  node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' "$release/.next-current" "$current"
}

restart_and_check() {
  local expected=$1 expected_port=$2 pid i
  echo "Starting PM2 and checking HTTP on port $expected_port"
  CHAT_BE_CWD="$current" pm2 startOrRestart "$current/ecosystem.config.js" --only chat-be --update-env || return 1
  for ((i = 0; i < 20; i++)); do
    pid=$(pm2 pid chat-be) || return 1
    if [[ "$pid" =~ ^[1-9][0-9]*$ ]] &&
      [[ "$(process_cwd "$pid")" == "$expected" ]] &&
      curl -fs --max-time 2 "http://127.0.0.1:$expected_port/docs/swagger.json" -o /dev/null; then
      return 0
    fi
    sleep 1
  done
  printf 'Deploy error: PM2 did not serve /docs/swagger.json from the expected release on port %s\n' "$expected_port" >&2
  printf 'Inspect server logs with: pm2 logs chat-be --lines 50 --nostream\n' >&2
  return 1
}

rollback() {
  local status=$?
  trap - EXIT HUP INT TERM
  if (( status == 0 )) || [[ "$(readlink "$current")" != "$release" ]]; then
    return
  fi
  if [[ -n "$previous" ]]; then
    local previous_port
    echo 'Deployment failed. Restoring the previous release.' >&2
    switch_to "$previous"
    if previous_port=$(cd "$previous" && DOTENV_CONFIG_PATH="$previous/.env" DOTENV_CONFIG_OVERRIDE=true node -p "require('./dist/configs/env.config').env.port") &&
      restart_and_check "$previous" "$previous_port" && pm2 save; then
      echo 'Previous release restored.'
    else
      echo 'Rollback requires operator attention.' >&2
    fi
  else
    pm2 delete chat-be || true
    unlink "$current"
  fi
  exit "$status"
}

trap rollback EXIT
trap 'exit 1' HUP INT TERM
switch_to "$release"
restart_and_check "$release" "$port"
pm2 save
trap - EXIT HUP INT TERM
echo "Deployed ${release##*/}"

# Keep the active and previous releases, plus other workflow releases from the past week.
for old in "$root"/releases/*; do
  [[ ${old##*/} =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ && -d "$old" && ! -L "$old" ]] || continue
  [[ "$old" != "$release" && "$old" != "$previous" ]] || continue
  find "$old" -prune -mtime +7 -exec rm -rf -- {} \;
done
