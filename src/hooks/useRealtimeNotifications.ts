import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

function sendNotification(title: string, body: string, tag: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Don't notify when the tab is already in focus
  if (document.visibilityState === "visible") return;
  new Notification(title, { body, tag, icon: "/whitelogo.png" });
}

async function requestPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    requestPermission();

    const channel = supabase
      .channel("realtime-notifications")

      // New inbound phone message
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_phone_messages" },
        (payload) => {
          const msg = payload.new as { direction?: string; body?: string };
          qc.invalidateQueries({ queryKey: ["phone-messages"] });
          qc.invalidateQueries({ queryKey: ["contact-messages"] });
          if (msg.direction === "incoming") {
            sendNotification("New text message", msg.body ?? "You have a new message", "sms-new");
          }
        },
      )

      // New phone call (missed)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_phone_calls" },
        (payload) => {
          const call = payload.new as { direction?: string; status?: string };
          qc.invalidateQueries({ queryKey: ["phone-calls"] });
          qc.invalidateQueries({ queryKey: ["contact-calls"] });
          if (
            call.direction === "incoming" &&
            ["missed", "no-answer", "abandoned"].includes(call.status ?? "")
          ) {
            sendNotification("Missed call", "You missed an incoming call", "call-missed");
          }
        },
      )

      // New email
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_emails" },
        (payload) => {
          const email = payload.new as { subject?: string; from_name?: string; from_email?: string };
          qc.invalidateQueries({ queryKey: ["emails"] });
          const from = email.from_name || email.from_email || "Someone";
          sendNotification("New email", `${from}: ${email.subject ?? "(no subject)"}`, "email-new");
        },
      )

      // New calendar event
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_calendar_events" },
        () => {
          qc.invalidateQueries({ queryKey: ["calendar-events"] });
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
