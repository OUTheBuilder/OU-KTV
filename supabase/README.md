# OU KTV — Free-tier backend foundation

This branch adds the first Supabase backend foundation without changing the existing Android APK workflow on `main`.

## Included
- Postgres tables for rooms, members, queue, cheers, and app configuration.
- Read-only RLS policies for browser clients.
- Atomic room action function (add song, play, pause, stop, next, cheer, remove, join, leave).
- Edge Function `ktv-api` for app configuration, no-email test login, room creation/checking, room actions, and placeholder search responses.

## Required one-time setup
A Supabase project must be created by the project owner. ChatGPT cannot create a third-party account or accept its terms on the owner's behalf.

1. Create a free project at https://supabase.com/dashboard.
2. In **SQL Editor**, run `migrations/202610310001_ouktv_core.sql`.
3. Install the Supabase CLI and link this repository/project.
4. Set the Edge Function secret `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets. Never put this secret in the website or APK.
5. Deploy: `supabase functions deploy ktv-api`.
6. Copy the Project URL and public anon/publishable key for frontend configuration.

## Important current limitations
This is a backend foundation/MVP, not yet the completed app integration:
- The existing OU KTV web client still expects a custom WebSocket server. The Supabase Realtime subscription adapter still needs to be connected before multi-phone room state is live.
- Song search currently returns an explanatory empty response. A YouTube Data API key (stored as a server-side Edge Function secret) is needed for reliable search.
- Admin login/configuration and admin user/room management endpoints are not implemented in this first backend pass.
- Test login intentionally skips email registration. Do not use it as production authentication.
- Free-tier limits and availability are controlled by Supabase and may change.

## Safety
The service-role key must remain server-side in Supabase Edge Function secrets. Only the public anon/publishable key may be used by the browser client. Do not commit passwords, private keys, or service-role credentials.
