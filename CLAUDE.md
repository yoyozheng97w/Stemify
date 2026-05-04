# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Stemify** is a containerized, AI-powered music source separation web app. Users upload a local audio file or paste a YouTube URL; the backend runs Meta's Demucs model and returns individual stems (vocals, drums, bass, etc.) as MP3 files. The frontend plays them back with per-stem volume/mute/solo controls and waveform visualization.

## Running the Project

Everything runs via Docker Compose — there is no Node.js build step or local Python setup needed.

```bash
docker compose up --build   # first run: ~5–15 min (downloads Demucs models)
docker compose up           # subsequent runs: ~5 seconds
```

- Frontend: `http://localhost:3000` (Nginx serving static files)
- Backend API: `http://localhost:8000`

There is no test suite. Manual testing is done by uploading an audio file or YouTube URL in the browser.

## Architecture

### Stack
| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS (ES Modules), CSS3, Canvas API |
| Backend | FastAPI + Uvicorn (Python 3.11) |
| AI Engine | Demucs 4.0.1 (Meta Research) via subprocess |
| Audio tooling | FFmpeg, yt-dlp, PyTorch / torchaudio |
| Infra | Docker, Docker Compose, Nginx Alpine |

### Request Flow

1. User uploads a file or YouTube URL → `frontend/js/api.js` sends a POST to `/separate` or `/separate-url`
2. Backend (`backend/main.py`) runs Demucs as an async subprocess; outputs per-stem MP3s to `/tmp/stem_outputs/`
3. Backend responds with a list of stem filenames
4. Frontend renders per-stem controls and streams audio via `GET /download/{model}/{track}/{filename}` (HTTP 206 range support)

### Frontend Module Responsibilities

```
main.js      — top-level orchestrator: tab switching, file/URL submission, separation flow
api.js       — all fetch/XHR calls to the backend
state.js     — global mutable state and constants (API_BASE, colors, emojis)
player.js    — synchronized multi-stem audio playback, seek, volume
stems.js     — stem card rendering, model selector, per-stem mute/solo/download
ui.js        — shared DOM helpers: notifications, progress bar, visibility toggles
waveform.js  — Canvas-based waveform drawing
```

### Backend (monolithic `backend/main.py`)

Five endpoints:
- `GET  /models` — list available Demucs model names
- `POST /separate` — accept uploaded file, run Demucs, return stem list
- `POST /separate-url` — accept YouTube URL (yt-dlp downloads first), run Demucs
- `GET  /download/{model}/{track}/{filename}` — stream a stem file with range support
- `DELETE /cleanup/{model}/{track}` — remove temp files

CORS is open to all origins.

## Key Hardcoded Values

| Setting | Location | Value |
|---------|----------|-------|
| API base URL | `frontend/js/state.js` | `http://localhost:8000` |
| Upload/output dirs | `backend/main.py` | `/tmp/stem_uploads`, `/tmp/stem_outputs` |
| Demucs models | `backend/main.py` | `htdemucs`, `htdemucs_6s`, `mdx_extra` |
| Docker memory limit | `docker-compose.yml` | 12 GB |
| CPU threads | `docker-compose.yml` | `OMP_NUM_THREADS=8` |

## Notes

- The Demucs model is pre-downloaded into the Docker image at build time (`~300 MB`); it is cached in a named volume (`demucs_models`) across rebuilds.
