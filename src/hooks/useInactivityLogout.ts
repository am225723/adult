import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const TIMEOUT_MS = 30 * 60 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useInactivityLogout() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        supabase.auth.signOut().catch((err) => {
          console.error("Inactivity sign-out failed", err);
        });
      }, TIMEOUT_MS);
    }

    reset();
    // Use capture:true so scroll events inside overflow containers are detected
    for (const event of EVENTS)
      window.addEventListener(event, reset, { passive: true, capture: true });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of EVENTS)
        window.removeEventListener(event, reset, { capture: true });
    };
  }, []);
}
