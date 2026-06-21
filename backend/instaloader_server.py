import json
import re
import os
import threading
import time
from datetime import timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, urlencode

import instaloader
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env_file(path: str):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


load_env_file(os.path.join(BASE_DIR, ".env"))

PORT = int(os.getenv("PORT", "5000"))
FRONTEND_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
}
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    FRONTEND_ORIGINS.update({origin.strip() for origin in frontend_url.split(",") if origin.strip()})
frontend_urls = os.getenv("FRONTEND_URLS")
if frontend_urls:
    FRONTEND_ORIGINS.update({origin.strip() for origin in frontend_urls.split(",") if origin.strip()})
RATE_LIMIT = 1000
RATE_LIMIT_WINDOW_SECONDS = 1
CACHE_TTL_SECONDS = 30 * 60

request_counts = {}
download_cache = {}
state_lock = threading.Lock()

for proxy_var in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(proxy_var, None)


def now_ms():
    return int(time.time() * 1000)


def normalize_filename(value: str, fallback: str = "instagram-media") -> str:
    safe = re.sub(r"[^a-z0-9._-]+", "_", fallback or "instagram-media", flags=re.I)
    if not value or not value.startswith(("http://", "https://")):
        return safe

    try:
        parsed = urlparse(value)
        tail = [segment for segment in parsed.path.split("/") if segment]
        if tail:
            cleaned = re.sub(r"[^a-z0-9._-]+", "_", tail[-1], flags=re.I)
            return cleaned or safe
    except Exception:
        pass

    return safe


def validate_instagram_url(url: str) -> bool:
    return bool(re.search(r"(?:https?://)?(?:www\.)?instagram\.com/(?:p|tv|reel)/[\w-]+/?", url, re.I))


def extract_shortcode(url: str) -> str:
    match = re.search(r"/(?:p|tv|reel)/([A-Za-z0-9_-]+)", url)
    if not match:
        raise ValueError("Invalid Instagram URL format")
    return match.group(1)


def build_item(media_url: str, shortcode: str, index: int = 0, is_video: bool = False):
    extension = "mp4" if is_video else "jpg"
    filename = f"{shortcode}.{extension}" if index == 0 else f"{shortcode}_{index + 1}.{extension}"
    return {
        "url": media_url,
        "downloadUrl": media_url,
        "type": "video" if is_video else "image",
        "filename": filename,
    }


def fetch_post_data(url: str):
    shortcode = extract_shortcode(url)
    loader = instaloader.Instaloader(
        sleep=False,
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
    )
    loader.context._session.trust_env = False
    loader.context._session.proxies.clear()

    post = instaloader.Post.from_shortcode(loader.context, shortcode)

    items = []
    if getattr(post, "typename", "") == "GraphSidecar":
        nodes = list(post.get_sidecar_nodes())
        for idx, node in enumerate(nodes):
            node_is_video = bool(getattr(node, "is_video", False))
            media_url = getattr(node, "video_url", None) if node_is_video else getattr(node, "display_url", None)
            if not media_url:
                media_url = getattr(node, "url", None)
            if media_url:
                items.append(build_item(media_url, shortcode, idx, node_is_video))
    else:
        is_video = bool(getattr(post, "is_video", False))
        media_url = getattr(post, "video_url", None) if is_video else getattr(post, "url", None)
        if media_url:
            items.append(build_item(media_url, shortcode, 0, is_video))

    raw = {
        "shortcode": shortcode,
        "typename": getattr(post, "typename", None),
        "is_video": bool(getattr(post, "is_video", False)),
        "owner_username": getattr(getattr(post, "owner_profile", None), "username", None),
        "caption": getattr(post, "caption", None),
        "date_utc": post.date_utc.replace(tzinfo=timezone.utc).isoformat() if getattr(post, "date_utc", None) else None,
        "media_count": getattr(post, "mediacount", None),
    }

    return {"items": items, "raw": raw}


def get_cached(url: str):
    with state_lock:
        entry = download_cache.get(url)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            download_cache.pop(url, None)
            return None
        return entry


def set_cached(url: str, items, raw):
    with state_lock:
        download_cache[url] = {
            "items": items,
            "raw": raw,
            "expires_at": time.time() + CACHE_TTL_SECONDS,
        }


def rate_limit(ip: str):
    current = time.time()
    with state_lock:
      entry = request_counts.get(ip)
      if not entry or current > entry["reset_at"]:
          entry = {"count": 0, "reset_at": current + RATE_LIMIT_WINDOW_SECONDS}
      entry["count"] += 1
      request_counts[ip] = entry
      remaining = max(0, RATE_LIMIT - entry["count"])
      allowed = entry["count"] <= RATE_LIMIT
      retry_after = max(0, entry["reset_at"] - current)
    return allowed, remaining, retry_after, entry["reset_at"]


class Handler(BaseHTTPRequestHandler):
    server_version = "InstaloaderDownloader/1.0"

    def log_message(self, format, *args):
        return

    def _send_cors(self):
        origin = self.headers.get("Origin")
        if origin in FRONTEND_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "null")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Expose-Headers", "X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,Retry-After")

    def _json(self, status, payload, extra_headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, str(value))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        ip = self.client_address[0]
        allowed, remaining, retry_after, reset_at = rate_limit(ip)

        if not allowed and parsed.path != "/api/health":
            self._json(
                429,
                {
                    "error": "Rate limit exceeded. Try again in a moment.",
                    "remaining": 0,
                    "limit": RATE_LIMIT,
                    "windowMs": RATE_LIMIT_WINDOW_SECONDS * 1000,
                },
                {
                    "Retry-After": str(max(1, int(retry_after))),
                    "X-RateLimit-Limit": RATE_LIMIT,
                    "X-RateLimit-Remaining": 0,
                    "X-RateLimit-Reset": int(reset_at * 1000),
                },
            )
            return

        if parsed.path == "/api/health":
            self._json(
                200,
                {"status": "OK", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"},
                {
                    "X-RateLimit-Limit": RATE_LIMIT,
                    "X-RateLimit-Remaining": remaining,
                    "X-RateLimit-Reset": int(reset_at * 1000),
                },
            )
            return

        if parsed.path == "/api/cache-stats":
            with state_lock:
                entries = len(download_cache)
            self._json(200, {"entries": entries})
            return

        if parsed.path == "/api/download-file":
            params = parse_qs(parsed.query)
            media_url = params.get("url", [None])[0]
            filename = params.get("filename", ["instagram-media"])[0]

            if not media_url or not media_url.startswith(("http://", "https://")):
                self._json(400, {"error": "A valid media URL is required"})
                return

            try:
                session = requests.Session()
                session.trust_env = False
                session.proxies.clear()
                response = session.get(media_url, stream=True, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
                response.raise_for_status()
            except Exception as exc:
                self._json(500, {"error": "Failed to download file", "details": str(exc)})
                return

            content_type = response.headers.get("content-type", "application/octet-stream")
            ext = ""
            if "video" in content_type:
                ext = ".mp4"
            elif "image/png" in content_type:
                ext = ".png"
            elif "image/webp" in content_type:
                ext = ".webp"
            elif "image/gif" in content_type:
                ext = ".gif"
            elif "image/jpeg" in content_type:
                ext = ".jpg"

            safe_name = normalize_filename(filename)
            if ext and not safe_name.lower().endswith(ext):
                safe_name += ext

            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
            self.end_headers()
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    self.wfile.write(chunk)
            return

        self._json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        ip = self.client_address[0]
        allowed, remaining, retry_after, reset_at = rate_limit(ip)

        if not allowed:
            self._json(
                429,
                {
                    "error": "Rate limit exceeded. Try again in a moment.",
                    "remaining": 0,
                    "limit": RATE_LIMIT,
                    "windowMs": RATE_LIMIT_WINDOW_SECONDS * 1000,
                },
                {
                    "Retry-After": str(max(1, int(retry_after))),
                    "X-RateLimit-Limit": RATE_LIMIT,
                    "X-RateLimit-Remaining": 0,
                    "X-RateLimit-Reset": int(reset_at * 1000),
                },
            )
            return

        if parsed.path != "/api/download":
            self._json(404, {"error": "Endpoint not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
            body = json.loads(raw_body or "{}")
        except Exception:
            self._json(400, {"error": "Invalid JSON body"})
            return

        url = (body.get("url") or "").strip()
        if not url:
            self._json(400, {"error": "URL is required"})
            return

        if not validate_instagram_url(url):
            self._json(400, {"error": "Invalid Instagram URL format"})
            return

        cached = get_cached(url)
        if cached:
            self._json(
                200,
                {
                    "success": True,
                    "sourceUrl": url,
                    "items": cached["items"],
                    "raw": cached["raw"],
                    "provider": "instaloader",
                    "cached": True,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
                },
                {
                    "X-RateLimit-Limit": RATE_LIMIT,
                    "X-RateLimit-Remaining": remaining,
                    "X-RateLimit-Reset": int(reset_at * 1000),
                },
            )
            return

        try:
            result = fetch_post_data(url)
        except Exception as exc:
            self._json(
                500,
                {
                    "error": "Failed to download content. Please check the URL and try again.",
                    "details": str(exc),
                    "provider": "instaloader",
                },
                {
                    "X-RateLimit-Limit": RATE_LIMIT,
                    "X-RateLimit-Remaining": remaining,
                    "X-RateLimit-Reset": int(reset_at * 1000),
                },
            )
            return

        set_cached(url, result["items"], result["raw"])
        self._json(
            200,
            {
                "success": True,
                "sourceUrl": url,
                "items": result["items"],
                "raw": result["raw"],
                "provider": "instaloader",
                "cached": False,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
            },
            {
                "X-RateLimit-Limit": RATE_LIMIT,
                "X-RateLimit-Remaining": remaining,
                "X-RateLimit-Reset": int(reset_at * 1000),
            },
        )


def cleanup_loop():
    while True:
        time.sleep(60)
        cutoff = time.time() - CACHE_TTL_SECONDS
        with state_lock:
            for key in list(download_cache.keys()):
                if download_cache[key]["expires_at"] < cutoff:
                    download_cache.pop(key, None)
            for key in list(request_counts.keys()):
                if request_counts[key]["reset_at"] < cutoff:
                    request_counts.pop(key, None)


def main():
    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Server running on port {PORT}")
    print("Environment: development")
    print("CORS enabled for: http://localhost:3000")
    server.serve_forever()


if __name__ == "__main__":
    main()
