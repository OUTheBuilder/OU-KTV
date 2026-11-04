"""
O|U KTV — aiohttp backend server
Implements all REST API and WebSocket endpoints expected by the frontend.
"""

import asyncio
import base64
import io
import hashlib
import hmac
import re
import urllib.parse
import json
import os
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiohttp
from aiohttp import web

# ---------------------------------------------------------------------------
# Configuration (override via env vars)
# ---------------------------------------------------------------------------
ADMIN_PASSWORD = os.environ.get("KTV_ADMIN_PASSWORD", "")
DEFAULT_YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

CONFIG_FILE = DATA_DIR / "config.json"
USERS_FILE = DATA_DIR / "users.json"
ROOMS_FILE = DATA_DIR / "rooms.json"
LOGINS_FILE = DATA_DIR / "logins.json"

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

config: Dict[str, Any] = {
    "app_name": "O|U KTV",
    "app_tagline": "Karaoke Together",
    "base_path": "ktv",
    "default_theme": "neonpop",
    "refresh_animation": "dissolve",
    "video_player": "videojs",
    "email_login_enabled": False,
    "buttons": {
        "live_music": True,
        "search": True,
        "queue": True,
        "popular": True,
        "mysongs": True,
    },
    "footer": {
        "credit": "",
        "support": "",
        "link1_text": "",
        "link1_url": "",
        "link2_text": "",
        "link2_url": "",
        "link3_text": "",
        "link3_url": "",
        "qr": "",
    },
    "show_live_music_button": "1",
    "show_search_button": "1",
    "show_queue_button": "1",
    "show_popular_button": "1",
    "show_mysongs_button": "1",
    "refresh_animation": "fall",
    "admin_password_hash": "",
}

users: List[Dict[str, Any]] = []  # [{email, password_hash, name, created_at}]
logins: List[Dict[str, Any]] = []  # [{email, created_at, ip}]
rooms: Dict[str, Dict[str, Any]] = {}  # code -> room state

# Per-room WebSocket sessions: { room_code: { client_id: websocket, ... } }
ws_sessions: Dict[str, Dict[str, web.WebSocketResponse]] = {}

# Admin token store (simple in-memory)
admin_tokens: Dict[str, float] = {}
user_sessions: Dict[str, Dict[str, Any]] = {}
login_attempts: Dict[str, List[float]] = {}




PBKDF2_ITERATIONS = 310_000
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, rounds, salt_hex, digest_hex = stored.split("$", 3)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds))
            return hmac.compare_digest(digest.hex(), digest_hex)
        except (ValueError, TypeError):
            return False
    # Backward-compatible verification of legacy SHA-256 hashes; upgraded on successful login.
    return bool(stored) and hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), stored)


def _load_json(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, type(default)) else default
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def load_persisted_data():
    """Load persisted application state before accepting requests."""
    loaded = _load_json(CONFIG_FILE, {})
    if loaded:
        config.update(loaded)
    config.setdefault("footer", {})
    config.setdefault("buttons", {})
    config["footer"] = {**{
        "credit": "", "support": "", "link1_text": "", "link1_url": "",
        "link2_text": "", "link2_url": "", "link3_text": "", "link3_url": "", "qr": ""
    }, **(config.get("footer") if isinstance(config.get("footer"), dict) else {})}
    users[:] = _load_json(USERS_FILE, [])
    logins[:] = _load_json(LOGINS_FILE, [])[-5000:]
    rooms.clear()
    saved_rooms = _load_json(ROOMS_FILE, {})
    if isinstance(saved_rooms, dict):
        for code, room in saved_rooms.items():
            if isinstance(room, dict):
                room.setdefault("queue", [])
                room.setdefault("guests", {})
                room.setdefault("activity", [])
                room["guests"] = {}  # WebSocket connections cannot survive a restart.
                room["guestCount"] = 0
                rooms[code] = room
    if not config.get("admin_password_hash"):
        if len(ADMIN_PASSWORD) < 12:
            raise RuntimeError("Set KTV_ADMIN_PASSWORD to a password of at least 12 characters before first startup.")
        config["admin_password_hash"] = hash_password(ADMIN_PASSWORD)
        save_config()
    elif not config["admin_password_hash"].startswith("pbkdf2_sha256$"):
        # Existing installations retain their configured password; migration occurs on login.
        pass


def _request_ip(request: web.Request) -> str:
    # Do not trust arbitrary X-Forwarded-For unless a trusted proxy is configured.
    return request.remote or "unknown"


def _rate_limited(key: str, limit: int = 10, window: int = 300) -> bool:
    now = time.time()
    attempts = [t for t in login_attempts.get(key, []) if now - t < window]
    if len(attempts) >= limit:
        login_attempts[key] = attempts
        return True
    attempts.append(now)
    login_attempts[key] = attempts
    return False


def _user_from_token(token: str):
    session = user_sessions.get(str(token or ""))
    if not session or session.get("expires", 0) < time.time():
        user_sessions.pop(str(token or ""), None)
        return None
    return session


def _user_from_request(request: web.Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    return _user_from_token(token)


def _safe_public_config():
    return {k: v for k, v in config.items() if k != "admin_password_hash"}


def _public_room(room: dict):
    return {k: v for k, v in room.items() if k != "owner_token_hash"}


def save_config():
    tmp = CONFIG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(config, indent=2))
    tmp.rename(CONFIG_FILE)


def save_users():
    tmp = USERS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(users, indent=2))
    tmp.rename(USERS_FILE)


def save_rooms():
    tmp = ROOMS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(rooms, indent=2))
    tmp.rename(ROOMS_FILE)


def save_logins():
    tmp = LOGINS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(logins, indent=2))
    tmp.rename(LOGINS_FILE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def http_post(url: str, body: dict, headers: dict = None) -> dict:
    """POST JSON and safely return a dictionary response."""
    timeout = aiohttp.ClientTimeout(total=8)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=body, headers=headers) as resp:
                if resp.status >= 400:
                    return {}
                data = await resp.json(content_type=None)
                return data if isinstance(data, dict) else {}
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        return {}


async def http_get_json(url: str, params: dict = None) -> dict:
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
            async with session.get(url, params=params) as resp:
                if resp.status >= 400:
                    return {}
                data = await resp.json(content_type=None)
                return data if isinstance(data, dict) else {}
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        return {}


# ---------------------------------------------------------------------------
# REST API routes
# ---------------------------------------------------------------------------

async def handle_config(request: web.Request):
    return web.json_response(_safe_public_config())


async def handle_login(request: web.Request):
    data = await request.json()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    name = str(data.get("name", "")).strip()[:80]
    if not EMAIL_RE.match(email):
        return web.json_response({"error": "A valid email address is required."}, status=400)
    if len(password) < 8 or len(password) > 256:
        return web.json_response({"error": "Password must be at least 8 characters."}, status=400)
    ip = _request_ip(request)
    if _rate_limited(f"user:{ip}", limit=10):
        return web.json_response({"error": "Too many attempts. Please try again later."}, status=429)

    user = next((u for u in users if u.get("email") == email), None)
    if user:
        if not verify_password(password, user.get("password_hash", "")):
            return web.json_response({"error": "Invalid email or password."}, status=401)
        if not user.get("password_hash", "").startswith("pbkdf2_sha256$"):
            user["password_hash"] = hash_password(password)
            save_users()
    else:
        user = {
            "email": email,
            "password_hash": hash_password(password),
            "name": name or email.split("@", 1)[0],
            "created_at": time.time(),
        }
        users.append(user)
        save_users()

    logins.append({"email": email, "created_at": time.time(), "ip": ip})
    del logins[:-5000]
    save_logins()
    token = secrets.token_urlsafe(40)
    user_sessions[token] = {"email": email, "name": user.get("name", ""), "expires": time.time() + 30 * 86400}
    return web.json_response({"token": token, "email": email, "user": {"email": email, "name": user.get("name", "")}})


async def handle_search(request: web.Request):
    q = request.query.get("q", "").strip()[:120]
    stype = request.query.get("type", "karaoke")
    if stype not in ("karaoke", "music", "live", ""):
        return web.json_response({"error": "Invalid search type."}, status=400)
    if not q:
        return web.json_response([])

    results: list[dict] = []

    def _add_youtube(video_id: str, title: str, thumb: str, channel: str = ""):
        results.append({
            "id": video_id,
            "youtube_id": video_id,
            "title": title,
            "thumb": thumb,
            "thumbnail": thumb,
            "channel": channel,
            "source": "youtube",
            "type": "song",
        })

    async def yt_search(query: str) -> list[dict]:
        """Search YouTube via innerTube API (no key required)."""
        payload = {
            "context": {"client": {"clientName": "WEB", "clientVersion": "2.20240101.00.00"}},
            "query": query,
        }
        try:
            resp = await http_post(
                "https://www.youtube.com/youtubei/v1/search",
                payload,
                headers={"Content-Type": "application/json"},
            )
            renderer = (
                resp.get("contents", {})
                .get("twoColumnSearchResultsRenderer", {})
                .get("primaryContents", {})
                .get("sectionListRenderer", {})
            )
            videos = []
            for section in renderer.get("contents", []):
                for item in section.get("itemSectionRenderer", {}).get("contents", []):
                    video = item.get("videoRenderer", {})
                    vid = video.get("videoId", "")
                    if not vid:
                        continue
                    title = video.get("title", {}).get("runs", [{}])[0].get("text", "")
                    thumb = video.get("thumbnail", {}).get("thumbnails", [{}])[0].get("url", "")
                    channel = ""
                    sub = video.get("longBylineText", {})
                    if sub.get("runs"):
                        channel = sub["runs"][0].get("text", "")
                    videos.append({"video_id": vid, "title": title, "thumb": thumb, "channel": channel})
            return videos
        except Exception:
            return []

    # YouTube Data API (when key is configured)
    if DEFAULT_YOUTUBE_API_KEY and stype in ("music", "karaoke", "live", ""):
        try:
            search_data = await http_get_json(
                "https://www.googleapis.com/youtube/v3/search",
                params={"q": q, "type": "video", "key": DEFAULT_YOUTUBE_API_KEY, "maxResults": 20, "part": "snippet"},
            )
            for item in search_data.get("items", []):
                vid = item["id"].get("videoId", "")
                if not vid:
                    continue
                title = item["snippet"].get("title", "")
                thumb = item["snippet"].get("thumbnails", {}).get("default", {}).get("url", "")
                channel = item["snippet"].get("channelTitle", "")
                _add_youtube(vid, title, thumb, channel)
        except Exception:
            pass
    # No API key — use innerTube with type-specific query boosting
    elif stype == "karaoke" or stype == "":
        karaoke_q = f"{q} karaoke" if "karaoke" not in q.lower() else q
        for v in await yt_search(karaoke_q):
            _add_youtube(v["video_id"], v["title"], v["thumb"], v["channel"])
    elif stype == "live":
        live_q = f"{q} live concert session" if "live" not in q.lower() else q
        for v in await yt_search(live_q):
            _add_youtube(v["video_id"], v["title"], v["thumb"], v["channel"])
    elif stype == "music":
        for v in await yt_search(q):
            _add_youtube(v["video_id"], v["title"], v["thumb"], v["channel"])

    # If KaraokeVox API key configured, search karaoke
    karo_api = os.environ.get("KARAOKEVOX_API_KEY", "")
    if karo_api and stype in ("karaoke", ""):
        try:
            async with aiohttp.ClientSession() as sess:
                async with sess.get(
                    f"https://api.karaokevox.com/v2/search",
                    params={"q": q, "limit": 20},
                    headers={"x-api-key": karo_api},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status == 200:
                        karo_data = await resp.json()
                        for item in (karo_data if isinstance(karo_data, list) else karo_data.get("results", [])):
                            kt_id = item.get("id", "")
                            results.append({
                                "id": kt_id,  # frontend expects 'id'
                                "youtube_id": "",
                                "title": item.get("title", q),
                                "thumb": item.get("thumbnail", ""),  # frontend expects 'thumb'
                                "thumbnail": item.get("thumbnail", ""),
                                "channel": item.get("artist", ""),
                                "source": "karaokevox",
                                "type": "karaoke",
                                "karaokevox_id": kt_id,
                            })
        except Exception:
            pass

    return web.json_response(results)


async def handle_popular(request: web.Request):
    """Return popular/trending songs (mocked)."""
    popular = [
        {
            "id": "dQw4w9WgXcQ",
            "youtube_id": "dQw4w9WgXcQ",
            "title": "Never Gonna Give You Up",
            "thumb": "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
            "channel": "Rick Astley",
            "source": "youtube",
            "type": "song",
        },
        {
            "id": "kJQP7kiw5Fk",
            "youtube_id": "kJQP7kiw5Fk",
            "title": "Lemon Tree",
            "thumb": "https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg",
            "thumbnail": "https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg",
            "channel": "Fools Garden",
            "source": "youtube",
            "type": "song",
        },
        {
            "id": "JGwWNGJdvx8",
            "youtube_id": "JGwWNGJdvx8",
            "title": "Shape of You",
            "thumb": "https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg",
            "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg",
            "channel": "Ed Sheeran",
            "source": "youtube",
            "type": "song",
        },
        {
            "id": "60ItHLz5WEA",
            "youtube_id": "60ItHLz5WEA",
            "title": "All Star",
            "thumb": "https://i.ytimg.com/vi/60ItHLz5WEA/default.jpg",
            "thumbnail": "https://i.ytimg.com/vi/60ItHLz5WEA/default.jpg",
            "channel": "Smash Mouth",
            "source": "youtube",
            "type": "song",
        },
        {
            "id": "fJ9rUzIMcZQ",
            "youtube_id": "fJ9rUzIMcZQ",
            "title": "Bohemian Rhapsody",
            "thumb": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/default.jpg",
            "thumbnail": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/default.jpg",
            "channel": "Queen",
            "source": "youtube",
            "type": "song",
        },
    ]
    return web.json_response(popular)


async def handle_create_ktv(request: web.Request):
    if config.get("email_login_enabled") and not _user_from_request(request):
        return web.json_response({"error": "Please register or log in first."}, status=401)
    code = secrets.token_hex(3)[:6].upper()
    while code in rooms:
        code = secrets.token_hex(3)[:6].upper()

    room = {
        "code": code,
        "created_at": time.time(),
        "name": "",
        "nowPlaying": None,
        "queue": [],
        "guests": {},
        "guestCount": 0,
        "activity": [],
        "owner": None,
        "owner_token_hash": hashlib.sha256((owner_token := secrets.token_urlsafe(40)).encode()).hexdigest(),
        "isPaused": True,
    }
    rooms[code] = room
    ws_sessions[code] = {}
    save_rooms()

    return web.json_response({"code": code, "host_token": owner_token, "ktv": _public_room(room)})


async def handle_ktv_check(request: web.Request):
    code = request.match_info["code"]
    room = rooms.get(code)
    if not room:
        return web.json_response({"exists": False})
    return web.json_response({"exists": True, "ktv": _public_room(room)})


async def handle_get_qr(request: web.Request):
    code = request.match_info["code"]
    room = rooms.get(code)
    if not room:
        return web.json_response({"error": "KTV not found"}, status=404)

    # Generate a QR code URL using a public API
    join_url = f"{request.scheme}://{request.host}/{urllib.parse.quote(str(config.get('base_path', 'ktv')).strip('/'))}/?code={code}"
    if request.method == "POST":
        try:
            request_data = await request.json()
        except (ValueError, aiohttp.ContentTypeError):
            request_data = {}
        supplied_token = str(request_data.get("remote_token", ""))
    else:
        supplied_token = request.query.get("remote_token", "")
    expected_hash = room.get("owner_token_hash", "")
    if supplied_token and expected_hash and hmac.compare_digest(hashlib.sha256(supplied_token.encode()).hexdigest(), expected_hash):
        join_url += "&host_token=" + urllib.parse.quote(supplied_token)
    try:
        import qrcode
        image = qrcode.make(join_url)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        qr_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except ImportError:
        # Safe fallback deliberately excludes the bearer controller token.
        safe_url = f"{request.scheme}://{request.host}/{urllib.parse.quote(str(config.get('base_path', 'ktv')).strip('/'))}/?code={code}"
        qr_url = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + urllib.parse.quote(safe_url, safe="")
        join_url = safe_url

    return web.json_response({"qr": qr_url, "url": join_url, "code": code})


# ---- Admin routes ----

def admin_auth(request: web.Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth else ""
    if not token or token not in admin_tokens or admin_tokens.get(token, 0) < time.time():
        if token in admin_tokens:
            del admin_tokens[token]
        return False
    return True


async def handle_admin_login(request: web.Request):
    data = await request.json()
    pw = str(data.get("password", ""))
    if _rate_limited(f"admin:{_request_ip(request)}", limit=5):
        return web.json_response({"error": "Too many attempts. Try again later."}, status=429)
    stored = config.get("admin_password_hash", "")
    if verify_password(pw, stored):
        if not stored.startswith("pbkdf2_sha256$"):
            config["admin_password_hash"] = hash_password(pw)
            save_config()
        token = secrets.token_urlsafe(40)
        admin_tokens[token] = time.time() + 3600
        return web.json_response({"token": token})
    return web.json_response({"error": "Invalid password"}, status=401)


async def handle_admin_config_get(request: web.Request):
    # Return config with both flat fields and nested buttons for frontend compatibility
    result = _safe_public_config()
    result["buttons"] = dict(config.get("buttons", {}))
    # Also include footer sub-keys as flat fields for frontend admin form
    result["footer_credit"] = config.get("footer", {}).get("credit", "")
    result["footer_support"] = config.get("footer", {}).get("support", "")
    result["footer_link1_text"] = config.get("footer", {}).get("link1_text", "")
    result["footer_link1_url"] = config.get("footer", {}).get("link1_url", "")
    result["footer_link2_text"] = config.get("footer", {}).get("link2_text", "")
    result["footer_link2_url"] = config.get("footer", {}).get("link2_url", "")
    result["footer_link3_text"] = config.get("footer", {}).get("link3_text", "")
    result["footer_link3_url"] = config.get("footer", {}).get("link3_url", "")
    result["footer_qr"] = config.get("footer", {}).get("qr", "")
    return web.json_response(result)


async def handle_admin_config_post(request: web.Request):
    data = await request.json()
    if "app_name" in data:
        config["app_name"] = data["app_name"]
    if "app_tagline" in data:
        config["app_tagline"] = data["app_tagline"]
    if "base_path" in data:
        config["base_path"] = data["base_path"]
    if "default_theme" in data:
        config["default_theme"] = data["default_theme"]
    if "refresh_animation" in data:
        config["refresh_animation"] = data["refresh_animation"]
    if "video_player" in data:
        config["video_player"] = data["video_player"]
    if "email_login_enabled" in data:
        config["email_login_enabled"] = data["email_login_enabled"] in (True, "1", 1)
    if "show_live_music_button" in data:
        val = "1" if data["show_live_music_button"] else "0"
        config["show_live_music_button"] = val
        config["buttons"]["live_music"] = data["show_live_music_button"]
    if "show_search_button" in data:
        val = "1" if data["show_search_button"] else "0"
        config["show_search_button"] = val
        config["buttons"]["search"] = data["show_search_button"]
    if "show_queue_button" in data:
        val = "1" if data["show_queue_button"] else "0"
        config["show_queue_button"] = val
        config["buttons"]["queue"] = data["show_queue_button"]
    if "show_popular_button" in data:
        val = "1" if data["show_popular_button"] else "0"
        config["show_popular_button"] = val
        config["buttons"]["popular"] = data["show_popular_button"]
    if "show_mysongs_button" in data:
        val = "1" if data["show_mysongs_button"] else "0"
        config["show_mysongs_button"] = val
        config["buttons"]["mysongs"] = data["show_mysongs_button"]
    if "footer" in data:
        config["footer"].update(data["footer"])
    if "footer_credit" in data:
        config["footer"]["credit"] = data["footer_credit"]
    if "footer_support" in data:
        config["footer"]["support"] = data["footer_support"]
    if "footer_link1_text" in data:
        config["footer"]["link1_text"] = data["footer_link1_text"]
    if "footer_link1_url" in data:
        config["footer"]["link1_url"] = data["footer_link1_url"]
    if "footer_link2_text" in data:
        config["footer"]["link2_text"] = data["footer_link2_text"]
    if "footer_link2_url" in data:
        config["footer"]["link2_url"] = data["footer_link2_url"]
    if "footer_link3_text" in data:
        config["footer"]["link3_text"] = data["footer_link3_text"]
    if "footer_link3_url" in data:
        config["footer"]["link3_url"] = data["footer_link3_url"]
    if "footer_qr" in data:
        config["footer"]["qr"] = data["footer_qr"]
    if "admin_password" in data:
        pw = data["admin_password"]
        if pw:
            if len(str(pw)) < 12:
                return web.json_response({"error": "Admin password must be at least 12 characters."}, status=400)
            config["admin_password_hash"] = hash_password(str(pw))
            admin_tokens.clear()

    save_config()
    return web.json_response({"ok": True})


async def handle_admin_logins(request: web.Request):
    # Return logins with login_at field for frontend compatibility
    result = []
    for l in logins[-50:]:
        result.append({
            "email": l["email"],
            "ip": l.get("ip", ""),
            "login_at": l.get("created_at", 0),  # frontend expects login_at
        })
    return web.json_response(result)


async def handle_admin_users(request: web.Request):
    # Return users with display_name, banned, and last_seen fields for frontend compatibility
    result = []
    for u in users:
        result.append({
            "email": u["email"],
            "display_name": u.get("name", ""),
            "banned": False,
            "last_seen": u.get("created_at", 0),  # frontend expects last_seen
        })
    return web.json_response(result)


async def handle_admin_rooms(request: web.Request):
    room_list = []
    for code, room in rooms.items():
        guests = room.get("guests", {})
        guest_count = len(guests)
        host_count = sum(1 for g in guests.values() if not g.get("is_remote", False))
        remote_count = sum(1 for g in guests.values() if g.get("is_remote", False))
        queue = room.get("queue", [])
        queue_length = len(queue)
        np = room.get("nowPlaying")
        if np:
            now_playing = np.get("title", "") if isinstance(np, dict) else str(np)
        else:
            now_playing = None
        room_list.append({
            "code": code,
            "nowPlaying": now_playing,
            "queueLength": queue_length,
            "guestCount": guest_count,
            "hostCount": host_count,
            "remoteCount": remote_count,
            "songLimitEnabled": room.get("limit", False),
            "created_at": room.get("created_at"),
        })
    return web.json_response(room_list)


async def handle_admin_room_limit(request: web.Request):
    data = await request.json()
    code = data.get("code", "")
    room = rooms.get(code)
    if room:
        room["limit"] = True if data.get("enabled") else False
        save_rooms()
    return web.json_response({"ok": True})


async def handle_admin_upload_qr(request: web.Request):
    data = await request.json()
    config["footer"]["qr"] = data.get("image", "")
    save_config()
    return web.json_response({"ok": True})


# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------

async def handle_ws(request: web.Request):
    ws = web.WebSocketResponse(max_msg_size=65536, heartbeat=30)
    await ws.prepare(request)

    code = None
    client_id = str(uuid.uuid4())
    is_host = False
    identity = "guest"
    display_name = "guest"

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            try:
                data = json.loads(msg.data)
                if not isinstance(data, dict):
                    continue
                msg_type = data.get("type")

                if msg_type == "join":
                    code = data.get("code")
                    is_remote = data.get("is_remote", False)
                    requester = str(data.get("requester", "guest"))[:80]
                    display_name = requester
                    if not isinstance(code, str) or not re.fullmatch(r"[A-Z0-9]{6}", code):
                        await ws.close(code=1008, message=b"Invalid room code")
                        break
                    if config.get("email_login_enabled") and not _user_from_token(data.get("token", "")):
                        await ws.close(code=1008, message=b"Authentication required")
                        break
                    if code and code in rooms:
                        room = rooms[code]
                        supplied_host_token = str(data.get("host_token", ""))
                        expected_hash = room.get("owner_token_hash", "")
                        is_host = bool(expected_hash and supplied_host_token and hmac.compare_digest(
                            hashlib.sha256(supplied_host_token.encode()).hexdigest(), expected_hash
                        ))
                        # A legacy room without a host credential remains guest-only; recreate it to obtain secure host control.
                        session_user = _user_from_token(data.get("token", ""))
                        identity = session_user.get("email") if session_user else f"guest:{client_id}"
                        ws_sessions.setdefault(code, {})[client_id] = ws
                        room.setdefault("guests", {})[client_id] = {
                            "name": requester, "is_remote": bool(is_remote), "is_host": is_host,
                            "joined_at": time.time(),
                        }
                        room["guestCount"] = len(room["guests"])
                        room["activity"] = room.get("activity", [])[-49:]
                        room["activity"].append({"type": "join", "user": requester, "time": time.time()})
                        save_rooms()

                        # Send current state back
                        await ws.send_json({
                            "type": "ktv",
                            "ktv": _public_room(room),
                        })

                        # Broadcast to others
                        await broadcast_to_room(code, {
                            "type": "ktv",
                            "ktv": _public_room(room),
                        }, exclude=client_id)
                    else:
                        await ws.send_json({"type": "error", "error": "KTV room not found."})
                        await ws.close(code=1008, message=b"Room not found")
                        break

                elif msg_type == "add_song":
                    # Accept both flat format (from frontend) and nested format
                    yt_id = data.get("youtube_id") or (data.get("song") or {}).get("youtube_id", "")
                    title = data.get("title") or (data.get("song") or {}).get("title", "")
                    requester = display_name[:80]
                    if not isinstance(yt_id, str) or not YOUTUBE_ID_RE.fullmatch(yt_id) or not isinstance(title, str) or not title.strip() or len(title) > 200:
                        await ws.send_json({"type": "error", "error": "Invalid song selection."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        # Enforce song limit if active (max 3 per user)
                        limit_enabled = room.get("limit", False)
                        if limit_enabled:
                            # Count user's songs: both in queue AND currently playing
                            user_songs = [s for s in room.get("queue", []) if s.get("user_id", "") == identity]
                            if room.get("nowPlaying") and room["nowPlaying"].get("user_id", "") == identity:
                                user_songs.append(room["nowPlaying"])
                            if len(user_songs) >= 3:
                                await broadcast_to_room(code, {
                                    "type": "song_rejected",
                                    "reason": "limit",
                                    "max": 3,
                                })
                                return
                        song_entry = {
                            "id": str(uuid.uuid4())[:8],
                            "youtube_id": yt_id,
                            "title": title,
                            "requester": requester,
                            "user_id": identity,
                            "status": "queued",
                            "added_at": time.time(),
                        }
                        # Auto-play: if no song is currently playing, make this the nowPlaying song
                        if not room.get("nowPlaying"):
                            room["nowPlaying"] = {"youtube_id": yt_id, "title": title, "requester": requester, "user_id": identity, "status": "playing"}
                            room["isPaused"] = False
                        else:
                            room.setdefault("queue", []).append(song_entry)
                        room["activity"] = room.get("activity", [])[-49:]
                        room["activity"].append({"type": "add_song", "user": requester, "time": time.time(), "title": title})
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "remove_song":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    song_id = data.get("song_id")
                    if code and code in rooms:
                        room = rooms[code]
                        room["queue"] = [s for s in room.get("queue", []) if s.get("id") != song_id]
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "now_playing":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    now_playing = data.get("nowPlaying")
                    if code and code in rooms:
                        room = rooms[code]
                        if now_playing is not None and (not isinstance(now_playing, dict) or not YOUTUBE_ID_RE.fullmatch(str(now_playing.get("youtube_id", ""))) or len(str(now_playing.get("title", ""))) > 200):
                            await ws.send_json({"type": "error", "error": "Invalid now-playing item."})
                            continue
                        room["nowPlaying"] = now_playing
                        room["activity"] = room.get("activity", [])[-49:]
                        room["activity"].append({"type": "now_playing", "user": "host", "time": time.time(), "title": now_playing.get("title", "") if now_playing else ""})
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "next":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        if room.get("queue"):
                            next_song = room["queue"].pop(0)
                            room["nowPlaying"] = {
                                "youtube_id": next_song.get("youtube_id", ""),
                                "title": next_song.get("title", ""),
                                "requester": next_song.get("requester", "guest"),
                                "status": "playing",
                            }
                            room["isPaused"] = False
                            save_rooms()
                            await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "stop":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        room["nowPlaying"] = None
                        room["isPaused"] = True
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "play":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        room["isPaused"] = False
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "pause":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        room["isPaused"] = True
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "reorder":
                    if not is_host:
                        await ws.send_json({"type": "error", "error": "Host permission required."})
                        continue
                    if code and code in rooms:
                        room = rooms[code]
                        items = data.get("items", [])
                        if not isinstance(items, list) or len(items) > 200 or any(not isinstance(item, dict) or not YOUTUBE_ID_RE.fullmatch(str(item.get("youtube_id", ""))) for item in items):
                            await ws.send_json({"type": "error", "error": "Invalid queue update."})
                            continue
                        room["queue"] = items
                        save_rooms()
                        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

                elif msg_type == "cheer":
                    requester = data.get("requester", "guest")
                    if code and code in rooms:
                        await broadcast_to_room(code, {"type": "cheer", "user": requester})

            except json.JSONDecodeError:
                pass

        elif msg.type == aiohttp.WSMsgType.ERROR:
            break

    # Clean up
    if code and code in rooms:
        room = rooms[code]
        room.get("guests", {}).pop(client_id, None)
        room["guestCount"] = len(room.get("guests", {}))
        save_rooms()
        await broadcast_to_room(code, {"type": "ktv", "ktv": _public_room(room)})

    if code and code in ws_sessions:
        ws_sessions[code].pop(client_id, None)
        if not ws_sessions[code]:
            del ws_sessions[code]

    return ws


async def broadcast_to_room(code: str, msg: dict, exclude: str = None):
    """Broadcast a message to all WebSocket clients in a room."""
    clients = ws_sessions.get(code, {})
    payloads = [json.dumps(msg)]
    remaining = []
    for cid, ws in clients.items():
        if cid == exclude:
            continue
        try:
            await ws.send_str(payloads[0])
        except Exception:
            remaining.append(cid)
    for cid in remaining:
        clients.pop(cid, None)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

@web.middleware
async def security_middleware(request: web.Request, handler):
    if "/api/admin/" in request.path and not request.path.endswith("/api/admin/login"):
        if not admin_auth(request):
            return web.json_response({"error": "Admin authentication required."}, status=401)
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH"):
        if request.content_length is not None and request.content_length > 2 * 1024 * 1024:
            return web.json_response({"error": "Request body too large."}, status=413)
    response = await handler(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
    return response


async def handle_index(request: web.Request):
    return web.FileResponse(Path(__file__).parent / "static" / "index.html")


def create_app() -> web.Application:
    load_persisted_data()
    # Keep the configured static/API base path safe and predictable.
    base_name = re.sub(r"[^A-Za-z0-9_-]", "", str(config.get("base_path", "ktv")))[:40] or "ktv"
    config["base_path"] = base_name
    base = "/" + base_name
    app = web.Application(middlewares=[security_middleware], client_max_size=2 * 1024 * 1024)

    # Register API routes at both the origin root and the configured app base.
    # API routes must be registered before static catch-all routes.
    route_sets = [
        ("get", "/api/config", handle_config),
        ("post", "/api/login", handle_login),
        ("get", "/api/search", handle_search),
        ("get", "/api/popular", handle_popular),
        ("post", "/api/ktvs", handle_create_ktv),
        ("get", "/api/ktv/check/{code}", handle_ktv_check),
        ("get", "/api/qr/{code}", handle_get_qr),
        ("post", "/api/qr/{code}", handle_get_qr),
        ("post", "/api/admin/login", handle_admin_login),
        ("get", "/api/admin/config", handle_admin_config_get),
        ("post", "/api/admin/config", handle_admin_config_post),
        ("get", "/api/admin/logins", handle_admin_logins),
        ("get", "/api/admin/users", handle_admin_users),
        ("get", "/api/admin/rooms", handle_admin_rooms),
        ("post", "/api/admin/room/limit", handle_admin_room_limit),
        ("post", "/api/admin/upload-qr", handle_admin_upload_qr),
        ("get", "/ws", handle_ws),
    ]
    for method, path, handler in route_sets:
        for route_path in dict.fromkeys((path, base + path)):
            getattr(app.router, f"add_{method}")(route_path, handler)
    app.router.add_get(base, handle_index)
    app.router.add_get(base + "/", handle_index)
    app.router.add_get("/", handle_index)

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.router.add_static(base, str(static_dir), name="static_base")
        if base != "/ktv":
            app.router.add_static("/ktv", str(static_dir), name="static_legacy")
        app.router.add_static("/", str(static_dir), name="static_root")

    return app


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app = create_app()
    print(f"Starting O|U KTV server on :{port}")
    web.run_app(app, host="0.0.0.0", port=port, print=None)

