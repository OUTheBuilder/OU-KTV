# Connect your existing Supabase project to OU-KTV

This setup adds OU-KTV objects to an **existing** Supabase project. It does not create, replace, or delete a project. The migration uses `CREATE TABLE IF NOT EXISTS`, but review it before applying because it adds policies and a database function.

## What you need

- Your Supabase **Project URL** and **publishable key** (or legacy `anon` key) for the app.
- Your Supabase **Project Reference ID** (the subdomain in the Project URL).
- Access to the project's SQL Editor and Edge Functions.
- The project's **service_role/secret key** only for the Edge Function secret. Never paste it into chat, GitHub source files, browser code, or the Android app.

## Step 1 — Apply the database migration

1. Open https://supabase.com/dashboard and select the existing project.
2. Open **SQL Editor** → **New query**.
3. Open this repository file:
   `supabase/migrations/202610310001_ouktv_core.sql`
4. Copy the complete SQL into the editor and run it.
5. Confirm the five `ktv_*` tables and the `ktv_apply_action` function exist.

The migration creates rooms, members, song queue, cheers, and app configuration. It enables RLS and read policies needed by the current prototype. It does not alter unrelated tables. The room/member/queue read policies are intentionally broad for the current prototype; before public production use, add room-code scoped access and real user authentication.

## Step 2 — Deploy the Edge Function

The function source is `supabase/functions/ktv-api/index.ts`.

**Recommended (computer with Supabase CLI):**

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY='YOUR_SERVICE_ROLE_KEY'
supabase functions deploy ktv-api
```

Use your own terminal to enter the secret. Do not commit it. The function also receives `SUPABASE_URL` from the Supabase runtime.

**Dashboard alternative:** If your Supabase Dashboard offers Edge Function deployment from the editor, create a function named `ktv-api`, paste the source file, set `SUPABASE_SERVICE_ROLE_KEY` under Edge Function Secrets, then deploy. If the dashboard does not offer source editing/deployment for your plan, use the CLI method.

## Step 3 — Configure the frontend

The browser app needs:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: publishable key (or legacy anon key)

These are public client values, not secrets. The current branch's Pages workflow reads GitHub Actions repository variables named `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Add them under GitHub → repository **Settings → Secrets and variables → Actions → Variables** (not Secrets), then run the Pages workflow after the frontend adapter is verified.

## Step 4 — Verify

After deployment, check the function endpoint:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/ktv-api/config`

Expected: JSON containing `app_name`, `app_tagline`, and configuration fields. Then test room creation and room check. Do not treat the setup as production-ready until authentication, authorization, rate limits, room-scoped data access, and realtime playback have been tested.

## Current limitations to understand

- The current `/login` endpoint is a temporary guest/test login, not secure account registration.
- `/search` and `/popular` currently return empty arrays. Real song search needs a permitted search provider/API and server-side key.
- The existing OU-KTV client still needs its complete API/realtime adapter verified against this function before all screens work.
- The database foundation supports room actions, but synchronized playback across devices is not yet validated.
- The service-role key must remain in Edge Function secrets. Never place it in GitHub Pages variables, app assets, or APK.

## If you only have your Android phone

You can apply the SQL in the Supabase Dashboard using your phone browser. Deploying the Edge Function is more difficult without a terminal; use a trusted computer with the Supabase CLI or connect an authorized Supabase integration. Do not share private keys to avoid that step.
