"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  User, Key, Save, Loader2, CheckCircle2, Palette, Image as ImageIcon,
  Coins, Flame, Zap, Award, Package, Star, Lock, GraduationCap
} from "lucide-react";
import AvatarDisplay from "@/components/profile/avatar-display";
import AvatarUpload from "@/components/profile/avatar-upload";
import BioEditor, { containsProfanity } from "@/components/profile/bio-editor";
import type { Cosmetic } from "@/lib/types/database";
import { toast } from "sonner";

export default function StudentSettingsPage() {
  const { t, isClient } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);

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

  // Profile slots / badges / inventory (from profile page)
  const [slots, setSlots] = useState<any[]>([]);
  const [equippedSlots, setEquippedSlots] = useState<Record<string, any>>({});
  const [inventory, setInventory] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

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
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch profile
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        // Fetch school and class for layout context only
        const { data: enr } = await supabase
          .from("enrollments")
          .select("class_id, classes(id, school_id, name, schools(id, name))")
          .eq("student_id", user.id)
          .maybeSingle();

        if (data) {
          setProfile({
            ...data,
            class_name: (enr?.classes as any)?.name,
            school_name: ((enr?.classes as any)?.schools as any)?.name
          });
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

        // Fetch wallet
        const { data: wall } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .eq("currency_type", "COIN")
          .maybeSingle();

        setWallet(wall);

        // Fetch profile slots
        const { data: slotData } = await supabase
          .from("profile_slots")
          .select("*")
          .order("sort_order", { ascending: true });

        setSlots(slotData || []);

        // Fetch equipped slots
        const { data: equipped } = await supabase
          .from("user_profile_slots")
          .select("*")
          .eq("user_id", user.id);

        const equippedMap: Record<string, any> = {};
        equipped?.forEach(item => {
          equippedMap[item.slot_key] = item.item_id;
        });
        setEquippedSlots(equippedMap);

        // Fetch inventory (purchased cosmetics)
        const { data: inv } = await supabase
          .from("user_cosmetics")
          .select("*, cosmetics(*)")
          .eq("user_id", user.id);

        setInventory(inv || []);

        // Fetch earned badges
        const { data: earnedBadges } = await supabase
          .from("student_badges")
          .select("*, badges(*)")
          .eq("student_id", user.id);

        setBadges(earnedBadges || []);
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);


  const handleEquip = async (slotKey: string, itemId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_profile_slots")
      .upsert({
        user_id: user.id,
        slot_key: slotKey,
        item_id: itemId,
        equipped_at: new Date().toISOString()
      });

    if (error) {
      toast.error("Error equipping item: " + error.message);
    } else {
      toast.success("Item equipped!");
      setEquippedSlots({ ...equippedSlots, [slotKey]: itemId });
    }
  };

  const handleEquipBadge = async (badgeId: string) => {
    const badgeSlots = slots.filter(s => s.slot_type === "BADGE");
    let targetSlot = badgeSlots.find(s => !equippedSlots[s.slot_key])?.slot_key;

    if (!targetSlot && badgeSlots.length > 0) {
      targetSlot = badgeSlots[0].slot_key;
    }

    if (targetSlot) {
      await handleEquip(targetSlot, badgeId);
    } else {
      toast.error("No available badge slots!");
    }
  };

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
        
        // Notify other components (like sidebar) that profile has changed
        window.dispatchEvent(new Event("profile-updated"));
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

  // Calculate level progress
  const xpCurrent = profile?.xp || 0;
  const currentLevel = profile?.level || 1;
  const xpNeeded = currentLevel * 100;
  const progressPercent = Math.min(100, (xpCurrent / xpNeeded) * 100);

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

      {/* Profile Header with Stats */}
      <div className="card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10" />

        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          {/* Avatar */}
          <div className="relative">
            <AvatarDisplay
              fullName={fullName || "User"}
              avatarUrl={avatarUrl}
              avatarMode={avatarMode}
              size="xl"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full border-2 border-card">
              Lvl {profile?.level || 1}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            <div>
              <h2 className="text-xl font-bold truncate">{fullName || "Your Name"}</h2>
              {username && (
                <p className="text-sm text-muted-foreground">@{username}</p>
              )}
              {profile?.class_name && (
                <p className="text-xs text-primary font-medium mt-0.5">
                  {profile.class_name} • {profile.school_name}
                </p>
              )}
            </div>

            {bio && (
              <p className="text-xs text-muted-foreground line-clamp-2">{bio}</p>
            )}

            {/* Stats Pills */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span>{wallet?.balance_available || 0} {t.studentProfile?.coins || "Coins"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span>{profile?.streak_current || 0} {t.studentProfile?.dayStreak || "Day Streak"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                <span>{profile?.xp || 0} {t.studentProfile?.xp || "XP"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span>Progress to Level {currentLevel + 1}</span>
            <span>{xpCurrent} / {xpNeeded} XP</span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Badge Showcase */}
      {slots.filter(s => s.slot_type === "BADGE").length > 0 && (
        <div className="card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Badge Showcase
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {slots.filter(s => s.slot_type === "BADGE").map((slot) => {
              const isLocked = currentLevel < slot.required_level;
              const equippedItemId = equippedSlots[slot.slot_key];
              const equippedBadge = badges.find(b => b.badge_id === equippedItemId)?.badges;

              return (
                <div
                  key={slot.slot_key}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-2 relative group cursor-pointer transition-colors ${
                    isLocked ? "bg-muted/40 border-dashed border-border" :
                    equippedBadge ? "bg-card border-primary/30" : "bg-muted/20 border-border hover:bg-muted/30"
                  }`}
                >
                  {isLocked ? (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span className="text-[9px] font-medium">Lvl {slot.required_level}</span>
                    </div>
                  ) : equippedBadge ? (
                    <div className="text-2xl">{equippedBadge.icon || "🏅"}</div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-medium">Empty</span>
                  )}

                  {!isLocked && equippedBadge && (
                    <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl p-1 text-center">
                      <span className="text-[10px] font-medium truncate">{equippedBadge.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              onUploaded={async (url) => {
                setAvatarUrl(url);
                setAvatarMode("upload");
                
                const supabase = createClient();
                await supabase.from("profiles").update({ 
                  avatar_url: url, 
                  avatar_mode: "upload" 
                }).eq("id", profile.id);
                
                window.dispatchEvent(new Event("profile-updated"));
                toast.success(t.profile.photoUploaded);
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


      {/* Inventory & Badges Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Cosmetic Inventory */}
        <div className="card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Inventory
          </h2>

          {inventory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              You haven&apos;t bought any items yet. Visit the shop!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="aspect-square bg-muted/20 border border-border rounded-xl flex flex-col items-center justify-center p-2 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <span className="text-2xl">{item.cosmetics?.visual_data?.icon || "🎭"}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                    {item.cosmetics?.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Earned Badges */}
        <div className="card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Earned Badges
          </h2>

          {badges.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Complete quests to earn badges!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {badges.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleEquipBadge(item.badge_id)}
                  className="aspect-square bg-muted/20 border border-border rounded-xl flex flex-col items-center justify-center p-2 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <span className="text-2xl">{item.badges?.icon || "🏅"}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                    {item.badges?.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
