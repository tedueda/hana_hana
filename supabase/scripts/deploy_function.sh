#!/usr/bin/env bash
# Supabase Management API で Edge Function をデプロイする (supabase CLI 不要)。
#   usage: deploy_function.sh <slug> [--no-verify-jwt]
# 必要な環境変数: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?}"
: "${SUPABASE_PROJECT_REF:?}"
SLUG="${1:?usage: deploy_function.sh <slug> [--no-verify-jwt]}"
VERIFY_JWT=true
[[ "${2:-}" == "--no-verify-jwt" ]] && VERIFY_JWT=false
DIR="$(cd "$(dirname "$0")/../functions" && pwd)"
export SLUG VERIFY_JWT DIR

python3 - <<'PY'
import json, os, sys, urllib.request, uuid, pathlib
slug, verify, root = os.environ["SLUG"], os.environ["VERIFY_JWT"] == "true", pathlib.Path(os.environ["DIR"])
fn = root / slug
files = [p for p in fn.rglob("*") if p.is_file()]
if (root / "_shared").exists():
    files += [p for p in (root / "_shared").rglob("*") if p.is_file()]
for extra in ("deno.json", "deno.lock"):
    if (root / extra).exists():
        files.append(root / extra)
boundary = uuid.uuid4().hex
meta = {"entrypoint_path": f"{slug}/index.ts", "name": slug, "verify_jwt": verify}
if (root / "deno.json").exists():
    meta["import_map_path"] = "deno.json"
body = b""
def part(name, value, filename=None, ctype="application/octet-stream"):
    global body
    body += f"--{boundary}\r\n".encode()
    if filename:
        body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()
    else:
        body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
    body += value if isinstance(value, bytes) else value.encode()
    body += b"\r\n"
part("metadata", json.dumps(meta))
for p in files:
    part("file", p.read_bytes(), filename=str(p.relative_to(root)))
body += f"--{boundary}--\r\n".encode()
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{os.environ['SUPABASE_PROJECT_REF']}/functions/deploy?slug={slug}",
    data=body, method="POST",
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
)
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read().decode()); print("deployed", d.get("slug"), "version", d.get("version"), "verify_jwt", d.get("verify_jwt"))
except urllib.error.HTTPError as e:
    print(e.read().decode(), file=sys.stderr); sys.exit(1)
PY
