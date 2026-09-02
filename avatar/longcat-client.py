"""
longcat-client.py — Tier-3 avatar generator for BROSKI VOID VIDEO AGENT V2
==========================================================================
Avatar chain: HeyGen (tier 1, paid) -> Hedra (tier 2, paid) -> LongCat (tier 3, $0).

LongCat-Video-Avatar (Meituan, MIT licence) turns a reference image + audio
into a lip-synced talking-head video.

Modes (LONGCAT_MODE env var):
  space  — zero-GPU. Calls a Hugging Face Space via gradio_client. Default.
  local  — GPU. Calls the longcat-inference FastAPI service
           (see docker-compose.longcat.yml + Dockerfile.longcat).

Quick test (space mode, no GPU needed):
    python avatar/longcat-client.py --image mascot.png --audio voice.wav
"""

import argparse
import logging
import os
import time
from pathlib import Path
from urllib.parse import urljoin

import requests

# ---------------------------------------------------------------- config ---

LONGCAT_MODE = os.environ.get("LONGCAT_MODE", "space")
LONGCAT_SPACE_ID = os.environ.get("LONGCAT_SPACE_ID", "victor/LongCat-Video-Avatar-1.5")
LONGCAT_LOCAL_URL = os.environ.get("LONGCAT_LOCAL_URL", "http://longcat-inference:8000").rstrip("/")
LONGCAT_TIMEOUT = int(os.environ.get("LONGCAT_TIMEOUT", "900"))  # seconds
HF_TOKEN = os.environ.get("HF_TOKEN") or None

log = logging.getLogger("longcat-client")


class LongCatError(RuntimeError):
    """Raised when LongCat generation fails. Router catches this + alerts."""


# --------------------------------------------------------------- public ----

def generate_avatar(
    image_path: str,
    audio_path: str,
    prompt: str = "a friendly avatar talking directly to camera",
    resolution: str = "480p",
    ref_img_index: int = 0,
    audio_cfg: float = 4.0,
    out_dir: str = "output/avatar",
) -> str:
    """
    image + audio -> talking-head video.

    prompt          include "talking" / "speaking" for best results
    resolution      "480p" (faster) or "720p"
    ref_img_index   0-24, identity consistency across renders
    audio_cfg       3-5 recommended for lip sync
    returns         local path to the finished .mp4
    """
    started = time.time()
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    if LONGCAT_MODE == "local":
        video_path = _generate_via_local(
            image_path, audio_path, prompt, resolution, ref_img_index, audio_cfg, out_dir
        )
    else:
        video_path = _generate_via_space(
            image_path, audio_path, prompt, resolution, ref_img_index, audio_cfg, out_dir
        )

    log.info("LongCat done in %.1fs -> %s", time.time() - started, video_path)
    return video_path


# ---------------------------------------------------------------- space ----

def _generate_via_space(image_path, audio_path, prompt, resolution, ref_img_index, audio_cfg, out_dir):
    from gradio_client import Client, handle_file  # lazy import

    try:
        client = Client(LONGCAT_SPACE_ID, hf_token=HF_TOKEN)
        result = client.predict(
            ref_image=handle_file(image_path),
            audio=handle_file(audio_path),
            prompt=prompt,
            api_name="/infer",  # VERIFY: open the Space's "API" tab + match endpoint name
        )
    except Exception as exc:
        raise LongCatError(f"Space call failed: {exc}") from exc

    return _save_result(result, out_dir)


# ---------------------------------------------------------------- local ----

def _generate_via_local(image_path, audio_path, prompt, resolution, ref_img_index, audio_cfg, out_dir):
    try:
        with open(image_path, "rb") as img, open(audio_path, "rb") as aud:
            resp = requests.post(
                f"{LONGCAT_LOCAL_URL}/avatar",
                files={"image": img, "audio": aud},
                data={
                    "prompt": prompt,
                    "resolution": resolution,
                    "ref_img_index": str(ref_img_index),
                    "audio_cfg": str(audio_cfg),
                },
                timeout=LONGCAT_TIMEOUT,
            )
        resp.raise_for_status()
        video_url = resp.json()["video_url"]
    except Exception as exc:
        raise LongCatError(f"Local service call failed: {exc}") from exc

    dl = requests.get(urljoin(LONGCAT_LOCAL_URL + "/", video_url.lstrip("/")), timeout=LONGCAT_TIMEOUT)
    dl.raise_for_status()

    out = Path(out_dir) / f"longcat_{int(time.time())}.mp4"
    out.write_bytes(dl.content)
    return str(out)


# ---------------------------------------------------------------- utils ----

def _save_result(result, out_dir):
    # gradio can return a URL, a local path, or a (path, ...) tuple
    if isinstance(result, (tuple, list)):
        result = result[0]
    out = Path(out_dir) / f"longcat_{int(time.time())}.mp4"

    if str(result).startswith("http"):
        dl = requests.get(str(result), timeout=LONGCAT_TIMEOUT)
        dl.raise_for_status()
        out.write_bytes(dl.content)
    else:
        src = Path(str(result))
        if not src.exists():
            raise LongCatError(f"Space returned missing file: {src}")
        out.write_bytes(src.read_bytes())
    return str(out)


# ------------------------------------------------------------------ cli ----

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tier-3 LongCat avatar generator")
    parser.add_argument("--image", required=True, help="reference image (the face)")
    parser.add_argument("--audio", required=True, help="voiceover audio file")
    parser.add_argument("--prompt", default="a friendly avatar talking directly to camera")
    parser.add_argument("--resolution", default="480p", choices=["480p", "720p"])
    parser.add_argument("--ref-img-index", type=int, default=0)
    parser.add_argument("--audio-cfg", type=float, default=4.0)
    parser.add_argument("--out-dir", default="output/avatar")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    print(
        generate_avatar(
            args.image,
            args.audio,
            args.prompt,
            args.resolution,
            args.ref_img_index,
            args.audio_cfg,
            args.out_dir,
        )
    )
