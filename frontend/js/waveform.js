/* ─────────────────────────────────────────────
   waveform.js — Canvas 波形繪製
───────────────────────────────────────────── */

import { formatTime } from './ui.js';

let _lastBuffer = null;
let _lastColor  = null;
let _resizeTimer = null;

window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_lastBuffer) drawWaveformCanvas(_lastBuffer, _lastColor, document.getElementById('waveform-canvas'));
  }, 100);
});

/** 從本地 File 物件繪製波形，並更新音源時長 */
export function drawWaveformFromFile(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const actx   = new AudioCtx();
  const reader = new FileReader();

  reader.onload = async e => {
    try {
      const buffer = await actx.decodeAudioData(e.target.result);
      document.getElementById('file-meta-display').textContent =
        `${formatTime(buffer.duration)} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
      drawWaveformCanvas(buffer, '#00e5ff', document.getElementById('waveform-canvas'));
    } catch { /* 靜默忽略無法解碼的情況 */ }
  };

  reader.readAsArrayBuffer(file);
}

/** 將 AudioBuffer 繪製到指定的 <canvas> 元素 */
export function drawWaveformCanvas(buffer, color, canvas) {
  _lastBuffer = buffer;
  _lastColor  = color;
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.parentElement.clientWidth - 24;
  const h   = 56;

  canvas.width        = w * dpr;
  canvas.height       = h * dpr;
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
