# Unified Workspace App — Product Plan & Technical Specification

**Prepared for:** 2-person founding team (you + business partner)
**Scope:** Calendar + Tasks + Internal Chat + Gmail + Quo phone/SMS + Contacts (mini-CRM) + AI, cross-platform

---

## 0. Reading This Document — Key Decisions Already Locked

Before anything else, here's what your answers locked in, because they change the architecture materially from a "build everything" version of this app:

| Decision | Your Answer | Why It Matters |
|---|---|---|
| Users | You + business partner (2 people) | No multi-tenant org system needed for MVP. No admin/roles complexity. No invite flows, billing, or seat management. |
| Chat scope | Internal only (you two) | No external messaging protocol needed. This is the single biggest scope reducer in the whole spec — "chat" becomes a simple two-person message log, not a federated messaging system. |
| Platform strategy | Shared web core + native wrappers | One React/TypeScript codebase. Electron for Mac/Windows, Capacitor for iOS/Android. Big velocity win, with known trade-offs (below). |
| Backend | Managed BaaS (Supabase) | No backend team needed. Postgres, Auth, Realtime, Storage, and Edge Functions all come from one vendor. |
| Calendar | Google Calendar + iCal (read-only subscription) | Google gets full read/write via API. iCal is subscribe-only (.ics feed) — this is a hard technical distinction explained in Section 6. |
| Email | Gmail only | Single OAuth integration, single API surface (Gmail API). |
| Phone/SMS | Quo, as a connected account via Quo's API | We are a consumer of Quo's API, not a phone carrier. Massively reduces complexity and avoids telecom compliance burden. |
| Realtime | Supabase Realtime (Postgres-native) | No separate WebSocket service to build or run. |
| AI | "LLM, or free options" | I'm recommending a specific, concrete default in Section 5 — see that section, this needs your sign-off since "free" and "good" pull in different directions. |
| Timeline | "Today" | Interpreted as: you want the finished plan now, not a 4-month roadmap before you can start. The MVP itself is scoped to be buildable by 2 people in **4-6 weeks** of focused work, not months. |

One thing I want to flag plainly, as a senior architect would in a real planning session: **the original brief described a 4-platform, multi-tenant, CRM+Slack+Superhuman+OpenPhone hybrid.** That is a 12-18 month build for a funded team of 6-10 engineers. Your actual answers describe something much smaller and much more achievable: **a shared two-person command center.** I'm planning for the thing you actually described in your answers, not the thing in the original headline brief. The roadmap shows how it grows toward the bigger vision over time, but the MVP is sized for reality.

---

## 1. Product Concept & Summary

**What it is:** A single shared workspace where you and your business partner manage your calendar, tasks, internal communication, Gmail, and Quo phone/SMS — with every contact, conversation, task, and event cross-linked, and a lightweight AI layer that summarizes and suggests rather than auto-acts.

**What it is not (for now):** A multi-tenant SaaS product, an external messaging platform, a CRM for hundreds of contacts, or a system that needs enterprise auth, billing, or admin roles.

**The core insight that makes this different from "just use 5 apps":** Right now you're context-switching between Google Calendar, a task app, Gmail, Slack/iMessage, and Quo, and the connections between them live only in your head ("that email turned into that task which is related to that call with that contact"). This app's actual value is the **linking layer** — every object (event, task, email, message, call) can reference a Contact and other objects, and the Contact page becomes a single timeline of everything related to that person or company. That linking layer is the product. Everything else is "calendar app" / "task app" / "inbox" done competently.

**Design tone:** Calm, fast, minimal. Not playful. Closer to Things 3 or Linear than to Notion's flexibility-as-feature or Slack's density.

---

## 2. The Simplest Realistic MVP

This is the version that proves the concept and that you'll actually use daily within weeks, not months.

### MVP includes:
1. **Auth** — Supabase email/password + Google OAuth login, 2 users only (you + partner), shared workspace (no org/team model needed — just a single shared Postgres schema both accounts read/write).
2. **Calendar** — Google Calendar two-way sync (read/write/delete), iCal feed subscription (read-only), day/week/month/agenda views, create/edit/delete events, recurring events, conflict detection (visual overlap warning only, not auto-resolution).
3. **Tasks** — Tasks, subtasks, due dates, priority, tags, projects. Today / Upcoming / Overdue / Completed / By Project views. Quick-capture (single input, parses nothing fancy yet — see AI section for natural language in V2).
4. **Internal Chat** — 1:1 channel between you and your partner (it's just two people, so no "create a channel" UI needed — there's exactly one shared thread, plus the ability to create *topic threads* if you want lightweight organization). Read receipts, file sharing, message search.
5. **Gmail** — Connect one Gmail account each (each user connects their own). Inbox/Sent/Drafts/Flagged views. Compose, reply, forward, search. "Convert to task" and "convert to event" actions. Link an email to a Contact (auto-suggested by sender address, confirmable).
6. **Quo Integration** — Connect your Quo account. View calls, texts, voicemails inside the app. Send/receive SMS via Quo's API. Missed call / voicemail / unread text indicators. Link calls/texts to a Contact.
7. **Contacts** — Central contact record per person/business. Unified timeline of every linked email, message, call, text, event, and task touching that contact. Quick actions (email, text, call, schedule, new task).
8. **Notifications** — In-app + desktop push (via Electron) + mobile push (via Capacitor/FCM/APNs). One unified notification feed. Basic quiet hours.
9. **Dashboard ("Today" view)** — Today's schedule, top tasks, recent messages, priority inbox preview, missed calls/voicemails — single landing screen.
10. **Dark/light mode.**

### MVP explicitly excludes (pushed to V2+):
- Mobile/lock-screen widgets (needs native platform work that's wasted effort before the core product is validated)
- AI features beyond a clearly-scoped V1.5 add-on (see Section 5 — I'm separating "AI in MVP" from "AI in the full vision" because your AI answer needs a decision)
- Multi-user/team beyond the 2 of you, invite flows, roles/permissions
- Outlook/Microsoft 365 (calendar or email)
- Offline-first conflict resolution (MVP requires connectivity; basic local caching only)
- External chat (texting/chatting with people outside the 2 of you, beyond what Quo SMS + Gmail already cover)
- Smart/escalating notifications, AI-drafted replies, AI daily briefing

**Why this is the right MVP cut:** every excluded item either (a) requires significant native platform engineering with no architectural payoff until the core app is proven (widgets), (b) requires a product decision from you first (AI provider/budget), or (c) is genuinely a "nice to have" that doesn't change whether you use this app daily (Outlook, offline-first).

---

## 3. Full Feature Roadmap

### MVP (Weeks 1-6)
Everything in Section 2.

### Version 2 (Months 2-4 post-MVP)
- AI Assistant v1: email/thread summarization, task suggestion from email, natural-language event creation ("lunch with Sarah Thursday at noon"), daily briefing (generated each morning, you review, nothing auto-sent)
- Mobile home screen widgets (iOS + Android): today's schedule, top 3 tasks, unread count
- Outlook/Microsoft 365 calendar + email support
- Recurring task templates, checklists
- Focus Mode (curated "today's 3 things" view, distraction suppression)
- Smarter notification rules (per-conversation, per-project)
- Offline support — local-first caching with conflict resolution on reconnect

### Version 3 (Months 4-8 post-MVP)
- Lock screen widgets (iOS 16+ / Android equivalents)
- AI: detect schedule conflicts proactively, recommend follow-ups, turn calls/emails into action items automatically (proposed, not auto-applied)
- Communication timeline polish: full per-contact relationship history with filters
- Multi-calendar support (more than 2 calendar accounts)
- Custom contact fields, contact tagging system
- Voicemail transcription (via Quo if available, or a transcription API)

### Advanced / Future
- True multi-tenant support if you ever want to bring on more team members or sell this as a product
- External chat (becoming an actual messaging platform, not just internal)
- Encrypted-at-rest sensitive fields, granular permission system
- Apple Calendar native two-way sync (not just iCal subscription) — requires CalDAV write support, meaningfully harder than Google's REST API
- Admin/roles, billing, invite flows — **only relevant if this becomes a multi-customer product**

---

## 4. Recommended Cross-Platform Architecture

### High-level shape
```
                        ┌─────────────────────────┐
                        │   Supabase (BaaS)        │
                        │  - Postgres DB            │
                        │  - Auth                   │
                        │  - Realtime (WS)          │
                        │  - Storage (files/images) │
                        │  - Edge Functions (Deno)  │
                        └────────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
          ┌─────────▼──────┐ ┌──────▼───────┐ ┌───────▼────────┐
          │ Edge Functions   │ │ Edge Functions│ │ Edge Functions  │
          │ Google Cal sync  │ │ Gmail sync     │ │ Quo webhook recv│
          └──────────────────┘ └────────────────┘ └─────────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │   Shared React Web Core   │
                        │   (TypeScript, Vite)       │
                        └────────────┬───────────────┘
                    ┌────────────────┼────────────────┐
            ┌───────▼──────┐ ┌───────▼───────┐ ┌───────▼────────┐
            │  Electron     │ │  Capacitor     │ │  Capacitor      │
            │  (macOS/Win)  │ │  (iOS)         │ │  (Android)      │
            └───────────────┘ └────────────────┘ └─────────────────┘
```

### Why this shape
- **One React codebase, three shells.** You write the UI once. Electron wraps it for desktop with native menu bar / notifications / dock badge access. Capacitor wraps it for mobile with native plugin access (push notifications, camera, etc.) while still rendering the same React app in a native WebView.
- **Supabase as the entire backend.** Postgres gives you a real relational database (important — this app is fundamentally relational: contacts link to everything). Supabase Auth handles login. Supabase Realtime gives you live sync across devices for free using Postgres logical replication — when one device writes a row, every subscribed client gets the update over a WebSocket, no custom sync engine needed. Supabase Storage holds file attachments. Supabase Edge Functions (server-side TypeScript/Deno) handle anything that needs a secret API key or scheduled job — OAuth token refresh, Google Calendar sync, Gmail sync, Quo webhook receivers.
- **Edge Functions are your only "real backend" code**, and they're small, focused, and serverless — no servers to provision or manage.

### Honest trade-offs of this approach (you should know these going in)

**Electron trade-offs:**
- Pro: full native menu, system tray, dock badges, native notifications, auto-updater all well-supported.
- Con: bigger app bundle size (~150-200MB) than a fully native Mac/Windows app, and it's running a Chromium instance per app — not the leanest possible resource usage. For a 2-person internal tool, this doesn't matter. If you later sell this as a premium product where every MB and millisecond of startup is scrutinized, you'd reconsider.

**Capacitor trade-offs:**
- Pro: same React code runs on iOS/Android, native plugin bridge gives you real push notifications, real camera/file access, etc.
- Con: **this is the one place where your stated goal ("modern, polished, premium, fast") and the architecture choice are in the most tension.** A WebView-based mobile app, even a very well-built one, will not feel as fluid as a fully native SwiftUI/Jetpack Compose app — scrolling physics, animations, and gesture responsiveness are noticeably different to a careful user. For an internal 2-person tool, this is the right trade (you get 1 codebase instead of 3). If this product later needs to feel "Superhuman-level premium" on mobile specifically, the honest long-term path is rebuilding the mobile clients natively while keeping the Supabase backend. I'd rather tell you that now than have you discover it in month 8.
- **Widgets are the other place this bites**: iOS/Android home screen and lock screen widgets are *native-only* — there is no way to build a widget inside a Capacitor WebView. Widgets must be built as small native Swift/Kotlin extensions that read from local storage/an API directly. This is why Section 3 pushes widgets to V2/V3: they're a separate, small native build, not a CSS/HTML task, regardless of which mobile strategy you pick.

### Data flow examples (concrete, so this isn't abstract)
- **Creating a task:** React app writes a row to `tasks` table via Supabase client SDK → Postgres commits → Realtime pushes the change to your partner's open session → their UI updates with no manual refresh, no polling.
- **Google Calendar sync:** An Edge Function runs on a schedule (e.g., every 5 min) and/or via Google push notifications (webhook), pulls changed events via the Google Calendar API, upserts them into your `calendar_events` table tagged with `source = 'google'`. The app never talks to Google directly from the client — this keeps your Google API credentials server-side only.
- **Quo SMS received:** Quo sends a webhook to a Supabase Edge Function endpoint → function verifies signature, writes the message to `phone_messages`, links to a Contact by phone number match → Realtime pushes to your open clients → notification fires.

---

## 5. Tech Stack Recommendation

| Layer | Recommendation | Why |
|---|---|---|
| Frontend framework | React + TypeScript + Vite | Fast dev loop, huge ecosystem, works in Electron and Capacitor identically |
| UI components | Tailwind CSS + shadcn/ui (Radix-based) | Gets you to "polished, modern" fast without a heavy design system to maintain; fully customizable, not a generic look if styled with intent (see frontend design notes you can apply during build) |
| State/data layer | TanStack Query (React Query) + Supabase client | React Query handles caching/loading/error states cleanly; pairs naturally with Supabase's realtime subscriptions |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | Matches your "managed/BaaS, move fast" answer directly |
| Desktop shell | Electron | Mature, best native OS integration of the mobile-wrapper options |
| Mobile shell | Capacitor | Best-in-class for "ship the same React app to iOS/Android with real native plugin access" |
| Calendar API | Google Calendar API v3 | Direct REST API, well documented, supports push notifications for near-real-time sync |
| iCal | `ical.js` or `node-ical` to parse subscribed `.ics` feeds | Read-only by nature — iCal subscription feeds are not a two-way protocol |
| Email API | Gmail API | OAuth2, supports read/send/labels/threads natively |
| Phone/SMS | Quo API (their MCP/REST surface) | You're already using Quo's MCP connector in this very conversation context, which confirms they expose a usable API surface for this purpose |
| Push notifications | Firebase Cloud Messaging (Android + web push) + Apple Push Notification service (iOS, via Capacitor plugin) | Standard, free, well-supported by Capacitor |
| AI | See dedicated callout below | Needs your decision |

### AI provider — this needs a decision from you, flagged explicitly

You said "LLM, or other free options," which I want to be straightforward about: there isn't a free option that's also genuinely good for the kind of summarization/drafting/reasoning tasks in Section's AI feature list (email summarization, drafting replies, daily briefings). The realistic choices are:

1. **Anthropic Claude API (paid, usage-based)** — Best fit if you want quality and you're already in the Claude ecosystem (this plan itself was built with Claude). Cost is low at 2-person usage volume — likely **single-digit dollars per month** for daily summarization/drafting use, not a meaningful budget line.
2. **OpenAI API (paid, usage-based)** — Comparable cost and quality tier to Claude for this use case.
3. **Open-source self-hosted model** (e.g., Llama-family via a hosted inference provider like Groq/Together, or genuinely free if self-hosted on your own hardware) — "free" only if you self-host, which means you're now running and maintaining inference infrastructure, which contradicts the "move fast with BaaS" decision you made everywhere else. Quality on summarization/drafting tasks is usable but noticeably behind Claude/OpenAI's frontier models.

**My recommendation:** Use the Anthropic Claude API with a small/cheap model (e.g., Claude Haiku tier) for the MVP-adjacent AI features in V2. At 2-user scale, the monthly cost will be trivial, and you avoid burning engineering time on self-hosting inference. If budget is a genuine hard constraint (not just a preference), say so and I'll re-scope the AI section around a self-hosted open model instead — but I'd rather flag the real trade-off than guess.

---
## 6. Database Schema / Data Model

Postgres, via Supabase. Two users only, so no `organizations`/`teams` table is needed for MVP — but I'm including a lightweight `workspace_id` concept on every table now, set to a single hardcoded workspace, so that growing to multi-team later (Advanced/Future section) doesn't require a painful migration. This is the one piece of "build for the future" I'm recommending even though it's not strictly needed today, because retrofitting multi-tenancy into a schema that was never designed for it is genuinely painful, while adding the column now costs nothing.

```sql
-- ============ CORE ============

users (
  id uuid primary key,              -- maps to Supabase auth.users.id
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
)

workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- e.g. "Us" — single row for MVP
  created_at timestamptz default now()
)

workspace_members (
  workspace_id uuid references workspaces(id),
  user_id uuid references users(id),
  role text default 'member',       -- unused logic in MVP, present for future
  primary key (workspace_id, user_id)
)

-- ============ CONTACTS (mini-CRM) ============

contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  display_name text not null,
  company text,
  primary_email text,
  primary_phone text,
  tags text[],                      -- simple tag array, sufficient at this scale
  notes text,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

contact_emails (   -- a contact can have multiple emails
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  email text not null,
  label text                        -- 'work', 'personal', etc
)

contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  phone text not null,
  label text
)

-- ============ CALENDAR ============

calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references users(id),       -- whose Google account this is
  provider text not null,                  -- 'google' | 'ical'
  external_account_email text,
  ical_feed_url text,                      -- only set when provider = 'ical'
  access_token text,                       -- encrypted at rest (see Security section)
  refresh_token text,                      -- encrypted at rest
  token_expires_at timestamptz,
  sync_enabled boolean default true,
  last_synced_at timestamptz
)

calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  calendar_account_id uuid references calendar_accounts(id),
  external_event_id text,                  -- Google's event ID, for sync matching
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  recurrence_rule text,                    -- iCal RRULE string, standard format
  source text not null,                    -- 'google' | 'ical' | 'app' (created in-app)
  is_read_only boolean default false,      -- true for ical-sourced events
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

event_links (    -- polymorphic linking table, used across the whole app
  id uuid primary key default gen_random_uuid(),
  event_id uuid references calendar_events(id) on delete cascade,
  linked_type text not null,    -- 'contact' | 'task' | 'email' | 'message' | 'phone_call'
  linked_id uuid not null
)

-- ============ TASKS ============

projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  name text not null,
  color text,
  archived boolean default false,
  created_at timestamptz default now()
)

tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  project_id uuid references projects(id),
  parent_task_id uuid references tasks(id),   -- for subtasks
  title text not null,
  notes text,
  due_date timestamptz,
  priority text default 'none',     -- 'none' | 'low' | 'medium' | 'high'
  status text default 'open',       -- 'open' | 'completed'
  recurrence_rule text,
  tags text[],
  assigned_to uuid references users(id),
  created_by uuid references users(id),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  linked_type text not null,    -- 'contact' | 'event' | 'email' | 'message' | 'phone_call'
  linked_id uuid not null
)

-- ============ CHAT (internal, 2-person) ============

chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  title text,                       -- optional, for topic threads; null = main thread
  is_main_thread boolean default false,
  created_at timestamptz default now()
)

chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads(id) on delete cascade,
  sender_id uuid references users(id),
  body text,
  attachment_url text,               -- points to Supabase Storage
  pinned boolean default false,
  created_at timestamptz default now()
)

message_read_receipts (
  message_id uuid references chat_messages(id) on delete cascade,
  user_id uuid references users(id),
  read_at timestamptz default now(),
  primary key (message_id, user_id)
)

-- ============ EMAIL (Gmail) ============

email_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references users(id),
  email_address text not null,
  access_token text,                -- encrypted
  refresh_token text,               -- encrypted
  token_expires_at timestamptz,
  last_synced_at timestamptz
)

emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  email_account_id uuid references email_accounts(id),
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
  contact_id uuid references contacts(id),   -- linked contact, auto-suggested
  created_at timestamptz default now()
)

email_links (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete cascade,
  linked_type text not null,   -- 'task' | 'event'
  linked_id uuid not null
)

-- ============ PHONE (Quo) ============

phone_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  quo_account_id text not null,
  access_token text,                -- encrypted
  refresh_token text,               -- encrypted
  phone_number text,
  last_synced_at timestamptz
)

phone_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  phone_account_id uuid references phone_accounts(id),
  direction text,                   -- 'inbound' | 'outbound'
  status text,                      -- 'completed' | 'missed' | 'voicemail'
  contact_id uuid references contacts(id),
  duration_seconds int,
  voicemail_url text,
  voicemail_transcript text,        -- populated in V3
  occurred_at timestamptz
)

phone_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  phone_account_id uuid references phone_accounts(id),
  direction text,
  contact_id uuid references contacts(id),
  body text,
  is_read boolean default false,
  occurred_at timestamptz
)

-- ============ NOTIFICATIONS ============

notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references users(id),       -- recipient
  type text not null,         -- 'calendar' | 'task' | 'chat' | 'email' | 'phone'
  title text not null,
  body text,
  related_type text,          -- polymorphic ref, same pattern as *_links tables
  related_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
)

notification_preferences (
  user_id uuid references users(id),
  category text not null,            -- 'calendar' | 'task' | 'chat' | 'email' | 'phone'
  enabled boolean default true,
  quiet_hours_start time,
  quiet_hours_end time,
  primary key (user_id, category)
)

-- ============ AI ============

ai_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  source_type text not null,     -- 'email_thread' | 'chat_thread' | 'contact' | 'daily_briefing'
  source_id uuid,                -- null for daily_briefing (it's not tied to one object)
  summary_text text not null,
  generated_at timestamptz default now(),
  model_used text                -- e.g. 'claude-haiku-4-5'
)

-- ============ INTEGRATIONS (generic connection registry) ============

integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references users(id),
  provider text not null,        -- 'google_calendar' | 'gmail' | 'quo' | 'ical'
  status text default 'connected',  -- 'connected' | 'error' | 'disconnected'
  last_error text,
  connected_at timestamptz default now()
)
```

**Design notes on the schema:**
- The `*_links` tables (`event_links`, `task_links`, `email_links`) implement the "everything connects to everything" requirement without needing a separate join table for every possible pairing (event↔task, event↔contact, task↔email, etc.) — a single polymorphic link table per "owning" object keeps this manageable. The trade-off is you lose a foreign-key constraint on `linked_id` (Postgres can't enforce "this id exists in one of 5 possible tables"), so referential integrity for these links is enforced in application code / Edge Functions, not the database. This is a standard, accepted trade-off for this pattern.
- `contacts` are the hub. Every other domain table (`calendar_events` via `event_links`, `tasks` via `task_links`, `emails`, `phone_calls`, `phone_messages`) can point back to a contact, which is what makes the "unified contact timeline" feature a single query (`select * from emails where contact_id = X union ... `) rather than a complex aggregation.
- Tokens (`access_token`, `refresh_token` columns) are marked for encryption — see Security section.

---

## 7. API Integration Plan

| Integration | Auth method | Sync pattern | Key constraint to know |
|---|---|---|---|
| **Google Calendar** | OAuth 2.0 (offline access, refresh token) | Two-way. Use Google's `watch` endpoint for push notifications on changes where possible, plus a periodic polling Edge Function (every 5 min) as a fallback/reconciliation pass | Google API quotas are generous for this usage scale; not a concern at 2 users |
| **iCal (.ics feeds)** | None — public or token-bearing URL | One-way pull only, polling Edge Function fetches and parses the feed on a schedule (e.g. hourly) | This is fundamentally read-only. iCal subscription is a static file format, not an API — there is no "write back" concept. Set user expectations clearly in the UI (e.g., a lock icon on these events) |
| **Gmail** | OAuth 2.0 | Two-way (read inbox, send mail) via Gmail API. Use `history.list` for efficient incremental sync rather than re-pulling the whole inbox each time | Gmail API has per-user rate limits that are generous for 1-2 accounts; sending mail requires `gmail.send` scope specifically, separate from read scope — request both explicitly during OAuth consent |
| **Quo** | OAuth or API key (per Quo's developer docs at time of build — confirm exact flow when you connect, as this evolves) | Webhook-driven for incoming calls/texts (push), REST calls for outbound send and historical pull | You're a connected-account consumer of Quo's API, not building your own telephony — this is the right call for an MVP, since Twilio-style "build your own phone system" adds carrier compliance overhead with no benefit at your scale |
| **Push notifications** | FCM (Android + web), APNs (iOS via Capacitor) | Server-initiated push from an Edge Function whenever a `notifications` row is created | Standard pattern, well documented in Capacitor's push notification plugin docs |
| **AI Assistant** | API key (Anthropic or OpenAI, server-side only) | Request/response from an Edge Function — never call the AI API directly from the client, to keep the key secret and so you can apply consistent prompt templates and guardrails server-side | Cost-control note: cache/dedupe summarization requests (e.g., don't re-summarize an email thread that hasn't changed since the last summary) |

**General integration principle:** every third-party API call that requires a secret (API key, OAuth client secret) happens in a Supabase Edge Function, never in the React client. The client only ever talks to Supabase directly (via the public anon key, protected by Row Level Security) or to Edge Functions (which then talk outward).

---

## 8. UX/UI Layout Plan

### Dashboard ("Today")
Single-column on mobile, 2-3 column on desktop. Top: today's date + greeting. Then in priority order: **Next event** (large, prominent — this is the single most time-sensitive thing), **Top 3 tasks** (Focus Mode preview), **Unread/priority inbox count**, **Recent chat activity**, **Missed calls/voicemails badge**. Everything here is a summary card that deep-links to its full view — the dashboard itself stays light and fast.

### Calendar View
Standard agenda/day/week/month toggle (top tab bar). Each event, when expanded, shows linked items (contact chip, task chip, email chip) inline — this is where the "connects to everything" requirement becomes visible and useful, not just a database feature. Conflict warnings render as a subtle red side-bar on overlapping event blocks, not a blocking modal — you stay in control, the app just flags it.

### Task View
Left sidebar: Today / Upcoming / Overdue / Completed / Projects list. Main pane: flat list grouped by due date within the selected view, checkbox to complete, priority shown as a small color dot (not heavy iconography — keeps it calm per your "clean, premium" direction). Quick-capture is a persistent input at the top, always one click/tap away.

### Chat View
Given it's only the 2 of you, this is intentionally simple: main thread is the default view, with topic threads as a secondary list if you create any. No channel-browsing UI needed — that complexity belongs to team chat tools with many channels, not a 2-person thread.

### Email View
Familiar 3-pane layout on desktop (folder list / message list / reading pane), collapsing to 2-pane then 1-pane responsively on mobile. "Convert to task" and "convert to event" appear as explicit buttons in the message toolbar, not buried in a menu — these are core actions per your spec, so they should be visually first-class.

### Contact Profile
Header: name, company, quick-action row (email / text / call / schedule / new task icons). Below: a single reverse-chronological timeline mixing every linked object type (color-coded by type: email, chat, call, text, event, task) — this is the page that makes the "personal CRM" framing real.

### Widget Views (V2/V3, native)
- Small: next event only, or top task only
- Medium: today's schedule (3-4 items) or top 3 tasks
- Large: combined schedule + tasks + unread badges
Lock screen (iOS): minimal — next event time + title, or unread count badge only; iOS lock screen widgets have very tight space/format constraints (single accent color, no images), so design these last, after you know exactly what data matters most in a glance.

### Mobile vs. Desktop philosophy
Mobile-first means: design every screen for the smallest viewport first, then progressively add panes/columns as space allows on desktop. Desktop should never feel like "mobile app stretched wide" — at minimum, the Calendar, Email, and Contact views should use the extra desktop width for genuinely useful multi-pane layouts, not just wider margins.

---

## 9. Edge Cases & Failure States to Account For

**Sync & integration failures:**
- Google/Gmail OAuth token expires or is revoked externally (user removes app access in their Google account) → integration status flips to `error` in the `integrations` table, UI shows a clear "reconnect" prompt on the relevant view, not a silent failure.
- iCal feed URL goes stale/404s → same pattern, surfaced clearly, doesn't crash calendar rendering for other sources.
- Quo webhook delivery fails or is delayed → reconcile with a periodic pull as backup, same pattern as Google Calendar's push+poll hybrid.
- Two devices edit the same task/event simultaneously → Supabase Realtime + Postgres `updated_at` last-write-wins is the pragmatic MVP approach; for 2 users this collision is rare enough not to need a full conflict-resolution UI yet (explicitly deferred to V2 "offline support" work).

**Data edge cases:**
- Email or phone number doesn't match an existing contact → don't auto-create a contact silently; show an "add as new contact?" prompt so your contact list doesn't fill with noise.
- Recurring event/task edited "this one only" vs "all future" → standard recurrence-exception pattern, needs explicit UI choice at edit time (this is one of the genuinely fiddly parts of calendar UX — budget real time for it).
- Deleted contact with linked history → soft-delete contacts (status flag, not hard delete) so linked emails/calls/events don't end up pointing at nothing.

**Notification edge cases:**
- Same event triggers multiple notification sources (e.g., Google's own notification + this app's) → since you're pulling from Google rather than fully replacing it, expect some double-notification risk initially; quiet-hours and a "disable Google's native notifications, use ours only" recommendation in onboarding helps.
- Quiet hours during an actually urgent missed call → MVP doesn't need smart escalation (that's V2+), but quiet hours should have a manual "do not disturb override" toggle visible at all times.

**Auth/access:**
- One partner revokes/loses access to their Google or Quo account → only their connected data integration breaks, not the shared workspace; the other partner's connections keep working independently.

---

## 10. Security & Privacy Considerations

- **OAuth tokens encrypted at rest.** Supabase Postgres supports column-level encryption (via `pgsodium` or application-level encryption before insert) — access/refresh tokens for Google, Gmail, and Quo should never sit in plaintext in the database.
- **Row Level Security (RLS) on every table.** Supabase's RLS policies should restrict every table to `workspace_id` membership — even though it's just the 2 of you, this is what stops a bug in the client code from being a data leak, and it's table stakes for ever growing beyond 2 users.
- **Server-side-only secrets.** All third-party API keys (AI provider, Quo, Google OAuth client secret) live only in Supabase Edge Function environment variables, never shipped to the client bundle.
- **Webhook signature verification.** Quo (and Google push notifications) should be verified via their signature/token scheme in the receiving Edge Function — don't trust an unverified POST request as truth.
- **Minimum necessary OAuth scopes.** Request only the specific Gmail/Calendar scopes needed (e.g., `gmail.readonly` + `gmail.send`, not the broad `mail.google.com` scope) — smaller blast radius if a token is ever compromised.
- **AI consent and control.** Per your spec: AI should summarize/suggest, never auto-send/auto-schedule/auto-delete. Concretely: AI-drafted email replies land in Drafts, not Sent. AI-suggested events/tasks require a confirm tap. This should be a hard rule in the Edge Function logic, not just a UI convention — the function that calls the AI API for "draft a reply" should return a draft object, full stop, never call `gmail.send` itself.
- **Local device storage.** Whatever gets cached locally on mobile (for offline support, in V2) should be encrypted using the platform's secure storage (iOS Keychain / Android Keystore via a Capacitor plugin), not plain localStorage/SQLite.

---

## 11. Development Plan — Phases

**Phase 0 (pre-build, ~3-5 days):** Finalize answers to the open clarifying questions in Section 13. Set up Supabase project, repo, CI skeleton, Google Cloud project (for Calendar + Gmail OAuth credentials), Quo developer access.

**Phase 1 — Foundation (Week 1):** Auth (Supabase email/password + Google OAuth login), base schema migration, shared React app shell with routing and the design system (Tailwind + shadcn/ui base components), dashboard skeleton.

**Phase 2 — Calendar + Tasks (Weeks 2-3):** Google Calendar OAuth + sync Edge Function, calendar views (day/week/month/agenda), event CRUD, iCal subscription parsing, full Task system (CRUD, subtasks, projects, views).

**Phase 3 — Contacts + Linking (Week 3-4):** Contact CRUD, the polymorphic link tables wired into Calendar and Task UIs (link an event/task to a contact from their respective detail views), Contact timeline view (initially just showing linked events/tasks, since email/chat/phone aren't built yet).

**Phase 4 — Chat (Week 4):** Internal chat (main thread + optional topic threads), Realtime wiring, read receipts, file attachments via Supabase Storage.

**Phase 5 — Gmail (Week 4-5):** Gmail OAuth, inbox/sent/drafts sync Edge Function, compose/reply/forward, convert-to-task/convert-to-event actions, contact auto-linking by sender.

**Phase 6 — Quo (Week 5-6):** Quo OAuth/API connection, webhook receiver Edge Function for inbound calls/texts, outbound SMS send, voicemail display, contact auto-linking by phone number.

**Phase 7 — Notifications + Polish (Week 6):** Unified notification feed, push notification wiring (FCM/APNs), quiet hours, dark/light mode pass, empty states, error states, loading states across every view.

**Phase 8 — Package & Ship (end of Week 6):** Electron build for Mac/Windows, Capacitor build for iOS/Android, internal distribution (TestFlight for iOS, direct APK/signed builds for the rest) — this is "ship to the 2 of you," not an App Store launch, which avoids App Store review timelines from blocking your MVP date.

This is an aggressive but realistic 6-week timeline for 2 builders if both of you are writing code; if only one of you is building while the other uses/tests the product, expect 8-10 weeks for the same scope.

---

## 12. First 10 Screens to Design

1. Login / Auth screen
2. Dashboard ("Today" view)
3. Calendar — Week view (the default/most-used calendar view)
4. Calendar — Event detail/edit modal (including the link-to-contact/task UI)
5. Tasks — Today view (with quick-capture)
6. Task detail (with subtasks and linking UI)
7. Contact profile (the unified timeline — arguably your highest-value, most novel screen, worth extra design attention)
8. Chat — main thread
9. Email — inbox (3-pane desktop layout)
10. Settings / Integrations (where you connect Google, Gmail, Quo, and see connection health) — easy to deprioritize visually but it's the screen you'll actually open first when something breaks, so don't leave it for last in the build order even if it's last in the "exciting features" list

---

## 13. Clarifying Questions to Answer Before Building

A few real open items remain — these are worth deciding before Phase 1 starts, but none of them block this plan:

1. **AI provider & budget** — Confirm Claude vs. OpenAI vs. self-hosted (see Section 5 callout). This affects whether V2 AI work starts immediately after MVP or needs a budget conversation first.
2. **Quo API access** — Do you currently have Quo API/developer credentials, or does that need to be requested from Quo first? This can be a lead-time item outside your control.
3. **Domain/hosting for the web build** — Even with Electron/Capacitor wrapping it, you'll likely want the React app also reachable as a plain web app (e.g., for quick access without installing). Do you want that in MVP or is "installed app only" fine initially?
4. **Design system depth** — Are you open to using shadcn/ui's default component look with custom theming (faster), or do you want a fully custom design pass from day one (slower, more "premium" out of the gate)?
5. **iCal source** — Whose calendar is the iCal feed (e.g., a shared family calendar, a read-only company calendar)? This affects whether it needs to show up as "informational only" vs. something you'd ever want to act on.
6. **Distribution** — Is "install via TestFlight / sideload" acceptable indefinitely, or do you eventually want this on the public App Store / Microsoft Store / Mac App Store (which adds review process, signing requirements, and possibly App Store policy constraints around things like the AI features)?

---

## 14. Investor-Style Product Description

*(Provided per your request — useful even though the current scope is a 2-person internal tool, in case this evolves into something you'd pitch later.)*

**[Working Name] is the command center for people who run their work from five different apps and shouldn't have to.**

Knowledge workers and small business operators today fragment their day across a calendar app, a task manager, a messaging tool, an inbox, and a business phone line — with no system connecting them. The result isn't just inefficiency; it's lost context. An email becomes a task becomes a meeting becomes a phone call, and the thread connecting them lives only in someone's memory.

[Working Name] unifies calendar, tasks, internal communication, email, and business phone/SMS into a single workspace — built around a simple but powerful idea: **every piece of communication and work should be able to point back to who it's about.** A contact isn't just a name and a phone number; it's a living timeline of every email, call, text, meeting, and task connected to that relationship.

Built cross-platform from a single codebase (desktop and mobile), backed by a modern serverless architecture that scales without operational overhead, and with an AI layer that assists — drafting, summarizing, suggesting — without ever acting without explicit confirmation, [Working Name] is designed to feel as fast and considered as the best single-purpose productivity tools, while replacing the five-app sprawl with one coherent system.

---

## 15. Technical Build Specification (for Claude Code)

Copy the block below as your starting prompt when you move into Claude Code for implementation.

```
PROJECT: [Working Name] — Unified Workspace App

STACK:
- Frontend: React + TypeScript + Vite, Tailwind CSS, shadcn/ui (Radix-based components), TanStack Query
- Backend: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions/Deno)
- Desktop wrapper: Electron
- Mobile wrapper: Capacitor (iOS + Android)
- Calendar: Google Calendar API v3 (OAuth2, two-way sync) + iCal feed parsing (read-only, node-ical or ical.js)
- Email: Gmail API (OAuth2, two-way: read + send)
- Phone/SMS: Quo API (OAuth or API key per their current docs — confirm flow before implementing)
- Push notifications: FCM (Android/web) + APNs (iOS via Capacitor plugin)
- AI: Anthropic Claude API (Haiku-tier model for cost efficiency), called only from Edge Functions

USERS: Exactly 2 users sharing one workspace. No multi-tenant, no roles/permissions, no billing.

SCHEMA: [paste the full SQL schema from Section 6 of the product plan]

BUILD ORDER (match Section 11 phases):
1. Auth + base schema + app shell + design system setup
2. Calendar (Google two-way sync + iCal read-only + day/week/month/agenda views + recurring events + conflict detection UI)
3. Tasks (CRUD, subtasks, projects, Today/Upcoming/Overdue/Completed views, quick-capture)
4. Contacts (CRUD + polymorphic linking wired into Calendar/Tasks + timeline view)
5. Internal chat (main thread, optional topic threads, Realtime, read receipts, file attachments)
6. Gmail (OAuth, sync, compose/reply/forward, convert-to-task/event, contact auto-link)
7. Quo (OAuth/API connection, webhook receiver for inbound, outbound SMS, voicemail, contact auto-link)
8. Notifications (unified feed, push wiring, quiet hours)
9. Polish pass (dark/light mode, empty/error/loading states across all views)
10. Package: Electron build (Mac/Win) + Capacitor build (iOS/Android)

HARD CONSTRAINTS:
- All third-party API secrets live ONLY in Supabase Edge Function env vars — never in client bundle.
- Row Level Security enabled on every table, scoped to workspace_id.
- OAuth tokens (access_token/refresh_token columns) encrypted at rest.
- AI features NEVER auto-send, auto-schedule, or auto-delete — AI output always requires explicit user confirmation (drafted emails go to Drafts folder, not Sent; suggested events/tasks require a confirm tap).
- iCal-sourced calendar events are read-only in the UI (no edit/delete actions) — this is a protocol limitation, not a bug.
- Use Postgres last-write-wins via updated_at for conflict handling in MVP; do not build offline-first conflict resolution yet (deferred to V2).

DESIGN DIRECTION: Modern, minimal, calm — closer to Things 3 / Linear than to Notion or Slack in density. Dark and light mode required. Mobile-first responsive layouts that progressively enhance to multi-pane desktop layouts (especially Calendar, Email, Contact views).

START WITH: Phase 1 only (Auth + schema + app shell). Do not attempt to scaffold all phases at once.
```

---

## Summary

This plan scopes down the original 4-platform, full-CRM, full-AI vision into something you can actually build and start using inside 4-6 weeks: a 2-person shared workspace, internal chat only, Supabase-backed, with Google Calendar, Gmail, and Quo as your three external integrations, and a clearly fenced-off AI layer that needs one decision from you (provider/budget) before V2 work starts. The roadmap shows the path from there to the fuller vision — widgets, more AI, more integrations, eventual multi-user — without forcing you to build any of that before you've validated the core daily-use product with the two of you.
