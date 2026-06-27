import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const INTERVAL_MS = 15 * 60 * 1000;

async function edgePost(path: string, token: string, body?: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function syncAll(token: string, qc: ReturnType<typeof useQueryClient>) {
  // 1. Quo (phone calls + messages)
  edgePost("quo-sync", token)
    .then((res) => res.json().catch(() => ({})))
    .then((json) => {
      if (json.error === "QUO_API_KEY not configured") return;
      qc.invalidateQueries({ queryKey: ["phone-calls"] });
      qc.invalidateQueries({ queryKey: ["phone-messages"] });
    })
    .catch(() => {});

  // 2. Gmail — sync each connected account
  const { data: gmailAccounts } = await supabase
    .from("admin_gmail_accounts")
    .select("id")
    .eq("provider", "google");

  for (const acct of gmailAccounts ?? []) {
    edgePost("google-gmail-sync", token, { gmail_account_id: acct.id })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["emails"] });
      })
      .catch(() => {});
  }

  // 3. Calendar — sync each connected account
  const { data: calAccounts } = await supabase
    .from("admin_calendar_accounts")
    .select("id")
    .eq("provider", "google");

  for (const acct of calAccounts ?? []) {
    edgePost("google-calendar-sync", token, { calendar_account_id: acct.id })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["calendar-events"] });
      })
      .catch(() => {});
  }
}

export function useAutoSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      syncAll(session.access_token, qc);
    }

    // Sync immediately on mount (login)
    run();

    // Sync every 15 minutes
    intervalRef.current = setInterval(run, INTERVAL_MS);

    // Sync when tab regains visibility
    function onVisible() {
      if (document.visibilityState === "visible") run();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, qc]);
}
