#!/usr/bin/env python3
"""
🎭 Hedra fallback — free-tier expressive talking heads.

NOTE: Hedra's public API surface changes often — wire this up against the
current docs (https://hedra.com) before relying on it. Endpoint + auth below
are placeholders ON PURPOSE. HeyGen (heygen-client.py) is the primary path.
"""
import argparse
import os

BASE = os.environ.get("HEDRA_BASE_URL", "https://api.hedra.com")  # TODO: verify
KEY = os.environ.get("HEDRA_API_KEY", "")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True)
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    print("⚠️  Hedra fallback is a stub — implement against current Hedra docs:")
    print(f"    POST {BASE}/  with image={args.image}, audio={args.audio}, out={args.out}")
    print("    (Set HEDRA_API_KEY once wired up.)")


if __name__ == "__main__":
    main()
