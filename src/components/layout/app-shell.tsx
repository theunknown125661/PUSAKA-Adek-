"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { Sidebar } from "@/components/layout/sidebar";
import AvatarDisplay from "@/components/profile/avatar-display";
import { NotificationBell } from "@/components/shared/notification-bell";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toLocalYYYYMMDD } from "@/lib/utils/format";
import { 
  X, Sun, Moon, Globe, User, Settings, LogOut, 
  GraduationCap, Coins, Flame, ChevronDown,
  Medal, Trophy, Shield, CheckCircle2, Lock, Sparkles, Star
} from "lucide-react";

const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame,
  Star,
  Trophy,
  Shield,
  Medal,
  CheckCircle2
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, loading } = useUserRole();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<{
    classesCount?: number;
    studentsCount?: number;
    totalStudents?: number;
    pendingReviews?: number;
    pendingWithdrawals?: number;
  }>({});
  const [studentMetrics, setStudentMetrics] = useState<{
    rupiahBalance: number | null;
    coinsBalance: number | null;
    unlockedBadges: any[];
    weeklyLogs: any[];
  }>({
    rupiahBalance: null,
    coinsBalance: null,
    unlockedBadges: [],
    weeklyLogs: []
  });
  const { theme, setTheme } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    const profileId = profile?.id;
    if (!profileId || !role) return;

    const supabase = createClient();
    async function loadMetrics() {
      if (role === "student") {
        try {
          // Fetch wallets (Rupiah and Coins)
          const { data: wallets } = await supabase
            .from("wallets")
            .select("currency_type, balance_available")
            .eq("user_id", profileId);
          
          const rupiahWallet = wallets?.find(w => w.currency_type === "RUPIAH");
          const coinWallet = wallets?.find(w => w.currency_type === "COIN");

          // Fetch top unlocked badges (up to 4, ordered by earned_at desc)
          const { data: badges } = await supabase
            .from("student_badges")
            .select("*, badges(*)")
            .eq("student_id", profileId)
            .order("earned_at", { ascending: false })
            .limit(4);

          // Fetch attendance logs for current week
          const today = new Date();
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday of this week
          const monday = new Date(today.getFullYear(), today.getMonth(), diff);
          monday.setHours(0, 0, 0, 0);

          const { data: logs } = await supabase
            .from("attendance_logs")
            .select("attendance_date, status")
            .eq("student_id", profileId)
            .gte("attendance_date", toLocalYYYYMMDD(monday));

          setStudentMetrics({
            rupiahBalance: rupiahWallet?.balance_available ?? 0,
            coinsBalance: coinWallet?.balance_available ?? profile?.coins ?? 0,
            unlockedBadges: badges || [],
            weeklyLogs: logs || []
          });
        } catch (error) {
          console.error("Error loading student metrics:", error);
        }
      } else if (role === "teacher") {
        const { data: classesData } = await supabase
          .from("classes")
          .select("id")
          .eq("teacher_id", profileId);
        
        const classesCount = classesData?.length || 0;
        let studentsCount = 0;
        if (classesData && classesData.length > 0) {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("class_id", classesData.map(c => c.id));
          studentsCount = count || 0;
        }
        setMetrics({ classesCount, studentsCount });
      } else if (role === "admin") {
        const { count: studentCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student");

        const { count: flaggedCount } = await supabase
          .from("attendance_logs")
          .select("*", { count: "exact", head: true })
          .eq("status", "flagged");

        const { count: payoutCount } = await supabase
          .from("payout_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "REQUESTED");

        setMetrics({
          totalStudents: studentCount || 0,
          pendingReviews: flaggedCount || 0,
          pendingWithdrawals: payoutCount || 0,
        });
      }
    }

    loadMetrics();

    window.addEventListener("profile-updated", loadMetrics);
    return () => {
      window.removeEventListener("profile-updated", loadMetrics);
    };
  }, [role, profile?.id, profile?.coins]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showProfileMenu]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role || !profile) return <>{children}</>;

  const getStreakStyles = (streak: number) => {
    if (streak >= 30) {
      return {
        iconColor: "text-blue-500",
        fillColor: "fill-blue-500/30",
        bgGradient: "from-blue-500/15 to-cyan-500/10",
        bgHoverGradient: "hover:from-blue-500/20 hover:to-cyan-500/15",
        borderColor: "border-blue-500/30",
        borderHoverColor: "hover:border-blue-500/40",
        badgeGradient: "from-blue-500 to-cyan-400",
        shadowColor: "shadow-blue-500/30",
        textColor: "text-blue-600 dark:text-blue-400",
        scale: "scale-125",
        iconScale: "scale-110",
        pulse: "animate-pulse",
      };
    } else if (streak >= 14) {
      return {
        iconColor: "text-purple-500",
        fillColor: "fill-purple-500/30",
        bgGradient: "from-purple-500/15 to-pink-500/10",
        bgHoverGradient: "hover:from-purple-500/20 hover:to-pink-500/15",
        borderColor: "border-purple-500/30",
        borderHoverColor: "hover:border-purple-500/40",
        badgeGradient: "from-purple-500 to-pink-500",
        shadowColor: "shadow-purple-500/30",
        textColor: "text-purple-600 dark:text-purple-400",
        scale: "scale-110",
        iconScale: "scale-105",
        pulse: "animate-pulse",
      };
    } else if (streak >= 7) {
      return {
        iconColor: "text-rose-500",
        fillColor: "fill-rose-500/30",
        bgGradient: "from-rose-500/15 to-red-500/10",
        bgHoverGradient: "hover:from-rose-500/20 hover:to-red-500/15",
        borderColor: "border-rose-500/30",
        borderHoverColor: "hover:border-rose-500/40",
        badgeGradient: "from-rose-500 to-red-500",
        shadowColor: "shadow-rose-500/30",
        textColor: "text-rose-600 dark:text-rose-400",
        scale: "scale-105",
        iconScale: "scale-105",
        pulse: "animate-pulse",
      };
    } else if (streak >= 3) {
      return {
        iconColor: "text-red-500",
        fillColor: "fill-red-500/20",
        bgGradient: "from-red-500/10 to-orange-500/5",
        bgHoverGradient: "hover:from-red-500/15 hover:to-orange-500/10",
        borderColor: "border-red-500/20",
        borderHoverColor: "hover:border-red-500/30",
        badgeGradient: "from-red-500 to-orange-500",
        shadowColor: "shadow-red-500/20",
        textColor: "text-red-600 dark:text-red-400",
        scale: "scale-100",
        iconScale: "scale-100",
        pulse: "animate-pulse",
      };
    } else {
      return {
        iconColor: "text-orange-500",
        fillColor: "fill-orange-500/10",
        bgGradient: "from-orange-500/10 to-amber-500/5",
        bgHoverGradient: "hover:from-orange-500/15 hover:to-amber-500/10",
        borderColor: "border-orange-500/15",
        borderHoverColor: "hover:border-orange-500/25",
        badgeGradient: "from-orange-400 to-amber-500",
        shadowColor: "shadow-orange-500/10",
        textColor: "text-orange-600 dark:text-orange-400",
        scale: "scale-100",
        iconScale: "scale-100",
        pulse: "",
      };
    }
  };

  const streakStyles = getStreakStyles(profile.streak_current || 0);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} profile={profile} />

      {/* Desktop Top Header Bar */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 h-16 border-b border-border bg-card items-center justify-end px-8 z-20">
        <div className="flex items-center gap-4">
          <NotificationBell />

          <div className="h-5 w-px bg-border" />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-muted/80 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-95 border border-transparent hover:border-border/50 bg-muted/20 hover:bg-muted/40"
              title="Open Profile Menu"
            >
              <AvatarDisplay
                fullName={profile.full_name || "User"}
                avatarUrl={profile.avatar_url}
                avatarMode={profile.avatar_mode}
                size="sm"
              />
              <div className="flex flex-col text-left mr-1 justify-center">
                <span className="font-bold text-xs text-foreground leading-none">{profile.full_name}</span>
                <span className="text-[8.5px] text-muted-foreground/80 capitalize mt-0.5 font-medium tracking-wide leading-none">{role}</span>
                
                {role === "student" && (
                  <div className="flex items-center gap-1 text-[8px] font-semibold text-muted-foreground/75 mt-1 leading-none whitespace-nowrap">
                    <div className={`flex items-center gap-0.5 ${streakStyles.textColor}`} title="Current Streak">
                      <Flame className={`h-2 w-2 shrink-0 ${streakStyles.fillColor} transition-all duration-300`} />
                      <span>{profile.streak_current || 0}d</span>
                    </div>
                    <span className="text-[6px] opacity-30 select-none">•</span>
                    <div className="flex items-center gap-0.5 text-primary" title="Level">
                      <GraduationCap className="h-2 w-2 shrink-0" />
                      <span>Lvl {profile.level || 1}</span>
                    </div>
                    <span className="text-[6px] opacity-30 select-none">•</span>
                    <div className="flex items-center gap-0.5 text-amber-500" title="Coins">
                      <Coins className="h-2 w-2 shrink-0 fill-amber-500/10" />
                      <span>{studentMetrics.coinsBalance !== null ? studentMetrics.coinsBalance : (profile.coins || 0)}</span>
                    </div>
                    <span className="text-[6px] opacity-30 select-none">•</span>
                    <div className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title="Money Balance">
                      <span className="text-[7.5px] font-black mr-0.5">Rp</span>
                      <span>{(studentMetrics.rupiahBalance !== null ? studentMetrics.rupiahBalance : (profile.rupiah || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>


              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5 transition-transform duration-200" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none' }} />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-card border border-border shadow-xl rounded-2xl z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                {/* Profile Header (Horizontal) */}
                <div className="flex items-center gap-3 mb-3">
                  <AvatarDisplay
                    fullName={profile.full_name || "User"}
                    avatarUrl={profile.avatar_url}
                    avatarMode={profile.avatar_mode}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-foreground truncate">{profile.full_name}</h3>
                    <p className="text-xs text-muted-foreground truncate leading-none mt-0.5">
                      {profile.username ? `@${profile.username}` : role}
                    </p>
                    {(profile as unknown as { class_name?: string; school_name?: string }).class_name && (
                      <p className="text-[10px] text-primary font-bold truncate mt-1">
                        {(profile as unknown as { class_name?: string; school_name?: string }).class_name} • {(profile as unknown as { class_name?: string; school_name?: string }).school_name}
                      </p>
                    )}
                  </div>
                </div>

                {profile.bio && (
                  <p className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-xl italic border border-border/30 mb-3 text-center">
                    &ldquo;{profile.bio}&rdquo;
                  </p>
                )}

                {/* Stats Section */}
                {role === "student" ? (
                  <div className="space-y-4">
                    {/* Interactive Level Ring & Streak block */}
                    <div className="flex items-center gap-4 bg-muted/30 p-3.5 rounded-2xl border border-border/40">
                      {/* Interactive Level Ring */}
                      <div className="relative group flex items-center justify-center h-16 w-16 cursor-default shrink-0 bg-card hover:bg-muted rounded-xl border border-border/40 hover:border-border/80 shadow-sm hover:shadow-md transition-all duration-300">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            className="stroke-muted/40"
                            strokeWidth="3.5"
                            fill="transparent"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            className="stroke-primary transition-all duration-700 ease-out"
                            strokeWidth="3.5"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 26}
                            strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min((profile.xp || 0) / ((profile.level || 1) * 100), 1))}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                          <span className="text-[8px] font-extrabold uppercase text-muted-foreground tracking-wider">LVL</span>
                          <span className="text-sm font-black text-foreground mt-0.5">{profile.level || 1}</span>
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 flex flex-col items-center z-[60] pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 ease-out">
                          <div className="bg-background text-foreground border border-border px-3 py-1.5 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 text-left text-[11px] min-w-[120px]">
                            <p className="font-extrabold text-[9px] uppercase text-primary mb-1">XP Progress</p>
                            <div className="flex justify-between font-bold leading-none">
                              <span>{profile.xp || 0}</span>
                              <span className="text-muted-foreground">/ {(profile.level || 1) * 100} XP</span>
                            </div>
                          </div>
                          <div className="w-2 h-2 bg-background border-r border-b border-border rotate-45 -mt-1" />
                        </div>
                      </div>

                      {/* Interactive Streak Flame */}
                      <div className={`relative group flex-1 bg-card hover:bg-muted bg-gradient-to-br ${streakStyles.bgGradient} ${streakStyles.bgHoverGradient} p-2.5 rounded-xl border ${streakStyles.borderColor} ${streakStyles.borderHoverColor} transition-all duration-300 flex items-center justify-between shadow-sm hover:shadow-md cursor-default`}>
                        <div className="flex items-center gap-2">
                          <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${streakStyles.badgeGradient} flex items-center justify-center text-white shadow-md ${streakStyles.shadowColor} group-hover:scale-105 transition-transform duration-300 shrink-0`}>
                            <Flame className={`h-5 w-5 fill-white/20 ${streakStyles.pulse} ${streakStyles.scale} transition-all duration-300`} />
                          </div>
                          <div>
                            <p className={`text-[9px] font-bold ${streakStyles.textColor} uppercase tracking-wider leading-none`}>Streak</p>
                            <h4 className="text-sm font-black text-foreground mt-1 leading-none">
                              {profile.streak_current || 0} <span className="text-[10px] font-extrabold text-muted-foreground">Days</span>
                            </h4>
                          </div>
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full right-2 mb-2 flex flex-col items-center z-[60] pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 ease-out">
                          <div className="bg-background text-foreground border border-border px-3 py-1.5 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 text-left text-[10px] min-w-[140px]">
                            <p className="font-extrabold text-orange-500 mb-0.5">Keep it up! 🔥</p>
                            <p className="text-muted-foreground font-medium leading-normal">Submit attendance daily to protect your streak.</p>
                          </div>
                          <div className="w-2 h-2 bg-background border-r border-b border-border rotate-45 -mt-1" />
                        </div>
                      </div>
                    </div>

                    {/* Weekly Attendance Tracker */}
                    <div className="bg-muted/20 border border-border/40 p-3 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest leading-none">
                        <span>Weekly Attendance</span>
                        <span className="text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full text-[8px] font-bold">This Week</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1">
                        {(() => {
                          const today = new Date();
                          const day = today.getDay();
                          const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
                          const dayNames = ["M", "T", "W", "T", "F", "S", "S"];
                          const weekDates = Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(today.getFullYear(), today.getMonth(), diff + i);
                            return toLocalYYYYMMDD(d);
                          });

                          return weekDates.map((dateStr, idx) => {
                            const log = studentMetrics.weeklyLogs.find(l => l.attendance_date === dateStr);
                            const isToday = toLocalYYYYMMDD(today) === dateStr;
                            const isFuture = new Date(dateStr) > today;
                            const isApproved = log?.status === "approved";
                            const isPending = log?.status === "pending_teacher_view" || log?.status === "pending_admin_review";
                            const isRejected = log?.status === "rejected";

                            let circleStyle = "bg-muted/40 border-border text-muted-foreground/60";
                            let icon = <span className="text-[9px] font-bold">{dayNames[idx]}</span>;

                            if (isApproved) {
                              circleStyle = "bg-gradient-to-br from-orange-400 to-amber-500 border-orange-500 text-white shadow-sm shadow-orange-500/10";
                              icon = <Flame className="h-3 w-3 fill-white/20 animate-pulse" />;
                            } else if (isPending) {
                              circleStyle = "bg-amber-500/10 border-amber-500/30 text-amber-600";
                            } else if (isRejected) {
                              circleStyle = "bg-rose-500/10 border-rose-500/30 text-rose-500";
                            } else if (isToday) {
                              circleStyle = "border-primary bg-primary/5 text-primary border-2 animate-pulse";
                            } else if (isFuture) {
                              circleStyle = "bg-muted/10 border-border/20 text-muted-foreground/30";
                            }

                            return (
                              <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                                <div 
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${circleStyle}`}
                                  title={log ? `Attendance: ${log.status}` : isToday ? "Today" : isFuture ? "Future" : "No record"}
                                >
                                  {icon}
                                </div>
                                <span className={`text-[8px] font-bold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>{dayNames[idx]}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Coins & Rupiah Wallets Summary */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-xl border border-border/40 hover:bg-muted/60 transition-colors">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Coins</span>
                        <span className="text-xs font-black text-amber-500 flex items-center gap-0.5">
                          <Coins className="h-3.5 w-3.5 fill-amber-500/10" />
                          {studentMetrics.coinsBalance !== null ? studentMetrics.coinsBalance : (profile.coins || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-xl border border-border/40 hover:bg-muted/60 transition-colors">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Money</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <span className="text-[9px] font-black mr-0.5">Rp</span>
                          {(studentMetrics.rupiahBalance !== null ? studentMetrics.rupiahBalance : (profile.rupiah || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Badges Showcase Section */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest leading-none">Badges Showcase</span>
                        <Link 
                          href="/student/badges" 
                          onClick={() => setShowProfileMenu(false)}
                          className="text-[9px] font-bold text-primary hover:underline"
                        >
                          View All
                        </Link>
                      </div>
                      {studentMetrics.unlockedBadges.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {studentMetrics.unlockedBadges.map((userBadge) => {
                            const badge = userBadge.badges;
                            if (!badge) return null;
                            const Icon = IconMap[badge.icon] || Medal;
                            
                            let rarityColors = "bg-muted text-muted-foreground border-border";
                            if (badge.rarity === 'common') rarityColors = "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400";
                            else if (badge.rarity === 'rare') rarityColors = "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";
                            else if (badge.rarity === 'epic') rarityColors = "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400";
                            else if (badge.rarity === 'legendary') rarityColors = "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
                            
                            return (
                              <div 
                                key={userBadge.id} 
                                className="relative group/badge flex flex-col items-center justify-center p-2 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all duration-300"
                              >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${rarityColors} group-hover/badge:scale-110 transition-transform duration-300 shadow-sm shrink-0`}>
                                  <Icon className="w-4.5 h-4.5" />
                                </div>
                                
                                {/* Badge Tooltip on Hover */}
                                <div className="absolute bottom-full mb-2 hidden group-hover/badge:flex flex-col items-center z-[60] pointer-events-none">
                                  <div className="bg-background text-foreground border border-border px-3 py-2 rounded-xl shadow-lg text-left text-xs min-w-[160px]">
                                    <p className="font-extrabold text-foreground">{badge.name}</p>
                                    <p className={`text-[9px] uppercase font-black tracking-wider mt-0.5 ${
                                      badge.rarity === 'legendary' ? 'text-amber-500' :
                                      badge.rarity === 'epic' ? 'text-purple-500' :
                                      badge.rarity === 'rare' ? 'text-blue-500' :
                                      'text-muted-foreground'
                                    }`}>{badge.rarity} Badge</p>
                                    <p className="text-muted-foreground text-[10px] mt-1 leading-normal font-medium">{badge.description}</p>
                                  </div>
                                  <div className="w-2.5 h-2.5 bg-background border-r border-b border-border rotate-45 -mt-1.5" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/20 border border-dashed border-border rounded-xl text-center">
                          <Medal className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
                          <p className="text-[10px] text-muted-foreground font-semibold">No badges unlocked yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : role === "teacher" ? (
                  <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-2.5 rounded-xl border border-border/40 mb-3">
                    <div className="bg-card border border-border/50 p-2 rounded-lg text-center">
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider leading-none">Classes</p>
                      <p className="text-base font-black text-primary mt-1 leading-none">{metrics.classesCount ?? "-"}</p>
                    </div>
                    <div className="bg-card border border-border/50 p-2 rounded-lg text-center">
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider leading-none">Students</p>
                      <p className="text-base font-black text-primary mt-1 leading-none">{metrics.studentsCount ?? "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40 mb-3">
                    <div className="bg-card border border-border/50 p-1.5 text-center rounded-lg">
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider leading-none">Students</p>
                      <p className="text-sm font-black text-primary mt-1 leading-none">{metrics.totalStudents ?? "-"}</p>
                    </div>
                    <div className="bg-card border border-border/50 p-1.5 text-center rounded-lg">
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider leading-none">Flags</p>
                      <p className="text-sm font-black text-rose-500 mt-1 leading-none">{metrics.pendingReviews ?? "-"}</p>
                    </div>
                    <div className="bg-card border border-border/50 p-1.5 text-center rounded-lg">
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider leading-none">Payouts</p>
                      <p className="text-sm font-black text-amber-500 mt-1 leading-none">{metrics.pendingWithdrawals ?? "-"}</p>
                    </div>
                  </div>
                )}

                {/* Quick Preferences */}
                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/50 space-y-2 mb-3 mt-3">
                  <div className="flex items-center justify-between text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    <span>Preferences</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-2">
                    <span className="text-[11px] font-semibold text-foreground">Theme</span>
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border hover:bg-muted font-bold text-[10px] text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="h-3 w-3 text-amber-500" />
                          <span>Light</span>
                        </>
                      ) : (
                        <>
                          <Moon className="h-3 w-3 text-indigo-500" />
                          <span>Dark</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-2">
                    <span className="text-[11px] font-semibold text-foreground">Language</span>
                    <button
                      onClick={() => {
                        const newLocale = locale === "en" ? "id" : "en";
                        localStorage.setItem("app-locale", newLocale);
                        window.location.reload();
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border hover:bg-muted font-bold text-[10px] text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                      <Globe className="h-3 w-3 text-primary" />
                      <span>{locale === "en" ? "EN" : "ID"}</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <Link
                    href={`/${role}/settings`}
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] shadow-md shadow-primary/10 hover:bg-primary/95"
                  >
                    {role === "student" ? <User className="h-3 w-3" /> : <Settings className="h-3 w-3" />}
                    {role === "student" ? t.navigation.profile : t.navigation.updateProfile}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 font-black text-[10px] uppercase tracking-wider transition-colors active:scale-[0.98]"
                  >
                    <LogOut className="h-3 w-3" />
                    {t.navigation.signOut}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="lg:ml-64 pt-14 pb-20 lg:pt-16 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

