import os
import uuid
import shutil
import asyncio
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import aiofiles

app = FastAPI(title="STEM Splitter API")

# CORS — 允許前端跨域呼叫
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/tmp/stem_uploads")
OUTPUT_DIR = Path("/tmp/stem_outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 支援的模型
MODELS = {
    "htdemucs":    {"stems": ["vocals", "drums", "bass", "other"], "desc": "4 音軌（推薦）"},
    "htdemucs_6s": {"stems": ["vocals", "drums", "bass", "other", "guitar", "piano"], "desc": "6 音軌"},
    "mdx_extra":   {"stems": ["vocals", "drums", "bass", "other"], "desc": "高品質 4 音軌"},
}

STEM_NAMES = {
    "vocals": "人聲",
    "drums":  "鼓組",
    "bass":   "貝斯",
    "other":  "其他",
    "guitar": "吉他",
    "piano":  "鋼琴",
}


@app.get("/models")
def get_models():
    return MODELS


@app.post("/separate")
async def separate(
    file: UploadFile = File(...),
    model: str = "htdemucs",
):
    if model not in MODELS:
        raise HTTPException(400, f"不支援的模型：{model}")

    # 儲存上傳檔案
    job_id   = str(uuid.uuid4())
    suffix   = Path(file.filename).suffix or ".mp3"
    in_path  = UPLOAD_DIR / f"{job_id}{suffix}"
    out_path = OUTPUT_DIR / job_id

    async with aiofiles.open(in_path, "wb") as f:
        await f.write(await file.read())

    # 執行 Demucs（非同步，不阻塞 event loop）
    cmd = [
        "python", "-m", "demucs",
        "--name", model,
        "--out",  str(OUTPUT_DIR),
        "--mp3",                   # 輸出 MP3 節省空間
        "--mp3-bitrate", "320",
        str(in_path),
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise HTTPException(500, f"Demucs 錯誤：{stderr.decode()}")

    # Demucs 輸出路徑：outputs/<model>/<filename_without_ext>/
    stem_dir = OUTPUT_DIR / model / in_path.stem
    if not stem_dir.exists():
        raise HTTPException(500, "找不到輸出目錄")

    # 收集輸出檔案
    stems = []
    for stem_file in sorted(stem_dir.iterdir()):
        if stem_file.suffix in (".mp3", ".wav"):
            key = stem_file.stem  # e.g. "vocals"
            stems.append({
                "key":      key,
                "name":     STEM_NAMES.get(key, key),
                "url":      f"/download/{job_id}/{stem_file.name}",
                "filename": stem_file.name,
            })

    # 清理上傳檔案
    in_path.unlink(missing_ok=True)

    return JSONResponse({
        "job_id": job_id,
        "model":  model,
        "stems":  stems,
    })


@app.get("/download/{job_id}/{filename}")
async def download(job_id: str, filename: str):
    # 安全性：避免路徑穿越
    model_dirs = list(OUTPUT_DIR.iterdir())
    for model_dir in model_dirs:
        for track_dir in model_dir.iterdir():
            candidate = track_dir / filename
            if candidate.exists():
                return FileResponse(
                    candidate,
                    media_type="audio/mpeg",
                    filename=filename,
                )
    raise HTTPException(404, "檔案不存在")


@app.delete("/cleanup/{job_id}")
async def cleanup(job_id: str):
    """前端完成後呼叫，清理暫存檔"""
    for model_dir in OUTPUT_DIR.iterdir():
        for track_dir in model_dir.iterdir():
            if track_dir.name.startswith(job_id[:8]):
                shutil.rmtree(track_dir, ignore_errors=True)
    return {"status": "cleaned"}