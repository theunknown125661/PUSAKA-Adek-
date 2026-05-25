"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, Loader2, Save, MapPin, ShieldAlert, Coins, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { toast } from "sonner";
import type { AttendancePolicy } from "@/lib/types/database";
import { Clock, Wallet } from "lucide-react";


import AvatarUpload from "@/components/profile/avatar-upload";

interface RulesConfig {
  id: string;
  base_reward: number;
  early_bonus: number;
  monthly_hold_bonus_pct: number;
  attendance_start_time: string;
  attendance_end_time: string;
  early_cutoff_time: string;
  min_withdrawal_amount: number;
  economy_config?: any;
}

interface SchoolConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  accuracy_tolerance_m?: number;
  economy_config?: any;
}

export default function AdminSettingsPage() {
  const [school, setSchool] = useState<SchoolConfig | null>(null);
  const [allSchools, setAllSchools] = useState<SchoolConfig[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<"upload" | "initials">("initials");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [policy, setPolicy] = useState<Partial<AttendancePolicy>>({});
  const [rulesMsg, setRulesMsg] = useState("");
  
  const { t, interpolate, isClient } = useTranslation();

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      // Fetch profile
      const { data: { user } } = await supabase.auth.getUser();
      let currentSchoolId: string | null = null;
      if (user) {
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (pData) {
          setProfile(pData);
          setFullName(pData.full_name || "");
          setAvatarUrl(pData.avatar_url);
          setAvatarMode(pData.avatar_mode || "initials");
          currentSchoolId = pData.school_id;
        }
      }

      // Fetch all schools
      const { data: allSData } = await supabase.from("schools").select("*");
      if (allSData && allSData.length > 0) {
        setAllSchools(allSData as SchoolConfig[]);
        
        // If admin has no school_id, fall back to the first school in the database
        if (!currentSchoolId) {
          currentSchoolId = allSData[0].id;
        }
        
        // Set the active school to edit
        const activeSchool = allSData.find(s => s.id === currentSchoolId) || allSData[0];
        setSchool(activeSchool as SchoolConfig);

        // Fetch rules & policy
        const [rRes, pRes] = await Promise.all([
          supabase.from("reward_rules").select("*").eq("school_id", currentSchoolId).limit(1).maybeSingle(),
          supabase.from("attendance_policies").select("*").eq("school_id", currentSchoolId).is("class_id", null).limit(1).maybeSingle(),
        ]);
        
        if (rRes.data) {
          setRules(rRes.data as RulesConfig);
        } else {
          setRules({
            id: "",
            base_reward: 5000,
            early_bonus: 2000,
            monthly_hold_bonus_pct: 5,
            attendance_start_time: "06:00",
            attendance_end_time: "09:00",
            early_cutoff_time: "07:00",
            min_withdrawal_amount: 10000,
            economy_config: {}
          });
        }
        
        if (pRes.data) {
          setPolicy(pRes.data as AttendancePolicy);
        } else {
          setPolicy({
            checkin_open_at: "06:00",
            early_start_at: "06:00",
            early_end_at: "06:45",
            normal_start_at: "06:46",
            normal_end_at: "07:00",
            late_start_at: "07:01",
            late_end_at: "08:00",
            absent_after_at: "08:00",
            late_enabled: true,
            late_grace_minutes: 5,
            late_penalty_type: "points_deduction",
            late_penalty_value: 5,
          });
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
      
    if (error) setProfileMsg(interpolate(t.adminSettings.errorSavingProfile, { message: error.message }));
    else {
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
      
    if (error) setPasswordMsg(interpolate(t.adminSettings.errorSavingPassword, { message: error.message }));
    else {
      setPasswordMsg(t.adminSettings.successSavingPassword);
      setNewPassword("");
      setConfirmPassword("");
    }
    
    setSavingProfile(false);
    setTimeout(() => setPasswordMsg(""), 3000);
  };

  const handleSaveSchoolRules = async () => {
    if (!rules) return;
    setSaving(true);
    setRulesMsg("");
    const supabase = createClient();
    
    let error;
    if (!rules.id) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user?.id).single();
      let schoolId = profile?.school_id;
      if (!schoolId) {
        const { data: firstSchool } = await supabase.from("schools").select("id").limit(1).single();
        if (firstSchool) schoolId = firstSchool.id;
      }
      
      if (!schoolId) {
        setRulesMsg("Error: No schools exist in the database. Please create a school first.");
        setSaving(false);
        return;
      }
      
      const cleanEconomyConfig = JSON.parse(JSON.stringify(rules.economy_config || {}));
      const sanitizeObj = (obj: any) => {
        for (const k in obj) {
          if (obj[k] === "") obj[k] = 0;
          else if (typeof obj[k] === "object" && obj[k] !== null) sanitizeObj(obj[k]);
        }
      };
      sanitizeObj(cleanEconomyConfig);

      const { data, error: insertError } = await supabase
        .from("reward_rules")
        .insert({ 
          school_id: schoolId,
          base_reward: rules.base_reward, 
          early_bonus: rules.early_bonus, 
          monthly_hold_bonus_pct: (rules.monthly_hold_bonus_pct as any) === "" ? 0 : rules.monthly_hold_bonus_pct, 
          min_withdrawal_amount: (rules.min_withdrawal_amount as any) === "" ? 0 : rules.min_withdrawal_amount,
          economy_config: cleanEconomyConfig,
          attendance_start_time: policy.checkin_open_at || "06:00",
          early_cutoff_time: policy.early_end_at || "06:45",
          attendance_end_time: policy.absent_after_at || "08:00"
        })
        .select()
        .single();
      
      error = insertError;
      if (data) {
        setRules(data as RulesConfig);
      }
    } else {
      const cleanEconomyConfig = JSON.parse(JSON.stringify(rules.economy_config || {}));
      const sanitizeObj = (obj: any) => {
        for (const k in obj) {
          if (obj[k] === "") obj[k] = 0;
          else if (typeof obj[k] === "object" && obj[k] !== null) sanitizeObj(obj[k]);
        }
      };
      sanitizeObj(cleanEconomyConfig);

      const { error: updateError } = await supabase
        .from("reward_rules")
        .update({ 
          base_reward: rules.base_reward, 
          early_bonus: rules.early_bonus, 
          monthly_hold_bonus_pct: (rules.monthly_hold_bonus_pct as any) === "" ? 0 : rules.monthly_hold_bonus_pct, 
          min_withdrawal_amount: (rules.min_withdrawal_amount as any) === "" ? 0 : rules.min_withdrawal_amount,
          economy_config: cleanEconomyConfig,
          attendance_start_time: policy.checkin_open_at || "06:00",
          early_cutoff_time: policy.early_end_at || "06:45",
          attendance_end_time: policy.absent_after_at || "08:00"
        })
        .eq("id", rules.id);
      error = updateError;
    }

    // Save policy
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("school_id, id, role").eq("id", user?.id).single();
      
      let schoolId = profile?.school_id;
      if (!schoolId && profile?.role === "admin") {
        const { data: assignments } = await supabase.from("school_admin_assignments").select("school_id").eq("user_id", profile?.id).limit(1);
        if (assignments && assignments.length > 0) schoolId = assignments[0].school_id;
      }
      if (!schoolId) {
        const { data: firstSchool } = await supabase.from("schools").select("id").limit(1).single();
        if (firstSchool) schoolId = firstSchool.id;
      }

      if (schoolId) {
        const payload = {
          ...policy,
          school_id: schoolId,
          name: policy.name || "Default School Policy",
        };

        if (policy.id) {
          const { error: polErr } = await supabase.from("attendance_policies").update({
            ...payload, updated_by: profile?.id, updated_at: new Date().toISOString()
          }).eq("id", policy.id);
          if (polErr) error = polErr;
        } else {
          const { data, error: polErr } = await supabase.from("attendance_policies").insert({
            ...payload, created_by: profile?.id
          }).select().single();
          if (data) setPolicy(data);
          if (polErr) error = polErr;
        }
      }
    }
      
    if (error) setRulesMsg(t.adminRewards.errorSaving);
    else setRulesMsg(t.adminRewards.successSaving);
    
    setSaving(false);
    setTimeout(() => setRulesMsg(""), 3000);
  };

  const handleSwitchSchool = async (newSchoolId: string) => {
    if (!profile) return;
    setSavingProfile(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("profiles")
      .update({ school_id: newSchoolId })
      .eq("id", profile.id);
      
    if (error) {
      toast.error("Failed to switch school");
      setSavingProfile(false);
    } else {
      toast.success("Active school changed!");
      // Reload the page to refresh all school settings
      window.location.reload();
    }
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
        <div className="glass rounded-2xl p-5 space-y-6 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <h2 className="font-semibold flex items-center gap-2 text-primary"><User className="h-4 w-4" /> {t.adminSettings.adminProfile}</h2>
          
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

      {/* ACTIVE SCHOOL SELECTOR */}
      <div className="glass rounded-2xl p-6 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Active School</h2>
            <p className="text-sm text-muted-foreground">Select which school you are currently managing</p>
          </div>
        </div>
        
        <div className="max-w-md">
          <select 
            value={school?.id || ""} 
            onChange={(e) => handleSwitchSchool(e.target.value)}
            disabled={savingProfile}
            className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          >
            {allSchools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!school && (
        <div className="glass rounded-2xl p-6 text-center space-y-4">
          <MapPin className="h-10 w-10 text-primary mx-auto animate-bounce" />
          <h2 className="text-lg font-bold">No School Configuration Found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must create a school configuration with coordinates and geofencing radius before students can check in.
          </p>
          <button
            onClick={async () => {
              setSaving(true);
              const supabase = createClient();
              const { data, error } = await supabase
                .from("schools")
                .insert({
                  name: "SMK Negeri 1 Jakarta",
                  latitude: -6.2088,
                  longitude: 106.8456,
                  radius_m: 200
                })
                .select()
                .single();
              
              if (error) {
                toast.error("Failed to create school: " + error.message);
              } else {
                setSchool(data as SchoolConfig);
                toast.success("School configuration created! Please update coordinates and details.");
              }
              setSaving(false);
            }}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Initialize School Configuration
          </button>
        </div>
      )}

      {school && (
        <div className="mt-8">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-primary"><Settings className="h-5 w-5" /> School Rules & Policies</h2>
          <div className="space-y-4">
            {rules && (
              <div className="glass rounded-2xl p-5 space-y-4 border border-primary/20 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <h2 className="font-semibold text-primary flex items-center gap-2"><Wallet className="h-4 w-4" /> {t.adminRewards.financialRules}</h2>
                
                <div className="space-y-4">
                  {/* Coins Config */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-xs text-amber-600 uppercase tracking-wider">{t.adminRewards.coinsTitle}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {field(t.adminRewards.attendancePresent, rules.economy_config?.coins?.attendance_present ?? 20, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          coins: { ...rules.economy_config?.coins, attendance_present: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                      {field(t.adminRewards.onTimeBonus, rules.economy_config?.coins?.attendance_ontime ?? 10, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          coins: { ...rules.economy_config?.coins, attendance_ontime: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                    </div>
                  </div>

                  {/* Rupiah Config */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-xs text-emerald-600 uppercase tracking-wider">{t.adminRewards.rupiahTitle}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {field(t.adminRewards.attendancePresentRp, rules.economy_config?.rupiah?.attendance_present ?? 1000, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          rupiah: { ...rules.economy_config?.rupiah, attendance_present: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                      {field(t.adminRewards.onTimeBonusRp, rules.economy_config?.rupiah?.attendance_ontime ?? 500, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          rupiah: { ...rules.economy_config?.rupiah, attendance_ontime: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                    </div>
                  </div>

                  {/* XP Config */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-xs text-indigo-600 uppercase tracking-wider">XP Rules</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {field("Attendance Present XP", rules.economy_config?.xp?.attendance_present ?? 50, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          xp: { ...rules.economy_config?.xp, attendance_present: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                      {field("On-Time Bonus XP", rules.economy_config?.xp?.attendance_ontime ?? 25, (v) => setRules({ 
                        ...rules, 
                        economy_config: { 
                          ...rules.economy_config, 
                          xp: { ...rules.economy_config?.xp, attendance_ontime: v === "" ? ("" as any) : Number(v) } 
                        } 
                      }), "number")}
                    </div>
                  </div>

                  {/* System Values */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    {field(t.adminRewards.minWithdrawal, rules.min_withdrawal_amount ?? 0, (v) => setRules({ ...rules, min_withdrawal_amount: v === "" ? ("" as any) : Number(v) }), "number")}
                    {field(t.adminRewards.monthlyHoldPct, rules.monthly_hold_bonus_pct ?? 0, (v) => setRules({ ...rules, monthly_hold_bonus_pct: v === "" ? ("" as any) : Number(v) }), "number")}
                  </div>
                </div>

                {policy && (
                  <>
                    <h2 className="font-semibold pt-4 text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Attendance Time Windows</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {field("1. Check-in Opens (Starts Early Bird)", policy.checkin_open_at || "", (v) => setPolicy({ 
                        ...policy, 
                        checkin_open_at: v, 
                        early_start_at: v 
                      }), "time")}
                      {field("2. Normal Check-in Starts (Ends Early Bird)", policy.normal_start_at || "", (v) => setPolicy({ 
                        ...policy, 
                        early_end_at: v, 
                        normal_start_at: v 
                      }), "time")}
                      {field("3. Late Penalty Starts (Ends Normal)", policy.late_start_at || "", (v) => setPolicy({ 
                        ...policy, 
                        normal_end_at: v, 
                        late_start_at: v 
                      }), "time")}
                      {field("4. Check-in Closes (Starts Absent)", policy.absent_after_at || "", (v) => setPolicy({ 
                        ...policy, 
                        late_end_at: v, 
                        absent_after_at: v 
                      }), "time")}
                    </div>

                    <h2 className="font-semibold pt-4 text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Penalty Rules</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {field("Late Grace Minutes", policy.late_grace_minutes ?? 0, (v) => setPolicy({ ...policy, late_grace_minutes: v === "" ? ("" as any) : Number(v) }), "number")}
                      <div className="col-span-full">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Penalty Type</label>
                        <select 
                          value={policy.late_penalty_type || "points_deduction"} 
                          onChange={(e) => setPolicy({ ...policy, late_penalty_type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                          <option value="points_deduction">Standard Points Deduction (Use value below)</option>
                          <option value="custom_deduction">Custom Economy Deduction (Rupiah, Coins, XP)</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      
                      {policy.late_penalty_type !== "custom_deduction" && (
                        field("Late Penalty Value (Legacy/Points)", policy.late_penalty_value ?? 0, (v) => setPolicy({ ...policy, late_penalty_value: v === "" ? ("" as any) : Number(v) }), "number")
                      )}
                    </div>

                    {policy.late_penalty_type === "custom_deduction" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 bg-muted/30 p-4 rounded-xl border border-border">
                        {field("Rupiah Deduction", rules.economy_config?.penalties?.rupiah ?? 0, (v) => setRules({
                          ...rules,
                          economy_config: {
                            ...rules.economy_config,
                            penalties: { ...rules.economy_config?.penalties, rupiah: v === "" ? ("" as any) : Number(v) }
                          }
                        }), "number")}
                        {field("Coins Deduction", rules.economy_config?.penalties?.coins ?? 0, (v) => setRules({
                          ...rules,
                          economy_config: {
                            ...rules.economy_config,
                            penalties: { ...rules.economy_config?.penalties, coins: v === "" ? ("" as any) : Number(v) }
                          }
                        }), "number")}
                        {field("XP Deduction", rules.economy_config?.penalties?.xp ?? 0, (v) => setRules({
                          ...rules,
                          economy_config: {
                            ...rules.economy_config,
                            penalties: { ...rules.economy_config?.penalties, xp: v === "" ? ("" as any) : Number(v) }
                          }
                        }), "number")}
                      </div>
                    )}

                    <h2 className="font-semibold pt-4 text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Active School Days</h2>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Select Active Days (Currently handled in Economy Config)</label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                          const activeDays = rules.economy_config?.active_days || [1, 2, 3, 4, 5];
                          const isActive = activeDays.includes(dayNum);
                          return (
                            <button
                              key={dayNum}
                              onClick={() => {
                                const newActive = isActive 
                                  ? activeDays.filter((d: number) => d !== dayNum)
                                  : [...activeDays, dayNum];
                                setRules({
                                  ...rules,
                                  economy_config: { ...rules.economy_config, active_days: newActive }
                                });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            >
                              {days[dayNum]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-border">
                  <span className={`text-xs font-medium ${rulesMsg.includes("Gagal") || rulesMsg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{rulesMsg}</span>
                  <button onClick={handleSaveSchoolRules} disabled={saving} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? t.adminRewards.savingStatus : t.adminRewards.saveConfig}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
