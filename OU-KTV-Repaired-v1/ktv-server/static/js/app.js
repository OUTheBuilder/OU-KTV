
// ===== app.js — O|U KTV frontend (clone) =====
'use strict';

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
const safeImageURL = (value) => { try { const u = new URL(String(value || ''), location.href); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const safeQRImageURL = (value) => { const v = String(value || ''); return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(v) ? v : safeImageURL(v); };
const rememberHostRoom = (r) => { if (r && r.code && r.host_token) localStorage.setItem('ktv_host_' + r.code, r.host_token); };
const show = (id) => { const e = $(`#${id}`); e && e.classList.remove('hidden'); };
const hide = (id) => { const e = $(`#${id}`); e && e.classList.add('hidden'); };
const openModal = (id) => { $(`#${id}`).classList.remove('hidden'); };
const closeModal = (id) => { $(`#${id}`).classList.add('hidden'); };

// ---------- Ripple effect on click/touch for all buttons ----------
(function () {
  function createRipple(e) {
    const el = e.currentTarget;
    if (!el || getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const rect = el.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches.length) { x = e.touches[0].clientX - rect.left; y = e.touches[0].clientY - rect.top; }
    else { x = (e.clientX || rect.left + rect.width / 2) - rect.left; y = (e.clientY || rect.top + rect.height / 2) - rect.top; }
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (x - size / 2) + 'px';
    ripple.style.top = (y - size / 2) + 'px';
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }
  const sel = 'button, .btn, .icon-btn, .landing-btn, .remote-btn, .host-ctrl-btn, .ktv-search-header, .ktv-tab, .tab, .rtab, .r-add, .results-list li, #ktv-popular-list li, .queue-item, [role="button"]';
  function attach() {
    document.querySelectorAll(sel).forEach(el => {
      if (el._rippleAttached) return;
      el._rippleAttached = true;
      el.addEventListener('click', createRipple);
      el.addEventListener('touchstart', createRipple, { passive: true });
    });
  }
  // Run immediately (DOM is already loaded since script is at bottom) + on DOMContentLoaded
  if (document.readyState !== 'loading') attach();
  else document.addEventListener('DOMContentLoaded', attach);
  // Re-attach for dynamically added elements
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  });
})();

// ---------- Modern SVG Icons (Lucide-style, stroke-based) ----------
const ICON = {
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  doorOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><polyline points="9 8 9 12 11 12"/><line x1="3" y1="4" x2="3" y2="20"/><path d="M13 20V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  pip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none"/></svg>',
};
function setIcon(selectorOrEl, iconName) {
  const el = typeof selectorOrEl === 'string' ? $(selectorOrEl) : selectorOrEl;
  if (el && ICON[iconName]) el.innerHTML = ICON[iconName];
}
function iconLabel(iconName, label) {
  return `<span class="ic">${ICON[iconName]}</span> ${label}`;
}

function injectStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    if (ICON[name]) el.innerHTML = ICON[name];
  });
  document.querySelectorAll('[data-icon-label]').forEach(el => {
    const name = el.getAttribute('data-icon-label');
    if (ICON[name]) el.innerHTML = `<span class="ic">${ICON[name]}</span> ${el.textContent.trim()}`;
  });
  setIcon('#theme-quick-btn', 'palette');
  setIcon('#settings-btn', 'settings');
  setIcon('#home-refresh-btn', 'refresh');
  setIcon('#landing-refresh-btn', 'refresh');
  setIcon('#ktv-theme-btn', 'palette');
  setIcon('#ktv-info-btn', 'info');
  setIcon('#ktv-settings-btn', 'settings');
  setIcon('#ktv-refresh-btn', 'refresh');
  setIcon('#remote-refresh-btn', 'refresh');
  setIcon('#pip-btn', 'pip');
  setIcon('#remote-pip-btn', 'pip');
  // fullscreen icons set via data-icon attribute; ensure they're rendered
  document.querySelectorAll('[data-icon="expand"]').forEach(el => { el.innerHTML = ICON.expand; });
  setIcon('#leave-ktv-btn', 'arrowLeft');
  const lb = $('#leave-ktv-btn');
  if (lb) lb.innerHTML = `${ICON.arrowLeft}<span style="margin-left:2px">Leave</span>`;
  setIcon('.host-banner-icon', 'tv');
  // Note: #create-ktv-btn now has inline SVG + text in the SingKTV-style design — don't clobber it
  // Tabs also have plain text in the new design — don't clobber with icons
  const searchTab = document.querySelector('#home-screen .tab[data-tab="search"]');
  if (searchTab && !searchTab.querySelector('.ic')) searchTab.innerHTML = iconLabel('search', 'Search');
  const popTab = document.querySelector('#home-screen .tab[data-tab="popular"]');
  if (popTab && !popTab.querySelector('.ic')) popTab.innerHTML = iconLabel('flame', 'Popular');
  const skipBtn = $('#skip-btn');
  if (skipBtn) skipBtn.innerHTML = iconLabel('skip', 'Skip');
  const cheerBtn = $('#cheer-btn');
  if (cheerBtn) cheerBtn.innerHTML = iconLabel('heart', 'Cheer');
  const slb = $('#sidebar-leave-btn');
  if (slb) slb.innerHTML = iconLabel('doorOpen', 'Leave KTV');
  const adminBtn = $('#open-admin-btn');
  if (adminBtn) adminBtn.innerHTML = iconLabel('wrench', 'Admin Panel');
  const copyBtn = $('#copy-join-link');
  if (copyBtn) copyBtn.innerHTML = iconLabel('copy', 'Copy Join Link');
  document.querySelectorAll('[data-close]').forEach(btn => { btn.innerHTML = ICON.close; });
}

// ---------- State ----------
let CONFIG = null;
let userEmail = localStorage.getItem('ktv_user_email') || '';
let userToken = localStorage.getItem('ktv_user_token') || '';
let displayName = localStorage.getItem('ktv_display_name') || '';
let adminToken = sessionStorage.getItem('ktv_admin_token') || '';
let currentKTV = null;
let ws = null;
let wsReconnectTries = 0;
let ytPlayer = null;
let ytReady = false;
let currentVideoId = null;
// Video.js players (host + remote)
let vjsPlayer = null;
let remoteVjsPlayer = null;
let vjsReady = false;
// Which player engine to use: 'youtube' (IFrame API) or 'videojs' (Video.js)
let playerEngine = 'youtube';
// Current refresh animation type (from server config, overridable by admin)
let refreshAnimation = 'fall';
// Base path derived from the page URL (e.g. '/ktv') so API/WS hit the right backend
const BASE = location.pathname.replace(/\/[^\/]*$/, '') || '';

// ---------- Themes ----------
const THEMES = [
  { id: 'neonpop',    name: 'Neon Pop',    colors: ['#E91E8C', '#1FB6B6', '#F4F6FA'] },
  { id: 'retro80s',   name: 'Retro 80s',   colors: ['#FF5E3A', '#FFD23F', '#1E0F2E'] },
  { id: 'classicktv', name: 'Classic KTV', colors: ['#B71C1C', '#D4AF37', '#F5EFE6'] },
  { id: 'midnight',   name: 'Midnight',    colors: ['#A855F7', '#22D3EE', '#0F0F1A'] },
  { id: 'sunrise',    name: 'Sunrise',     colors: ['#FF8A72', '#7ED7C1', '#FFF5F1'] },
  { id: 'aurora',     name: 'Aurora',       colors: ['#6366F1', '#EC4899', '#0A0E27'] },
  { id: 'glass',      name: 'Glass',        colors: ['#6366F1', '#06B6D4', '#EEF2FF'] },
  { id: 'slate',      name: 'Slate',        colors: ['#3B82F6', '#8B5CF6', '#0F172A'] },
  { id: 'ocean',      name: 'Ocean',        colors: ['#0EA5E9', '#14B8A6', '#F0FDFA'] },
  { id: 'sunset',     name: 'Sunset',       colors: ['#F97316', '#EC4899', '#FFF7ED'] },
];

function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('ktv_theme', themeId);
  $$('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === themeId));
}
function buildThemeGrid() {
  const grid = $('#theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const current = localStorage.getItem('ktv_theme') || (CONFIG && CONFIG.default_theme) || 'neonpop';
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'theme-card' + (t.id === current ? ' active' : '');
    card.dataset.theme = t.id;
    card.innerHTML = `<div class="theme-swatches">${t.colors.map(c => `<div class="swatch" style="background:${c}"></div>`).join('')}</div>${t.name}`;
    card.onclick = () => { applyTheme(t.id); };
    grid.appendChild(card);
  });
}
function cycleTheme() {
  const current = localStorage.getItem('ktv_theme') || 'neonpop';
  const idx = THEMES.findIndex(t => t.id === current);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next.id);
  const toast = document.createElement('div');
  toast.style.css = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999';
  toast.textContent = `Theme: ${next.name}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

// ---------- API ----------
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = 'Bearer ' + adminToken;
  else if (userToken) headers['Authorization'] = 'Bearer ' + userToken;
  const r = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && adminToken && !path.includes('/admin/login')) {
      adminToken = ''; sessionStorage.removeItem('ktv_admin_token');
      closeModal('admin-modal'); openModal('admin-login-modal');
    } else if (r.status === 401 && userToken && path !== '/login') {
      userToken = ''; userEmail = '';
      localStorage.removeItem('ktv_user_token'); localStorage.removeItem('ktv_user_email');
      if (CONFIG && CONFIG.email_login_enabled) showRegistrationModal();
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ---------- YouTube IFrame API ----------
window.onYouTubeIframeAPIReady = () => { ytReady = true; };
function checkYtReady() {
  if (ytReady) return true;
  if (typeof YT !== 'undefined' && YT && YT.Player) { ytReady = true; return true; }
  return false;
}
function maybeStartPlayer() {
  if (!currentKTV || !currentKTV.nowPlaying) {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }
    $('#player-idle').classList.remove('hidden');
    $('#now-playing-bar').classList.add('hidden');
    return;
  }
  const v = currentKTV.nowPlaying;
  $('#player-idle').classList.add('hidden');
  $('#now-playing-bar').classList.remove('hidden');
  $('#np-title').textContent = v.title;
  $('#np-by').textContent = 'Added by ' + (v.requester || 'guest');
  // Hide Video.js player when using YouTube IFrame
  $('#videojs-player').classList.add('hidden');
  if (!checkYtReady()) { setTimeout(maybeStartPlayer, 500); return; }
  if (!ytPlayer) {
    currentVideoId = v.youtube_id;
    ytPlayer = new YT.Player('yt-player', {
      videoId: v.youtube_id,
      playerVars: { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: (e) => { try { e.target.playVideo(); } catch {} },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code }));
          }
        },
        onError: (e) => {
          if (e.data === 150 || e.data === 101 || e.data === 100) {
            $('#np-title').textContent = 'Video unavailable — skipping...';
            setTimeout(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); }, 2000);
          }
        },
      },
    });
  } else if (currentVideoId !== v.youtube_id) {
    currentVideoId = v.youtube_id;
    ytPlayer.loadVideoById(v.youtube_id);
  }
}

// ---------- Video.js Player ----------
function checkVjsReady() {
  if (vjsReady || (typeof videojs !== 'undefined')) { vjsReady = true; return true; }
  return false;
}

// Build a source object for Video.js from a song
function vjsSourceFor(v) {
  if (v.video_url) {
    // Direct video file — guess type from extension
    const ext = v.video_url.split('?')[0].split('.').pop().toLowerCase();
    const types = { mp4:'video/mp4', webm:'video/webm', ogg:'video/ogg', ogv:'video/ogg', mov:'video/mp4', m4v:'video/mp4', mkv:'video/x-matroska', avi:'video/x-msvideo', m3u8:'application/x-mpegURL' };
    return { src: v.video_url, type: types[ext] || 'video/mp4' };
  }
  if (v.youtube_id) {
    // YouTube via videojs-youtube tech
    return { src: 'https://www.youtube.com/watch?v=' + v.youtube_id, type: 'video/youtube' };
  }
  return null;
}

// Host player via Video.js
function maybeStartVjsPlayer() {
  if (!currentKTV || !currentKTV.nowPlaying) {
    if (vjsPlayer) { try { vjsPlayer.pause(); } catch {} }
    $('#videojs-player').classList.add('hidden');
    $('#player-idle').classList.remove('hidden');
    $('#now-playing-bar').classList.add('hidden');
    return;
  }
  const v = currentKTV.nowPlaying;
  const src = vjsSourceFor(v);
  if (!src) return;
  $('#player-idle').classList.add('hidden');
  $('#now-playing-bar').classList.remove('hidden');
  $('#np-title').textContent = v.title;
  $('#np-by').textContent = 'Added by ' + (v.requester || 'guest');
  if (!checkVjsReady()) { setTimeout(maybeStartVjsPlayer, 500); return; }

  const el = $('#videojs-player');
  el.classList.remove('hidden');
  // Hide YouTube IFrame player when using Video.js
  $('#yt-player').style.display = 'none';
  if (!vjsPlayer) {
    vjsPlayer = videojs(el, {
      controls: true,
      autoplay: true,
      fluid: true,
      playsinline: true,
      sources: [src],
      controlBar: {
        playToggle: false,
        volumePanel: false,
        currentTimeDisplay: false,
        timeDivider: false,
        durationDisplay: false,
        progressControl: false,
        remainingTimeDisplay: false,
        liveDisplay: false,
        seekToLive: false,
        customControlsSpacer: false,
        playbackRateMenuButton: false,
        chaptersButton: false,
        descriptionsButton: false,
        subsCapsButton: false,
        audioTrackButton: false,
        skipBackward: false,
        skipForward: false,
        pictureInPictureToggle: true,
        fullscreenToggle: true,
      },
    });
    vjsPlayer.ready(function() {
      vjsPlayer.play().catch(() => {});
    });
    vjsPlayer.on('ended', () => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code }));
    });
    vjsPlayer.on('error', () => {
      $('#np-title').textContent = 'Video error — skipping...';
      setTimeout(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); }, 2000);
    });
    // MediaSession integration
    if ('mediaSession' in navigator) {
      vjsPlayer.on('play', () => { navigator.mediaSession.playbackState = 'playing'; });
      vjsPlayer.on('pause', () => { navigator.mediaSession.playbackState = 'paused'; });
      navigator.mediaSession.setActionHandler('play', () => vjsPlayer.play());
      navigator.mediaSession.setActionHandler('pause', () => vjsPlayer.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => {});
      navigator.mediaSession.setActionHandler('nexttrack', () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); });
    }
  } else {
    vjsPlayer.src(src);
    vjsPlayer.play().catch(() => {});
  }
  // Update MediaSession metadata
  if ('mediaSession' in navigator) {
    const artwork = v.youtube_id ? [{ src: `https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({ title: v.title, artist: v.requester || 'guest', album: 'O|U KTV', artwork });
  }
}

// Remote player via Video.js (muted preview)
function maybeStartRemoteVjsPlayer(r) {
  if (!r || !r.nowPlaying) {
    if (remoteVjsPlayer) { try { remoteVjsPlayer.pause(); } catch {} }
    $('#remote-videojs-player').classList.add('hidden');
    $('#remote-player-idle').classList.remove('hidden');
    return;
  }
  const v = r.nowPlaying;
  const src = vjsSourceFor(v);
  if (!src) return;
  if (!checkVjsReady()) { setTimeout(() => { if (currentKTV) maybeStartRemoteVjsPlayer(currentKTV); }, 500); return; }

  const el = $('#remote-videojs-player');
  el.classList.remove('hidden');
  $('#remote-player-idle').classList.add('hidden');
  // Hide YouTube IFrame remote player when using Video.js
  $('#remote-yt-player').style.display = 'none';
  if (!remoteVjsPlayer) {
    remoteVjsPlayer = videojs(el, {
      controls: true,
      autoplay: true,
      muted: true,
      fluid: true,
      playsinline: true,
      sources: [src],
      controlBar: {
        playToggle: false,
        volumePanel: false,
        currentTimeDisplay: false,
        timeDivider: false,
        durationDisplay: false,
        progressControl: false,
        remainingTimeDisplay: false,
        liveDisplay: false,
        seekToLive: false,
        customControlsSpacer: false,
        playbackRateMenuButton: false,
        chaptersButton: false,
        descriptionsButton: false,
        subsCapsButton: false,
        audioTrackButton: false,
        skipBackward: false,
        skipForward: false,
        pictureInPictureToggle: true,
        fullscreenToggle: true,
      },
    });
    remoteVjsPlayer.ready(function() { remoteVjsPlayer.muted(true); remoteVjsPlayer.play().catch(() => {}); });
    remoteVjsPlayer.on('ended', () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); });
  } else {
    remoteVjsPlayer.src(src);
    remoteVjsPlayer.muted(true);
    remoteVjsPlayer.play().catch(() => {});
  }
}

function applyVjsPlaybackState(r) {
  if (!vjsPlayer || !r.nowPlaying) return;
  try { if (r.isPaused) vjsPlayer.pause(); else vjsPlayer.play(); } catch {}
}
function applyRemoteVjsPlaybackState(r) {
  if (!remoteVjsPlayer || !r.nowPlaying) return;
  try { remoteVjsPlayer.muted(true); if (r.isPaused) remoteVjsPlayer.pause(); else remoteVjsPlayer.play(); } catch {}
}
function destroyVjsPlayers() {
  if (vjsPlayer) { try { vjsPlayer.dispose(); } catch {} vjsPlayer = null; }
  if (remoteVjsPlayer) { try { remoteVjsPlayer.dispose(); } catch {} remoteVjsPlayer = null; }
}

// ---------- Boot ----------
let isRemoteMode = false;
let isHost = false;
let remoteYtPlayer = null;
let remotePlayerReady = false;
let pendingKTVCode = null;

async function boot() {
  injectStaticIcons();
  const hash = location.hash || '';
  const query = new URLSearchParams(location.search || '');
  const urlCode = query.get('code') || '';
  const urlHostToken = query.get('host_token') || '';
  if (urlCode && urlHostToken) localStorage.setItem('ktv_host_' + urlCode.toUpperCase(), urlHostToken);
  const ktvMatch = hash.match(/ktv=([A-Za-z0-9]{6})/);
  isRemoteMode = hash.includes('remote=1') || !!urlCode;
  if (ktvMatch) pendingKTVCode = ktvMatch[1];
  if (urlCode && !pendingKTVCode) pendingKTVCode = urlCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  try { CONFIG = await api('/config'); }
  catch { CONFIG = { app_name: 'O|U KTV', app_tagline: 'Karaoke Together', email_login_enabled: true, default_theme: 'neonpop', buttons: {}, footer: {} }; }
  // Load refresh animation from server config
  refreshAnimation = CONFIG.refresh_animation || 'fall';
  // Load video player engine from server config
  playerEngine = CONFIG.video_player || 'youtube';
  applyBranding(CONFIG);
  renderFooter();
  const savedTheme = localStorage.getItem('ktv_theme') || CONFIG.default_theme || 'neonpop';
  applyTheme(savedTheme);
  if (CONFIG.email_login_enabled && !userToken) {
    // Unregistered device — show the landing/login screen and pop up
    // the registration modal. The landing buttons are guarded so they
    // will show the modal again if the user dismisses it.
    showLogin();
    showRegistrationModal();
    return;
  }
  // Restore last screen: if user was in a KTV room before refresh, rejoin it directly
  // Unless a new code was passed in the URL (e.g., from scanning a QR), then use that instead
  const savedKTVCode = localStorage.getItem('ktv_active_code');
  const savedRemote = localStorage.getItem('ktv_remote_mode') === '1';
  if (urlCode) {
    // URL has a code — use it (new session via QR/share link)
    isRemoteMode = true;
    pendingKTVCode = urlCode;
    enterApp(urlCode);
  } else if (savedKTVCode) {
    isRemoteMode = savedRemote;
    pendingKTVCode = savedKTVCode;
    enterApp(savedKTVCode);
  } else {
    enterApp(ktvMatch ? ktvMatch[1] : null);
  }
}
function applyBranding(cfg) {
  document.title = cfg.app_name;
  const lname = $('#login-app-name');
  if (lname) {
    // Split app name: first word pink, rest navy — matches landing logo style
    const parts = cfg.app_name.split(' ');
    if (parts.length >= 2) {
      lname.innerHTML = `<span class="ll-pink">${escapeHTML(parts[0])}</span> ${escapeHTML(parts.slice(1).join(' '))}`;
    } else {
      lname.innerHTML = `<span class="ll-pink">${escapeHTML(cfg.app_name)}</span>`;
    }
  }
  const ltag = $('#login-app-tagline');
  if (ltag) ltag.textContent = (cfg.app_tagline || '').toUpperCase();
  const hname = $('#home-app-name');
  if (hname) {
    const parts = cfg.app_name.split(' ');
    if (parts.length >= 2) {
      hname.innerHTML = `<span class="ll-pink">${escapeHTML(parts[0])}</span> ${escapeHTML(parts.slice(1).join(' '))}`;
    } else {
      hname.innerHTML = `<span class="ll-pink">${escapeHTML(cfg.app_name)}</span>`;
    }
  }
  const htag = $('#home-app-tagline');
  if (htag) htag.textContent = (cfg.app_tagline || '').toUpperCase();
  if (cfg.email_login_enabled) $('#login-screen').classList.remove('hidden');
}
function showLogin() { hide('home-screen'); hide('ktv-screen'); show('login-screen'); }

// ---------- Registration pop-up modal ----------
function showRegistrationModal() {
  $('#register-error').classList.add('hidden');
  $('#register-email').value = userEmail || '';
  openModal('register-modal');
  setTimeout(() => { const inp = $('#register-email'); if (inp) inp.focus(); }, 300);
}
function hideRegistrationModal() { closeModal('register-modal'); }
function showLockedOverlay() {
  // Lock the landing page — user cancelled registration
  hideRegistrationModal();
  openModal('locked-overlay');
}
function hideLockedOverlay() { closeModal('locked-overlay'); }
function enterApp(prefilledKTV) {
  hide('login-screen');
  if (isRemoteMode && prefilledKTV) {
    // Remote controller (joined via QR) — skip the landing page, go straight to ktv
    joinKTV(prefilledKTV);
  } else if (prefilledKTV) {
    // Restoring a previous KTV session after refresh — go straight to ktv screen
    joinKTV(prefilledKTV);
  } else {
    show('home-screen');
  }
}

// ---------- Registration modal handlers ----------
$('#register-submit-btn').addEventListener('click', async () => {
  const email = ($('#register-email').value || '').trim();
  if (!email || email.indexOf('@') === -1) {
    const el = $('#register-error'); el.textContent = 'Please enter a valid email address.'; el.classList.remove('hidden');
    return;
  }
  try {
    const password = ($('#register-password').value || '');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const r = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    userToken = r.token; userEmail = r.email || (r.user && r.user.email) || email;
    localStorage.setItem('ktv_user_token', userToken);
    localStorage.setItem('ktv_user_email', userEmail);
    hideRegistrationModal();
    $('#register-password').value = '';
    hideLockedOverlay();
    // Transition from login-screen to the main app/landing
    enterApp(pendingKTVCode);
  } catch (err) {
    const el = $('#register-error'); el.textContent = err.message || 'Registration failed.'; el.classList.remove('hidden');
  }
});
$('#register-cancel-btn').addEventListener('click', () => {
  // User cancelled — lock the landing page
  showLockedOverlay();
});
// Enter key in email field triggers register
$('#register-email').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#register-submit-btn').click(); }
});
// "Register Now" button on the locked overlay reopens the registration modal
$('#locked-register-btn').addEventListener('click', () => {
  hideLockedOverlay();
  showRegistrationModal();
});

// ---------- Custom buttons ----------
function renderCustomButtons() {
  const box = $('#custom-buttons'); if (!box) return; box.innerHTML = '';
  if (CONFIG && CONFIG.buttons && CONFIG.buttons.live_music) {
    const b = document.createElement('button');
    b.className = 'btn btn-block mode-toggle-btn mode-karaoke';
    b.innerHTML = iconLabel('music', 'Click & Search LIVE<br>Music Video');
    b.onclick = () => {
      if (searchType === 'live') {
        // Switch to karaoke (green, label shows LIVE)
        searchType = 'karaoke';
        b.classList.remove('mode-live');
        b.classList.add('mode-karaoke');
        b.innerHTML = iconLabel('music', 'Click & Search LIVE<br>Music Video');
        const inp = $('#song-search'); if (inp) inp.placeholder = 'Search for a live music video...';
      } else {
        // Switch to live (orange, label shows KARAOKE)
        searchType = 'live';
        b.classList.remove('mode-karaoke');
        b.classList.add('mode-live');
        b.innerHTML = iconLabel('music', 'Click & Search KARAOKE<br>Music Video');
        const inp = $('#song-search'); if (inp) inp.placeholder = 'Search for a karaoke song...';
      }
      switchTab('search');
      const ss = $('#song-search');
      if (ss) {
        // Do NOT auto-focus — keyboard should only open when user taps the search bar
        if (ss.value.trim()) doSearch();
      }
    };
    box.appendChild(b);
  }
}

// ---------- Tabs ----------
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + name));
}
$$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
function applyHomeTabVisibility() {
  if (!CONFIG || !CONFIG.buttons) return;
  const searchTab = document.querySelector('#home-screen .tab[data-tab="search"]');
  const popularTab = document.querySelector('#home-screen .tab[data-tab="popular"]');
  if (searchTab) searchTab.classList.toggle('hidden', !CONFIG.buttons.search);
  if (popularTab) popularTab.classList.toggle('hidden', !CONFIG.buttons.popular);
}

// ---------- Search ----------
// searchType tracks the current search mode: 'karaoke' (default) or 'live'
// The "Search Live Music Video" button toggles live mode on/off.
// When live mode is ON, the Search button and Enter search for live music videos.
// When live mode is OFF, they search for karaoke tracks.
let searchType = 'karaoke';

async function doSearch() {
  const input = $('#song-search');
  const resultsEl = $('#search-results');
  if (!input || !resultsEl) return;
  const q = input.value.trim();
  if (!q) return;
  const type = searchType;
  resultsEl.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Searching YouTube for "' + q.replace(/</g,'&lt;') + '"...</p></div>';
  try {
    const results = await api(`/search?q=${encodeURIComponent(q)}&type=${type}`);
    if (!results.length) { resultsEl.innerHTML = '<p style="color:var(--muted);padding:16px;text-align:center">No results found. Try another search term.</p>'; return; }
    resultsEl.innerHTML = '';
    results.forEach(v => {
      const li = document.createElement('li');
      li.innerHTML = `<img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22><rect fill=%22%23333%22 width=%22120%22 height=%2268%22/><text x=%2260%22 y=%2238%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2212%22>♪</text></svg>'"><span class="r-title">${escapeHTML(v.title)}</span><button class="r-add">${ICON.plus} Add</button>`;
      li.querySelector('.r-add').onclick = () => addSongToKTV(v);
      resultsEl.appendChild(li);
    });
  } catch (e) {
    resultsEl.innerHTML = '<p style="color:var(--muted);padding:16px;text-align:center">Search failed: ' + (e.message || 'unknown error') + '. Try again.</p>';
  }
}
const _ssBtn = $('#song-search-btn'); if (_ssBtn) _ssBtn.addEventListener('click', () => { doSearch(); });
const _ssInput = $('#song-search'); if (_ssInput) _ssInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// ---------- Popular songs ----------
const POPULAR_QUERIES = [
  'Bohemian Rhapsody Queen karaoke', "Don't Stop Believin' Journey karaoke", 'Sweet Caroline Neil Diamond karaoke',
  'I Will Always Love You Whitney Houston karaoke', 'My Way Frank Sinatra karaoke', 'Wonderwall Oasis karaoke',
  'Mr Brightside The Killers karaoke', 'Hello Adele karaoke', 'Dancing Queen ABBA karaoke', 'Shape of You Ed Sheeran karaoke',
];
let popularLoaded = false;
async function loadPopular() {
  const ul = $('#popular-list');
  if (!ul || popularLoaded) return;
  ul.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Loading popular songs...</p></div>';
  try {
    const results = await api('/popular');
    if (!results.length) throw new Error('empty');
    ul.innerHTML = '';
    results.forEach((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.style.display='none'"><span class="pop-title">${escapeHTML(v.title)}</span>`;
      li.onclick = () => { searchType = 'karaoke'; const lb = document.querySelector('#custom-buttons .mode-toggle-btn'); if (lb) { lb.classList.remove('mode-live'); lb.classList.add('mode-karaoke'); lb.innerHTML = iconLabel('music', 'Click & Search LIVE<br>Music Video'); } const inp = $('#song-search'); if (inp) inp.placeholder = 'Search for a live music video...'; $('#song-search').value = v.title.replace(/\s*\(.*?\)\s*/g, '').replace(/karaoke.*/i, '').trim(); switchTab('search'); doSearch(); };
      ul.appendChild(li);
    });
    popularLoaded = true;
  } catch (e) {
    ul.innerHTML = '';
    POPULAR_QUERIES.forEach((q, i) => {
      const li = document.createElement('li');
      const title = q.replace(' karaoke', '');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><span class="pop-title">${title}</span>`;
      li.onclick = () => { searchType = 'karaoke'; const lb = document.querySelector('#custom-buttons .mode-toggle-btn'); if (lb) { lb.classList.remove('mode-live'); lb.classList.add('mode-karaoke'); lb.innerHTML = iconLabel('music', 'Click & Search LIVE<br>Music Video'); } const inp = $('#song-search'); if (inp) inp.placeholder = 'Search for a live music video...'; $('#song-search').value = title; switchTab('search'); doSearch(); };
      ul.appendChild(li);
    });
  }
}

// ---------- KTV ----------
// ---------- Landing page buttons ----------
$('#landing-create-btn').addEventListener('click', async () => {
  if (CONFIG.email_login_enabled && !userToken) {
    showRegistrationModal(); return;
  }
  try {
    const r = await api('/ktvs', { method: 'POST', body: JSON.stringify({}) });
    isHost = true; rememberHostRoom(r); enterApp(); joinKTV(r.code);
  } catch (err) { alert('Failed to create ktv: ' + err.message); }
});
$('#login-join-btn').addEventListener('click', () => {
  const code = ($('#login-join-code').value || '').trim().toUpperCase();
  if (!code) return;
  if (CONFIG.email_login_enabled && !userToken) { showRegistrationModal(); return; }
  enterApp(); joinKTV(code);
});
$('#login-join-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#login-join-btn').click(); }
});
// ---------- QR Scanner ----------
let _qrStream = null;
let _qrScanTimer = null;

function startQRScanner() {
  const video = $('#qr-video');
  const canvas = $('#qr-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const statusEl = $('#qr-status');
  let qrDetector = null;
  let scanBusy = false;

  if (typeof jsQR === 'undefined' && 'BarcodeDetector' in window) {
    try { qrDetector = new BarcodeDetector({ formats: ['qr_code'] }); } catch {}
  }

  if (typeof jsQR === 'undefined' && !qrDetector) {
    alert('QR scanning is unavailable in this browser. Please use a browser with QR BarcodeDetector support or install the QR scanner library.');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera not supported on this device/browser.');
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      _qrStream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      video.play();
      openModal('qr-scanner-modal');
      statusEl.textContent = 'Point camera at a ktv code QR';

      _qrScanTimer = setInterval(async () => {
        if (scanBusy || video.readyState !== video.HAVE_ENOUGH_DATA) return;
        scanBusy = true;
        try {
          let detected = null;
          if (qrDetector) {
            const codes = await qrDetector.detect(video);
            if (codes && codes.length) detected = codes[0].rawValue;
          } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
            if (result) detected = result.data;
          }
          if (detected) { stopQRScanner(); handleQRResult(detected); }
        } catch (err) { statusEl.textContent = 'Scanning…'; }
        finally { scanBusy = false; }
      }, 350);
    })
    .catch(err => {
      console.error('QR camera error:', err);
      const msg = (err.name === 'NotAllowedError') ? 'Camera permission denied. Please allow camera access.' : 'Cannot access camera: ' + err.message;
      alert(msg);
    });
}

function stopQRScanner() {
  if (_qrScanTimer) { clearInterval(_qrScanTimer); _qrScanTimer = null; }
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  const video = $('#qr-video');
  if (video) video.srcObject = null;
  closeModal('qr-scanner-modal');
}

function handleQRResult(data) {
  // Extract ktv code from QR data — accept URL with /#ktv=CODE, /ktv/r/CODE, or plain code
  let code = data.trim();
  let scannedRemote = false;
  // If it's a URL, extract the code from hash or path
  if (code.startsWith('http://') || code.startsWith('https://')) {
    try {
      const url = new URL(code);
      const queryCode = url.searchParams.get('code');
      const queryHostToken = url.searchParams.get('host_token');
      if (queryCode) {
        code = queryCode;
        if (queryHostToken) localStorage.setItem('ktv_host_' + queryCode.toUpperCase(), queryHostToken);
        scannedRemote = true;
      // Check for #ktv=CODE&remote=1 hash format
      } else if (url.hash && url.hash.includes('ktv=')) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        code = hashParams.get('ktv') || '';
        scannedRemote = hashParams.get('remote') === '1';
      } else {
        const segments = url.pathname.split('/').filter(Boolean);
        code = segments[segments.length - 1] || '';
      }
    } catch (e) { /* not a valid URL, use raw */ }
  }
  // Uppercase and strip non-alphanumeric (ktv codes are alphanumeric)
  code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!code) {
    alert('No valid ktv code found in QR.');
    return;
  }

  // If the QR indicates remote mode, set it so joinKTV shows the remote view
  if (scannedRemote) isRemoteMode = true;

  // Join the ktv directly (skip landing page in remote mode)
  if (isRemoteMode) {
    enterApp(code);
  } else {
    enterApp();
    const joinInput = $('#join-code');
    joinInput.value = code;
    setTimeout(() => $('#join-ktv-btn').click(), 300);
  }
}

$('#login-qr-btn').addEventListener('click', () => {
  if (CONFIG.email_login_enabled && !userToken) { showRegistrationModal(); return; }
  startQRScanner();
});
$('#home-qr-btn').addEventListener('click', startQRScanner);
$('#qr-close-btn').addEventListener('click', stopQRScanner);
$('#qr-cancel-btn').addEventListener('click', stopQRScanner);
$('#landing-settings-btn').addEventListener('click', () => { buildThemeGrid(); openModal('settings-modal'); });

// ---------- Global Refresh All State ----------
// refreshAllState() refreshes every piece of app state in-place, no page reload:
//   1. CONFIG  — re-fetch branding/buttons/footer from server
//   2. Theme   — re-apply persisted theme
//   3. KTV     — re-request room state via WebSocket (queue, nowPlaying, activity, guestCount)
//   4. Player  — re-sync YouTube player to current nowPlaying
//   5. Popular — reload popular song lists (home / KTV / remote)
//   6. Search  — re-run last search query on the active screen
//   7. WS      — reconnect WebSocket if disconnected
async function refreshAllState() {
  // Determine which screen is currently visible
  const onLogin = !$('#login-screen').classList.contains('hidden');
  const onHome  = !$('#home-screen').classList.contains('hidden');
  const onKTV   = !$('#ktv-screen').classList.contains('hidden');

  // 1. Re-fetch CONFIG from server (branding, buttons, footer, theme default)
  try {
    CONFIG = await api('/config');
    applyBranding(CONFIG);
    renderFooter();
    // Re-read refresh animation in case admin changed it
    refreshAnimation = CONFIG.refresh_animation || 'fall';
  } catch (e) { /* keep existing CONFIG on failure */ }

  // 2. Re-apply theme from localStorage
  const savedTheme = localStorage.getItem('ktv_theme') || (CONFIG && CONFIG.default_theme) || 'neonpop';
  applyTheme(savedTheme);

  // 3 & 7. KTV state + WebSocket — request fresh room state
  if (onKTV && currentKTV) {
    // Reconnect WS if disconnected
    if (!ws || ws.readyState !== 1) {
      connectWS(currentKTV.code);
    } else {
      // WS is alive — request fresh state by re-joining
      ws.send(JSON.stringify({ type: 'join', code: currentKTV.code, is_remote: isRemoteMode, requester: displayName || userEmail || 'guest', token: userToken, host_token: localStorage.getItem('ktv_host_' + currentKTV.code) || '' }));
    }
  }

  // 5. Reload popular song lists on whichever screen is visible
  if (onHome) {
    popularLoaded = false;
    loadPopular();
  }
  if (onKTV && !isRemoteMode) {
    ktvPopularLoaded = false;
    loadKTVPopular();
  }
  if (onKTV && isRemoteMode) {
    remotePopularLoaded = false;
    loadRemotePopular();
  }

  // 6. Re-run last search on the active screen
  if (onHome) {
    const inp = $('#song-search');
    if (inp && inp.value.trim()) doSearch();
  }
  if (onKTV && !isRemoteMode) {
    const inp = $('#ktv-song-search');
    if (inp && inp.value.trim()) doKTVSearch();
  }
  if (onKTV && isRemoteMode) {
    const inp = $('#remote-song-search');
    if (inp && inp.value.trim()) doRemoteSearch();
  }
}

// Helper: spin the SVG icon inside a refresh button for visual feedback
function spinRefreshIcon(btn) {
  const svg = btn && btn.querySelector('svg');
  if (svg) svg.style.animation = 'spin 0.6s ease';
  setTimeout(() => { if (svg) svg.style.animation = ''; }, 600);
}

// ── clearAppCache() ──
// Clears all device-side caches for THIS app only — does NOT touch login
// session tokens, so the user stays logged in after the refresh.
//
// What gets cleared:
//   1. localStorage — all ktv_* keys EXCEPT login tokens (user_token, user_email)
//   2. sessionStorage — app keys EXCEPT admin_token (keeps admin session alive)
//   3. Service Worker cache (ou-ktv-*) — deletes cached app shell / static assets
//   4. In-memory JS state — resets CONFIG, currentKTV, loaded flags, etc.
//   5. YouTube player — destroys iframe player instances
//   6. WebSocket — closes existing connection (will reconnect fresh)
// What is preserved:
//   - ktv_user_token, ktv_user_email  → user stays logged in
//   - ktv_admin_token (sessionStorage) → admin stays authenticated
//   - Other websites' caches — we only touch our own origin's cache buckets
async function clearAppCache() {
  // ── 1. localStorage: clear app keys but keep login session + active KTV room ──
  // We keep ktv_active_code and ktv_remote_mode so the user stays in the same
  // KTV room and the same display (host vs remote) after the refresh.
  // We keep ktv_display_name so the user's display name survives.
  const KEEP_LS = ['ktv_user_token', 'ktv_user_email', 'ktv_active_code', 'ktv_remote_mode', 'ktv_display_name'];
  const lsKeys = Object.keys(localStorage).filter(k =>
    k.startsWith('ktv_') && !KEEP_LS.includes(k)
  );
  lsKeys.forEach(k => localStorage.removeItem(k));

  // ── 2. sessionStorage: clear app keys but keep admin token ──
  const KEEP_SS = ['ktv_admin_token'];
  const ssKeys = Object.keys(sessionStorage).filter(k =>
    k.startsWith('ktv_') && !KEEP_SS.includes(k)
  );
  ssKeys.forEach(k => sessionStorage.removeItem(k));

  // ── 3. Service Worker cache: delete all ou-ktv-* cache buckets ──
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith('ou-ktv')).map(k => caches.delete(k))
      );
    } catch (e) { /* cache API may be unavailable in some contexts */ }
  }

  // ── 4. In-memory JS state: reset cached variables BUT preserve currentKTV ──
  // currentKTV holds the active room (code, queue, nowPlaying). We save it
  // so the reserved song queue survives the refresh. refreshAllState() will
  // re-fetch fresh state from the server via WebSocket to update it.
  const savedKTV = currentKTV;
  CONFIG = null;
  currentKTV = null;
  currentVideoId = null;
  remoteCurrentVideoId = null;
  popularLoaded = false;
  ktvPopularLoaded = false;
  remotePopularLoaded = false;
  pendingKTVCode = null;
  wsReconnectTries = 0;

  // ── 5. YouTube player: destroy iframe instances ──
  if (ytPlayer && typeof ytPlayer.destroy === 'function') {
    try { ytPlayer.destroy(); } catch (e) {}
    ytPlayer = null;
    ytReady = false;
  }
  if (remoteYtPlayer && typeof remoteYtPlayer.destroy === 'function') {
    try { remoteYtPlayer.destroy(); } catch (e) {}
    remoteYtPlayer = null;
  }
  destroyVjsPlayers();

  // ── 6. WebSocket: close existing connection ──
  if (ws) {
    try {
      ws.onclose = null; // prevent auto-reconnect during cleanup
      ws.close();
    } catch (e) {}
    ws = null;
  }

  // Restore the KTV room reference so the queue and room code survive.
  // refreshAllState() will re-fetch fresh state from the server via WS,
  // updating the queue with the latest server-side copy.
  currentKTV = savedKTV;
}

// Helper: play the refresh animation on the active screen.
// Uses the animation type from refreshAnimation (loaded from server config).
// Returns a Promise that resolves when the animation finishes.
function playRefreshAnimation() {
  // Find the visible screen
  const screens = ['#login-screen', '#home-screen', '#ktv-screen'];
  let activeScreen = null;
  for (const sel of screens) {
    const el = $(sel);
    if (el && !el.classList.contains('hidden')) { activeScreen = el; break; }
  }
  if (!activeScreen) return Promise.resolve();

  // Set the animation type via data attribute (CSS uses this to pick keyframes)
  activeScreen.setAttribute('data-refresh-anim', refreshAnimation);
  // Remove any previous animation class, force reflow, then re-add
  activeScreen.classList.remove('refreshing');
  void activeScreen.offsetWidth; // force DOM reflow so animation restarts
  activeScreen.classList.add('refreshing');

  return new Promise((resolve) => {
    const cleanup = () => {
      activeScreen.classList.remove('refreshing');
      activeScreen.removeEventListener('animationend', cleanup);
      resolve();
    };
    activeScreen.addEventListener('animationend', cleanup);
    // Safety timeout in case animationend doesn't fire (animation durations vary 0.8–1.1s)
    setTimeout(() => { activeScreen.classList.remove('refreshing'); resolve(); }, 1500);
  });
}

// Unified refresh: spin icon + animation + clear app cache + refresh all state
// After refresh, the user stays on the SAME display they were on, and the
// reserved song queue is preserved (re-fetched from server via WebSocket).
async function triggerRefresh(btn) {
  spinRefreshIcon(btn);

  // ── Save which display is currently visible BEFORE refresh ──
  const onLogin = !$('#login-screen').classList.contains('hidden');
  const onHome  = !$('#home-screen').classList.contains('hidden');
  const onKTV   = !$('#ktv-screen').classList.contains('hidden');
  // Save the KTV room code and remote mode so we can restore them
  const savedKTVCode = currentKTV ? currentKTV.code : null;

  // Start the animation
  const animPromise = playRefreshAnimation();
  // Wait for the "fall down + empty" phase (about 550ms) before clearing cache
  // and refreshing state — so new content arrives right as the screen snaps back
  await new Promise(r => setTimeout(r, 550));

  // ── Clear caches (preserves login, KTV code, and currentKTV in-memory) ──
  await clearAppCache();

  // ── Ensure we're back on the same display that was visible before refresh ──
  if (onKTV && currentKTV) {
    // Re-show the KTV screen (in case any screen toggling happened)
    hide('login-screen'); hide('home-screen'); show('ktv-screen');
    // Re-connect WebSocket to get fresh room state (queue, nowPlaying, etc.)
    if (!ws || ws.readyState !== 1) {
      connectWS(currentKTV.code);
    } else {
      ws.send(JSON.stringify({ type: 'join', code: currentKTV.code, is_remote: isRemoteMode, requester: displayName || userEmail || 'guest', token: userToken, host_token: localStorage.getItem('ktv_host_' + currentKTV.code) || '' }));
    }
    // Re-render the KTV with the existing queue (preserved by clearAppCache)
    renderKTV(currentKTV);
  } else if (onHome) {
    hide('login-screen'); hide('ktv-screen'); show('home-screen');
  }

  // ── Re-fetch all state from server (CONFIG, popular songs, search, etc.) ──
  await refreshAllState();
  await animPromise;
}

// ---------- Refresh button handlers (all displays) ----------
// Landing (login) refresh: animation + clear cache + full reload
// On the login screen there's no KTV room or queue to preserve, so a full
// page reload is fine here — it will re-show the login screen after reload.
$('#landing-refresh-btn').addEventListener('click', () => {
  spinRefreshIcon($('#landing-refresh-btn'));
  playRefreshAnimation().then(async () => {
    await clearAppCache();
    location.reload();
  });
});
// Home refresh: falling animation + refresh all state in-place
$('#home-refresh-btn').addEventListener('click', () => {
  triggerRefresh($('#home-refresh-btn'));
});
// Footer links removed from landing — no longer wired

// ---------- Create / Join ktv (home screen) ----------
$('#create-ktv-btn').addEventListener('click', async () => {
  try {
    const r = await api('/ktvs', { method: 'POST', body: JSON.stringify({}) });
    isHost = true; rememberHostRoom(r); joinKTV(r.code);
  } catch (err) { alert('Failed to create ktv: ' + err.message); }
});
$('#join-ktv-btn').addEventListener('click', () => {
  const code = $('#join-code').value.trim().toUpperCase();
  if (code) joinKTV(code);
});
async function joinKTV(code) {
  // Check if the room exists on the server before joining.
  // If it doesn't exist, show a "Room Code Not Exist" pop-up.
  try {
    const res = await api(`/ktv/check/${encodeURIComponent(code)}`);
    if (res && res.exists === false) {
      openModal('room-not-found-modal');
      return;
    }
  } catch (e) {
    // If the check API fails (network error etc.), proceed with join
    // rather than blocking the user — the WS will handle it.
  }
  hide('home-screen'); show('ktv-screen');
  $('#ktv-code-display').textContent = code;
  isHost = !!localStorage.getItem('ktv_host_' + code);
  if (!currentKTV) currentKTV = { code, queue: [], guestCount: 1 };
  if (isRemoteMode) { show('remote-mode'); hide('host-mode'); }
  else { hide('remote-mode'); show('host-mode'); }
  // Persist current screen so a page refresh / pull-to-refresh restores it
  localStorage.setItem('ktv_active_code', code);
  localStorage.setItem('ktv_remote_mode', isRemoteMode ? '1' : '0');
  connectWS(code);
}
// "Try Again" button in the Room Not Found modal — closes the pop-up
// and focuses the join code input so the user can retype the code.
$('#room-not-found-retry-btn').addEventListener('click', () => {
  closeModal('room-not-found-modal');
  const joinInput = $('#join-code');
  if (joinInput) { joinInput.focus(); joinInput.select(); }
});
function addSongToKTV(v) {
  if (!currentKTV) { alert('Create or join a ktv first.'); return; }
  if (ws && ws.readyState === 1) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(v.youtube_id || '')) { alert('This result is not a supported YouTube playback item yet.'); return; }
    ws.send(JSON.stringify({ type: 'add_song', code: currentKTV.code, youtube_id: v.youtube_id, title: v.title, requester: displayName || userEmail || 'guest' }));
  } else {
    if (!currentKTV.queue) currentKTV.queue = [];
    currentKTV.queue.push({ youtube_id: v.id, title: v.title, requester: displayName || userEmail || 'guest', status: 'queued' });
    currentKTV.guestCount = currentKTV.guestCount || 1;
    renderKTV(currentKTV);
  }
}
// Handle song_rejected message from server (when song limit is active)
function handleSongRejected(msg) {
  const reason = msg.reason || 'limit';
  if (reason === 'limit') {
    const max = msg.max || 3;
    // Show the limit pop-up
    const m = $('#song-limit-modal');
    if (m) {
      $('#song-limit-max').textContent = max;
      openModal('song-limit-modal');
    } else {
      alert(`Song limit reached: you have ${max} songs queued. Wait for one to play before adding more.`);
    }
  }
}

// ---------- Cheer vibration ----------
// When a cheer message is received (from host or another remote),
// trigger 3 long vibrations on this device. Only remote devices
// receive cheer messages from the server.
function handleCheer() {
  if ('vibrate' in navigator) {
    // 3 long vibrations: 500ms each, 300ms pause between
    navigator.vibrate([500, 300, 500, 300, 500]);
  }
  // Also show a brief visual cheer flash on remote
  if (isRemoteMode) {
    const npBar = $('#remote-now-playing-bar');
    if (npBar && !npBar.classList.contains('hidden')) {
      npBar.style.transition = 'box-shadow 0.3s, transform 0.3s';
      npBar.style.boxShadow = '0 0 0 2px var(--accent), var(--shadow-md)';
      npBar.style.transform = 'scale(1.02)';
      setTimeout(() => { npBar.style.boxShadow = ''; npBar.style.transform = ''; }, 600);
    }
    const banner = $('.remote-host-banner');
    if (banner) {
      banner.style.transition = 'background 0.3s';
      banner.style.background = 'var(--accent)';
      setTimeout(() => { banner.style.background = ''; }, 600);
    }
  }
}

// ---------- Search helpers ----------
function showMovingPh(id) { const ph = $(id); if (ph) ph.classList.remove('hidden'); }
function clearRemoteSearch() {
  const rs = $('#remote-song-search'); if (rs) rs.value = '';
  const rr = $('#remote-search-results'); if (rr) rr.innerHTML = '';
  showMovingPh('#remote-moving-ph');
  const panel = $('#remote-search-panel');
  if (panel) panel.classList.remove('search-active');
}
let _remoteSearchClearTimer = null;
function scheduleRemoteSearchAutoClose() {
  if (_remoteSearchClearTimer) clearTimeout(_remoteSearchClearTimer);
  _remoteSearchClearTimer = setTimeout(() => { _remoteSearchClearTimer = null; const q = $('#remote-song-search'); if (q && !q.value.trim()) clearRemoteSearch(); }, 3000);
}

// ---------- KTV interactions ----------
$('#cheer-btn').addEventListener('click', () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'like', code: currentKTV.code })); });
const _remoteCheerBtn = $('#remote-cheer-btn');
if (_remoteCheerBtn) _remoteCheerBtn.addEventListener('click', () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'like', code: currentKTV.code })); });
$('#leave-ktv-btn').addEventListener('click', leaveKTV);
$('#leave-from-info').addEventListener('click', leaveKTV);
$('#sidebar-leave-btn').addEventListener('click', leaveKTV);
// ---------- Fullscreen + Picture-in-Picture (Floating) ----------
function toggleFullscreen(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  if (!document.fullscreenElement) {
    (wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.requestFullscreen)?.call(wrap);
  } else {
    document.exitFullscreen?.();
  }
}

// PiP for YouTube IFrame player — request PiP on the iframe element
async function toggleYtPip(iframeId) {
  const iframe = document.getElementById(iframeId)?.querySelector('iframe') || document.getElementById(iframeId);
  if (!iframe) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (iframe.requestPictureInPicture) {
      await iframe.requestPictureInPicture();
    }
  } catch (e) {
    console.warn('PiP not available for IFrame:', e.message);
    // Fallback: try to use the YouTube IFrame API to show a message
    alert('Floating (Picture-in-Picture) is not available for this player. Try the Video.js player in Admin settings for PiP support.');
  }
}

// PiP for Video.js player
async function toggleVjsPip(player) {
  if (!player) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      const tech = player.tech({ IWillUseThisInTests: true });
      const el = tech?.el?.() || player.el_.querySelector('video');
      if (el && el.requestPictureInPicture) await el.requestPictureInPicture();
    }
  } catch (e) { console.warn('VJS PiP error:', e.message); }
}

// Unified PiP toggle — routes to the correct player based on engine
function togglePip(isRemote) {
  if (playerEngine === 'videojs') {
    toggleVjsPip(isRemote ? remoteVjsPlayer : vjsPlayer);
  } else {
    toggleYtPip(isRemote ? 'remote-yt-player' : 'yt-player');
  }
}

$('#fullscreen-btn').addEventListener('click', () => toggleFullscreen('player-wrap'));
$('#pip-btn').addEventListener('click', () => togglePip(false));

// Remote player controls
const remoteFsBtn = $('#remote-fullscreen-btn');
const remotePipBtn = $('#remote-pip-btn');
if (remoteFsBtn) remoteFsBtn.addEventListener('click', () => toggleFullscreen('remote-player-wrap'));
if (remotePipBtn) remotePipBtn.addEventListener('click', () => togglePip(true));

function leaveKTV() {
  if (ws) { try { ws.send(JSON.stringify({ type: 'leave', code: currentKTV.code })); ws.close(); } catch {} }
  ws = null; currentKTV = null; wsReconnectTries = 0;
  // Clear persisted screen so refresh returns to home, not the left KTV
  localStorage.removeItem('ktv_active_code');
  localStorage.removeItem('ktv_remote_mode');
  if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }
  if (remoteYtPlayer) { try { remoteYtPlayer.destroy(); } catch {} remoteYtPlayer = null; }
  destroyVjsPlayers();
  remoteCurrentVideoId = null; currentVideoId = null; isHost = false;
  const rs = $('#ktv-search-results'); if (rs) rs.innerHTML = '';
  const rsi = $('#ktv-song-search'); if (rsi) rsi.value = '';
  const rp = $('#ktv-popular-list'); if (rp) rp.innerHTML = '';
  const rs2 = $('#remote-search-results'); if (rs2) rs2.innerHTML = '';
  const rsi2 = $('#remote-song-search'); if (rsi2) rsi2.value = '';
  showMovingPh('#ktv-moving-ph'); showMovingPh('#remote-moving-ph');
  if (_remoteSearchClearTimer) { clearTimeout(_remoteSearchClearTimer); _remoteSearchClearTimer = null; }
  hide('ktv-screen'); show('home-screen'); closeModal('ktv-info-modal');
}
$('#ktv-info-btn').addEventListener('click', async () => {
  if (!currentKTV) return;
  $('#info-ktv-code').textContent = currentKTV.code;
  openModal('ktv-info-modal');
  const qrContainer = $('#qr-code-container');
  qrContainer.innerHTML = '<div class="qr-loading">Loading QR...</div>';
  $('#qr-join-url').textContent = '';
  try {
    const hostToken = localStorage.getItem('ktv_host_' + currentKTV.code) || '';
    const data = await api(`/qr/${currentKTV.code}`, { method: 'POST', body: JSON.stringify({ remote_token: hostToken }) });
    qrContainer.innerHTML = `<img src="${escapeHTML(safeQRImageURL(data.qr))}" alt="QR Code to join ktv">`;
    $('#qr-join-url').textContent = data.url;
  } catch (e) { qrContainer.innerHTML = '<div class="qr-loading">QR failed to load</div>'; }
});
$('#copy-join-link').addEventListener('click', async () => {
  const url = $('#qr-join-url').textContent;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    $('#copy-join-link').innerHTML = iconLabel('check', 'Copied!');
    setTimeout(() => { $('#copy-join-link').innerHTML = iconLabel('copy', 'Copy Join Link'); }, 2000);
  } catch {}
});
$('#skip-btn').addEventListener('click', () => { if (ws && ws.readyState === 1 && currentKTV) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); });

// ---------- Remote control buttons ----------
$('#remote-stop-btn').addEventListener('click', () => { if (ws && ws.readyState === 1 && currentKTV) ws.send(JSON.stringify({ type: 'stop', code: currentKTV.code })); });
$('#remote-play-btn').addEventListener('click', () => { if (ws && ws.readyState === 1 && currentKTV) { const action = currentKTV.isPaused ? 'play' : 'pause'; ws.send(JSON.stringify({ type: action, code: currentKTV.code })); } });
$('#remote-next-btn').addEventListener('click', () => { if (ws && ws.readyState === 1 && currentKTV) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); });

// ---------- Remote Now Playing bar buttons ----------
const _remoteSkipBtn = $('#remote-skip-btn');
if (_remoteSkipBtn) _remoteSkipBtn.addEventListener('click', () => { if (ws && ws.readyState === 1 && currentKTV) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); });

// ---------- Remote search ----------
// remoteSearchType tracks current search mode for the remote (phone) screen.
// Mirrors the host's ktvSearchType: 'karaoke' (default, green) or 'live' (orange).
//   - Karaoke mode: green/teal button, label "Click & Search LIVE Music Video"
//   - Live mode: orange button, label "Click & Search KARAOKE Music Video"
let remoteSearchType = 'karaoke';

function updateRemoteToggleUI() {
  const btn = $('#remote-live-search-btn');
  const input = $('#remote-song-search');
  const labelEl = btn ? btn.querySelector('.ktv-search-header-text') : null;
  const movingPh = $('#remote-moving-ph span');
  if (remoteSearchType === 'live') {
    // Live mode = orange → button label says KARAOKE
    if (btn) { btn.classList.remove('mode-karaoke'); btn.classList.add('mode-live'); }
    if (labelEl) labelEl.innerHTML = 'Click & Search KARAOKE<br>Music Video';
    if (input) input.placeholder = 'Search LIVE music video';
    if (movingPh) movingPh.textContent = 'Search LIVE music video ';
  } else {
    // Karaoke mode = green/teal → button label says LIVE
    if (btn) { btn.classList.remove('mode-live'); btn.classList.add('mode-karaoke'); }
    if (labelEl) labelEl.innerHTML = 'Click & Search LIVE<br>Music Video';
    if (input) input.placeholder = 'Search KARAOKE music video';
    if (movingPh) movingPh.textContent = 'Search KARAOKE music video ';
  }
}

// Initialize the remote search button to show the correct mode on page load
updateRemoteToggleUI();

async function doRemoteSearch() {
  const q = $('#remote-song-search').value.trim();
  if (!q) return;
  const type = remoteSearchType;
  const resultsEl = $('#remote-search-results');
  const panel = $('#remote-search-panel');
  // Show overlay immediately with spinner
  if (panel) panel.classList.add('search-active');
  resultsEl.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Searching...</p></div>';
  try {
    const results = await api(`/search?q=${encodeURIComponent(q)}&type=${type}`);
    if (!results.length) { resultsEl.innerHTML = '<p style="color:var(--muted);padding:12px">No results found.</p>'; return; }
    resultsEl.innerHTML = '';
    results.forEach(v => {
      const li = document.createElement('li');
      li.innerHTML = `<img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22><rect fill=%22%23333%22 width=%22120%22 height=%2268%22/><text x=%2260%22 y=%2238%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2212%22>♪</text></svg>'"><span class="r-title">${escapeHTML(v.title)}</span><button class="r-add">${ICON.plus} Add</button>`;
      li.querySelector('.r-add').onclick = () => { addSongToKTV(v); const btn = li.querySelector('.r-add'); btn.innerHTML = `${ICON.check} Added`; btn.style.background = 'var(--accent)'; setTimeout(() => { li.remove(); }, 1000); setTimeout(clearRemoteSearch, 1000); };
      resultsEl.appendChild(li);
    });
  } catch (e) { resultsEl.innerHTML = '<p style="color:var(--muted);padding:12px">Search failed: ' + (e.message || 'error') + '</p>'; }
}
$('#remote-search-btn').addEventListener('click', doRemoteSearch);
$('#remote-song-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doRemoteSearch(); });
$('#remote-song-search').addEventListener('blur', () => { setTimeout(scheduleRemoteSearchAutoClose, 200); });
$('#remote-song-search').addEventListener('input', () => { if (_remoteSearchClearTimer) { clearTimeout(_remoteSearchClearTimer); _remoteSearchClearTimer = null; } if (!$('#remote-song-search').value.trim()) scheduleRemoteSearchAutoClose(); });
// Show/hide moving placeholder for remote search bar
(function() {
  const inp = $('#remote-song-search');
  const ph = $('#remote-moving-ph');
  if (!inp || !ph) return;
  inp.addEventListener('focus', () => ph.classList.add('hidden'));
  inp.addEventListener('blur', () => { if (!inp.value.trim()) ph.classList.remove('hidden'); });
  inp.addEventListener('input', () => { if (inp.value.trim()) ph.classList.add('hidden'); else ph.classList.remove('hidden'); });
})();

// Tap the queue area below the search panel to dismiss the results overlay
(function() {
  const queue = $('.remote-queue');
  if (!queue) return;
  queue.addEventListener('click', () => {
    const panel = $('#remote-search-panel');
    if (panel && (panel.classList.contains('search-active') || panel.classList.contains('popular-active'))) {
      panel.classList.remove('search-active', 'popular-active');
    }
  });
})();

// ---------- Remote mode toggle button (header) ----------
// Clicking the button toggles between karaoke and live search modes on the remote screen.
// Mirrors the host's ktv-live-search-btn toggle behavior.
$('#remote-live-search-btn').addEventListener('click', () => {
  if (remoteSearchType === 'live') {
    // Switch from live to karaoke
    remoteSearchType = 'karaoke';
    updateRemoteToggleUI();
  } else {
    // Switch from karaoke to live (orange)
    remoteSearchType = 'live';
    updateRemoteToggleUI();
    // Do NOT auto-focus the input — keyboard should only open when user taps the search bar
    // If there's already text in the box, search immediately
    const ss = $('#remote-song-search');
    if (ss && ss.value.trim()) doRemoteSearch();
  }
});

// ---------- KTV tabs ----------
$$('.rtab').forEach(t => t.addEventListener('click', () => {
  $$('.rtab').forEach(x => x.classList.toggle('active', x === t));
  $$('.rtab-content').forEach(c => c.classList.toggle('active', c.id === 'rtab-' + t.dataset.rtab));
}));

// ---------- Render ktv ----------
function renderKTV(r) {
  // r may be the full message {type, ktv} or the flat room object directly
  const room = r.ktv || r;
  currentKTV = room;
  $('#guest-count').textContent = room.guestCount || 0;
  if (isRemoteMode) renderRemoteMode(room); else renderHostMode(room);
  if (!isRemoteMode) { if (playerEngine === 'videojs') maybeStartVjsPlayer(); else maybeStartPlayer(); }
}

function renderHostMode(r) {
  const q = $('#queue-list'); q.innerHTML = '';
  const upNext = r.queue.filter(x => x.status === 'queued');
  const qEmpty = $('#queue-empty');
  if (qEmpty) qEmpty.style.display = upNext.length ? 'none' : 'block';
  upNext.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    const mine = (item.requester || '').toLowerCase() === (displayName || userEmail || '').toLowerCase();
    li.innerHTML = `<span class="qi-num">${i + 1}</span><img class="qi-thumb" src="https://i.ytimg.com/vi/${escapeHTML(item.youtube_id)}/default.jpg" alt=""><div class="qi-info"><div class="qi-title">${escapeHTML(item.title)}</div><div class="qi-req"><span class="ic">${ICON.mic}</span> ${escapeHTML(item.requester || 'guest')}</div></div>${mine ? '<span class="badge yours">You</span>' : ''}`;
    q.appendChild(li);
  });
  const nsList = $('#now-singing-list'); const nsSection = $('#now-singing-section');
  if (nsList) nsList.innerHTML = '';
  if (r.nowPlaying) {
    const npLi = document.createElement('li');
    npLi.className = 'queue-item now-singing';
    npLi.innerHTML = `<span class="qi-num singing-icon">${ICON.music}</span><img class="qi-thumb" src="https://i.ytimg.com/vi/${escapeHTML(r.nowPlaying.youtube_id)}/default.jpg" alt=""><div class="qi-info"><div class="qi-title">${escapeHTML(r.nowPlaying.title)}</div><div class="qi-req">Now singing: ${escapeHTML(r.nowPlaying.requester || 'guest')}</div></div><span class="badge playing">${r.isPaused ? 'PAUSED' : 'LIVE'}</span>`;
    if (nsList) nsList.appendChild(npLi);
    if (nsSection) nsSection.style.display = 'block';
  } else { if (nsSection) nsSection.style.display = 'none'; }

  const m = $('#mysongs-list'); m.innerHTML = '';
  const mine = r.queue.filter(x => (x.requester || '').toLowerCase() === (displayName || userEmail || '').toLowerCase());
  // Also include the currently playing song if it belongs to this user
  const np = r.nowPlaying;
  if (np && (np.requester || '').toLowerCase() === (displayName || userEmail || '').toLowerCase()) {
    mine.unshift({ ...np, status: 'playing' });
  }
  if (mine.length === 0) m.innerHTML = '<p class="sidebar-empty">No songs yet. Search and add one!</p>';
  mine.forEach(item => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<img class="qi-thumb" src="https://i.ytimg.com/vi/${escapeHTML(item.youtube_id)}/default.jpg" alt=""><div class="qi-info"><div class="qi-title">${escapeHTML(item.title)}</div><div class="qi-req">by ${escapeHTML(item.requester)}</div></div><span class="badge ${item.status === 'playing' ? 'playing' : 'queued'}">${item.status === 'playing' ? 'NOW PLAYING' : 'IN QUEUE'}</span>`;
    m.appendChild(li);
  });

  const a = $('#activity-list'); a.innerHTML = '';
  (r.activity || []).forEach(x => {
    const li = document.createElement('li');
    const t = new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `${escapeHTML(x.message)}<time>${t}</time>`;
    a.appendChild(li);
  });
  if (playerEngine === 'videojs') applyVjsPlaybackState(r); else applyPlaybackState(r);
}

function renderRemoteMode(r) {
  if (playerEngine === 'videojs') maybeStartRemoteVjsPlayer(r); else maybeStartRemotePlayer(r);
  const playBtn = $('#remote-play-btn'); const stopBtn = $('#remote-stop-btn'); const nextBtn = $('#remote-next-btn');
  // --- Now Playing bar ---
  const rnpBar = $('#remote-now-playing-bar');
  if (rnpBar) {
    if (r.nowPlaying) {
      rnpBar.classList.remove('hidden');
      $('#remote-np-title').textContent = r.nowPlaying.title || '';
      $('#remote-np-by').textContent = 'Added by ' + (r.nowPlaying.requester || 'guest');
    } else {
      rnpBar.classList.add('hidden');
    }
  }
  if (!r.nowPlaying) {
    playBtn.disabled = true; stopBtn.disabled = true; nextBtn.disabled = true;
    playBtn.querySelector('.remote-btn-icon').innerHTML = ICON.play;
    playBtn.querySelector('.remote-btn-label').textContent = 'PLAY';
  } else {
    playBtn.disabled = false; stopBtn.disabled = false; nextBtn.disabled = false;
    if (r.isPaused) { playBtn.querySelector('.remote-btn-icon').innerHTML = ICON.play; playBtn.querySelector('.remote-btn-label').textContent = 'PLAY'; playBtn.classList.add('paused-state'); playBtn.classList.remove('playing-state'); }
    else { playBtn.querySelector('.remote-btn-icon').innerHTML = ICON.pause; playBtn.querySelector('.remote-btn-label').textContent = 'PAUSE'; playBtn.classList.add('playing-state'); playBtn.classList.remove('paused-state'); }
  }
  const rq = $('#remote-queue-list'); rq.innerHTML = '';
  const upNext = r.queue.filter(x => x.status === 'queued');
  const rqEmpty = $('#remote-queue-empty');
  if (rqEmpty) rqEmpty.style.display = upNext.length ? 'none' : 'block';
  upNext.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    const mine = (item.requester || '').toLowerCase() === (displayName || userEmail || '').toLowerCase();
    li.innerHTML = `<span class="qi-num">${i + 1}</span><img class="qi-thumb" src="https://i.ytimg.com/vi/${escapeHTML(item.youtube_id)}/default.jpg" alt=""><div class="qi-info"><div class="qi-title">${escapeHTML(item.title)}</div><div class="qi-req"><span class="ic">${ICON.mic}</span> ${escapeHTML(item.requester || 'guest')}</div></div>${mine ? '<span class="badge yours">You</span>' : ''}`;
    rq.appendChild(li);
  });
  const rnsList = $('#remote-now-singing-list'); const rnsSection = $('#remote-now-singing-section');
  if (rnsList) rnsList.innerHTML = '';
  if (r.nowPlaying) {
    const npLi = document.createElement('li');
    npLi.className = 'queue-item now-singing';
    npLi.innerHTML = `<span class="qi-num singing-icon">${ICON.music}</span><img class="qi-thumb" src="https://i.ytimg.com/vi/${escapeHTML(r.nowPlaying.youtube_id)}/default.jpg" alt=""><div class="qi-info"><div class="qi-title">${escapeHTML(r.nowPlaying.title)}</div><div class="qi-req">Now singing: ${escapeHTML(r.nowPlaying.requester || 'guest')}</div></div><span class="badge playing">${r.isPaused ? 'PAUSED' : 'LIVE'}</span>`;
    if (rnsList) rnsList.appendChild(npLi);
    if (rnsSection) rnsSection.style.display = 'block';
  } else { if (rnsSection) rnsSection.style.display = 'none'; }
  if (playerEngine === 'videojs') applyRemoteVjsPlaybackState(r); else applyRemotePlaybackState(r);
}

// ====== Muted remote player ======
let remoteCurrentVideoId = null;
function maybeStartRemotePlayer(r) {
  if (!r.nowPlaying) {
    if (remoteYtPlayer) { try { remoteYtPlayer.destroy(); } catch {} remoteYtPlayer = null; }
    remotePlayerReady = false;
    $('#remote-player-idle').classList.remove('hidden');
    remoteCurrentVideoId = null;
    return;
  }
  $('#remote-player-idle').classList.add('hidden');
  $('#remote-player-idle').innerHTML = `<div class="idle-icon">${ICON.mic}</div><p>No song playing</p><p class="idle-sub">Waiting for the host to play a song</p>`;
  const v = r.nowPlaying;
  // Hide Video.js remote player when using YouTube IFrame
  $('#remote-videojs-player').classList.add('hidden');
  if (!checkYtReady()) { setTimeout(() => { if (currentKTV) maybeStartRemotePlayer(currentKTV); }, 500); return; }
  if (!remoteYtPlayer) {
    remoteYtPlayer = new YT.Player('remote-yt-player', {
      videoId: v.youtube_id,
      playerVars: { autoplay: 1, playsinline: 1, mute: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: (e) => {
          remotePlayerReady = true;
          try { e.target.mute(); if (currentKTV && currentKTV.isPaused) { e.target.pauseVideo(); } else { e.target.playVideo(); } } catch {}
        },
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'next', code: currentKTV.code })); } },
        onError: (e) => {
          if (e.data === 150 || e.data === 101 || e.data === 100) {
            const idle = document.getElementById('remote-player-idle');
            if (idle) { idle.classList.remove('hidden'); idle.innerHTML = `<div class="idle-icon">${ICON.mic}</div><p>Preview not available</p><p class="idle-sub">Video doesn't allow embedding — host is still playing</p>`; }
          }
        },
      },
    });
    remoteCurrentVideoId = v.youtube_id;
  } else if (remoteCurrentVideoId !== v.youtube_id) {
    remotePlayerReady = false;
    remoteYtPlayer.loadVideoById(v.youtube_id);
    remoteYtPlayer.mute();
    remoteCurrentVideoId = v.youtube_id;
  }
}
function applyRemotePlaybackState(r) {
  if (!remoteYtPlayer || !r.nowPlaying || !remotePlayerReady) return;
  try { remoteYtPlayer.mute(); if (r.isPaused) remoteYtPlayer.pauseVideo(); else remoteYtPlayer.playVideo(); } catch {}
}
function applyPlaybackState(r) {
  if (!ytPlayer || !r.nowPlaying) return;
  try { if (r.isPaused) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); } catch {}
}

// ---------- In-ktv search ----------
// ktvSearchType tracks current search mode for the host KTV screen.
// 'live' (default) or 'karaoke'.
// The button label and color always reflect the CURRENT mode:
//   - Karaoke mode: green/teal button, label "Click & Search LIVE Music Video"
//   - Live mode: orange button, label "Click & Search KARAOKE Music Video"
// Clicking the button toggles between the two modes.
let ktvSearchType = 'karaoke';

function updateLiveSearchToggleUI() {
  const btn = $('#ktv-live-search-btn');
  const input = $('#ktv-song-search');
  const labelEl = btn ? btn.querySelector('.ktv-search-header-text') : null;
  const movingPh = $('#ktv-moving-ph span');
  if (ktvSearchType === 'live') {
    // Live mode = orange → button label says KARAOKE
    if (btn) { btn.classList.remove('mode-karaoke'); btn.classList.add('mode-live'); }
    if (labelEl) labelEl.innerHTML = 'Click & Search KARAOKE<br>Music Video';
    if (input) input.placeholder = 'Search LIVE music video';
    if (movingPh) movingPh.textContent = 'Search LIVE music video ';
  } else {
    // Karaoke mode = green/teal → button label says LIVE
    if (btn) { btn.classList.remove('mode-live'); btn.classList.add('mode-karaoke'); }
    if (labelEl) labelEl.innerHTML = 'Click & Search LIVE<br>Music Video';
    if (input) input.placeholder = 'Search KARAOKE music video';
    if (movingPh) movingPh.textContent = 'Search KARAOKE music video ';
  }
}

async function doKTVSearch() {
  const q = $('#ktv-song-search').value.trim();
  if (!q) return;
  const type = ktvSearchType;
  const resultsEl = $('#ktv-search-results');
  resultsEl.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Searching...</p></div>';
  try {
    const results = await api(`/search?q=${encodeURIComponent(q)}&type=${type}`);
    if (!results.length) { resultsEl.innerHTML = '<p style="color:var(--muted);padding:12px">No results found.</p>'; return; }
    resultsEl.innerHTML = '';
    results.forEach(v => {
      const li = document.createElement('li');
      li.innerHTML = `<img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22><rect fill=%22%23333%22 width=%22120%22 height=%2268%22/><text x=%2260%22 y=%2238%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2212%22>♪</text></svg>'"><span class="r-title">${escapeHTML(v.title)}</span><button class="r-add">${ICON.plus} Add</button>`;
      li.querySelector('.r-add').onclick = () => { addSongToKTV(v); const btn = li.querySelector('.r-add'); btn.innerHTML = `${ICON.check} Added`; btn.style.background = 'var(--accent)'; setTimeout(() => { li.remove(); }, 1000); const r = $("#ktv-search-results"); if (r) r.innerHTML = ""; const rs = $("#ktv-song-search"); if (rs) rs.value = ""; showMovingPh('#ktv-moving-ph'); };
      resultsEl.appendChild(li);
    });
  } catch (e) { resultsEl.innerHTML = '<p style="color:var(--muted);padding:12px">Search failed: ' + (e.message || 'error') + '</p>'; }
}
$('#ktv-search-btn').addEventListener('click', () => { doKTVSearch(); });
$('#ktv-song-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doKTVSearch(); });
// Show/hide moving placeholder for host search bar
(function() {
  const inp = $('#ktv-song-search');
  const ph = $('#ktv-moving-ph');
  if (!inp || !ph) return;
  inp.addEventListener('focus', () => ph.classList.add('hidden'));
  inp.addEventListener('blur', () => { if (!inp.value.trim()) ph.classList.remove('hidden'); });
  inp.addEventListener('input', () => { if (inp.value.trim()) ph.classList.add('hidden'); else ph.classList.remove('hidden'); });
})();

// ---------- Mode toggle button (header) ----------
// Clicking the button toggles between karaoke and live search modes.
// The button label and color update to show the current mode.
$('#ktv-live-search-btn').addEventListener('click', () => {
  if (ktvSearchType === 'live') {
    // Switch from live to karaoke
    ktvSearchType = 'karaoke';
    updateLiveSearchToggleUI();
  } else {
    // Switch from karaoke to live (orange)
    ktvSearchType = 'live';
    updateLiveSearchToggleUI();
    // Switch to search tab but do NOT auto-focus — keyboard should only open when user taps the search bar
    switchKTVTab('search');
    const ss = $('#ktv-song-search');
    if (ss && ss.value.trim()) doKTVSearch();
  }
});

// Initialize the host search button to show the correct mode on page load
updateLiveSearchToggleUI();

// ---------- In-ktv search tabs (Search / Popular) ----------
let ktvPopularLoaded = false;
function switchKTVTab(name) {
  $$('#host-mode .ktv-tab').forEach(t => t.classList.toggle('active', t.dataset.ktvTab === name));
  $$('#ktv-tab-search, #ktv-tab-popular').forEach(c => {
    c.classList.toggle('active', c.id === 'ktv-tab-' + name);
  });
  if (name === 'popular' && !ktvPopularLoaded) loadKTVPopular();
}
$$('#host-mode .ktv-tab').forEach(t => t.addEventListener('click', () => switchKTVTab(t.dataset.ktvTab)));
async function loadKTVPopular() {
  const ul = $('#ktv-popular-list');
  if (!ul) return;
  ul.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Loading popular songs...</p></div>';
  try {
    const results = await api('/popular');
    if (!results.length) throw new Error('empty');
    ul.innerHTML = '';
    results.forEach((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.style.display='none'"><span class="pop-title">${escapeHTML(v.title)}</span><button class="r-add">${ICON.plus} Add</button>`;
      li.querySelector('.r-add').onclick = () => { addSongToKTV(v); const btn = li.querySelector('.r-add'); btn.innerHTML = `${ICON.check} Added`; btn.style.background = 'var(--accent)'; setTimeout(() => { li.remove(); }, 1000); const r = $("#ktv-search-results"); if (r) r.innerHTML = ""; const rs = $("#ktv-song-search"); if (rs) rs.value = ""; showMovingPh('#ktv-moving-ph'); };
      ul.appendChild(li);
    });
    ktvPopularLoaded = true;
  } catch (e) {
    ul.innerHTML = '';
    POPULAR_QUERIES.forEach((q, i) => {
      const li = document.createElement('li');
      const title = q.replace(' karaoke', '');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><span class="pop-title">${title}</span>`;
      li.onclick = () => { ktvSearchType = 'karaoke'; updateLiveSearchToggleUI(); $('#ktv-song-search').value = title; switchKTVTab('search'); doKTVSearch(); };
      ul.appendChild(li);
    });
    ktvPopularLoaded = true;
  }
}

// ---------- Remote (phone) search tabs (Search / Popular) ----------
// Mirrors the host's switchKTVTab / loadKTVPopular for the remote display.
let remotePopularLoaded = false;
function switchRemoteTab(name) {
  // Only toggle remote tabs (inside #remote-mode), not host tabs
  $$('#remote-mode .ktv-tab').forEach(t => t.classList.toggle('active', t.dataset.ktvTab === name));
  $$('#remote-tab-search, #remote-tab-popular').forEach(c => {
    c.classList.toggle('active', c.id === 'remote-tab-' + name);
  });
  const panel = $('#remote-search-panel');
  if (panel) {
    // Toggle overlay: search results overlay vs popular list overlay
    panel.classList.toggle('search-active', name === 'search' && $('#remote-search-results') && $('#remote-search-results').children.length > 0);
    panel.classList.toggle('popular-active', name === 'popular');
  }
  if (name === 'popular' && !remotePopularLoaded) loadRemotePopular();
}
$$('#remote-mode .ktv-tab').forEach(t => t.addEventListener('click', () => switchRemoteTab(t.dataset.ktvTab)));
async function loadRemotePopular() {
  const ul = $('#remote-popular-list');
  if (!ul) return;
  ul.innerHTML = '<div class="search-spinner"><div class="spinner"></div><p>Loading popular songs...</p></div>';
  try {
    const results = await api('/popular');
    if (!results.length) throw new Error('empty');
    ul.innerHTML = '';
    results.forEach((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><img class="r-thumb" src="${escapeHTML(safeImageURL(v.thumb))}" alt="" loading="lazy" onerror="this.style.display='none'"><span class="pop-title">${escapeHTML(v.title)}</span><button class="r-add">${ICON.plus} Add</button>`;
      li.querySelector('.r-add').onclick = () => { addSongToKTV(v); const btn = li.querySelector('.r-add'); btn.innerHTML = `${ICON.check} Added`; btn.style.background = 'var(--accent)'; setTimeout(() => { li.remove(); }, 1000); };
      ul.appendChild(li);
    });
    remotePopularLoaded = true;
  } catch (e) {
    ul.innerHTML = '';
    POPULAR_QUERIES.forEach((q, i) => {
      const li = document.createElement('li');
      const title = q.replace(' karaoke', '');
      li.innerHTML = `<span class="pop-num">${i + 1}</span><span class="pop-title">${title}</span>`;
      li.onclick = () => { remoteSearchType = 'karaoke'; updateRemoteToggleUI(); switchRemoteTab('search'); const ss = $('#remote-song-search'); if (ss) { ss.value = title; doRemoteSearch(); } };
      ul.appendChild(li);
    });
    remotePopularLoaded = true;
  }
}

// ---------- WebSocket ----------
function connectWS(code) { if (ws) ws.close(); ws = doConnectWS(code); }
function doConnectWS(code) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}${BASE}/ws`);
  sock.onopen = () => {
    wsReconnectTries = 0;
    sock.send(JSON.stringify({
      type: 'join',
      code,
      is_remote: isRemoteMode,
      requester: displayName || userEmail || 'guest',
      token: userToken,
      host_token: localStorage.getItem('ktv_host_' + code) || '',
    }));
  };
  sock.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'ktv') renderKTV(msg);
    else if (msg.type === 'song_rejected') handleSongRejected(msg);
    else if (msg.type === 'cheer') handleCheer();
  };
  sock.onclose = (event) => {
    if (event && event.code === 1008 && event.reason === 'Authentication required' && CONFIG && CONFIG.email_login_enabled) {
      userToken = ''; userEmail = '';
      localStorage.removeItem('ktv_user_token'); localStorage.removeItem('ktv_user_email');
      showRegistrationModal();
      return;
    }
    if (currentKTV && currentKTV.code === code) {
      if (wsReconnectTries < 5) {
        const delay = Math.min(1000 * Math.pow(2, wsReconnectTries), 8000);
        wsReconnectTries++;
        setTimeout(() => { if (currentKTV && currentKTV.code === code) ws = doConnectWS(code); }, delay);
      }
    }
  };
  return sock;
}

// ---------- Settings ----------
const _settingsBtn = $('#settings-btn'); if (_settingsBtn) _settingsBtn.addEventListener('click', () => { buildThemeGrid(); openModal('settings-modal'); });
const _ktvSettingsBtn = $('#ktv-settings-btn'); if (_ktvSettingsBtn) _ktvSettingsBtn.addEventListener('click', () => { buildThemeGrid(); openModal('settings-modal'); });

// ---------- Refresh buttons (host + remote) ----------
// Host refresh: falling animation + refresh ALL state in-place
const _ktvRefreshBtn = $('#ktv-refresh-btn');
if (_ktvRefreshBtn) _ktvRefreshBtn.addEventListener('click', () => {
  triggerRefresh(_ktvRefreshBtn);
});
// Remote refresh: falling animation + refresh ALL state in-place
const _remoteRefreshBtn = $('#remote-refresh-btn');
if (_remoteRefreshBtn) _remoteRefreshBtn.addEventListener('click', () => {
  triggerRefresh(_remoteRefreshBtn);
});
const _themeQuickBtn = $('#theme-quick-btn'); if (_themeQuickBtn) _themeQuickBtn.addEventListener('click', cycleTheme);
const _ktvThemeBtn = $('#ktv-theme-btn'); if (_ktvThemeBtn) _ktvThemeBtn.addEventListener('click', cycleTheme);
$('#save-display-name').addEventListener('click', () => { displayName = $('#display-name').value.trim(); localStorage.setItem('ktv_display_name', displayName); alert('Name saved'); });
$$('[data-close]').forEach(b => b.addEventListener('click', () => { stopQRScanner(); $$('.modal').forEach(m => m.classList.add('hidden')); }));

// Special handling: if user closes the registration modal via X button without registering,
// show the locked overlay (same as Cancel button)
$('#register-close-btn').addEventListener('click', () => {
  if (CONFIG.email_login_enabled && !userToken) {
    setTimeout(() => { if (!userToken) showLockedOverlay(); }, 50);
  }
});

// ---------- Admin ----------
$('#open-admin-btn').addEventListener('click', () => { closeModal('settings-modal'); openModal('admin-login-modal'); });
$('#admin-login-btn').addEventListener('click', async () => {
  const p = $('#admin-pass').value;
  try {
    const r = await api('/admin/login', { method: 'POST', body: JSON.stringify({ password: p }) });
    adminToken = r.token; sessionStorage.setItem('ktv_admin_token', adminToken);
    closeModal('admin-login-modal'); openAdminPanel();
  } catch (err) { const el = $('#admin-login-error'); el.textContent = err.message; el.classList.remove('hidden'); }
});
async function openAdminPanel() {
  openModal('admin-modal');
  const cfg = await api('/admin/config');
  $('#cfg-app-name').value = cfg.app_name || '';
  $('#cfg-app-tagline').value = cfg.app_tagline || '';
  $('#cfg-base-path').value = cfg.base_path || 'ktv';
  $('#cfg-show-live-music').checked = cfg.show_live_music_button === '1';
  $('#cfg-show-search').checked = cfg.show_search_button === '1';
  $('#cfg-show-queue').checked = cfg.show_queue_button === '1';
  $('#cfg-show-popular').checked = cfg.show_popular_button === '1';
  $('#cfg-show-mysongs').checked = cfg.show_mysongs_button === '1';
  $('#cfg-email-login').checked = cfg.email_login_enabled === '1' || cfg.email_login_enabled === true;
  $('#cfg-default-theme').value = cfg.default_theme || 'neonpop';
  $('#cfg-refresh-animation').value = cfg.refresh_animation || 'fall';
  $('#cfg-video-player').value = cfg.video_player || 'youtube';
  $('#cfg-footer-credit').value = cfg.footer_credit || '';
  $('#cfg-footer-support').value = cfg.footer_support || '';
  $('#cfg-footer-link1-text').value = cfg.footer_link1_text || '';
  $('#cfg-footer-link1-url').value = cfg.footer_link1_url || '';
  $('#cfg-footer-link2-text').value = cfg.footer_link2_text || '';
  $('#cfg-footer-link2-url').value = cfg.footer_link2_url || '';
  $('#cfg-footer-link3-text').value = cfg.footer_link3_text || '';
  $('#cfg-footer-link3-url').value = cfg.footer_link3_url || '';
  // Show QR preview if one exists
  const qrPreview = $('#cfg-footer-qr-preview');
  if (qrPreview) {
    if (cfg.footer_qr) qrPreview.innerHTML = `<img src="${escapeHTML(safeQRImageURL(cfg.footer_qr))}" style="width:64px;height:64px;border-radius:6px;border:1px solid rgba(0,0,0,0.08)">`;
    else qrPreview.innerHTML = '<span style="font-size:11px;color:#999">No QR uploaded</span>';
  }
  await refreshLogins(); await refreshUsers();
  await refreshAdminRooms();
}
$('#save-identity').addEventListener('click', async () => {
  await api('/admin/config', { method: 'POST', body: JSON.stringify({ app_name: $('#cfg-app-name').value, app_tagline: $('#cfg-app-tagline').value, base_path: $('#cfg-base-path').value }) });
  alert('Identity saved. Reload the page to see the new name.');
});
$('#save-theme').addEventListener('click', async () => {
  const t = $('#cfg-default-theme').value;
  await api('/admin/config', { method: 'POST', body: JSON.stringify({ default_theme: t }) });
  alert('Default theme saved: ' + t);
});
// Save refresh animation choice to server config
$('#save-refresh-anim').addEventListener('click', async () => {
  const anim = $('#cfg-refresh-animation').value;
  try {
    await api('/admin/config', { method: 'POST', body: JSON.stringify({ refresh_animation: anim }) });
    refreshAnimation = anim; // apply immediately for this session
    CONFIG.refresh_animation = anim;
    alert('Refresh animation saved: ' + $('#cfg-refresh-animation option:checked').textContent.split(' —')[0]);
  } catch (e) { alert('Failed to save: ' + (e.message || 'unknown error')); }
});

// Save video player choice to server config
$('#save-video-player').addEventListener('click', async () => {
  const p = $('#cfg-video-player').value;
  try {
    await api('/admin/config', { method: 'POST', body: JSON.stringify({ video_player: p }) });
    playerEngine = p;
    CONFIG.video_player = p;
    alert('Video player saved: ' + $('#cfg-video-player option:checked').textContent + '\n\nReload the page for the change to take effect on all displays.');
  } catch (e) { alert('Failed to save: ' + (e.message || 'unknown error')); }
});

// Preview the selected animation without saving
$('#preview-anim').addEventListener('click', () => {
  const anim = $('#cfg-refresh-animation').value;
  // Temporarily set the animation type, play it, then restore
  const prev = refreshAnimation;
  refreshAnimation = anim;
  playRefreshAnimation().then(() => { refreshAnimation = prev; });
});
$('#save-buttons').addEventListener('click', async () => {
  const liveMusic = $('#cfg-show-live-music').checked;
  await api('/admin/config', { method: 'POST', body: JSON.stringify({
    show_live_music_button: liveMusic ? '1' : '0', show_search_button: $('#cfg-show-search').checked ? '1' : '0',
    show_queue_button: $('#cfg-show-queue').checked ? '1' : '0', show_popular_button: $('#cfg-show-popular').checked ? '1' : '0',
    show_mysongs_button: $('#cfg-show-mysongs').checked ? '1' : '0',
  }) });
  CONFIG.buttons.live_music = liveMusic; CONFIG.buttons.search = $('#cfg-show-search').checked;
  CONFIG.buttons.queue = $('#cfg-show-queue').checked; CONFIG.buttons.popular = $('#cfg-show-popular').checked;
  CONFIG.buttons.mysongs = $('#cfg-show-mysongs').checked;
  renderCustomButtons(); applyHomeTabVisibility();
  alert('Buttons saved and applied.');
});
$('#save-email').addEventListener('click', async () => {
  await api('/admin/config', { method: 'POST', body: JSON.stringify({ email_login_enabled: $('#cfg-email-login').checked ? '1' : '0' }) });
  alert('Email login setting saved.');
});
$('#save-admin-pass').addEventListener('click', async () => {
  const p = $('#cfg-admin-pass').value;
  if (!p) return alert('Enter a new password');
  await api('/admin/config', { method: 'POST', body: JSON.stringify({ admin_password: p }) });
  alert('Admin password changed. Please sign in again.');
  $('#cfg-admin-pass').value = '';
  adminToken = ''; sessionStorage.removeItem('ktv_admin_token');
  closeModal('admin-modal'); openModal('admin-login-modal');
});
$('#save-footer').addEventListener('click', async () => {
  await api('/admin/config', { method: 'POST', body: JSON.stringify({
    footer_credit: $('#cfg-footer-credit').value,
    footer_support: $('#cfg-footer-support').value,
    footer_link1_text: $('#cfg-footer-link1-text').value,
    footer_link1_url: $('#cfg-footer-link1-url').value,
    footer_link2_text: $('#cfg-footer-link2-text').value,
    footer_link2_url: $('#cfg-footer-link2-url').value,
    footer_link3_text: $('#cfg-footer-link3-text').value,
    footer_link3_url: $('#cfg-footer-link3-url').value,
  }) });
  // Refresh config and re-render footer immediately
  CONFIG = await api('/config');
  renderFooter();
  alert('Footer saved and applied.');
});

// Upload QR code
$('#upload-qr').addEventListener('click', async () => {
  const fileInput = $('#cfg-footer-qr-file');
  const file = fileInput.files[0];
  if (!file) { alert('Please select an image file first.'); return; }
  if (file.size > 2e6) { alert('Image too large (max 2MB).'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imageData = e.target.result; // data URL
      await api('/admin/upload-qr', { method: 'POST', body: JSON.stringify({ image: imageData }) });
      CONFIG = await api('/config');
      renderFooter();
      // Update preview
      const qrPreview = $('#cfg-footer-qr-preview');
      if (CONFIG.footer.qr) qrPreview.innerHTML = `<img src="${escapeHTML(safeQRImageURL(CONFIG.footer.qr))}" style="width:64px;height:64px;border-radius:6px;border:1px solid rgba(0,0,0,0.08)">`;
      fileInput.value = '';
      alert('QR code uploaded and shown in footer.');
    } catch (err) { alert('Upload failed: ' + err.message); }
  };
  reader.readAsDataURL(file);
});

// Remove QR code
$('#remove-qr').addEventListener('click', async () => {
  try {
    await api('/admin/config', { method: 'POST', body: JSON.stringify({ footer_qr: '' }) });
    CONFIG = await api('/config');
    renderFooter();
    const qrPreview = $('#cfg-footer-qr-preview');
    qrPreview.innerHTML = '<span style="font-size:11px;color:#999">No QR uploaded</span>';
    alert('QR code removed from footer.');
  } catch (err) { alert('Remove failed: ' + err.message); }
});

function renderFooter() {
  const f = CONFIG.footer || {};
  // Landing footer
  const creditEl = $('#footer-credit');
  const supportEl = $('#footer-support');
  const linksEl = $('#footer-links');
  const qrEl = $('#footer-qr');
  if (creditEl) creditEl.textContent = f.credit || '';
  if (supportEl) supportEl.textContent = f.support || '';
  if (linksEl) linksEl.innerHTML = buildFooterLinks(f);
  if (qrEl) qrEl.innerHTML = f.qr ? `<img src="${escapeHTML(safeQRImageURL(f.qr))}" alt="QR Code">` : '';
  // Home footer
  const hCredit = document.querySelector('[data-footer-credit]');
  const hSupport = document.querySelector('[data-footer-support]');
  const hLinks = document.querySelector('[data-footer-links]');
  const hQr = document.querySelector('[data-footer-qr]');
  if (hCredit) hCredit.textContent = f.credit || '';
  if (hSupport) hSupport.textContent = f.support || '';
  if (hLinks) hLinks.innerHTML = buildFooterLinks(f);
  if (hQr) hQr.innerHTML = f.qr ? `<img src="${escapeHTML(safeQRImageURL(f.qr))}" alt="QR Code">` : '';
}
function buildFooterLinks(f) {
  const links = [
    { text: f.link1_text, url: f.link1_url },
    { text: f.link2_text, url: f.link2_url },
    { text: f.link3_text, url: f.link3_url },
  ].filter(l => l.text);
  return links.map(l => {
    let href = '#';
    try { const u = new URL(l.url || '', location.href); if (u.protocol === 'https:' || u.protocol === 'http:') href = u.href; } catch {}
    return `<a href="${escapeHTML(href)}"${href !== '#' ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(l.text)}</a>`;
  }).join('');
}
async function refreshLogins() {
  try {
    const rows = await api('/admin/logins');
    const tb = $('#logins-table tbody'); tb.innerHTML = '';
    rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${escapeHTML(r.email)}</td><td>${escapeHTML(r.ip || '')}</td><td>${new Date(r.login_at).toLocaleString()}</td>`; tb.appendChild(tr); });
  } catch {}
}
async function refreshUsers() {
  try {
    const rows = await api('/admin/users');
    const tb = $('#users-table tbody'); tb.innerHTML = '';
    rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${escapeHTML(r.email)}</td><td>${escapeHTML(r.display_name || '')}</td><td>${r.banned ? 'YES' : 'no'}</td><td>${new Date(r.last_seen).toLocaleString()}</td>`; tb.appendChild(tr); });
  } catch {}
}

// ---------- Admin: Remote Song Limit ----------
async function refreshAdminRooms() {
  try {
    const rooms = await api('/admin/rooms');
    const container = $('#admin-rooms-list');
    if (!container) return;
    if (!rooms.length) {
      container.innerHTML = '<p style="font-size:13px;color:#999">No active rooms.</p>';
      return;
    }
    container.innerHTML = rooms.map(r => {
      const status = r.songLimitEnabled
        ? '<span style="color:#e74c3c;font-weight:600">LIMIT ON</span>'
        : '<span style="color:#27ae60;font-weight:600">No limit</span>';
      const btnLabel = r.songLimitEnabled ? 'Disable Limit' : 'Enable Limit';
      const btnClass = r.songLimitEnabled ? 'btn-secondary' : 'btn-primary';
      const remoteBadge = r.remoteCount > 2
        ? ` <span style="color:#e74c3c">(${r.remoteCount} remotes — limit will apply)</span>`
        : ` <span style="color:#999">(${r.remoteCount} remote${r.remoteCount === 1 ? '' : 's'} — no limit needed)</span>`;
      return `
        <div style="border:1px solid var(--surface-2);border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong>Room ${r.code}</strong>
            ${status}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
            ${r.guestCount} guest(s) · ${r.hostCount} host · ${r.remoteCount} remote${remoteBadge}<br>
            ${r.queueLength} song(s) queued${r.nowPlaying ? ' · Now playing: ' + r.nowPlaying : ''}
          </div>
          <button class="btn ${btnClass} btn-block toggle-limit-btn" data-code="${r.code}" data-enabled="${!r.songLimitEnabled}">
            ${btnLabel}
          </button>
        </div>`;
    }).join('');
    // Attach click handlers to toggle buttons
    container.querySelectorAll('.toggle-limit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        const enabled = btn.dataset.enabled === 'true';
        try {
          await api('/admin/room/limit', { method: 'POST', body: JSON.stringify({ code, enabled }) });
          await refreshAdminRooms();
        } catch (e) { alert('Failed to toggle limit: ' + (e.message || 'error')); }
      });
    });
  } catch (e) {
    const container = $('#admin-rooms-list');
    if (container) container.innerHTML = '<p style="font-size:13px;color:#999">Unable to load rooms.</p>';
  }
}
// Refresh room list when admin modal opens and when refresh button is clicked
const _refreshRoomsBtn = $('#refresh-rooms-btn');
if (_refreshRoomsBtn) _refreshRoomsBtn.addEventListener('click', refreshAdminRooms);

// ---------- Service worker (PWA offline shell) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}/sw.js`).catch(() => {});
  });
}

// ---------- Start ----------
boot();

