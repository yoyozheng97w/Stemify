/* ─────────────────────────────────────────────
   main.js — 入口：事件綁定、分離流程協調
   Stemify v3.0
───────────────────────────────────────────── */

import { state }                            from './state.js';
import { showNotif, showFileBar, showSections, setProgressState } from './ui.js';
import { fetchYouTubeTitle, separateLocalFile, separateYouTubeUrl } from './api.js';
import { initModels, renderRealStems, renderDownloads }             from './stems.js';
import { stopAll }                          from './player.js';
import { drawWaveformFromFile }             from './waveform.js';
import { initPlayerEvents }                 from './player.js';

// ─── Tab 切換 ────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    state.currentMode = btn.dataset.tab;
    document.getElementById(`tab-${state.currentMode}`).classList.add('active');
  });
});

// ─── 本地上傳 ────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput  = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleLocalFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleLocalFile(e.target.files[0]);
});

function handleLocalFile(file) {
  const okExt = ['mp3','wav','flac','aac','ogg','m4a','mp4'];
  const ext   = file.name.split('.').pop().toLowerCase();
  if (!okExt.includes(ext) && !file.type.startsWith('audio/')) {
    showNotif('❌ 請上傳音訊檔案（MP3/WAV/FLAC/AAC/OGG）');
    return;
  }
  state.currentFile = file;
  showFileBar('🎵', file.name, `${(file.size / 1024 / 1024).toFixed(1)} MB`);
  drawWaveformFromFile(file);
  showNotif('✅ 音檔已載入，選擇模式後點擊「開始分離」');
}

// ─── YouTube 連結 ─────────────────────────────────
function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/.test(url);
}

document.getElementById('yt-url').addEventListener('paste', e => {
  setTimeout(async () => {
    const url = e.target.value.trim();
    if (!isYouTubeUrl(url)) return;
    showFileBar('▶', '正在讀取影片資訊...', 'YouTube');
    const title = await fetchYouTubeTitle(url);
    if (title) showFileBar('▶', title, 'YouTube');
    showNotif('✅ YouTube 連結已輸入，選擇模式後點擊「開始分離」');
  }, 50);
});

document.getElementById('yt-url').addEventListener('input', e => {
  const url = e.target.value.trim();
  if (isYouTubeUrl(url)) showFileBar('▶', 'YouTube 影片', url);
});

// ─── 開始分離 ────────────────────────────────────
document.getElementById('split-btn').addEventListener('click', async () => {
  if (state.currentMode === 'upload' && !state.currentFile) {
    showNotif('❌ 請先上傳音檔');
    return;
  }
  if (state.currentMode === 'youtube') {
    const url = document.getElementById('yt-url').value.trim();
    if (!isYouTubeUrl(url)) {
      showNotif('❌ 請輸入有效的 YouTube 連結');
      return;
    }
  }

  resetStems();
  showSections({ progress: true, controls: false, stems: false, downloads: false, masterBar: false });

  try {
    let result;

    if (state.currentMode === 'upload') {
      result = await separateLocalFile(
        state.currentFile,
        state.selectedModel,
        (pct, phase) => {
          if (phase === 'processing') animateProgress(30, 95, 180_000);
        }
      );
    } else {
      animateProgress(5, 30, 30_000);
      result = await separateYouTubeUrl(
        document.getElementById('yt-url').value.trim(),
        state.selectedModel
      );
    }

    clearInterval(state.progressTimer);
    state.currentJobId = result.job_id;

    showSections({ progress: false, controls: true, stems: true, downloads: true, masterBar: true });
    renderRealStems(result.stems);
    renderDownloads();
    if (result.title) document.getElementById('file-name-display').textContent = result.title;
    showNotif(`✅ 分離完成！共 ${result.stems.length} 條音軌`);

  } catch (err) {
    clearInterval(state.progressTimer);
    showSections({ progress: false, controls: true, stems: false, downloads: false, masterBar: false });
    showNotif('❌ ' + (err.message || '分離失敗，請確認後端是否正常運作'));
    console.error(err);
  }
});

// ─── 進度條動畫 ───────────────────────────────────
function animateProgress(from, to, duration) {
  clearInterval(state.progressTimer);
  const steps     = 200;
  const interval  = duration / steps;
  let   current   = from;
  const increment = (to - from) / steps;

  state.progressTimer = setInterval(() => {
    current += increment;
    if (current >= to) { clearInterval(state.progressTimer); current = to; }
    const label = state.currentMode === 'youtube' && current < 30
      ? 'yt-dlp 下載音訊中...'
      : 'AI 分離中，請稍候（可能需要數分鐘）...';
    setProgressState(label, Math.round(current));
  }, interval);
}

// ─── 重置 ────────────────────────────────────────
document.getElementById('reset-btn').addEventListener('click', reset);

function resetStems() {
  stopAll();
  state.stems    = [];
  state.soloStem = -1;
  clearInterval(state.progressTimer);
}

function reset() {
  resetStems();
  state.currentFile  = null;
  state.currentJobId = null;
  showSections({ progress: false, controls: true, stems: false, downloads: false, masterBar: false });
  document.getElementById('processing-section').style.display = 'none';
  document.getElementById('stems-container').innerHTML        = '';
  document.getElementById('download-grid').innerHTML          = '';
  document.getElementById('yt-url').value                     = '';
  fileInput.value = '';
  showNotif('已重置');
}

// ─── 啟動 ────────────────────────────────────────
initModels();
initPlayerEvents();
