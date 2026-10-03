#!/usr/bin/env bash
# Testet Schema, Rechte (RLS) und Funktionen gegen eine frische lokale Postgres-Instanz.
# Benötigt Postgres 15+ (initdb/pg_ctl/psql). Aufruf: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
PORT=${PGPORT_TEST:-54329}
DIR=$(mktemp -d)
AS=()
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; AS=(runuser -u postgres --); fi
cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start -w >/dev/null

PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -o /dev/null -f supabase/tests/rls_test.sql
echo "✅ Datenbank-Tests bestanden"
