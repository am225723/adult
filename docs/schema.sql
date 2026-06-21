-- ============================================================
-- Unified Workspace App — Schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Tables are ordered so foreign keys always reference a table
-- that already exists.
--
-- ⚠️ TODO: Row Level Security (RLS) is NOT included in this file.
-- Every table here is currently open to anyone holding your anon
-- key. Add RLS policies before this holds real data — see the
-- product plan, Section 10, for what those policies should do.
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ============ CORE ============

create table admin_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Mirrors Supabase's built-in auth.users — kept in sync via trigger below
create table admin_users (
  id uuid primary key,  -- matches auth.users.id
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table admin_workspace_members (
  workspace_id uuid references admin_workspaces(id),
  user_id uuid references admin_users(id),
  role text default 'member',
  primary key (workspace_id, user_id)
);

-- Auto-create an admin_users row whenever someone signs up via Supabase Auth
create function admin_handle_new_user()
returns trigger as $$
begin
  insert into admin_users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger admin_on_auth_user_created
  after insert on auth.users
  for each row execute procedure admin_handle_new_user();

-- ============ CONTACTS (mini-CRM) ============

create table admin_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  display_name text not null,
  company text,
  primary_email text,
  primary_phone text,
  tags text[],
  notes text,
  is_deleted boolean default false,  -- soft delete, see plan Section 9
  created_by uuid references admin_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table admin_contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references admin_contacts(id) on delete cascade,
  email text not null,
  label text
);

create table admin_contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references admin_contacts(id) on delete cascade,
  phone text not null,
  label text
);

-- ============ CALENDAR ============

create table admin_calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  user_id uuid references admin_users(id),
  provider text not null,                  -- 'google' | 'ical'
  external_account_email text,
  ical_feed_url text,
  access_token text,                       -- encrypt at rest before production use
  refresh_token text,                      -- encrypt at rest before production use
  token_expires_at timestamptz,
  sync_enabled boolean default true,
  last_synced_at timestamptz
);

create table admin_calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  calendar_account_id uuid references admin_calendar_accounts(id),
  external_event_id text,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  recurrence_rule text,
  source text not null,                    -- 'google' | 'ical' | 'app'
  is_read_only boolean default false,
  created_by uuid references admin_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table admin_event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references admin_calendar_events(id) on delete cascade,
  linked_type text not null,    -- 'contact' | 'task' | 'email' | 'message' | 'phone_call'
  linked_id uuid not null
);

-- ============ TASKS ============

create table admin_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  name text not null,
  color text,
  archived boolean default false,
  created_at timestamptz default now()
);

create table admin_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  project_id uuid references admin_projects(id),
  parent_task_id uuid references admin_tasks(id),
  title text not null,
  notes text,
  due_date timestamptz,
  priority text default 'none',     -- 'none' | 'low' | 'medium' | 'high'
  status text default 'open',       -- 'open' | 'completed'
  recurrence_rule text,
  tags text[],
  assigned_to uuid references admin_users(id),
  created_by uuid references admin_users(id),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table admin_task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references admin_tasks(id) on delete cascade,
  linked_type text not null,    -- 'contact' | 'event' | 'email' | 'message' | 'phone_call'
  linked_id uuid not null
);

-- ============ CHAT (internal) ============

create table admin_chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  title text,
  is_main_thread boolean default false,
  created_at timestamptz default now()
);

create table admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references admin_chat_threads(id) on delete cascade,
  sender_id uuid references admin_users(id),
  body text,
  attachment_url text,
  pinned boolean default false,
  created_at timestamptz default now()
);

create table admin_message_read_receipts (
  message_id uuid references admin_chat_messages(id) on delete cascade,
  user_id uuid references admin_users(id),
  read_at timestamptz default now(),
  primary key (message_id, user_id)
);

-- ============ EMAIL (Gmail) ============

create table admin_email_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  user_id uuid references admin_users(id),
  email_address text not null,
  access_token text,                -- encrypt at rest before production use
  refresh_token text,               -- encrypt at rest before production use
  token_expires_at timestamptz,
  last_synced_at timestamptz
);

create table admin_emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  email_account_id uuid references admin_email_accounts(id),
  gmail_thread_id text,
  gmail_message_id text,
  subject text,
  snippet text,
  from_address text,
  to_addresses text[],
  folder text,                      -- 'inbox' | 'sent' | 'drafts' | 'archived'
  is_flagged boolean default false,
  is_read boolean default true,
  received_at timestamptz,
  contact_id uuid references admin_contacts(id),
  created_at timestamptz default now()
);

create table admin_email_links (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references admin_emails(id) on delete cascade,
  linked_type text not null,   -- 'task' | 'event'
  linked_id uuid not null
);

-- ============ PHONE (Quo) ============

create table admin_phone_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  quo_account_id text not null,
  access_token text,                -- encrypt at rest before production use
  refresh_token text,               -- encrypt at rest before production use
  phone_number text,
  last_synced_at timestamptz
);

create table admin_phone_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  phone_account_id uuid references admin_phone_accounts(id),
  direction text,                   -- 'inbound' | 'outbound'
  status text,                      -- 'completed' | 'missed' | 'voicemail'
  contact_id uuid references admin_contacts(id),
  duration_seconds int,
  voicemail_url text,
  voicemail_transcript text,
  occurred_at timestamptz
);

create table admin_phone_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  phone_account_id uuid references admin_phone_accounts(id),
  direction text,
  contact_id uuid references admin_contacts(id),
  body text,
  is_read boolean default false,
  occurred_at timestamptz
);

-- ============ NOTIFICATIONS ============

create table admin_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  user_id uuid references admin_users(id),
  type text not null,         -- 'calendar' | 'task' | 'chat' | 'email' | 'phone'
  title text not null,
  body text,
  related_type text,
  related_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table admin_notification_preferences (
  user_id uuid references admin_users(id),
  category text not null,            -- 'calendar' | 'task' | 'chat' | 'email' | 'phone'
  enabled boolean default true,
  quiet_hours_start time,
  quiet_hours_end time,
  primary key (user_id, category)
);

-- ============ AI ============

create table admin_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  source_type text not null,     -- 'email_thread' | 'chat_thread' | 'contact' | 'daily_briefing'
  source_id uuid,
  summary_text text not null,
  generated_at timestamptz default now(),
  model_used text
);

-- ============ INTEGRATIONS ============

create table admin_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references admin_workspaces(id),
  user_id uuid references admin_users(id),
  provider text not null,        -- 'google_calendar' | 'gmail' | 'quo' | 'ical'
  status text default 'connected',  -- 'connected' | 'error' | 'disconnected'
  last_error text,
  connected_at timestamptz default now()
);

-- ============================================================
-- Seed: create your single shared workspace
-- (Run this once. Both users will be added to admin_workspace_members
-- manually after you both sign up, or via a small follow-up script.)
-- ============================================================

insert into admin_workspaces (name) values ('Us');
