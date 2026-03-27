/* ─────────────────────────────────────────────
   player.js — 音訊播放、音量、Seek bar
───────────────────────────────────────────── */

import { state } from './state.js';
import { formatTime } from './ui.js';

// ─── 播放 / 暫停 ─────────────────────────────────
let rafId = null;

export function playAll() {
  state.stems.forEach(s => {
    if (s.audioEl) s.audioEl.play().catch(() => {});
  });
  state.isPlaying = true;
  document.getElementById('play-btn').textContent = '⏸';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tickSeekUI);
}

export function pauseAll() {
  state.stems.forEach(s => { if (s.audioEl) s.audioEl.pause(); });
  state.isPlaying = false;
  document.getElementById('play-btn').textContent = '▶';
}

export function stopAll() {
  state.stems.forEach(s => {
    if (s.audioEl) {
      s.audioEl.pause();
      // s.audioEl.currentTime = 0;
    }
  });
  state.isPlaying = false;
  const btn = document.getElementById('play-btn');
  if (btn) btn.textContent = '▶';
}

export function checkAllEnded() {
  if (state.isSeeking) return;
  const active = state.stems.filter(s => s.audioEl && !s.muted && s.audioEl.duration > 0);
  if (active.length === 0) return;
  if (active.every(s => s.audioEl.currentTime >= s.audioEl.duration - 0.5)) {
    state.stems.forEach(s => { if (s.audioEl) s.audioEl.currentTime = 0; });
    state.isPlaying = false;
    document.getElementById('play-btn').textContent = '▶';
  }
}

// ─── 音量增益 ────────────────────────────────────
export function applyGain(si) {
  const stem = state.stems[si];
  if (!stem.audioEl) return;
  const vol = stem.muted ? 0 : stem.volume;
  stem.audioEl.volume =
    (state.soloStem >= 0 && state.soloStem !== si) ? 0 : vol * state.masterVolume;
}

export function applyAllGains() {
  state.stems.forEach((_, i) => applyGain(i));
}

// ─── Seek bar 動畫更新 ────────────────────────────
function tickSeekUI() {
  if (!state.isPlaying) { rafId = null; return; }

  if (!state.isSeeking) {
    const ref = state.stems.find(s => s.audioEl && s.audioEl.duration);
    if (ref) {
      const ratio = ref.audioEl.currentTime / ref.audioEl.duration;
      document.getElementById('seek-bar').value      = ratio * 100;
      document.getElementById('playhead').style.left = ratio * 100 + '%';
      document.getElementById('time-display').textContent =
        `${formatTime(ref.audioEl.currentTime)} / ${formatTime(ref.audioEl.duration)}`;
    }
  }

  rafId = requestAnimationFrame(tickSeekUI);
}

// ─── Seek 跳轉（共用）────────────────────────────
export function seekToRatio(ratio) {
  const ref = state.stems.find(s => s.audioEl && s.audioEl.duration > 0);
  if (!ref) return;

  const targetTime = ratio * ref.audioEl.duration;

  state.stems.forEach(s => {
    if (s.audioEl && s.audioEl.duration > 0) {
      s.audioEl.currentTime = targetTime;
    }
  });

  document.getElementById('seek-bar').value      = ratio * 100;
  document.getElementById('playhead').style.left = ratio * 100 + '%';
  document.getElementById('time-display').textContent =
    `${formatTime(targetTime)} / ${formatTime(ref.audioEl.duration)}`;
}

// ─── 事件綁定 ────────────────────────────────────
export function initPlayerEvents() {
  document.getElementById('play-btn').addEventListener('click', () => {
    if (!state.stems.length) return;
    state.isPlaying ? pauseAll() : playAll();
  });

  const seekBar = document.getElementById('seek-bar');

  // 開始拖曳：鎖定 tickSeekUI（不暫停音訊，讓 seek 直接作用在播放中的音訊）
  seekBar.addEventListener('mousedown', () => { state.isSeeking = true; });
  seekBar.addEventListener('touchstart', () => { state.isSeeking = true; }, { passive: true });

  // 拖曳中：即時 seek 所有音軌（live seek）
  seekBar.addEventListener('input', e => {
    const ratio = parseFloat(e.target.value) / 100;
    seekToRatio(ratio);
  });

  // 拖曳結束：解鎖 tickSeekUI
  // 用 document 層級捕捉 mouseup，確保滑鼠移出元素外放開也能觸發
  document.addEventListener('mouseup', () => {
    if (!state.isSeeking) return;
    seekToRatio(parseFloat(seekBar.value) / 100);
    setTimeout(() => { state.isSeeking = false; }, 50);
  });

  seekBar.addEventListener('touchend', () => {
    if (!state.isSeeking) return;
    seekToRatio(parseFloat(seekBar.value) / 100);
    setTimeout(() => { state.isSeeking = false; }, 50);
  }, { passive: true });

  seekBar.addEventListener('touchcancel', () => {
    if (!state.isSeeking) return;
    state.isSeeking = false;
  }, { passive: true });

  document.getElementById('master-vol').addEventListener('input', e => {
    state.masterVolume = parseFloat(e.target.value);
    applyAllGains();
  });

  // 波形點擊跳轉
  document.getElementById('waveform-container').addEventListener('click', e => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekToRatio(ratio);
  });
}
