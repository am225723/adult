import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? "/dashboard" : "/login", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
