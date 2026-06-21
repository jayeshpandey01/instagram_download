import json
import re
import sys
from datetime import datetime, timezone

import instaloader


def extract_shortcode(url: str) -> str:
    match = re.search(r'/(?:p|tv|reel)/([A-Za-z0-9_-]+)', url)
    if not match:
      raise ValueError("Invalid Instagram URL format")
    return match.group(1)


def make_filename(shortcode: str, index: int, is_video: bool) -> str:
    extension = "mp4" if is_video else "jpg"
    if index == 0:
        return f"{shortcode}.{extension}"
    return f"{shortcode}_{index + 1}.{extension}"


def build_item(url: str, shortcode: str, index: int = 0, is_video: bool = False):
    return {
        "url": url,
        "downloadUrl": url,
        "type": "video" if is_video else "image",
        "filename": make_filename(shortcode, index, is_video),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL argument is required"}))
        sys.exit(1)

    url = sys.argv[1].strip()
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

    post = instaloader.Post.from_shortcode(loader.context, shortcode)

    items = []
    if post.typename == "GraphSidecar":
        nodes = list(post.get_sidecar_nodes())
        for idx, node in enumerate(nodes):
            node_is_video = bool(getattr(node, "is_video", False))
            node_url = getattr(node, "video_url", None) if node_is_video else getattr(node, "display_url", None)
            if not node_url:
                node_url = getattr(node, "url", None)
            if node_url:
                items.append(build_item(node_url, shortcode, idx, node_is_video))
    else:
        is_video = bool(post.is_video)
        media_url = post.video_url if is_video else post.url
        items.append(build_item(media_url, shortcode, 0, is_video))

    raw = {
        "shortcode": shortcode,
        "is_video": bool(post.is_video),
        "typename": post.typename,
        "owner_username": getattr(post.owner_profile, "username", None),
        "caption": post.caption,
        "date_utc": post.date_utc.replace(tzinfo=timezone.utc).isoformat() if post.date_utc else None,
        "media_count": getattr(post, "mediacount", None),
    }

    print(json.dumps({
        "success": True,
        "items": items,
        "raw": raw,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
