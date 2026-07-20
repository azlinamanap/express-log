#!/usr/bin/env python3
"""Dev server for the HSR showcase app.

Serves this folder's static files and relays /api/{uid}?lang=xx to
api.mihomo.me (which sends no CORS headers, so the browser can't call it
directly). Responses are cached for 5 minutes per uid+lang because the
upstream API is rate-limited.

Run:  python3 server.py   →  http://127.0.0.1:8399
"""
import hashlib
import json
import random
import string
import time
import urllib.error
import urllib.request
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = 8399
UPSTREAM = "https://api.mihomo.me/"
CACHE_TTL = 300  # seconds
RETRIES = 3  # sr_activity queue-times-out often; retry before giving up

_cache = {}  # key -> (fetched_at, status, body)

# --- HoYoLAB battle records (authenticated via a dummy account's session) ---
HOYOLAB_ENV = Path(__file__).parent / "hoyolab.env"
HOYOLAB_API = "https://bbs-api-os.hoyolab.com/game_record/hkrpg/api"
DS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt"  # public overseas web-client salt
REGIONS = {  # UID first digit -> game server
    "6": "prod_official_usa",
    "7": "prod_official_euro",
    "8": "prod_official_asia",
    "9": "prod_official_cht",
}


def hoyolab_cookies():
    creds = {}
    if HOYOLAB_ENV.exists():
        for line in HOYOLAB_ENV.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                creds[k.strip()] = v.strip()
    if creds.get("LTUID_V2") and creds.get("LTOKEN_V2"):
        return f"ltuid_v2={creds['LTUID_V2']}; ltoken_v2={creds['LTOKEN_V2']}"
    return None


def ds_header():
    t = int(time.time())
    r = "".join(random.choices(string.ascii_letters, k=6))
    check = hashlib.md5(f"salt={DS_SALT}&t={t}&r={r}".encode()).hexdigest()
    return f"{t},{r},{check}"


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/activity/"):
            self.relay("sr_activity", self.path[len("/api/activity/"):])
        elif self.path.startswith("/api/raw/"):
            self.relay("sr_info", self.path[len("/api/raw/"):])
        elif self.path.startswith("/api/challenge/"):
            rest = self.path[len("/api/challenge/"):]  # "{kind}/{uid}"
            kind, _, uid = rest.partition("/")
            self.challenge(kind, uid)
        elif self.path.startswith("/api/"):
            self.relay("sr_info_parsed", self.path[len("/api/"):])
        else:
            super().do_GET()

    def relay(self, endpoint, key):
        cache_key = endpoint + "/" + key
        hit = _cache.get(cache_key)
        if hit and time.time() - hit[0] < CACHE_TTL:
            return self.send_json(hit[1], hit[2], cached=True)

        req = urllib.request.Request(
            f"{UPSTREAM}{endpoint}/{key}",
            headers={"User-Agent": "Mozilla/5.0 (hsr-starlog dev)"},
        )
        for attempt in range(RETRIES):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    status, body = r.status, r.read()
            except urllib.error.HTTPError as e:
                status, body = e.code, e.read()
            except OSError as e:
                status = 502
                body = json.dumps({"detail": f"upstream unreachable: {e}"}).encode()
            if not (status == 500 and b"Queue timeout" in body):
                break
            time.sleep(3)

        if status == 200:
            _cache[cache_key] = (time.time(), status, body)
        self.send_json(status, body)

    CHALLENGE_KINDS = {  # battle-record mode -> hoyolab endpoint
        # Treasures Lightward
        "aa": "challenge_peak",    # Anomaly Arbitration
        "moc": "challenge",        # Memory of Chaos
        "pf": "challenge_story",   # Pure Fiction
        "as": "challenge_boss",    # Apocalyptic Shadow
        # Cosmic Strife
        "cw": "grid_fight",        # Currency Wars (internal name: Grid Fight)
        "su": "rogue",             # Simulated Universe
        "du": "rogue_tourn",       # Divergent Universe
    }

    def challenge(self, kind, uid):
        endpoint = self.CHALLENGE_KINDS.get(kind)
        if not endpoint:
            return self.send_json(
                400, json.dumps({"detail": f"unknown challenge kind {kind!r}"}).encode()
            )
        uid, _, query = uid.partition("?")
        # schedule_type 1 = current cycle, 2 = previous cycle
        schedule = "2" if "schedule=2" in query else "1"
        cookie = hoyolab_cookies()
        if not cookie:
            return self.send_json(
                503, json.dumps({"detail": "hoyolab.env has no cookies yet"}).encode()
            )
        region = REGIONS.get(uid[:1])
        if not region:
            return self.send_json(
                400, json.dumps({"detail": f"unsupported region for UID {uid}"}).encode()
            )

        cache_key = f"{kind}/{uid}/{schedule}"
        hit = _cache.get(cache_key)
        if hit and time.time() - hit[0] < CACHE_TTL:
            return self.send_json(hit[1], hit[2], cached=True)

        url = f"{HOYOLAB_API}/{endpoint}?server={region}&role_id={uid}&schedule_type={schedule}&need_all=true"
        req = urllib.request.Request(url, headers={
            "Cookie": cookie,
            "DS": ds_header(),
            "x-rpc-app_version": "1.5.0",
            "x-rpc-client_type": "5",
            "x-rpc-language": "en-us",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                status, body = r.status, r.read()
        except urllib.error.HTTPError as e:
            status, body = e.code, e.read()
        except OSError as e:
            status = 502
            body = json.dumps({"detail": f"hoyolab unreachable: {e}"}).encode()

        if status == 200:
            _cache[cache_key] = (time.time(), status, body)
        self.send_json(status, body)

    def send_json(self, status, body, cached=False):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Cache", "hit" if cached else "miss")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}")


if __name__ == "__main__":
    handler = partial(Handler, directory=str(Path(__file__).parent))
    print(f"Starlog dev server → http://127.0.0.1:{PORT}")
    HTTPServer(("127.0.0.1", PORT), handler).serve_forever()
