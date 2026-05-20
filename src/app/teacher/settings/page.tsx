"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, Loader2, Save, User, Key } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import AvatarUpload from "@/components/profile/avatar-upload";

export default function TeacherSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<"upload" | "initials">("initials");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  
  const { t, interpolate, isClient } = useTranslation();

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (pData) {
          setProfile(pData);
          setFullName(pData.full_name || "");
          setAvatarUrl(pData.avatar_url);
          setAvatarMode(pData.avatar_mode || "initials");
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg("");
    const supabase = createClient();
    
    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: fullName,
        avatar_url: avatarUrl,
        avatar_mode: avatarMode
      })
      .eq("id", profile.id);
      
    if (error) {
      setProfileMsg(interpolate(t.adminSettings.errorSavingProfile, { message: error.message }));
    } else {
      setProfileMsg(t.adminSettings.successSavingProfile);
      window.dispatchEvent(new Event("profile-updated"));
    }
    
    setSavingProfile(false);
    setTimeout(() => setProfileMsg(""), 3000);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg(t.adminSettings.passwordMismatch);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg(t.adminSettings.passwordTooShort);
      return;
    }
    
    setSavingProfile(true);
    setPasswordMsg("");
    const supabase = createClient();
    
    const { error } = await supabase.auth.updateUser({ password: newPassword });
      
    if (error) {
      setPasswordMsg(interpolate(t.adminSettings.errorSavingPassword, { message: error.message }));
    } else {
      setPasswordMsg(t.adminSettings.successSavingPassword);
      setNewPassword("");
      setConfirmPassword("");
    }
    
    setSavingProfile(false);
    setTimeout(() => setPasswordMsg(""), 3000);
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const field = (label: string, value: string | number, onChange: (v: string) => void, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-12">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5" /> Teacher Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your teacher profile and security credentials</p>
      </div>
 
      {/* Teacher Profile Settings */}
      {profile && (
        <div className="glass rounded-2xl p-5 space-y-6">
          <h2 className="font-semibold flex items-center gap-2 text-primary">
            <User className="h-4 w-4" /> My Profile
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Info */}
            <div className="space-y-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t.adminSettings.profilePicture}</label>
              <AvatarUpload 
                userId={profile.id}
                currentUrl={avatarUrl}
                onUploaded={async (url) => {
                  setAvatarUrl(url);
                  setAvatarMode("upload");
                  const supabase = createClient();
                  await supabase.from("profiles").update({ 
                    avatar_url: url, 
                    avatar_mode: "upload" 
                  }).eq("id", profile.id);
                  window.dispatchEvent(new Event("profile-updated"));
                }}
                onRemoved={async () => {
                  setAvatarUrl(null);
                  setAvatarMode("initials");
                  const supabase = createClient();
                  await supabase.from("profiles").update({ 
                    avatar_url: null, 
                    avatar_mode: "initials" 
                  }).eq("id", profile.id);
                  window.dispatchEvent(new Event("profile-updated"));
                }}
              />

              {field(t.adminSettings.fullName, fullName, (v) => setFullName(v))}
              
              <div className="pt-2">
                <button 
                  onClick={handleSaveProfile} 
                  disabled={savingProfile} 
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 
                  {savingProfile ? t.adminSettings.saving : t.adminSettings.updateProfileBtn}
                </button>
              </div>

              {profileMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${profileMsg.includes("Error") || profileMsg.includes("Gagal") ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`}>
                  {profileMsg}
                </div>
              )}
            </div>

            {/* Password Change */}
            <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-6">
              <h3 className="font-medium text-sm flex items-center gap-2 text-foreground">
                <Key className="h-4 w-4 text-muted-foreground" /> {t.adminSettings.changePassword}
              </h3>
              
              {field(t.adminSettings.newPassword, newPassword, (v) => setNewPassword(v), "password")}
              {field(t.adminSettings.confirmPassword, confirmPassword, (v) => setConfirmPassword(v), "password")}
              
              <div className="pt-2">
                <button 
                  onClick={handleChangePassword} 
                  disabled={savingProfile} 
                  className="px-4 py-2 rounded-xl bg-muted border border-border text-foreground hover:bg-muted/80 font-semibold text-xs disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />} 
                  {savingProfile ? t.adminSettings.changing : t.adminSettings.changePasswordBtn}
                </button>
              </div>

              {passwordMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${passwordMsg.includes("Error") || passwordMsg.includes("Gagal") || passwordMsg.includes("match") || passwordMsg.includes("kurang") ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`}>
                  {passwordMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
