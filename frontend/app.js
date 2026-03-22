/* ─────────────────────────────────────────────────
   STEM 音軌分離器 — app.js  (前後端分離版)
   後端：FastAPI + Demucs  http://localhost:8000
───────────────────────────────────────────────── */

const API_BASE = 'http://localhost:8000';

// ─── State ──────────────────────────────────────
let currentFile   = null;   // 使用者上傳的原始 File 物件
let selectedModel = 'htdemucs';
let stems         = [];     // [{ key, name, color, emoji, audioEl, volume, muted }]
let isPlaying     = false;
let masterVolume  = 1;
let soloStem      = -1;
let currentJobId  = null;
let progressTimer = null;

// 每條音軌顏色 / emoji
const COLORS = ['#00e5ff', '#ff6b35', '#7b2fff', '#ffe600', '#ff3cac', '#00ff87'];
const EMOJIS = ['🎤', '🥁', '🎸', '🎹', '🎵', '🎺'];

// ─── 初始化：載入後端模型清單 ───────────────────
async function initModels() {
  try {
    const res    = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error();
    const models = await res.json();
    renderModelGrid(models);
    setStatusDot(true);
  } catch {
    setStatusDot(false);
    // 後端尚未就緒時，顯示預設模型清單
    renderModelGrid({
      htdemucs:    { stems: ['vocals','drums','bass','other'],                  desc: '4 音軌（推薦）' },
      htdemucs_6s: { stems: ['vocals','drums','bass','other','guitar','piano'], desc: '6 音軌' },
      mdx_extra:   { stems: ['vocals','drums','bass','other'],                  desc: '高品質 4 音軌' },
    });
    setTimeout(initModels, 5000); // 5 秒後重試連線
  }
}

function renderModelGrid(models) {
  const grid = document.querySelector('.model-grid');
  grid.innerHTML = '';
  let first = true;
  for (const [key, val] of Object.entries(models)) {
    const div = document.createElement('div');
    div.className     = `model-btn${first ? ' active' : ''}`;
    div.dataset.model = key;
    div.innerHTML     = `
      <div class="model-name">
        ${val.stems.length} 音軌
        ${first ? '<span class="model-badge">推薦</span>' : ''}
      </div>
      <div class="model-desc">${val.desc}</div>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
      div.classList.add('active');
      selectedModel = key;
    });
    grid.appendChild(div);
    if (first) { selectedModel = key; first = false; }
  }
}

function setStatusDot(online) {
  const dot = document.querySelector('.status-dot');
  dot.style.background = online ? 'var(--green)' : '#ff3c3c';
  dot.style.boxShadow  = online ? '0 0 8px var(--green)' : '0 0 8px #ff3c3c';
  dot.title = online ? '後端連線正常' : '後端尚未連線';
}

// ─── Upload zone 事件 ────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput  = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// ─── 處理檔案選擇 ────────────────────────────────
function handleFile(file) {
  const okExt = ['mp3','wav','flac','aac','ogg','m4a','mp4'];
  const ext   = file.name.split('.').pop().toLowerCase();
  if (!okExt.includes(ext) && !file.type.startsWith('audio/')) {
    showNotif('❌ 請上傳音訊檔案（MP3/WAV/FLAC/AAC/OGG）');
    return;
  }

  currentFile = file;
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-meta-display').textContent =
    `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  document.getElementById('processing-section').style.display = 'block';

  // 非同步畫波形（失敗不影響主流程）
  drawWaveformFromFile(file);
  showNotif('✅ 音檔已載入，選擇模式後點擊「開始分離」');
}

// ─── 波形繪製 ────────────────────────────────────
function drawWaveformFromFile(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const actx   = new AudioCtx();
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const buffer = await actx.decodeAudioData(e.target.result);
      document.getElementById('file-meta-display').textContent =
        `${formatTime(buffer.duration)} · ${(file.size/1024/1024).toFixed(1)} MB`;
      drawWaveformCanvas(buffer, '#00e5ff', document.getElementById('waveform-canvas'));
    } catch { /* 靜默忽略 */ }
  };
  reader.readAsArrayBuffer(file);
}

function drawWaveformCanvas(buffer, color, canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.parentElement.clientWidth - 24;
  const h   = 56;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  const ctx  = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / w);
  const mid  = h / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.8;

  for (let i = 0; i < w; i++) {
    let min = 0, max = 0;
    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.beginPath();
    ctx.moveTo(i, mid + min * mid * 0.9);
    ctx.lineTo(i, mid + max * mid * 0.9);
    ctx.stroke();
  }
}

// 點波形區塊 seek
document.getElementById('waveform-container').addEventListener('click', e => {
  const rect  = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  stems.forEach(s => {
    if (s.audioEl && s.audioEl.duration) s.audioEl.currentTime = ratio * s.audioEl.duration;
  });
  document.getElementById('seek-bar').value = ratio * 100;
});

// ─── 開始分離（呼叫後端）────────────────────────
document.getElementById('split-btn').addEventListener('click', async () => {
  if (!currentFile) {
    showNotif('❌ 請先上傳音檔');
    return;
  }

  resetStems();
  stopAll();

  // 顯示進度 UI
  document.querySelector('.split-controls').style.display = 'none';
  document.getElementById('progress-wrap').style.display  = 'block';
  setProgressState('上傳音檔中...', 0);

  const formData = new FormData();
  formData.append('file',  currentFile);
  formData.append('model', selectedModel);

  try {
    const result = await uploadWithProgress(formData);
    currentJobId = result.job_id;

    document.getElementById('progress-wrap').style.display  = 'none';
    document.querySelector('.split-controls').style.display = 'block';

    renderRealStems(result.stems);
  } catch (err) {
    clearInterval(progressTimer);
    document.getElementById('progress-wrap').style.display  = 'none';
    document.querySelector('.split-controls').style.display = 'block';
    showNotif('❌ 分離失敗：' + (err.message || '請確認後端是否正常運作'));
    console.error(err);
  }
});

// XHR 上傳（可追蹤進度）
function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 上傳進度 (0 → 30%)
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 30);
        setProgressState(`上傳中... ${Math.round(e.loaded/e.total*100)}%`, pct);
      }
    });

    // 上傳完成後進入後端處理階段 (30 → 95%)
    xhr.upload.addEventListener('load', () => {
      setProgressState('AI 分離中，請稍候（可能需要數分鐘）...', 30);
      animateProgress(30, 95, 180000);
    });

    xhr.addEventListener('load', () => {
      clearInterval(progressTimer);
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
    xhr.timeout = 600000; // 10 分鐘
    xhr.send(formData);
  });
}

function animateProgress(from, to, duration) {
  clearInterval(progressTimer);
  const steps     = 200;
  const interval  = duration / steps;
  let   current   = from;
  const increment = (to - from) / steps;
  progressTimer = setInterval(() => {
    current += increment;
    if (current >= to) { clearInterval(progressTimer); current = to; }
    setProgressState('AI 分離中，請稍候（可能需要數分鐘）...', Math.round(current));
  }, interval);
}

function setProgressState(text, pct) {
  document.getElementById('progress-label').textContent = `PROCESSING... ${pct}%`;
  document.getElementById('progress-fill').style.width  = pct + '%';
  document.getElementById('progress-steps').textContent = text;
}

// ─── 渲染真實音軌 ────────────────────────────────
function renderRealStems(stemsData) {
  stems = stemsData.map((s, i) => ({
    key:     s.key,
    name:    s.name,
    url:     `${API_BASE}${s.url}`,
    filename: s.filename,
    color:   COLORS[i % COLORS.length],
    emoji:   EMOJIS[i % EMOJIS.length],
    audioEl: null,
    volume:  1,
    muted:   false,
  }));

  // 每條音軌建立獨立 <audio> 元素
  stems.forEach(stem => {
    const audio   = new Audio(stem.url);
    audio.preload = 'auto';
    stem.audioEl  = audio;
    audio.addEventListener('ended', checkAllEnded);
  });

  renderStemsUI();

  document.getElementById('stems-section').style.display    = 'block';
  document.getElementById('download-section').style.display = 'block';
  document.getElementById('master-bar').style.display       = 'block';
  renderDownloads();

  showNotif(`✅ 分離完成！共 ${stems.length} 條音軌`);
}

function checkAllEnded() {
  if (stems.every(s => !s.audioEl || s.muted || s.audioEl.ended)) {
    isPlaying = false;
    document.getElementById('play-btn').textContent = '▶';
  }
}

// ─── 音軌 UI ─────────────────────────────────────
function renderStemsUI() {
  const container = document.getElementById('stems-container');
  container.innerHTML = '';

  stems.forEach((stem, si) => {
    const row = document.createElement('div');
    row.className = 'stem-row';
    row.id        = `stem-row-${si}`;
    row.innerHTML = `
      <div class="stem-header">
        <div class="stem-color" style="background:${stem.color}"></div>
        <div class="stem-info">
          <div class="stem-name" style="color:${stem.color}">${stem.emoji} ${stem.name}</div>
          <div class="stem-type">${stem.key.toUpperCase()}</div>
        </div>
        <div class="stem-controls">
          <div class="vol-wrap">
            <span class="vol-label" id="vol-label-${si}">100</span>
            <input type="range" min="0" max="1" step="0.01" value="1" id="vol-${si}" title="音量">
          </div>
          <button class="solo-btn" id="solo-${si}" title="Solo">S</button>
          <button class="toggle-btn on" id="toggle-${si}" title="靜音">🔊</button>
        </div>
      </div>
    `;
    container.appendChild(row);

    // 音量滑桿
    document.getElementById(`vol-${si}`).addEventListener('input', e => {
      stem.volume = parseFloat(e.target.value);
      document.getElementById(`vol-label-${si}`).textContent = Math.round(stem.volume * 100);
      applyGain(si);
    });

    // 靜音切換
    document.getElementById(`toggle-${si}`).addEventListener('click', () => {
      stem.muted = !stem.muted;
      const btn  = document.getElementById(`toggle-${si}`);
      btn.textContent = stem.muted ? '🔇' : '🔊';
      btn.classList.toggle('on', !stem.muted);
      row.classList.toggle('muted', stem.muted);
      applyGain(si);
    });

    // Solo
    document.getElementById(`solo-${si}`).addEventListener('click', () => {
      soloStem = soloStem === si ? -1 : si;
      document.querySelectorAll('.solo-btn').forEach((b, i) => {
        b.classList.toggle('on', soloStem === i);
      });
      stems.forEach((_, i) => applyGain(i));
    });
  });
}

function applyGain(si) {
  const stem = stems[si];
  if (!stem.audioEl) return;
  const vol = stem.muted ? 0 : stem.volume;
  stem.audioEl.volume = (soloStem >= 0 && soloStem !== si) ? 0 : vol * masterVolume;
}

function applyAllGains() {
  stems.forEach((_, i) => applyGain(i));
}

// ─── 播放控制 ─────────────────────────────────────
document.getElementById('play-btn').addEventListener('click', () => {
  if (!stems.length) return;
  if (isPlaying) pauseAll();
  else playAll();
});

function playAll() {
  // 若已播完，重頭再播
  stems.forEach(s => {
    if (s.audioEl) {
      if (s.audioEl.ended) s.audioEl.currentTime = 0;
      s.audioEl.play().catch(() => {});
    }
  });
  isPlaying = true;
  document.getElementById('play-btn').textContent = '⏸';
  requestAnimationFrame(tickSeekUI);
}

function pauseAll() {
  stems.forEach(s => { if (s.audioEl) s.audioEl.pause(); });
  isPlaying = false;
  document.getElementById('play-btn').textContent = '▶';
}

function stopAll() {
  stems.forEach(s => {
    if (s.audioEl) { s.audioEl.pause(); s.audioEl.currentTime = 0; }
  });
  isPlaying = false;
  const btn = document.getElementById('play-btn');
  if (btn) btn.textContent = '▶';
}

// Seek bar 拖曳
document.getElementById('seek-bar').addEventListener('input', e => {
  const ratio = parseFloat(e.target.value) / 100;
  stems.forEach(s => {
    if (s.audioEl && s.audioEl.duration) s.audioEl.currentTime = ratio * s.audioEl.duration;
  });
});

// 主音量
document.getElementById('master-vol').addEventListener('input', e => {
  masterVolume = parseFloat(e.target.value);
  applyAllGains();
});

// rAF 更新 seek bar
function tickSeekUI() {
  if (!isPlaying) return;
  const ref = stems.find(s => s.audioEl && s.audioEl.duration);
  if (ref) {
    const ratio = ref.audioEl.currentTime / ref.audioEl.duration;
    document.getElementById('seek-bar').value        = ratio * 100;
    document.getElementById('playhead').style.left   = ratio * 100 + '%';
    document.getElementById('time-display').textContent =
      `${formatTime(ref.audioEl.currentTime)} / ${formatTime(ref.audioEl.duration)}`;
  }
  requestAnimationFrame(tickSeekUI);
}

// ─── 下載區塊 ────────────────────────────────────
function renderDownloads() {
  const grid = document.getElementById('download-grid');
  grid.innerHTML = '';
  stems.forEach((stem, i) => {
    const btn = document.createElement('div');
    btn.className = 'dl-btn';
    btn.innerHTML = `
      <div class="dl-name">${stem.emoji} ${stem.name}</div>
      <div class="dl-meta">點擊下載</div>
    `;
    btn.addEventListener('click', () => {
      const a    = document.createElement('a');
      a.href     = stem.url;
      a.download = stem.filename || `${stem.key}.mp3`;
      a.target   = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showNotif(`⬇ 下載：${stem.name}`);
    });
    grid.appendChild(btn);
  });
}

// ─── 重置 ────────────────────────────────────────
document.getElementById('reset-btn').addEventListener('click', () => {
  resetStems();
  currentFile  = null;
  currentJobId = null;

  document.getElementById('processing-section').style.display = 'none';
  document.querySelector('.split-controls').style.display     = 'block';
  document.getElementById('progress-wrap').style.display      = 'none';
  document.getElementById('stems-section').style.display      = 'none';
  document.getElementById('download-section').style.display   = 'none';
  document.getElementById('master-bar').style.display         = 'none';
  document.getElementById('stems-container').innerHTML        = '';
  document.getElementById('download-grid').innerHTML          = '';
  fileInput.value = '';
  showNotif('已重置');
});

function resetStems() {
  stopAll();
  stems    = [];
  soloStem = -1;
  clearInterval(progressTimer);
}

// ─── 工具函式 ────────────────────────────────────
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function showNotif(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── 啟動 ────────────────────────────────────────
initModels();