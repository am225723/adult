import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface QuoCustomField {
  id: string;
  name: string;
  type: "text" | "number" | "email" | "phone" | "url" | "date" | "select" | "multiselect";
  options?: string[];
}

export interface QuoContact {
  id: string;
  firstName?: string;
  lastName?: string;
  emails?: string[];
  phoneNumbers?: Array<{ type?: string; value: string }>;
  company?: string;
  role?: string;
  customFields?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  externalId?: string;
}

export function useQuoContacts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContacts = async (cursor?: string, limit: string = "50"): Promise<{
    contacts: QuoContact[];
    nextCursor?: string;
  }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        action: "list",
        limit,
      });
      if (cursor) params.append("cursor", cursor);

      const response = await fetch(
        `/functions/v1/quo-contacts?${params}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        contacts: result.data || [],
        nextCursor: result.pageInfo?.endCursor,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getContact = async (contactId: string): Promise<QuoContact> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-contacts?action=get&contactId=${contactId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contact: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCustomFields = async (): Promise<QuoCustomField[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-contacts?action=customFields",
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch custom fields: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (
    options: {
      firstName?: string;
      lastName?: string;
      emails?: string[];
      phoneNumbers?: Array<{ type?: string; value: string }>;
      company?: string;
      role?: string;
      customFields?: Record<string, unknown>;
      externalId?: string;
    }
  ): Promise<QuoContact> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-contacts?action=create",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create contact: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateContact = async (
    contactId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      emails?: string[];
      phoneNumbers?: Array<{ type?: string; value: string }>;
      company?: string;
      role?: string;
      customFields?: Record<string, unknown>;
    }
  ): Promise<QuoContact> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-contacts?action=update",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactId,
            ...updates,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update contact: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (contactId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-contacts?action=delete&contactId=${contactId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete contact: ${response.statusText}`);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getContacts,
    getContact,
    getCustomFields,
    createContact,
    updateContact,
    deleteContact,
  };
}
