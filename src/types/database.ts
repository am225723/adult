export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_saved_searches: {
        Row: {
          id: string
          workspace_id: string | null
          user_id: string
          name: string
          query: string
          category: string
          filters: string[]
          created_at: string | null
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          user_id: string
          name: string
          query?: string
          category?: string
          filters?: string[]
          created_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string | null
          user_id?: string
          name?: string
          query?: string
          category?: string
          filters?: string[]
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_saved_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ai_summaries: {
        Row: {
          generated_at: string | null
          id: string
          model_used: string | null
          source_id: string | null
          source_type: string
          summary_text: string
          workspace_id: string | null
        }
        Insert: {
          generated_at?: string | null
          id?: string
          model_used?: string | null
          source_id?: string | null
          source_type: string
          summary_text: string
          workspace_id?: string | null
        }
        Update: {
          generated_at?: string | null
          id?: string
          model_used?: string | null
          source_id?: string | null
          source_type?: string
          summary_text?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_ai_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_calendar_accounts: {
        Row: {
          access_token: string | null
          external_account_email: string | null
          ical_feed_url: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          external_account_email?: string | null
          ical_feed_url?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          external_account_email?: string | null
          ical_feed_url?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_calendar_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_calendar_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_calendar_events: {
        Row: {
          all_day: boolean | null
          calendar_account_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          external_event_id: string | null
          id: string
          is_read_only: boolean | null
          location: string | null
          recurrence_rule: string | null
          source: string
          start_time: string
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          all_day?: boolean | null
          calendar_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          external_event_id?: string | null
          id?: string
          is_read_only?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          source: string
          start_time: string
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          all_day?: boolean | null
          calendar_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          external_event_id?: string | null
          id?: string
          is_read_only?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          source?: string
          start_time?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_calendar_events_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "admin_calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_messages: {
        Row: {
          attachment_url: string | null
          body: string | null
          created_at: string | null
          id: string
          pinned: boolean | null
          sender_id: string | null
          thread_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          pinned?: boolean | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          pinned?: boolean | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "admin_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_threads: {
        Row: {
          created_at: string | null
          id: string
          is_main_thread: boolean | null
          title: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_main_thread?: boolean | null
          title?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_main_thread?: boolean | null
          title?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_contact_notes: {
        Row: {
          id: string
          workspace_id: string | null
          contact_id: string
          created_by: string | null
          body: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          contact_id: string
          created_by?: string | null
          body: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string | null
          contact_id?: string
          created_by?: string | null
          body?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_contact_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_contact_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_contact_emails: {
        Row: {
          contact_id: string | null
          email: string
          id: string
          label: string | null
        }
        Insert: {
          contact_id?: string | null
          email: string
          id?: string
          label?: string | null
        }
        Update: {
          contact_id?: string | null
          email?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_contact_phones: {
        Row: {
          contact_id: string | null
          id: string
          label: string | null
          phone: string
        }
        Insert: {
          contact_id?: string | null
          id?: string
          label?: string | null
          phone: string
        }
        Update: {
          contact_id?: string | null
          id?: string
          label?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_contacts: {
        Row: {
          company: string | null
          created_at: string | null
          created_by: string | null
          display_name: string
          id: string
          is_deleted: boolean | null
          notes: string | null
          primary_email: string | null
          primary_phone: string | null
          tags: string[] | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name: string
          id?: string
          is_deleted?: boolean | null
          notes?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          id?: string
          is_deleted?: boolean | null
          notes?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_email_accounts: {
        Row: {
          access_token: string | null
          email_address: string
          id: string
          last_synced_at: string | null
          refresh_token: string | null
          token_expires_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          email_address: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          email_address?: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_email_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_email_links: {
        Row: {
          email_id: string | null
          id: string
          linked_id: string
          linked_type: string
        }
        Insert: {
          email_id?: string | null
          id?: string
          linked_id: string
          linked_type: string
        }
        Update: {
          email_id?: string | null
          id?: string
          linked_id?: string
          linked_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_email_links_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "admin_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_emails: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string | null
          email_account_id: string | null
          external_message_id: string | null
          folder: string | null
          from_addr: string | null
          from_address: string | null
          gmail_account_id: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          is_flagged: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          labels: string[] | null
          received_at: string | null
          snippet: string | null
          subject: string | null
          to_addr: string | null
          to_addresses: string[] | null
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_account_id?: string | null
          external_message_id?: string | null
          folder?: string | null
          from_addr?: string | null
          from_address?: string | null
          gmail_account_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_flagged?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          to_addr?: string | null
          to_addresses?: string[] | null
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_account_id?: string | null
          external_message_id?: string | null
          folder?: string | null
          from_addr?: string | null
          from_address?: string | null
          gmail_account_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_flagged?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          to_addr?: string | null
          to_addresses?: string[] | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "admin_email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_links: {
        Row: {
          event_id: string | null
          id: string
          linked_id: string
          linked_type: string
        }
        Insert: {
          event_id?: string | null
          id?: string
          linked_id: string
          linked_type: string
        }
        Update: {
          event_id?: string | null
          id?: string
          linked_id?: string
          linked_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "admin_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_integrations: {
        Row: {
          connected_at: string | null
          id: string
          last_error: string | null
          provider: string
          status: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          connected_at?: string | null
          id?: string
          last_error?: string | null
          provider: string
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          connected_at?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_message_read_receipts: {
        Row: {
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "admin_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_message_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_preferences: {
        Row: {
          category: string
          enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          user_id: string
        }
        Insert: {
          category: string
          enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          user_id: string
        }
        Update: {
          category?: string
          enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_phone_accounts: {
        Row: {
          access_token: string | null
          id: string
          last_synced_at: string | null
          phone_number: string | null
          quo_account_id: string
          refresh_token: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number?: string | null
          quo_account_id: string
          refresh_token?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          id?: string
          last_synced_at?: string | null
          phone_number?: string | null
          quo_account_id?: string
          refresh_token?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_phone_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_phone_calls: {
        Row: {
          contact_id: string | null
          direction: string | null
          duration_seconds: number | null
          id: string
          occurred_at: string | null
          phone_account_id: string | null
          status: string | null
          voicemail_transcript: string | null
          voicemail_url: string | null
          workspace_id: string | null
        }
        Insert: {
          contact_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string | null
          phone_account_id?: string | null
          status?: string | null
          voicemail_transcript?: string | null
          voicemail_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          contact_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string | null
          phone_account_id?: string | null
          status?: string | null
          voicemail_transcript?: string | null
          voicemail_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_phone_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_phone_calls_phone_account_id_fkey"
            columns: ["phone_account_id"]
            isOneToOne: false
            referencedRelation: "admin_phone_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_phone_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_phone_messages: {
        Row: {
          body: string | null
          contact_id: string | null
          direction: string | null
          id: string
          is_read: boolean | null
          occurred_at: string | null
          phone_account_id: string | null
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          direction?: string | null
          id?: string
          is_read?: boolean | null
          occurred_at?: string | null
          phone_account_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          direction?: string | null
          id?: string
          is_read?: boolean | null
          occurred_at?: string | null
          phone_account_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_phone_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "admin_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_phone_messages_phone_account_id_fkey"
            columns: ["phone_account_id"]
            isOneToOne: false
            referencedRelation: "admin_phone_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_phone_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_quo_contacts: {
        Row: {
          id: string
          workspace_id: string | null
          external_id: string
          first_name: string | null
          last_name: string | null
          emails: Json
          primary_phone: string | null
          company: string | null
          role: string | null
          custom_fields: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          external_id: string
          first_name?: string | null
          last_name?: string | null
          emails?: Json
          primary_phone?: string | null
          company?: string | null
          role?: string | null
          custom_fields?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          external_id?: string
          first_name?: string | null
          last_name?: string | null
          emails?: Json
          primary_phone?: string | null
          company?: string | null
          role?: string | null
          custom_fields?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_quo_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_quo_tasks: {
        Row: {
          id: string
          workspace_id: string | null
          external_id: string
          title: string
          description: string | null
          status: string
          due_date: string | null
          assignee_id: string | null
          conversation_id: string | null
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          external_id: string
          title: string
          description?: string | null
          status?: string
          due_date?: string | null
          assignee_id?: string | null
          conversation_id?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          workspace_id?: string | null
          external_id?: string
          title?: string
          description?: string | null
          status?: string
          due_date?: string | null
          assignee_id?: string | null
          conversation_id?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_quo_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_quo_webhooks: {
        Row: {
          id: string
          workspace_id: string | null
          event_types: Json
          secret: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          event_types?: Json
          secret: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          event_types?: Json
          secret?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_quo_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_quo_webhook_events: {
        Row: {
          id: string
          workspace_id: string | null
          webhook_id: string | null
          event_type: string
          event_data: Json
          processed: boolean
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          webhook_id?: string | null
          event_type: string
          event_data: Json
          processed?: boolean
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          webhook_id?: string | null
          event_type?: string
          event_data?: Json
          processed?: boolean
          processed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_quo_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_quo_webhook_events_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "admin_quo_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_projects: {
        Row: {
          archived: boolean | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_task_links: {
        Row: {
          id: string
          linked_id: string
          linked_type: string
          task_id: string | null
        }
        Insert: {
          id?: string
          linked_id: string
          linked_type: string
          task_id?: string | null
        }
        Update: {
          id?: string
          linked_id?: string
          linked_type?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          parent_task_id: string | null
          priority: string | null
          project_id: string | null
          recurrence_rule: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      admin_workspace_members: {
        Row: {
          role: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          role?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          role?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "admin_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never
