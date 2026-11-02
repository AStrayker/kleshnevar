import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

IG_URL = "https://www.instagram.com/kleshnevar_km_/"
TT_URL = "https://r.jina.ai/https://www.tiktok.com/@kleshnevar"
OUT = Path(__file__).resolve().parents[1] / "followers.json"
GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"


def fetch(url, headers):
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def digits(value):
    number = int(re.sub(r"\D", "", value or ""))
    return number if number > 0 else None


def instagram_count(text):
    match = re.search(r'og:description" content="([\d,\.]+)\s+Followers', text, re.I)
    if not match:
        match = re.search(r"([\d,\.]+)\s+Followers,\s+\d+\s+Following", text, re.I)
    count = digits(match.group(1)) if match else None
    if count is None or not 100 <= count <= 5_000_000:
        return None
    return count


def tiktok_count(text):
    match = re.search(r"Following\s+\*\*(\d[\d\s.,]*)\*\*\s*Followers\b", text, re.I)
    if not match:
        match = re.search(r"\*\*(\d[\d\s.,]*)\*\*\s*Followers\b", text, re.I)
    count = digits(match.group(1)) if match else None
    if count is None or not 1 <= count <= 5_000_000:
        return None
    return count


def plausible(previous, instagram, tiktok):
    for key, value in (("instagram", instagram), ("tiktok", tiktok)):
        old = previous.get(key)
        if isinstance(old, int) and old > 0 and not (old / 3) <= value <= old * 3:
            return False
    return True


def read_counts():
    instagram = None
    tiktok = None
    for attempt in range(3):
        if instagram is None:
            try:
                instagram = instagram_count(fetch(IG_URL, {
                    "User-Agent": GOOGLEBOT,
                    "Accept-Language": "en",
                }))
            except Exception as error:
                print("instagram", error)
        if tiktok is None:
            try:
                tiktok = tiktok_count(fetch(TT_URL, {
                    "User-Agent": "Mozilla/5.0",
                    "X-No-Cache": "true",
                }))
            except Exception as error:
                print("tiktok", error)
        if instagram and tiktok:
            return instagram, tiktok
        time.sleep(2 + attempt)
    return instagram, tiktok


def main():
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception as error:
            print("previous", error)
    instagram, tiktok = read_counts()
    if not instagram or not tiktok or not plausible(previous, instagram, tiktok):
        print(f"skipped ig={instagram} tt={tiktok}")
        return 0
    if previous.get("instagram") == instagram and previous.get("tiktok") == tiktok:
        print(f"unchanged {instagram + tiktok}")
        return 0
    payload = {
        "instagram": instagram,
        "tiktok": tiktok,
        "total": instagram + tiktok,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", payload["total"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
