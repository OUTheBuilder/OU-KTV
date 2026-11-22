# OU KTV — Supabase backend foundation

This branch contains a Supabase Edge Function API, PostgreSQL room/queue schema, a GitHub Pages build, and the original OU KTV browser interface.

## Deployment prerequisites

A Supabase project and GitHub Pages build variables are required; repository code cannot create or authorize cloud resources in your account.

1. Apply `migrations/202610310001_ouktv_core.sql`, then `migrations/202611170001_ouktv_backend_hardening.sql` in the Supabase SQL Editor (or use the Supabase CLI).
2. Set `SUPABASE_SERVICE_ROLE_KEY` as an Edge Function secret. **Never place it in browser code or GitHub Actions variables.**
3. Deploy `supabase/functions/ktv-api/index.ts` as `ktv-api`.
4. Add GitHub Actions repository variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public/publishable key only), then run the Pages workflow.
5. Optionally add `YOUTUBE_API_KEY` as a Supabase Edge Function secret for official YouTube Data API search and quota-controlled results. Without it, the API tries YouTube's public web search endpoint, which YouTube may change or restrict.

The Edge Function currently supports public configuration, guest-mode login, room creation/checking, room actions, popular videos, and search. Host-only room controls use a high-entropy host token, hashed in the database. Guest login remains test/guest mode, not account registration. Admin routes, production user accounts, moderation, analytics, and end-to-end playback verification are not implemented by this foundation and should not be advertised as available.

## Verify after setup

- `GET https://PROJECT_REF.supabase.co/functions/v1/ktv-api/config`
- `GET https://PROJECT_REF.supabase.co/functions/v1/ktv-api/search?q=hello&type=music`
- Create a room from the site and verify a second device can join using its six-character code.
- Confirm host controls fail from a guest device and succeed from the host.
- Check browser console and Supabase Function/Postgres logs during a full host/guest playback session.

Only the project owner can provide the actual project configuration and authorize deployment. A successful Pages build does not by itself mean the Supabase backend is configured.
