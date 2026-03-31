# 🎵 Stemify

> AI-powered music source separation — split any song into vocals, drums, bass, guitar, and more

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![Demucs](https://img.shields.io/badge/AI-Demucs_4.0-blueviolet)](https://github.com/facebookresearch/demucs)

**[繁體中文](README.zh-TW.md) | English**

---

## 📸 Demo

**1. Upload a file or paste a YouTube URL**

<div align="center">
  <img alt="Upload screen" src="docs/screenshots/upload.png" width="700" />
</div>

**2. Separating — AI processing in progress**

<div align="center">
  <img alt="Separation in progress" src="docs/screenshots/processing.png" width="700" />
</div>

**3. Done — play and download each stem**

<div align="center">
  <img alt="Results screen" src="docs/screenshots/results.png" width="700" />
</div>

---

## ✨ Features

- 🎙️ **AI Stem Separation** — Powered by Meta Research's Demucs model; isolate vocals, drums, bass, and more
- 📁 **Local Upload** — Drag and drop support for MP3, WAV, FLAC, AAC, OGG, M4A, and more
- 🎬 **YouTube Integration** — Paste any YouTube URL and Stemify will download and separate it automatically
- 🎚️ **Interactive Player** — Per-stem volume control, mute, and solo mode with synchronized playback
- 📊 **Waveform Visualization** — Real-time Canvas waveform rendering with click-to-seek
- 💾 **High-Quality Export** — Download each stem individually as a 320kbps MP3
- 🐳 **One-Command Setup** — Fully containerized with Docker Compose, no manual environment setup needed

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS (ES Modules), CSS3, Web Audio API |
| Backend | FastAPI, Python 3.11, Uvicorn |
| AI Model | Demucs 4.0.1 (Meta Research) |
| Audio Processing | FFmpeg, yt-dlp, torchaudio |
| Infrastructure | Docker, Docker Compose, Nginx Alpine |

---

## 🚀 Getting Started with Docker

### Prerequisites

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS / Linux)
- Make sure Docker Desktop is running (look for the whale icon in your taskbar)
- At least **8 GB RAM** recommended; **12 GB+** for longer tracks

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/yoyozheng97w/stemify.git
cd stemify
```

**2. Start the containers**

```bash
docker compose up --build
```

> **First run only:** Docker will download Python packages, FFmpeg, and the Demucs AI model automatically. This takes **5–15 minutes**. Subsequent starts are near-instant since everything is cached.
>
> When you see `Uvicorn running on http://0.0.0.0:8000` in the terminal, the app is ready.

**3. Open your browser**

```
http://localhost:3000
```

**4. Stop the containers**

```bash
docker compose down
```

### Quick Reference

| Item | Details |
|------|---------|
| First startup time | 5–15 min (downloads ~300 MB model) |
| Subsequent startups | ~5 seconds (model is cached) |
| Memory limit | 12 GB by default (configurable in `docker-compose.yml`) |
| Processing time per song | ~2–10 min depending on length and CPU |

---

## 📖 How to Use

### Option 1: Upload a Local File

1. Click the **Upload** tab
2. Drag and drop an audio file, or click to browse
3. Select an AI separation model
4. Click **Start Separation**
5. Once done, play or download each stem individually

### Option 2: YouTube URL

1. Click the **YouTube** tab
2. Paste a YouTube video URL
3. Select an AI separation model
4. Click **Start Separation**
5. Wait for the download + processing to finish, then play or download each stem

---

## 🤖 Model Comparison

| Model | Stems | Output Tracks | Best For | Speed |
|-------|-------|---------------|----------|-------|
| `htdemucs` | 4 | Vocals, Drums, Bass, Other | General use — **recommended** | ⚡ Fast |
| `htdemucs_6s` | 6 | Vocals, Drums, Bass, Guitar, Piano, Other | More detailed separation | 🐢 Slower |
| `mdx_extra` | 4 | Vocals, Drums, Bass, Other | Alternative algorithm, different tonal character | ⚡ Fast |

---

## 🔌 API Reference

Backend runs at `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/models` | List available separation models |
| `POST` | `/separate` | Upload an audio file and separate it |
| `POST` | `/separate-url` | Download from YouTube URL and separate |
| `GET` | `/download/{model}/{track}/{filename}` | Download a stem (supports HTTP range requests) |
| `DELETE` | `/cleanup/{job_id}` | Remove temporary files for a job |

---

## ⚙️ Advanced Configuration

Edit `docker-compose.yml` to tune performance:

```yaml
environment:
  - OMP_NUM_THREADS=8   # Set to your CPU core count for best performance

deploy:
  resources:
    limits:
      memory: 12G       # Lower to 8G if your machine has less RAM
```

