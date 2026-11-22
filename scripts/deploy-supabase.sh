#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root. This script never writes credentials to Git.
command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI is required. Install it from https://supabase.com/docs/guides/cli"
  exit 1
}

read -r -p "Supabase project reference ID: " PROJECT_REF
if [[ -z "$PROJECT_REF" || ! "$PROJECT_REF" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "Invalid project reference ID."
  exit 1
fi

echo "A browser/device authorization will open for Supabase."
supabase login
supabase link --project-ref "$PROJECT_REF"

read -r -s -p "Paste the project's service_role/secret key (input hidden): " SERVICE_ROLE_KEY
echo
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "No key entered; stopping."
  exit 1
fi

TMP_ENV="$(mktemp)"
chmod 600 "$TMP_ENV"
cleanup() { rm -f "$TMP_ENV"; unset SERVICE_ROLE_KEY; }
trap cleanup EXIT
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$SERVICE_ROLE_KEY" > "$TMP_ENV"
unset SERVICE_ROLE_KEY

echo "Applying database migrations. Review the migration first if this is a production project."
supabase db push

echo "Uploading the Edge Function secret."
supabase secrets set --env-file "$TMP_ENV"

echo "Deploying OU-KTV API."
supabase functions deploy ktv-api

echo "Done. Verify: https://$PROJECT_REF.supabase.co/functions/v1/ktv-api/config"
echo "The frontend still needs the Project URL and publishable/anon key configured as GitHub Actions variables."
