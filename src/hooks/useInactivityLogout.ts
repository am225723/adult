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
        supabase.auth.signOut();
      }, TIMEOUT_MS);
    }

    reset();
    for (const event of EVENTS) window.addEventListener(event, reset, { passive: true });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of EVENTS) window.removeEventListener(event, reset);
    };
  }, []);
}
