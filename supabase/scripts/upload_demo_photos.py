#!/usr/bin/env python3
"""seed_demo_users.sql のデモ会員 4 名に、生成したダミー写真 (profile-photos/<user_id>/main.jpg) をアップロードする。

環境変数: SUPABASE_ACCESS_TOKEN (Management API), SUPABASE_PROJECT_REF
service_role キーは Management API から取得し、メモリ上でのみ使用する。
"""
import io
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

REF = os.environ["SUPABASE_PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
BUCKET = "profile-photos"

USERS = [
    ("d1000000-0000-4000-8000-000000000001", "さくら", (244, 143, 177), (255, 224, 178)),
    ("d1000000-0000-4000-8000-000000000002", "ユウキ", (100, 181, 246), (178, 235, 242)),
    ("d1000000-0000-4000-8000-000000000003", "지우", (186, 104, 200), (255, 205, 210)),
    ("d1000000-0000-4000-8000-000000000004", "민준", (129, 199, 132), (255, 241, 118)),
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


def make_image(label: str, c1, c2) -> bytes:
    w, h = 900, 1200
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        col = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
        for x in range(w):
            px[x, y] = col
    d = ImageDraw.Draw(img)
    d.ellipse((w / 2 - 220, 330, w / 2 + 220, 770), fill=tuple(max(0, c - 40) for c in c1), outline=(255, 255, 255), width=8)
    font = None
    for p in ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"):
        if os.path.exists(p):
            font = ImageFont.truetype(p, 150)
            break
    if font is None:
        font = ImageFont.load_default()
    box = d.textbbox((0, 0), label, font=font)
    d.text(((w - box[2] + box[0]) / 2, 550 - (box[3] - box[1]) / 2 - box[1]), label, fill="white", font=font)
    small = ImageFont.truetype(font.path, 48) if hasattr(font, "path") else font
    d.text((w / 2 - 120, 1050), "DEMO / SAMPLE", fill="white", font=small)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return buf.getvalue()


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
    for uid, label, c1, c2 in USERS:
        upload(key, f"{uid}/main.jpg", make_image(label, c1, c2))


if __name__ == "__main__":
    main()
