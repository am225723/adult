import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const EDGE_FN = "google-sync-settings";

async function callSettings(
  token: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = token || session?.access_token;
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${EDGE_FN}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export function useRefreshCalendars() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      return callSettings(session?.access_token ?? "", {
        action: "list-calendars",
        account_id: accountId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-account", user?.id] }),
  });
}

export function useUpdateCalendarSelection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      accountId,
      calendarIds,
    }: {
      accountId: string;
      calendarIds: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      return callSettings(session?.access_token ?? "", {
        action: "update-calendars",
        account_id: accountId,
        calendar_ids: calendarIds,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-account", user?.id] }),
  });
}

export function useRefreshLabels() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      return callSettings(session?.access_token ?? "", {
        action: "list-labels",
        account_id: accountId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail-account", user?.id] }),
  });
}

export function useUpdateLabelSelection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      accountId,
      labelIds,
    }: {
      accountId: string;
      labelIds: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      return callSettings(session?.access_token ?? "", {
        action: "update-labels",
        account_id: accountId,
        label_ids: labelIds,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail-account", user?.id] }),
  });
}
