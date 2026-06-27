-- Add email_signature column to admin_gmail_accounts for per-inbox signatures
ALTER TABLE admin_gmail_accounts
ADD COLUMN IF NOT EXISTS email_signature text;
