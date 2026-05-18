"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GraduationCap, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      const handleCodeExchange = async () => {
        setLoading(true);
        setError("");
        try {
          const supabase = createClient();
          // Exchanging the code client-side guarantees direct access to browser storage
          // (cookies and localStorage) where the PKCE verifier is saved!
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            setError(`Exchange error: ${exchangeError.message}`);
            setLoading(false);
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single();

            window.location.href = `/${profile?.role || "student"}`;
          } else {
            setError("Failed to retrieve authenticated user details.");
            setLoading(false);
          }
        } catch (err: any) {
          setError(err.message || "An unexpected error occurred during Google sign-in.");
          setLoading(false);
        }
      };
      handleCodeExchange();
      return;
    }

    const urlError = searchParams.get("error");
    if (urlError) {
      setError(urlError);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      if (isSignUp) {
        // Sign Up Flow
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "student", // Self-registration defaults to student role
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // If the session is automatically created (email confirmation is disabled)
        if (data.session) {
          window.location.href = "/student";
        } else {
          // If email confirmation is enabled in Supabase
          setSuccessMessage("Registration successful! Please check your email to confirm your account.");
          setFullName("");
          setEmail("");
          setPassword("");
          setIsSignUp(false);
          setLoading(false);
        }
      } else {
        // Sign In Flow
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }

        // Fetch role for redirect
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          window.location.href = `/${profile?.role || "student"}`;
        } else {
          setLoading(false);
        }
      }
    } catch (err: any) {
      setError(`Fatal auth error: ${err.message || err}`);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      setGoogleStatus("Initializing client...");
      
      const supabase = createClient();
      
      setGoogleStatus("Requesting OAuth URL from Supabase...");
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setGoogleStatus("");
        setError(`OAuth Error: ${authError.message}`);
        setLoading(false);
        return;
      }
      
      setGoogleStatus("Redirecting to Google...");
      
      // Fallback manual redirect just in case Supabase's auto-redirect was blocked by Safari's async popup blocker
      if (data?.url) {
        window.location.href = data.url;
      }
      
    } catch (err: any) {
      setGoogleStatus("");
      setError(`Google sign-in exception: ${err.message || err}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-accent/15 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">School Present Reward</h1>
          <p className="text-muted-foreground text-sm mt-1">Attendance made rewarding</p>
        </div>

        {/* Login/Signup card */}
        <div className="glass rounded-2xl p-6 space-y-5 relative z-20">
          
          {/* Success Banner */}
          {successMessage && (
            <div className="text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium mb-1.5">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  required
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.test"
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors z-20 touch-manipulation"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading 
                ? (isSignUp ? "Registering Student..." : "Signing in...") 
                : (isSignUp ? "Register as Student" : "Sign In")
              }
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <span className="relative px-3 bg-[#0d0f12] text-muted-foreground/80 font-medium">Or continue with</span>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-muted border border-border hover:bg-muted/80 text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] touch-manipulation relative z-20 disabled:opacity-50"
          >
            {googleStatus ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            )}
            <span>{googleStatus || "Continue with Google"}</span>
          </button>

          {/* Toggle Tab */}
          <div className="text-center text-xs text-muted-foreground pt-1">
            {isSignUp ? (
              <p>
                Already have a student account?{" "}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setError(""); }}
                  className="text-primary font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have a student account?{" "}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(""); }}
                  className="text-primary font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
