/* ─────────────────────────────────────────────
   state.js — 全域狀態與常數
   Stemify v3.0
───────────────────────────────────────────── */

export const API_BASE = 'http://localhost:8000';

export const COLORS = ['#00e5ff', '#ff6b35', '#7b2fff', '#ffe600', '#ff3cac', '#00ff87'];
export const EMOJIS = ['🎤', '🥁', '🎸', '🎹', '🎵', '🎺'];

// 可被其他模組讀寫的共用狀態
export const state = {
  currentFile:   null,
  currentMode:   'upload',   // 'upload' | 'youtube'
  selectedModel: 'htdemucs',
  stems:         [],
  isPlaying:     false,
  masterVolume:  1,
  soloStem:      -1,
  currentJobId:  null,
  progressTimer: null,
  isSeeking:     false,
};
