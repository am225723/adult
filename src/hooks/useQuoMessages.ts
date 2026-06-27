import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface QuoMessage {
  id: string;
  from: string;
  to: string[];
  content: string;
  direction: "incoming" | "outgoing";
  status: "received" | "sent" | "delivered" | "failed";
  createdAt: string;
  conversationId?: string;
}

export interface QuoPhoneNumber {
  id: string;
  number: string;
  name?: string;
}

export function useQuoMessages() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPhoneNumbers = async (): Promise<QuoPhoneNumber[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-messages?action=phone-numbers",
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch phone numbers: ${response.statusText}`);
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

  const getMessages = async (
    phoneNumberId: string,
    participant?: string,
    pageToken?: string
  ): Promise<{ messages: QuoMessage[]; nextPageToken?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        action: "messages",
        phoneNumberId,
      });
      if (participant) params.append("participant", participant);
      if (pageToken) params.append("pageToken", pageToken);

      const response = await fetch(
        `/functions/v1/quo-messages?${params}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        messages: result.data || [],
        nextPageToken: result.pageToken,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (
    from: string,
    to: string | string[],
    content: string
  ): Promise<QuoMessage> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-messages",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: Array.isArray(to) ? to : [to],
            content,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
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

  return {
    loading,
    error,
    getPhoneNumbers,
    getMessages,
    sendMessage,
  };
}
