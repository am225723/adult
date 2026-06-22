# Gmail Integration — Setup Guide

This guide walks you through connecting Gmail to the Adulting app. The same Google Cloud project and OAuth credentials from the Calendar setup can be reused.

## 1. Add Gmail OAuth Redirect URI (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your existing "Adulting App" project
3. Go to **APIs & Services → Credentials**
4. Click on your existing "Adulting Web" OAuth 2.0 Client
5. Under **Authorized redirect URIs**, add:
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/google-gmail-oauth
   ```
6. Click **Save**

## 2. Enable Gmail API (if not already enabled)

1. In your Google Cloud project, go to **APIs & Services → Library**
2. Search for **Gmail API**
3. If not enabled, click **Enable**

## 3. Update OAuth Consent Screen Scopes

1. Go to **APIs & Services → OAuth consent screen**
2. Click **Edit App**
3. Go to **Scopes** step
4. Click **Add or Remove Scopes**
5. Add (if not already present):
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
6. Click **Save and Continue** → **Back to Dashboard**

## 4. Verify Environment Variables

Ensure these are already set in Supabase Edge Functions secrets (from Calendar setup):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `APP_ORIGINS`

No additional secrets are needed for Gmail — it uses the same credentials.

## 5. Deploy Gmail Edge Functions

Three new edge functions handle Gmail OAuth, sync, and push notifications:

```bash
supabase functions deploy google-gmail-oauth --no-verify-jwt
supabase functions deploy google-gmail-sync --no-verify-jwt
supabase functions deploy google-gmail-push --no-verify-jwt
```

## 6. Run Database Migration

Apply the migration to create Gmail tables:

```bash
supabase db push
```

This creates:
- `admin_gmail_accounts` — stored encrypted tokens and sync metadata
- `admin_emails` — cached email messages with RLS scoped to workspace

## 7. Verify in the App

1. Navigate to **Mail** in the sidebar
2. Click **Connect Gmail**
3. Authenticate with Google
4. Your emails will begin syncing (last 50 inbox messages)
5. Use the tabs to filter: Inbox, Unread, Starred, All

## Notes

- Gmail sync is read-only in this initial version (no send/draft/delete yet)
- Push notifications use Google's webhook API to trigger incremental sync when new mail arrives
- Emails are cached in `admin_emails` for full-text search and offline access (see Phase 3+)
- The same `APP_ORIGINS` allowlist from Calendar applies to Gmail OAuth

## Troubleshooting

**"Connection failed" after clicking Connect Gmail**
- Verify the Gmail redirect URI is exactly as shown above (with your project ref)
- Check that Gmail API is enabled in Google Cloud Console

**No emails showing after connect**
- Click the sync button (⟳) in the Mail toolbar
- Check Supabase edge function logs: **Edge Functions → google-gmail-sync → Logs**

**Emails not updating automatically**
- Push channels require a valid HTTPS URL; ensure `APP_ORIGINS` includes your production domain
- Check logs for `google-gmail-push` function
