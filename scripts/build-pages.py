#!/usr/bin/env python3
"""Build the GitHub Pages frontend from the original OU KTV project ZIP."""
import os, re, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "OU-KTV-Fresh-Android-Project-v2.zip"
OUT = ROOT / "docs"
SUPABASE_URL = os.getenv("SUPABASE_URL", "SUPABASE_URL_NOT_CONFIGURED").rstrip("/")
ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY_NOT_CONFIGURED")

if not ARCHIVE.exists():
    raise SystemExit(f"Missing source archive: {ARCHIVE}")

with zipfile.ZipFile(ARCHIVE) as z:
    candidates = [n for n in z.namelist() if n.endswith("/app/src/main/assets/www/index.html")]
    if not candidates:
        raise SystemExit("Could not find the original OU KTV web interface in the source ZIP.")
    prefix = candidates[0].rsplit("app/src/main/assets/www/index.html", 1)[0]
    html = z.read(candidates[0]).decode("utf-8")
    assets = {}
    for name in z.namelist():
        marker = prefix + "app/src/main/assets/www/ext/"
        if name.startswith(marker) and not name.endswith("/"):
            assets[name[len(marker):]] = z.read(name)

adapter = r"""
// OU KTV Supabase browser adapter. The public anon key is safe for browser use
// only when Row Level Security is enabled. Never put a service-role key here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content.replace(/\/$/, '');
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]').content;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let _adminToken = '';
let _userToken = localStorage.getItem('ktv_user_token') || '';
let _roomChannel = null;
let _onMsg = null;
let _activeRoom = null;
function setAdminToken(token) { _adminToken = token || ''; }

async function api(path, opts = {}) {
  const url = SUPABASE_URL + '/functions/v1/ktv-api' + (path.startsWith('/') ? path : '/' + path);
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    ...(opts.headers || {})
  };
  const response = await fetch(url, {
    method: (opts.method || 'GET').toUpperCase(),
    headers,
    body: opts.body
  });
  const raw = await response.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch { data = raw; } }
  if (!response.ok) throw new Error((data && (data.error || data.message)) || raw || ('HTTP ' + response.status));
  return data;
}

async function publishRoomSnapshot() {
  if (!_activeRoom || !_onMsg) return;
  const { data: room, error: roomError } = await supabaseClient
    .from('ktv_rooms').select('*').eq('id', _activeRoom.id).single();
  if (roomError) { console.warn('[KTV] room refresh failed', roomError.message); return; }
  const { data: queue, error: queueError } = await supabaseClient
    .from('ktv_queue').select('*').eq('room_id', _activeRoom.id).eq('status', 'queued').order('position');
  if (queueError) console.warn('[KTV] queue refresh failed', queueError.message);
  const { count } = await supabaseClient
    .from('ktv_room_members').select('*', { count: 'exact', head: true })
    .eq('room_id', _activeRoom.id).is('left_at', null);
  _onMsg({
    type: 'ktv', code: room.code, name: room.name,
    nowPlaying: room.now_playing, isPaused: room.is_paused,
    queue: (queue || []).map(x => ({
      id: x.id, youtube_id: x.youtube_id, title: x.title,
      requester: x.requester, position: x.position
    })),
    guestCount: count || 0
  });
}

async function connectRealtime(code, onMsg, isRemote = false, name = 'guest') {
  disconnectRealtime();
  _onMsg = onMsg;
  const room = await api('/ktv/check/' + encodeURIComponent(code));
  if (!room || !room.id) throw new Error('Room not found');
  _activeRoom = { id: room.id, code: room.code };
  await api('/room/' + encodeURIComponent(code) + '/action', {
    method: 'POST',
    body: JSON.stringify({ type: 'join', code, requester: name, isRemote })
  });
  _roomChannel = supabaseClient.channel('ktv-room-' + room.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ktv_rooms', filter: 'id=eq.' + room.id }, publishRoomSnapshot)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ktv_queue', filter: 'room_id=eq.' + room.id }, publishRoomSnapshot)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ktv_cheers', filter: 'room_id=eq.' + room.id }, () => _onMsg && _onMsg({ type: 'cheer' }))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') publishRoomSnapshot();
      if (status === 'CHANNEL_ERROR') console.error('[KTV] Realtime channel error');
    });
  return _roomChannel;
}
function disconnectRealtime() {
  _onMsg = null;
  _activeRoom = null;
  if (_roomChannel) { supabaseClient.removeChannel(_roomChannel); _roomChannel = null; }
}
async function sendAction(action) {
  if (!action || !action.code) return;
  try {
    await api('/room/' + encodeURIComponent(action.code) + '/action', {
      method: 'POST', body: JSON.stringify(action)
    });
  } catch (error) { console.error('[KTV] action failed:', error.message); }
}
"""
start = html.find("// ===== client.js — O|U KTV client layer")
end = html.find("// ===== app.js — O|U KTV frontend", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate the client adapter section in the original HTML.")
html = html[:start] + adapter + "\n\n" + html[end:]
html = html.replace('content="__PUBLIC_URL__"', f'content="{SUPABASE_URL}"')
html = html.replace('content="__ANONKEY__"', f'content="{ANON_KEY}"')
OUT.mkdir(exist_ok=True)
(OUT / "index.html").write_text(html, encoding="utf-8")
ext_dir = OUT / "ext"
ext_dir.mkdir(exist_ok=True)
for name, data in assets.items():
    target = ext_dir / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
if SUPABASE_URL.endswith("NOT_CONFIGURED") or "NOT_CONFIGURED" in ANON_KEY:
    print("WARNING: Supabase credentials are not configured; Pages will display the original UI but backend requests cannot work.")
print(f"Built {OUT}/index.html and {len(assets)} local assets.")
