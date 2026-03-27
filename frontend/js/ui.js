/* ─────────────────────────────────────────────
   ui.js — DOM 輔助：通知、狀態列、進度條
───────────────────────────────────────────── */

/** 右上角 toast 通知 */
export function showNotif(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

/** 後端連線狀態燈 */
export function setStatusDot(online) {
  const dot = document.querySelector('.status-dot');
  dot.style.background = online ? 'var(--green)' : '#ff3c3c';
  dot.style.boxShadow  = online ? '0 0 8px var(--green)' : '0 0 8px #ff3c3c';
  dot.title = online ? '後端連線正常' : '後端尚未連線';
}

/** 更新音源資訊列 */
export function showFileBar(icon, name, meta) {
  document.getElementById('file-bar-icon').textContent     = icon;
  document.getElementById('file-name-display').textContent = name;
  document.getElementById('file-meta-display').textContent = meta;
  document.getElementById('processing-section').style.display = 'block';
}

/** 更新進度條文字與百分比 */
export function setProgressState(text, pct) {
  document.getElementById('progress-label').textContent = `PROCESSING... ${pct}%`;
  document.getElementById('progress-fill').style.width  = pct + '%';
  document.getElementById('progress-steps').textContent = text;
}

/** 顯示 / 隱藏各主要區塊 */
export function showSections({ progress, controls, stems, downloads, masterBar }) {
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? 'block' : 'none';
  };
  show('progress-wrap',     progress);
  show('split-controls',    controls);
  show('stems-section',     stems);
  show('download-section',  downloads);
  show('master-bar',        masterBar);
}

/** 時間格式化：秒 → m:ss */
export function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
