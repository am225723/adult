# Google Calendar Integration — Setup Guide

## 1. Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project**
3. Name it (e.g., "Adulting App") → **Create**

## 2. Enable the Google Calendar API

1. In your project, go to **APIs & Services → Library**
2. Search for **Google Calendar API** → **Enable**
3. Also enable **Google People API** (for user email lookup)

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (since this is a private app, External works fine with test users)
3. Fill in required fields:
   - App name: `Adulting`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. **Scopes page**: click **Add or Remove Scopes**, add:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
6. Click **Save and Continue**
7. **Test users page**: add both users' Google email addresses
8. Click **Save and Continue** → **Back to Dashboard**

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Adulting Web`
5. **Authorized redirect URIs** — add:
   ```text
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/google-calendar-oauth
   ```
6. Click **Create**
7. Copy your **Client ID** and **Client Secret**

## 5. Generate the Token Encryption Key

Run this command to generate a random 32-byte key:

```bash
openssl rand -hex 32
```

Save the output — this is your `TOKEN_ENCRYPTION_KEY`.

## 6. Set Supabase Edge Function Secrets

In your Supabase project → **Edge Functions → Manage secrets**, add:

| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | The Client ID from step 4 |
| `GOOGLE_CLIENT_SECRET` | The Client Secret from step 4 |
| `TOKEN_ENCRYPTION_KEY` | The 32-byte hex string from step 5 |
| `APP_ORIGINS` | Comma-separated list of allowed app origins, e.g. `https://myapp.vercel.app,http://localhost:5173` |

Or via the Supabase CLI:
```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... TOKEN_ENCRYPTION_KEY=...
```

## 7. Verify

1. In the app, navigate to **Calendar**
2. Click **Connect Google Calendar**
3. Complete the Google OAuth flow
4. You'll be redirected back and events will begin syncing

## Notes

- The OAuth consent screen stays in "Testing" mode until you publish it. In Testing mode, only explicitly added test users can connect.
- Google push notification channels expire after 7 days. The sync function automatically renews them during each sync.
- If you need to disconnect and reconnect, simply click "Connect Google Calendar" again — it will overwrite the existing token.
