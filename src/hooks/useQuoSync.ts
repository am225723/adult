import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

async function runSync(accessToken: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return;

  const res = await fetch(
    new URL("/functions/v1/quo-sync", supabaseUrl).toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    // not_configured means no API key set — silently skip
    if (json.error === "QUO_API_KEY not configured") return;
    throw new Error(json.error ?? `Quo sync failed (${res.status})`);
  }
}

/**
 * Triggers a Quo/OpenPhone → Supabase sync once per component mount,
 * then invalidates phone-message and phone-call queries so the UI refreshes.
 * Silently skips if QUO_API_KEY is not configured.
 */
export function useQuoSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const didSync = useRef(false);

  useEffect(() => {
    if (!user || didSync.current) return;
    didSync.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      runSync(session.access_token)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["phone-messages"] });
          qc.invalidateQueries({ queryKey: ["phone-calls"] });
        })
        .catch((err) => {
          console.warn("[quo-sync]", err.message);
        });
    });
  }, [user, qc]);
}
