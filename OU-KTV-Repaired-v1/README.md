# O|U KTV — Security and Reliability Repair

This repaired source keeps the original O|U KTV screens, themes, room workflow, queue, karaoke search, and remote display. The main changes are security and reliability hardening.

## Requirements

- Python 3.9 or newer
- `pip install -r requirements.txt`
- A strong admin password (at least 12 characters) in `KTV_ADMIN_PASSWORD` on first startup

Optional environment variables:

- `YOUTUBE_API_KEY` — enables YouTube Data API search. If omitted, the existing YouTube InnerTube search path is used.
- `KARAOKEVOX_API_KEY` — enables KaraokeVox search results. KaraokeVox playback is not implemented by the original frontend; non-YouTube results are now rejected instead of being incorrectly sent to the YouTube player.

## Start

Linux/macOS:

```bash
cd ktv-server
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export KTV_ADMIN_PASSWORD='replace-with-a-unique-password-at-least-12-chars'
python server.py
```

Windows PowerShell:

```powershell
cd ktv-server
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:KTV_ADMIN_PASSWORD = 'replace-with-a-unique-password-at-least-12-chars'
py server.py
```

The server listens on port 8080 by default. Set `PORT` to change it.

## Important migration notes

- Existing `data/config.json` admin SHA-256 hashes are verified and upgraded to PBKDF2 after a successful admin login.
- On a brand-new installation, `KTV_ADMIN_PASSWORD` is required; the insecure default `admin` has been removed.
- Existing legacy user accounts were created by a source version that did not actually verify passwords and assigned `123456` by default. Those accounts do not have trustworthy credentials. Back them up and arrange account re-registration/reset before enabling email login in a public deployment. New accounts require passwords of at least 8 characters and are stored using PBKDF2-HMAC-SHA256.
- Old rooms without a host-token hash remain guest-only for playback controls. Create a new room to obtain secure host credentials.
- A room's QR/link includes a bearer controller token only when requested by the room owner. Anyone possessing that QR/link can control playback; share it only with trusted participants. QR images are generated locally when the `qrcode` dependency is installed, so the controller token is not sent to a third-party QR service.
- Back up the `data/` directory before deploying over an existing installation.

## Security changes

- Admin API endpoints require a valid one-hour admin bearer token.
- Public configuration and room responses omit password hashes and host-token hashes.
- Admin password hashes use PBKDF2-HMAC-SHA256 with a random salt; successful legacy admin logins are migrated.
- Login attempts are rate-limited in-process.
- User passwords are verified; new user sessions are server-side and expire after 30 days.
- Host-only playback and queue-management commands require the room's high-entropy host credential. The host credential is never sent in public room state.
- WebSocket messages have size limits, room codes and YouTube IDs are validated, and queue updates are bounded.
- Search results no longer fabricate demo tracks when upstream search fails; YouTube Data API requests use GET.
- Frontend rendering escapes dynamic text and validates image/link URLs in the most important dynamic templates.
- QR images are generated locally when possible. QR URL parsing now supports `?code=...` links and controller credentials.
- PWA manifest, service worker, and app icons are included. The QR scanner uses the browser's native `BarcodeDetector` where available.

## Tests

Run syntax checks:

```bash
python -m py_compile server.py
node --check static/js/app.js
```

A security smoke test is included in `tests/test_security_smoke.py` and can be run with:

```bash
python tests/test_security_smoke.py
```

The smoke test covers admin endpoint protection, admin login, user password verification, room credential secrecy, and host-versus-guest WebSocket permissions. It does not replace a full browser/device or production deployment test.

User sessions are held in memory and are cleared when the server restarts; the frontend now detects an expired session and asks the user to sign in again. Use HTTPS in production because browser-to-server user and room-controller credentials must not travel over plain HTTP. If you change the configured `base_path` in the admin panel, restart the server so the new static/API/WebSocket aliases are registered.
