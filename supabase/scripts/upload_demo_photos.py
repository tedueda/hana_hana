#!/usr/bin/env python3
"""seed_demo_users.sql のデモ会員 4 名の写真 (supabase/assets/demo/*.jpg) を
profile-photos/<user_id>/main.jpg へアップロードする。

環境変数: SUPABASE_ACCESS_TOKEN (Management API), SUPABASE_PROJECT_REF
service_role キーは Management API から取得し、メモリ上でのみ使用する。
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

REF = os.environ["SUPABASE_PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
BUCKET = "profile-photos"
ASSETS = Path(__file__).resolve().parents[1] / "assets" / "demo"

USERS = [
    ("d2000000-0000-4000-8000-000000000001", "saki.jpg"),
    ("d2000000-0000-4000-8000-000000000002", "yuma.jpg"),
    ("d2000000-0000-4000-8000-000000000003", "jieun.jpg"),
    ("d2000000-0000-4000-8000-000000000004", "minjun.jpg"),
]


def service_role_key() -> str:
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req) as r:
        keys = json.load(r)
    for k in keys:
        if k.get("name") == "service_role":
            return k["api_key"]
    sys.exit("service_role key not found")


def upload(key: str, path: str, data: bytes) -> None:
    req = urllib.request.Request(
        f"https://{REF}.supabase.co/storage/v1/object/{BUCKET}/{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req) as r:
        print(path, r.status)


def main() -> None:
    key = service_role_key()
    for uid, fname in USERS:
        upload(key, f"{uid}/main.jpg", (ASSETS / fname).read_bytes())


if __name__ == "__main__":
    main()
