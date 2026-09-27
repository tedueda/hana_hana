#!/usr/bin/env bash
# Supabase Management API 経由で supabase/migrations/*.sql を順に適用する。
# 必要な環境変数: SUPABASE_ACCESS_TOKEN (Personal Access Token), SUPABASE_PROJECT_REF
# 適用済みファイルは public.schema_migrations に記録し、再実行時はスキップする。
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

run_sql() {
  python3 - "$1" <<'PY'
import json, os, sys, urllib.request
sql = sys.argv[1]
req = urllib.request.Request(
    os.environ["API"],
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        print(r.read().decode()[:2000])
except urllib.error.HTTPError as e:
    print(e.read().decode(), file=sys.stderr)
    sys.exit(1)
PY
}
export API

run_sql "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;"

for f in "$DIR"/*.sql; do
  v="$(basename "$f" .sql)"
  applied="$(run_sql "select 1 from public.schema_migrations where version = '$v';")"
  if [[ "$applied" != "[]" ]]; then
    echo "skip  $v"
    continue
  fi
  echo "apply $v"
  run_sql "begin; $(cat "$f") ; insert into public.schema_migrations(version) values ('$v'); commit;"
done
