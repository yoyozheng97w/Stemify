/* ─────────────────────────────────────────────
   stems.js — 音軌 UI、下載列表、模型選擇
───────────────────────────────────────────── */

import { state, API_BASE, COLORS, EMOJIS } from './state.js';
import { applyGain, applyAllGains, checkAllEnded } from './player.js';
import { setStatusDot } from './ui.js';
import { fetchModels } from './api.js';

// ─── 模型選擇格 ──────────────────────────────────
export async function initModels() {
  try {
    const models = await fetchModels();
    renderModelGrid(models);
    setStatusDot(true);
  } catch {
    setStatusDot(false);
    renderModelGrid({
      htdemucs:    { stems: ['vocals','drums','bass','other'],                  desc: '4 音軌（推薦）' },
      htdemucs_6s: { stems: ['vocals','drums','bass','other','guitar','piano'], desc: '6 音軌' },
      mdx_extra:   { stems: ['vocals','drums','bass','other'],                  desc: '高品質 4 音軌' },
    });
    setTimeout(initModels, 5000);  // 5 秒後重試
  }
}

export function renderModelGrid(models) {
  const grid = document.getElementById('model-grid');
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
      state.selectedModel = key;
    });
    grid.appendChild(div);
    if (first) { state.selectedModel = key; first = false; }
  }
}

// ─── 音軌列表 ────────────────────────────────────
export function renderRealStems(stemsData) {
  state.stems = stemsData.map((s, i) => ({
    key:      s.key,
    name:     s.name,
    url:      `${API_BASE}${s.url}`,
    filename: s.filename,
    color:    COLORS[i % COLORS.length],
    emoji:    EMOJIS[i % EMOJIS.length],
    audioEl:  null,
    volume:   1,
    muted:    false,
  }));

  state.stems.forEach(stem => {
    const audio   = new Audio(stem.url);
    audio.preload = 'auto';
    stem.audioEl  = audio;
    audio.addEventListener('ended', checkAllEnded);
  });

  renderStemsUI();
}

function renderStemsUI() {
  const container = document.getElementById('stems-container');
  container.innerHTML = '';

  state.stems.forEach((stem, si) => {
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
          <button class="solo-btn"       id="solo-${si}"   title="Solo">S</button>
          <button class="toggle-btn on"  id="toggle-${si}" title="靜音">🔊</button>
        </div>
      </div>
    `;
    container.appendChild(row);

    // 音量
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
      state.soloStem = state.soloStem === si ? -1 : si;
      document.querySelectorAll('.solo-btn').forEach((b, i) =>
        b.classList.toggle('on', state.soloStem === i)
      );
      state.stems.forEach((_, i) => applyGain(i));
    });
  });
}

// ─── 下載按鈕 ────────────────────────────────────
export function renderDownloads() {
  const grid = document.getElementById('download-grid');
  grid.innerHTML = '';

  state.stems.forEach(stem => {
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
    });
    grid.appendChild(btn);
  });
}
