import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/useToast";

type Mode = "sign_in" | "sign_up" | "forgot";

export function LoginPage() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent a confirmation link to " + email,
        });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setResetSent(true);
      }
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: error.message,
      });
      setSubmitting(false);
    }
  }

  const title =
    mode === "sign_in"
      ? "Welcome back"
      : mode === "sign_up"
        ? "Create your account"
        : "Reset password";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Logo / wordmark */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Adulting
          </h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

        {mode === "forgot" && resetSent ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Password reset link sent to <strong>{email}</strong>. Check your
              inbox.
            </p>
            <Button
              variant="ghost"
              className="px-0 text-sm"
              onClick={() => {
                setMode("sign_in");
                setResetSent(false);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "sign_in" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  minLength={8}
                />
              </div>
            )}

            {mode === "sign_in" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? "..."
                : mode === "sign_in"
                  ? "Sign in"
                  : mode === "sign_up"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>
        )}

        {mode !== "forgot" && !resetSent && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleLogin}
              disabled={submitting}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </>
        )}

        {mode !== "forgot" && (
          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign_in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-foreground font-medium hover:underline"
                  onClick={() => setMode("sign_up")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-foreground font-medium hover:underline"
                  onClick={() => setMode("sign_in")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M15.68 8.18c0-.57-.05-1.12-.14-1.64H8v3.1h4.3a3.67 3.67 0 01-1.59 2.41v2h2.57c1.5-1.38 2.4-3.42 2.4-5.87z"
        fill="#4285F4"
      />
      <path
        d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.58-2a4.8 4.8 0 01-2.72.76 4.77 4.77 0 01-4.48-3.3H.86v2.07A8 8 0 008 16z"
        fill="#34A853"
      />
      <path
        d="M3.52 9.52A4.8 4.8 0 013.27 8c0-.53.09-1.05.25-1.52V4.41H.86A8 8 0 000 8c0 1.29.31 2.51.86 3.59l2.66-2.07z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.18c1.22 0 2.3.42 3.16 1.24l2.37-2.37A8 8 0 00.86 4.41L3.52 6.48A4.77 4.77 0 018 3.18z"
        fill="#EA4335"
      />
    </svg>
  );
}
