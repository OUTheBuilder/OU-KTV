# Repair changelog

## Security and reliability pass

- Added PBKDF2-HMAC-SHA256 password hashing with random salts and legacy admin-hash migration.
- Removed the insecure built-in admin password; first-time setup now requires `KTV_ADMIN_PASSWORD` (12+ characters).
- Added admin API authentication middleware and rate limits for login attempts.
- Removed password hashes from public/admin config responses.
- Replaced passwordless user login with password verification and server-side expiring sessions.
- Added high-entropy room host credentials and server-side authorization for playback/queue management.
- Added controller credential support to owner-generated QR links; QR images are generated locally when possible.
- Added input validation, WebSocket message limits/heartbeat, response security headers, and safer dynamic frontend rendering.
- Fixed YouTube Data API search to use GET and removed fabricated demo search results.
- Added prefixed API/WebSocket routes and explicit index routes so `/ktv/` works as expected.
- Added JSON startup loading, room recovery normalization, PWA manifest/service worker/icons, and a security smoke test.
- Preserved the original CSS and overall interface design.
