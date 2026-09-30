#!/usr/bin/env bash
#
# Full end-to-end run: bring up the datastore stack, wait until every store is
# ready, run the API walkthrough and the UI mission suites, then tear down.
#
set -euo pipefail

cd "$(dirname "$0")/.."

export PGHOST=localhost
export MYSQL_HOST=localhost
export MONGO_HOST=localhost

COMPOSE="docker compose -f compose.test.yaml"

cleanup() {
  echo "==> tearing down datastore stack"
  $COMPOSE down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> starting datastore stack (postgres, mysql, mongo)"
$COMPOSE up -d

echo "==> waiting for datastores to become ready"
ready_pg()    { docker compose -f compose.test.yaml exec -T postgres pg_isready -U bookuser >/dev/null 2>&1; }
ready_mysql() { docker compose -f compose.test.yaml exec -T mysql mysqladmin ping -uroot -proot 2>/dev/null | grep -q alive; }
ready_mongo() { docker compose -f compose.test.yaml exec -T mongo mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1; }

wait_for() {
  local name="$1"; local fn="$2"; local tries=60
  for ((i=1; i<=tries; i++)); do
    if $fn; then echo "    $name ready"; return 0; fi
    sleep 2
  done
  echo "    ERROR: $name did not become ready" >&2
  return 1
}

wait_for postgres ready_pg
wait_for mysql    ready_mysql
wait_for mongo    ready_mongo

echo "==> API walkthrough suite"
npm run test:api

echo "==> UI mission suite"
npm run test:ui

echo "==> E2E complete: all suites passed"
