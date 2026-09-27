#!/usr/bin/env bash
# 任意の SQL ファイルを Management API で実行する。
# 必要な環境変数: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?}"
: "${SUPABASE_PROJECT_REF:?}"
FILE="${1:?usage: run_sql.sh <file.sql>}"

python3 - "$FILE" <<'PY'
import json, os, sys, urllib.request
sql = open(sys.argv[1], encoding="utf-8").read()
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{os.environ['SUPABASE_PROJECT_REF']}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
        try:
            for row in json.loads(body):
                print(row)
        except ValueError:
            print(body)
except urllib.error.HTTPError as e:
    print(e.read().decode(), file=sys.stderr)
    sys.exit(1)
PY
