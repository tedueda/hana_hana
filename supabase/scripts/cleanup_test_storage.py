#!/usr/bin/env python3
"""profiles に存在しない user_id 配下の Storage オブジェクト (孤児) を削除する。
cleanup_test_users.sql 実行後に使う。

環境変数: SUPABASE_ACCESS_TOKEN (Management API), SUPABASE_PROJECT_REF
"""
import json
import os
import urllib.request

from upload_demo_photos import REF, service_role_key

BUCKETS = ["profile-photos", "verification-docs", "salon-photos"]


def api(key: str, method: str, path: str, body=None):
    req = urllib.request.Request(
        f"https://{REF}.supabase.co/storage/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def sql(path: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": path}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main() -> None:
    key = service_role_key()
    live = {row["id"] for row in sql("select id::text from profiles")}
    for bucket in BUCKETS:
        rows = sql(f"select name from storage.objects where bucket_id = '{bucket}'")
        orphans = [r["name"] for r in rows if r["name"].split("/", 1)[0] not in live]
        if orphans:
            api(key, "DELETE", f"object/{bucket}", {"prefixes": orphans})
        print(bucket, "deleted", len(orphans))


if __name__ == "__main__":
    main()
