#!/usr/bin/env bash
# Integrationstest: echter App-Adapter (supabaseApi.ts) gegen Postgres + PostgREST –
# dieselbe REST-Schicht, die Supabase verwendet. Aufruf: npm run test:api
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
PORT=${PGPORT_TEST:-54339}
REST_PORT=${REST_PORT_TEST:-54340}
SECRET="skc-integrationstest-geheimnis-0123456789"
POSTGREST=${POSTGREST_BIN:-supabase/.bin/postgrest}
if [ ! -x "$POSTGREST" ]; then
  mkdir -p supabase/.bin
  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C supabase/.bin
fi

DIR=$(mktemp -d)
chmod 755 "$DIR"
AS=()
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; AS=(runuser -u postgres --); fi
REST_PID=""
cleanup() {
  [ -n "$REST_PID" ] && kill "$REST_PID" 2>/dev/null || true
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap cleanup EXIT

"${AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start -w >/dev/null
PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null)
"${PSQL[@]}" -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f supabase/tests/fixtures.sql

PGRST_DB_URI="postgres://authenticator:authenticator@/postgres?host=$DIR&port=$PORT" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" \
PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=crit \
  "$POSTGREST" > "$DIR/postgrest.log" 2>&1 &
REST_PID=$!
curl -s --retry 30 --retry-connrefused --retry-delay 1 "http://localhost:$REST_PORT/" > /dev/null || true

SKC_IT_REST="http://localhost:$REST_PORT" SKC_IT_SECRET="$SECRET" \
  npx vitest run src/data/supabase/supabaseApi.integration.test.ts
