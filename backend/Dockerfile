FROM python:3.11-slim

WORKDIR /app

# 系統依賴（ffmpeg 用於音訊轉換）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 預先下載 Demucs 模型（htdemucs 是最新主力模型）
RUN python -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')"

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
