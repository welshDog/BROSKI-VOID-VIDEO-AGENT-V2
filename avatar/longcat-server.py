"""
longcat-server.py — FastAPI wrapper around LongCat-Video-Avatar inference
=========================================================================
Runs inside the longcat-inference container (Dockerfile.longcat).

Endpoints:
    POST /avatar        multipart: image + audio, form: prompt, resolution,
                        ref_img_index, audio_cfg -> {"video_url": "/files/<id>.mp4"}
    GET  /files/<name>  download a finished video
    GET  /health        liveness probe for docker healthcheck

Requires:
    - LongCat-Video repo cloned at LONGCAT_REPO_DIR (done in the Dockerfile)
    - Weights mounted at LONGCAT_CHECKPOINT_DIR (see docker-compose.longcat.yml)
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

log = logging.getLogger("longcat-server")

REPO_DIR = Path(os.environ.get("LONGCAT_REPO_DIR", "/opt/longcat"))
CHECKPOINT_DIR = Path(os.environ.get("LONGCAT_CHECKPOINT_DIR", "/weights/LongCat-Video-Avatar"))
GPUS = int(os.environ.get("LONGCAT_GPUS", "1"))
WORK_DIR = Path(os.environ.get("LONGCAT_WORK_DIR", "/tmp/longcat"))
OUT_DIR = Path("/output")

# one GPU = one inference at a time. Serialize so torchrun never fights itself.
_lock = threading.Lock()

app = FastAPI(title="longcat-inference", version="0.1.0")


@app.get("/health")
def health():
    entrypoint = REPO_DIR / "run_demo_avatar_single_audio_to_video.py"
    return {
        "status": "ok" if entrypoint.exists() else "degraded",
        "repo": str(REPO_DIR),
        "checkpoint": str(CHECKPOINT_DIR),
        "checkpoint_ready": CHECKPOINT_DIR.exists(),
        "gpus": GPUS,
    }


@app.post("/avatar")
async def avatar(
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    prompt: str = Form("a friendly avatar talking directly to camera"),
    resolution: str = Form("480p"),
    ref_img_index: int = Form(0),
    audio_cfg: float = Form(4.0),
):
    job_id = uuid.uuid4().hex[:10]
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    (job_dir / "ref.png").write_bytes(await image.read())
    (job_dir / "voice.wav").write_bytes(await audio.read())

    try:
        video_url = await asyncio.to_thread(
            _run_inference, job_dir, job_id, prompt, resolution, ref_img_index, audio_cfg
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"video_url": video_url, "job_id": job_id}


def _run_inference(job_dir: Path, job_id: str, prompt: str, resolution: str, ref_img_index: int, audio_cfg: float) -> str:
    with _lock:
        # NOTE: field names mirror the LongCat demo JSONs
        # (assets/avatar/single_example_1.json in the LongCat-Video repo).
        # VERIFY after cloning + adjust if the schema differs.
        job = {
            "prompt": prompt,
            "image": str(job_dir / "ref.png"),
            "audio": str(job_dir / "voice.wav"),
            "ref_img_index": ref_img_index,
            "resolution": resolution,
            "audio_cfg": audio_cfg,
        }
        job_json = job_dir / "job.json"
        job_json.write_text(json.dumps(job))

        cmd = [
            "torchrun", f"--nproc_per_node={GPUS}",
            str(REPO_DIR / "run_demo_avatar_single_audio_to_video.py"),
            f"--context_parallel_size={GPUS}",
            f"--checkpoint_dir={CHECKPOINT_DIR}",
            "--stage_1=ai2v",
            f"--input_json={job_json}",
        ]
        log.info("Running: %s", " ".join(cmd))
        t0 = time.time()
        proc = subprocess.run(cmd, cwd=REPO_DIR, capture_output=True, text=True)
        if proc.returncode != 0:
            log.error("torchrun failed: %s", proc.stderr[-2000:])
            raise RuntimeError(f"LongCat inference failed: {proc.stderr[-400:]}")

        # LongCat writes mp4s somewhere under the repo. Grab whatever is new.
        candidates = sorted(
            (p for p in REPO_DIR.rglob("*.mp4") if p.stat().st_mtime >= t0),
            key=lambda p: p.stat().st_mtime,
        )
        if not candidates:
            raise RuntimeError("torchrun finished but no new .mp4 was found")

        final = OUT_DIR / f"{job_id}.mp4"
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidates[-1], final)
        shutil.rmtree(job_dir, ignore_errors=True)

        log.info("Job %s done in %.1fs", job_id, time.time() - t0)
        return f"/files/{final.name}"


@app.get("/files/{name}")
def files(name: str):
    safe = Path(name).name  # no path traversal
    path = OUT_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path, media_type="video/mp4")


OUT_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR.mkdir(parents=True, exist_ok=True)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
