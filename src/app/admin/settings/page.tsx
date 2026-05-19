"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, Loader2, Save, MapPin, ShieldAlert, Coins, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/admin/location-map"), { ssr: false });
import AvatarUpload from "@/components/profile/avatar-upload";

interface SchoolConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  economy_config?: any;
}

export default function AdminSettingsPage() {
  const [school, setSchool] = useState<SchoolConfig | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  
  const { t, interpolate, isClient } = useTranslation();

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      // Fetch school
      const { data: sData } = await supabase.from("schools").select("*").limit(1).single();
      if (sData) setSchool(sData as SchoolConfig);

      // Fetch profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (pData) {
          setProfile(pData);
          setFullName(pData.full_name || "");
          setAvatarUrl(pData.avatar_url);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    
    const { error } = await supabase
      .from("schools")
      .update({ 
        name: school.name, 
        latitude: school.latitude, 
        longitude: school.longitude, 
        radius_m: school.radius_m,
        economy_config: school.economy_config
      })
      .eq("id", school.id);
      
    if (error) setMsg(t.adminSettings.errorSaving);
    else setMsg(t.adminSettings.successSaving);
    
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg("");
    const supabase = createClient();
    
    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: fullName,
        avatar_url: avatarUrl
      })
      .eq("id", profile.id);
      
    if (error) setProfileMsg(interpolate(t.adminSettings.errorSavingProfile, { message: error.message }));
    else setProfileMsg(t.adminSettings.successSavingProfile);
    
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
      
    if (error) setPasswordMsg(interpolate(t.adminSettings.errorSavingPassword, { message: error.message }));
    else {
      setPasswordMsg(t.adminSettings.successSavingPassword);
      setNewPassword("");
      setConfirmPassword("");
    }
    
    setSavingProfile(false);
    setTimeout(() => setPasswordMsg(""), 3000);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const field = (label: string, value: string | number, onChange: (v: string) => void, type = "text", step?: string) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        step={step}
        className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-12">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5" /> {t.adminSettings.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t.adminSettings.desc}</p>
      </div>
 
      {/* Admin Profile Settings */}
      {profile && (
        <div className="glass rounded-2xl p-5 space-y-6">
          <h2 className="font-semibold flex items-center gap-2 text-primary"><User className="h-4 w-4" /> {t.adminSettings.adminProfile}</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Info */}
            <div className="space-y-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t.adminSettings.profilePicture}</label>
              <AvatarUpload 
                userId={profile.id}
                currentUrl={avatarUrl}
                onUploaded={(url) => setAvatarUrl(url)}
                onRemoved={() => setAvatarUrl(null)}
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
                {profileMsg && <p className={`text-xs font-medium mt-2 ${profileMsg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{profileMsg}</p>}
              </div>
            </div>

            {/* Password Change */}
            <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
              <h3 className="font-semibold text-sm">{t.adminSettings.changePassword}</h3>
              {field(t.adminSettings.newPassword, newPassword, (v) => setNewPassword(v), "password")}
              {field(t.adminSettings.confirmPassword, confirmPassword, (v) => setConfirmPassword(v), "password")}
              
              <div className="pt-2">
                <button 
                  onClick={handleChangePassword} 
                  disabled={savingProfile} 
                  className="px-4 py-2 rounded-xl bg-muted text-foreground font-semibold text-xs disabled:opacity-50 flex items-center gap-2 hover:bg-muted/80 transition-colors"
                >
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 
                  {savingProfile ? t.adminSettings.changing : t.adminSettings.changePasswordBtn}
                </button>
                {passwordMsg && <p className={`text-xs font-medium mt-2 ${passwordMsg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{passwordMsg}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {school && (
        <div className="glass rounded-2xl p-5 space-y-6">
          <h2 className="font-semibold flex items-center gap-2 text-primary"><MapPin className="h-4 w-4" /> {t.adminSettings.schoolLocation}</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-4">
                {field(t.adminSettings.schoolName, school.name, (v) => setSchool({ ...school, name: v }))}
                <div className="grid grid-cols-2 gap-4">
                  {field(t.adminSettings.latitude, school.latitude, (v) => setSchool({ ...school, latitude: parseFloat(v) || 0 }), "number", "any")}
                  {field(t.adminSettings.longitude, school.longitude, (v) => setSchool({ ...school, longitude: parseFloat(v) || 0 }), "number", "any")}
                </div>
                {field(t.adminSettings.allowedRadius, school.radius_m, (v) => setSchool({ ...school, radius_m: parseInt(v) || 0 }), "number")}
              </div>
              
              <div className="bg-muted p-4 rounded-xl border border-border flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">{t.adminSettings.geofencingWarning}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.adminSettings.geofencingDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full">
              <LocationMap 
                latitude={school.latitude} 
                longitude={school.longitude} 
                radius_m={school.radius_m} 
                onLocationChange={(lat, lng) => setSchool({ ...school, latitude: lat, longitude: lng })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? t.adminSettings.saving : t.adminSettings.saveConfig}
        </button>
        {msg && <p className={`text-sm font-medium ${msg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{msg}</p>}
      </div>
    </div>
  );
}
