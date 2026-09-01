#!/usr/bin/env python3
"""
🗣️ BROski HeyGen Avatar Layer — ported from the Hyper-Vibe pipeline (Apr 2026).
Zero external deps (stdlib only).

Usage:
  python3 avatar/heygen-client.py --text "Yo BROskis!" --out output/scene-3.mp4

Config: HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID env vars,
or a workspace/video-config.json with a "heygen" object (env wins on conflicts).
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://api.heygen.com"


def die(msg):
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(1)


def load_config():
    cfg = {
        "api_key": os.environ.get("HEYGEN_API_KEY", ""),
        "avatar_id": os.environ.get("HEYGEN_AVATAR_ID", ""),
        "voice_id": os.environ.get("HEYGEN_VOICE_ID", ""),
    }
    path = os.environ.get("VIDEO_CONFIG", "workspace/video-config.json")
    if os.path.exists(path):
        with open(path) as f:
            file_cfg = json.load(f).get("heygen", {})
        cfg = {k: file_cfg.get(k) or v for k, v in cfg.items()}
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        die(f"Missing HeyGen config: {', '.join(missing)} — set env vars or {path}")
    return cfg


def api(method, url, cfg, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + url,
        data=data,
        method=method,
        headers={"X-HeyGen-API-Key": cfg["api_key"], "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def generate(cfg, text):
    payload = {
        "video_inputs": [
            {
                "character": {"type": "avatar", "avatar_id": cfg["avatar_id"], "avatar_style": "normal"},
                "voice": {"type": "text", "voice_id": cfg["voice_id"], "input_text": text, "speed": 1.0},
            }
        ]
    }
    out = api("POST", "/v2/video/generate", cfg, payload)
    return out["data"]["video_id"]


def wait(cfg, video_id, timeout=600):
    deadline = time.time() + timeout
    while time.time() < deadline:
        q = urllib.parse.urlencode({"video_id": video_id})
        out = api("GET", f"/v1/video_status.get?{q}", cfg)
        status = out["data"]["status"]
        if status == "completed":
            return out["data"]["video_url"]
        if status in ("failed", "error"):
            die(f"HeyGen render failed: {out['data']}")
        time.sleep(10)
    die("HeyGen render timed out")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    cfg = load_config()
    print("🗣️  Submitting to HeyGen …")
    video_id = generate(cfg, args.text)
    print(f"   video_id: {video_id} — polling …")
    url = wait(cfg, video_id)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    urllib.request.urlretrieve(url, args.out)
    print(f"✅ Saved: {args.out}")


if __name__ == "__main__":
    main()
