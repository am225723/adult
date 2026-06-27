# Quo API Integration

This document describes the implementation of the Quo (OpenPhone) API integration into the Adult application. The integration provides task management, contact management, and real-time webhook event handling.

## Overview

The Quo integration consists of several layers:

1. **Database Schema** - PostgreSQL tables for storing synced Quo data
2. **Edge Functions** - Serverless functions that proxy requests to the Quo API
3. **React Hooks** - Type-safe client-side API integration
4. **Utilities** - Helper functions for webhooks and common operations
5. **Components** - UI components for displaying and managing data

## Database Schema

### Tables

#### `admin_quo_tasks`
Stores task data synced from Quo API with support for task lifecycle management.

**Columns:**
- `id` - Primary key (UUID)
- `workspace_id` - Workspace reference
- `external_id` - Quo API task ID
- `title` - Task title
- `description` - Task description
- `status` - "open" or "completed"
- `due_date` - Optional due date
- `assignee_id` - Optional assignee user ID
- `conversation_id` - Link to conversation thread
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `metadata` - JSON metadata

#### `admin_quo_contacts`
Stores contact information synced from Quo API.

**Columns:**
- `id` - Primary key (UUID)
- `workspace_id` - Workspace reference
- `external_id` - Quo API contact ID
- `first_name` - First name
- `last_name` - Last name
- `emails` - JSON array of emails
- `primary_phone` - Primary phone number
- `company` - Company name
- `role` - Job role
- `custom_fields` - JSON custom fields
- `metadata` - JSON metadata
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

#### `admin_quo_webhooks`
Tracks active webhook subscriptions for real-time event handling.

**Columns:**
- `id` - Primary key (UUID)
- `workspace_id` - Workspace reference
- `event_types` - JSON array of subscribed event types
- `secret` - HMAC secret for signature validation
- `is_active` - Whether webhook is active
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

#### `admin_quo_webhook_events`
Logs webhook events for debugging and audit purposes.

**Columns:**
- `id` - Primary key (UUID)
- `workspace_id` - Workspace reference
- `webhook_id` - Reference to webhook subscription
- `event_type` - Type of event
- `event_data` - Full event payload (JSON)
- `processed` - Whether event was processed
- `processed_at` - Processing timestamp
- `created_at` - Receive timestamp

### Row-Level Security (RLS)

All Quo tables implement RLS policies that restrict access to workspace members. Users can only see data from their workspace.

## Edge Functions

### quo-tasks
**Path:** `/functions/v1/quo-tasks`

Manages all task operations with support for pagination and various task-specific actions.

**Actions:**
- `list` (GET) - List tasks with cursor-based pagination
- `get` (GET) - Get specific task by ID
- `create` (POST) - Create new task
- `update` (PUT) - Update task details
- `delete` (DELETE) - Delete task
- `complete` (POST) - Mark task as completed
- `reopen` (POST) - Reopen completed task
- `assign` (POST) - Assign task to user
- `changeDueDate` (POST) - Update due date
- `linkConversation` (POST) - Link task to conversation

**Authentication:** Bearer token (Supabase session)

**Timeout:** 8 seconds (default)

### quo-contacts
**Path:** `/functions/v1/quo-contacts`

Manages all contact operations with support for custom fields.

**Actions:**
- `list` (GET) - List contacts with cursor-based pagination
- `get` (GET) - Get specific contact by ID
- `customFields` (GET) - Get custom field definitions
- `create` (POST) - Create new contact
- `update` (PATCH) - Update contact details
- `delete` (DELETE) - Delete contact

**Authentication:** Bearer token (Supabase session)

**Timeout:** 8 seconds (default)

### quo-webhooks
**Path:** `/functions/v1/quo-webhooks` (POST only)

Receives and processes webhook events from Quo API with signature validation.

**Supported Events:**
- `message.received` - New message received
- `message.delivered` - Message delivery confirmation
- `call.completed` - Call completed
- `call.voicemail.completed` - Voicemail received
- `contact.updated` - Contact information updated

**Security:** HMAC-SHA256 signature validation using shared secret

### quo-sync-tasks
**Path:** `/functions/v1/quo-sync-tasks` (POST only)

Periodic sync function to fetch tasks from Quo API and update database.

**Features:**
- Automatic pagination through all tasks
- Per-workspace sync
- Error tracking and reporting
- Returns sync statistics (synced count, error count)

### quo-sync-contacts
**Path:** `/functions/v1/quo-sync-contacts` (POST only)

Periodic sync function to fetch contacts from Quo API and update database.

**Features:**
- Automatic pagination through all contacts
- Per-workspace sync
- Error tracking and reporting
- Returns sync statistics (synced count, error count)

## React Hooks

### useQuoTasks
**Location:** `src/hooks/useQuoTasks.ts`

Provides task management operations with loading and error state management.

**Exported Functions:**
- `getTasks(cursor?, limit?)` - List tasks with pagination
- `getTask(taskId)` - Get single task
- `createTask(title, options?)` - Create new task
- `updateTask(taskId, updates)` - Update task fields
- `deleteTask(taskId)` - Delete task
- `completeTask(taskId)` - Mark as complete
- `reopenTask(taskId)` - Reopen task
- `assignTask(taskId, userId)` - Assign to user
- `changeDueDate(taskId, dueDate)` - Set due date
- `linkConversation(taskId, conversationId)` - Link to conversation

**State:** `loading`, `error`

**Example Usage:**
```tsx
const { getTasks, createTask, loading, error } = useQuoTasks();

// List tasks
const { tasks, nextCursor } = await getTasks();

// Create task
const task = await createTask("Implement feature X", {
  description: "Details here",
  dueDate: "2024-07-01"
});
```

### useQuoMessages
**Location:** `src/hooks/useQuoMessages.ts`

Provides message operations including phone number retrieval and messaging.

**Exported Functions:**
- `getPhoneNumbers()` - Get available phone numbers
- `getMessages(phoneNumberId, participant?, pageToken?)` - Get messages
- `sendMessage(from, to, content)` - Send message

**State:** `loading`, `error`

### useQuoContacts
**Location:** `src/hooks/useQuoContacts.ts`

Provides contact management operations with custom field support.

**Exported Functions:**
- `getContacts(cursor?, limit?)` - List contacts with pagination
- `getContact(contactId)` - Get single contact
- `getCustomFields()` - Get custom field definitions
- `createContact(options)` - Create new contact
- `updateContact(contactId, updates)` - Update contact
- `deleteContact(contactId)` - Delete contact

**State:** `loading`, `error`

## Utility Functions

### quoWebhooks.ts
**Location:** `src/lib/quoWebhooks.ts`

Webhook management utilities for subscription and event tracking.

**Functions:**
- `createWebhookSubscription(workspaceId, eventTypes, secret)` - Create webhook
- `getWebhookSubscriptions(workspaceId)` - List webhooks
- `deactivateWebhook(webhookId)` - Deactivate webhook
- `deleteWebhook(webhookId)` - Delete webhook
- `getWebhookEvents(webhookId, limit?, offset?)` - Get webhook events
- `clearWebhookEvents(webhookId)` - Clear event log
- `generateWebhookSecret(length?)` - Generate secure secret
- `validateWebhookSignature(body, signature, secret)` - Validate request

### quoApi.ts
**Location:** `src/lib/quoApi.ts`

Type-safe wrappers for common Quo API operations.

**Functions:**
- `listTasks(cursor?, limit?, accessToken?)`
- `getTask(taskId, accessToken?)`
- `createTask(title, options?, accessToken?)`
- `updateTask(taskId, updates, accessToken?)`
- `deleteTask(taskId, accessToken?)`
- `listContacts(cursor?, limit?, accessToken?)`
- `getContact(contactId, accessToken?)`
- `createContact(options, accessToken?)`
- `updateContact(contactId, updates, accessToken?)`
- `deleteContact(contactId, accessToken?)`

## UI Components

### QuoTaskList
**Location:** `src/components/QuoTaskList.tsx`

Displays and manages Quo tasks with full CRUD operations.

**Features:**
- List tasks with pagination
- Create new tasks with modal dialog
- Mark tasks complete/incomplete
- Delete tasks
- Loading and error states

**Usage:**
```tsx
import { QuoTaskList } from "@/components/QuoTaskList";

export default function TasksPage() {
  return <QuoTaskList />;
}
```

### QuoContactList
**Location:** `src/components/QuoContactList.tsx`

Displays and manages Quo contacts with search functionality.

**Features:**
- List contacts with pagination
- Create new contacts with detailed form
- Search contacts by name or company
- Display contact information (email, phone, company, role)
- Delete contacts
- Loading and error states

**Usage:**
```tsx
import { QuoContactList } from "@/components/QuoContactList";

export default function ContactsPage() {
  return <QuoContactList />;
}
```

## Environment Configuration

Required environment variables:

```
QUO_API_KEY=your-quo-api-key
QUO_API_BASE=https://api.quo.com/v1
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Set these in your `.env.local` or Supabase environment variables.

## Setup Checklist

- [ ] Deploy database migration to Supabase
- [ ] Configure Quo API key in environment variables
- [ ] Set up Supabase session handling for authentication
- [ ] Configure webhook subscription in Quo dashboard pointing to `/functions/v1/quo-webhooks`
- [ ] Generate webhook secret and store in database
- [ ] Set up periodic sync jobs for tasks and contacts (cron or scheduled functions)
- [ ] Test edge functions with sample requests
- [ ] Deploy components to application
- [ ] Update database types: `npx supabase gen types typescript --local > src/types/database.ts`

## Security Considerations

1. **Authentication**: All edge functions validate Supabase session tokens
2. **Authorization**: RLS policies ensure users only access workspace data
3. **Webhook Validation**: HMAC-SHA256 signatures validate webhook authenticity
4. **API Key Protection**: Quo API key stored as environment variable
5. **Data Encryption**: Sensitive data in custom fields should be encrypted at rest

## Error Handling

All functions implement error state management:

```tsx
const { loading, error, getTasks } = useQuoTasks();

try {
  const { tasks } = await getTasks();
} catch (err) {
  // Error is also available in `error` state
  console.error(err.message);
}
```

## Future Enhancements

- [ ] Real-time subscriptions using Supabase Realtime for task/contact updates
- [ ] Webhook event delivery status tracking
- [ ] Bulk operations (create/update multiple records)
- [ ] Advanced search and filtering
- [ ] Task templates
- [ ] Contact groups/lists
- [ ] Integration with calendar for due dates
- [ ] Contact activity history
- [ ] Message threading UI
- [ ] Call recording retrieval

## Troubleshooting

### Webhooks not being received
1. Verify webhook secret in database matches Quo configuration
2. Check webhook delivery logs in `admin_quo_webhook_events`
3. Verify CORS headers in edge function response
4. Ensure webhook endpoint is publicly accessible

### Sync functions not updating data
1. Check edge function logs in Supabase dashboard
2. Verify Quo API key is valid and has required permissions
3. Ensure migrations have been applied to database
4. Check RLS policies aren't blocking inserts

### Tasks/Contacts not loading in UI
1. Verify authentication token is valid
2. Check browser console for API errors
3. Ensure workspace_id is set correctly
4. Verify RLS policies allow reads for current user

## References

- [Quo API Documentation](https://api.quo.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [React Hooks Best Practices](https://react.dev/reference/react/hooks)
