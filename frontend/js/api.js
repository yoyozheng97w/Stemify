/* ─────────────────────────────────────────────
   api.js — 與後端 FastAPI 溝通
───────────────────────────────────────────── */

import { API_BASE } from './state.js';
import { setProgressState } from './ui.js';
import { state } from './state.js';

/** 取得可用模型清單 */
export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('無法連線到後端');
  return res.json();
}

/** 本地檔案上傳分離（XHR，帶上傳進度） */
export function separateLocalFile(file, model, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', model);
  setProgressState('上傳音檔中...', 0);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 30);
        setProgressState(`上傳中... ${Math.round(e.loaded / e.total * 100)}%`, pct);
        onProgress?.(pct);
      }
    });

    xhr.upload.addEventListener('load', () => {
      setProgressState('AI 分離中，請稍候（可能需要數分鐘）...', 30);
      onProgress?.(30, 'processing');
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('後端回應格式錯誤')); }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).detail || msg; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error',   () => reject(new Error('網路連線失敗，請確認後端服務（localhost:8000）是否啟動')));
    xhr.addEventListener('timeout', () => reject(new Error('請求逾時（超過 10 分鐘）')));

    xhr.open('POST', `${API_BASE}/separate`);
    xhr.timeout = 600_000;
    xhr.send(formData);
  });
}

/** YouTube 連結分離 */
export async function separateYouTubeUrl(url, model) {
  setProgressState('下載 YouTube 音訊中...', 5);

  const res = await fetch(`${API_BASE}/separate-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** 嘗試從 noembed 取得 YouTube 影片標題（不需 API key） */
export async function fetchYouTubeTitle(url) {
  try {
    const res  = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}
