"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { User, Key, Save, Loader2, CheckCircle2, Palette, Sparkles, Image as ImageIcon } from "lucide-react";
import AvatarDisplay from "@/components/profile/avatar-display";
import AvatarUpload from "@/components/profile/avatar-upload";
import BioEditor, { containsProfanity } from "@/components/profile/bio-editor";
import type { Cosmetic } from "@/lib/types/database";
import { toast } from "sonner";

export default function StudentSettingsPage() {
  const { t, isClient } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarMode, setAvatarMode] = useState<"upload" | "initials">("initials");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Theme system
  const [themes, setThemes] = useState<Cosmetic[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

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
          setUsername(data.username || "");
          setBio(data.bio || "");
          setAvatarMode(data.avatar_mode || "initials");
          setAvatarUrl(data.avatar_url || null);
          setSelectedThemeId(data.theme_id || null);
        }

        // Load available themes
        const { data: cosmetics } = await supabase
          .from("cosmetics")
          .select("*")
          .eq("type", "theme")
          .eq("active", true)
          .order("rarity");

        if (cosmetics) setThemes(cosmetics as Cosmetic[]);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");
    setProfileErr("");

    if (!fullName.trim()) {
      setProfileErr(t.profile.displayNameRequired);
      setProfileLoading(false);
      return;
    }

    if (bio.length > 160) {
      setProfileErr(t.profile.bioTooLong);
      setProfileLoading(false);
      return;
    }

    if (bio && containsProfanity(bio)) {
      setProfileErr(t.profile.bioProfanity);
      setProfileLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Check username uniqueness if changed
      if (username.trim() && username !== profile.username) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.trim())
          .neq("id", profile.id)
          .limit(1);
        if (existing && existing.length > 0) {
          setProfileErr(t.profile.usernameTaken);
          setProfileLoading(false);
          return;
        }
      }

      // Find selected theme CSS value and apply
      const selectedTheme = themes.find((th) => th.id === selectedThemeId);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          username: username.trim() || null,
          bio: bio.trim() || null,
          avatar_mode: avatarMode,
          avatar_url: avatarUrl,
          theme_id: selectedThemeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        setProfileErr(error.message);
      } else {
        setProfileMsg(t.profile.profileSaved);
        setProfile((prev: any) => ({
          ...prev,
          full_name: fullName.trim(),
          username: username.trim() || null,
          bio: bio.trim() || null,
          avatar_mode: avatarMode,
          avatar_url: avatarUrl,
          theme_id: selectedThemeId,
        }));
        toast.success(t.profile.profileSaved);

        // Apply theme globally
        if (selectedTheme?.css_value) {
          document.documentElement.style.setProperty("--primary", selectedTheme.css_value);
          document.documentElement.style.setProperty("--accent", selectedTheme.css_value);
        }
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
      setPwdErr(t.profile.passwordTooShort);
      setPwdLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdErr(t.profile.passwordMismatch);
      setPwdLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPwdErr(error.message);
      } else {
        setPwdMsg(t.profile.passwordChanged);
        setNewPassword("");
        setConfirmPassword("");
        toast.success(t.profile.passwordChanged);
      }
    } catch (err: any) {
      setPwdErr(err.message || "An unexpected error occurred");
    } finally {
      setPwdLoading(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; maxLength?: number; disabled?: boolean }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        maxLength={opts?.maxLength}
        disabled={opts?.disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow ${opts?.disabled ? "cursor-not-allowed opacity-70" : ""}`}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold">{t.profile.editProfile}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.profile.editProfileDesc}</p>
      </div>

      {/* Live Profile Preview */}
      <div className="card rounded-2xl p-6 flex items-center gap-5">
        <AvatarDisplay
          fullName={fullName || "User"}
          avatarUrl={avatarUrl}
          avatarMode={avatarMode}
          size="xl"
        />
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{fullName || "Your Name"}</h2>
          {username && (
            <p className="text-sm text-muted-foreground">@{username}</p>
          )}
          {bio && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{bio}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Personal Info Card */}
        <div className="card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{t.profile.personalInfo}</h2>
              <p className="text-xs text-muted-foreground">{t.profile.editProfileDesc}</p>
            </div>
          </div>

          <div className="space-y-4">
            {field("email", "Email", profile?.email || "", () => {}, { disabled: true })}
            {field("displayName", t.profile.displayName, fullName, setFullName, { maxLength: 40 })}
            {field("username", t.profile.username, username, setUsername, { placeholder: t.profile.usernamePlaceholder, maxLength: 20 })}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t.profile.bio}
              </label>
              <BioEditor
                value={bio}
                onChange={setBio}
                placeholder={t.profile.bioPlaceholder}
              />
            </div>
          </div>
        </div>

        {/* Avatar Card */}
        <div className="card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{t.profile.avatar}</h2>
              <p className="text-xs text-muted-foreground">{t.profile.photoFormats} · {t.profile.photoMaxSize}</p>
            </div>
          </div>

          {/* Upload Widget */}
          {profile && (
            <AvatarUpload
              userId={profile.id}
              currentUrl={avatarUrl}
              onUploaded={(url) => {
                setAvatarUrl(url);
                setAvatarMode("upload");
                toast.success(t.profile.photoUploaded);
              }}
              onRemoved={() => {
                setAvatarUrl(null);
                setAvatarMode("initials");
                toast.info(t.profile.photoRemoved);
              }}
            />
          )}
        </div>

        {/* Appearance Card */}
        {themes.length > 0 && (
          <div className="card rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Palette className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{t.profile.appearance}</h2>
                <p className="text-xs text-muted-foreground">{t.profile.themeColor}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {themes.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setSelectedThemeId(theme.id);
                      // Live preview: set the hex color directly on the CSS variable
                      if (theme.css_value) {
                        document.documentElement.style.setProperty("--primary", theme.css_value);
                        document.documentElement.style.setProperty("--accent", theme.css_value);
                      }
                    }}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-muted/30 hover:border-primary/30"
                    }`}
                  >
                    <div
                      className="h-8 w-8 rounded-full shrink-0 shadow-inner"
                      style={{ backgroundColor: theme.css_value || undefined }}
                    />
                    <span className="text-[10px] font-bold truncate w-full text-center">{theme.name}</span>
                    {isSelected && (
                      <CheckCircle2 className="absolute top-1.5 right-1.5 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Profile Feedback */}
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

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={profileLoading}
            className="py-3 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 touch-manipulation shadow-lg shadow-primary/20"
          >
            {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {profileLoading ? t.profile.saving : t.profile.saveChanges}
          </button>
        </div>
      </form>

      {/* Password Card */}
      <div className="card rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Key className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{t.profile.security}</h2>
            <p className="text-xs text-muted-foreground">{t.profile.securityDesc}</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="newPwd" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t.profile.newPassword}
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
              {t.profile.confirmPassword}
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
              {t.profile.security}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
