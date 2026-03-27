import os
import uuid
import shutil
import asyncio
import re
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
import aiofiles

app = FastAPI(title="Stemify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Range", "Content-Length"],
)

UPLOAD_DIR = Path("/tmp/stem_uploads")
OUTPUT_DIR = Path("/tmp/stem_outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODELS = {
    "htdemucs":    {"stems": ["vocals", "drums", "bass", "other"],                  "desc": "4 音軌（推薦）"},
    "htdemucs_6s": {"stems": ["vocals", "drums", "bass", "other", "guitar", "piano"], "desc": "6 音軌"},
    "mdx_extra":   {"stems": ["vocals", "drums", "bass", "other"],                  "desc": "高品質 4 音軌"},
}

STEM_NAMES = {
    "vocals": "人聲",
    "drums":  "鼓組",
    "bass":   "貝斯",
    "other":  "其他",
    "guitar": "吉他",
    "piano":  "鋼琴",
}


# ─── 工具：執行 shell 指令 ───────────────────────
async def run_cmd(cmd: list[str], timeout: int = 600) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        return -1, "", "執行逾時"
    return proc.returncode, stdout.decode(), stderr.decode()


# ─── 工具：執行 Demucs ───────────────────────────
async def run_demucs(in_path: Path, model: str) -> list[dict]:
    cmd = [
        "python", "-m", "demucs",
        "--name", model,
        "--out",  str(OUTPUT_DIR),
        "--mp3",
        "--mp3-bitrate", "320",
        str(in_path),
    ]
    code, stdout, stderr = await run_cmd(cmd, timeout=600)
    if code != 0:
        raise HTTPException(500, f"Demucs 錯誤：{stderr}")

    stem_dir = OUTPUT_DIR / model / in_path.stem
    if not stem_dir.exists():
        raise HTTPException(500, "找不到輸出目錄")

    stems = []
    for stem_file in sorted(stem_dir.iterdir()):
        if stem_file.suffix in (".mp3", ".wav"):
            key = stem_file.stem
            stems.append({
                "key":      key,
                "name":     STEM_NAMES.get(key, key),
                "url":      f"/download/{stem_file.parent.parent.name}/{stem_file.parent.name}/{stem_file.name}",
                "filename": stem_file.name,
            })
    return stems


# ─── GET /models ────────────────────────────────
@app.get("/models")
def get_models():
    return MODELS


# ─── POST /separate  （本地上傳）────────────────
@app.post("/separate")
async def separate(
    file: UploadFile = File(...),
    model: str = "htdemucs",
):
    if model not in MODELS:
        raise HTTPException(400, f"不支援的模型：{model}")

    job_id  = str(uuid.uuid4())
    suffix  = Path(file.filename).suffix or ".mp3"
    in_path = UPLOAD_DIR / f"{job_id}{suffix}"

    async with aiofiles.open(in_path, "wb") as f:
        await f.write(await file.read())

    stems = await run_demucs(in_path, model)
    in_path.unlink(missing_ok=True)

    return JSONResponse({"job_id": job_id, "model": model, "stems": stems})


# ─── POST /separate-url  （YouTube 連結）─────────
class UrlRequest(BaseModel):
    url:   str
    model: str = "htdemucs"

@app.post("/separate-url")
async def separate_url(req: UrlRequest):
    if req.model not in MODELS:
        raise HTTPException(400, f"不支援的模型：{req.model}")

    # 基本 URL 驗證
    yt_pattern = r"(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w\-]+"
    if not re.search(yt_pattern, req.url):
        raise HTTPException(400, "請提供有效的 YouTube 連結")

    job_id  = str(uuid.uuid4())
    in_path = UPLOAD_DIR / job_id  # yt-dlp 會自動加副檔名

    # 用 yt-dlp 下載音訊（最佳音質，轉成 mp3）
    cmd = [
        "yt-dlp",
        "--no-playlist",             # 只下載單首，不下載整個播放清單
        "--extract-audio",
        "--audio-format",  "mp3",
        "--audio-quality", "0",      # 最高品質
        "--output",        f"{in_path}.%(ext)s",
        "--no-progress",
        req.url,
    ]
    code, stdout, stderr = await run_cmd(cmd, timeout=120)
    if code != 0:
        raise HTTPException(500, f"yt-dlp 下載失敗：{stderr}")

    # 找到下載的檔案（副檔名由 yt-dlp 決定）
    matches = list(UPLOAD_DIR.glob(f"{job_id}.*"))
    if not matches:
        raise HTTPException(500, "下載後找不到音訊檔案")
    actual_path = matches[0]

    stems = await run_demucs(actual_path, req.model)
    actual_path.unlink(missing_ok=True)

    # 嘗試取得影片標題回傳給前端
    title_cmd = ["yt-dlp", "--get-title", "--no-playlist", req.url]
    _, title_out, _ = await run_cmd(title_cmd, timeout=15)
    title = title_out.strip() or "YouTube 音訊"

    return JSONResponse({
        "job_id": job_id,
        "model":  req.model,
        "title":  title,
        "stems":  stems,
    })


# ─── GET /download ───────────────────────────────
@app.get("/download/{model}/{track}/{filename}")
async def download(model: str, track: str, filename: str, request: Request):
    candidate = OUTPUT_DIR / model / track / filename
    if not candidate.exists():
        raise HTTPException(404, "檔案不存在")

    file_size = candidate.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        # 解析 Range: bytes=start-end
        range_val = range_header.replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0])
        end   = int(parts[1]) if parts[1] else file_size - 1
        end   = min(end, file_size - 1)
        length = end - start + 1

        def iter_file():
            with open(candidate, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iter_file(),
            status_code=206,
            media_type="audio/mpeg",
            headers={
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(length),
            },
        )

    # 一般完整請求
    return StreamingResponse(
        open(candidate, "rb"),
        status_code=200,
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges":       "bytes",
            "Content-Length":      str(file_size),
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


# ─── DELETE /cleanup ────────────────────────────
@app.delete("/cleanup/{job_id}")
async def cleanup(job_id: str):
    for model_dir in OUTPUT_DIR.iterdir():
        for track_dir in model_dir.iterdir():
            if job_id[:8] in track_dir.name:
                shutil.rmtree(track_dir, ignore_errors=True)
    return {"status": "cleaned"}