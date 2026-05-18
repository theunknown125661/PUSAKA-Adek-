"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Key, Save, Loader2, CheckCircle2 } from "lucide-react";

export default function StudentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  
  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Feedback states
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setProfile(data);
          setFullName(data.full_name || "");
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");
    setProfileErr("");

    if (!fullName.trim()) {
      setProfileErr("Full name is required");
      setProfileLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id);

      if (error) {
        setProfileErr(error.message);
      } else {
        setProfileMsg("Profile updated successfully!");
        setProfile((prev: any) => ({ ...prev, full_name: fullName.trim() }));
      }
    } catch (err: any) {
      setProfileErr(err.message || "An unexpected error occurred");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdMsg("");
    setPwdErr("");

    if (newPassword.length < 6) {
      setPwdErr("Password must be at least 6 characters long");
      setPwdLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdErr("Passwords do not match");
      setPwdLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPwdErr(error.message);
      } else {
        setPwdMsg("Password changed successfully!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setPwdErr(err.message || "An unexpected error occurred");
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your student profile and security credentials</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Profile Form Card */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Personal Profile</h2>
              <p className="text-xs text-muted-foreground">Modify your account public display name</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Registered Email Address
              </label>
              <input
                type="text"
                value={profile?.email || ""}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm text-muted-foreground cursor-not-allowed opacity-80"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">Your email cannot be changed as it is locked to your school registry.</p>
            </div>

            <div>
              <label htmlFor="studentFullName" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                id="studentFullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                required
              />
            </div>

            {profileErr && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                {profileErr}
              </div>
            )}

            {profileMsg && (
              <div className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {profileMsg}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 touch-manipulation"
              >
                {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Password Reset Card */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Security Credentials</h2>
              <p className="text-xs text-muted-foreground">Keep your account safe by updating your password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="newPwd" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                id="newPwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPwd" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                required
              />
            </div>

            {pwdErr && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                {pwdErr}
              </div>
            )}

            {pwdMsg && (
              <div className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {pwdMsg}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={pwdLoading}
                className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 touch-manipulation"
              >
                {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Change Password
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
