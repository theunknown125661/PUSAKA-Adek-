"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toLocalYYYYMMDD } from "@/lib/utils/format";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { GraduationCap, Trophy, ChevronRight, Lock, Map, Clock, ArrowRight, Play, ExternalLink, Calendar, Plus, X, Coins, CheckCircle2, Zap, Flame, ShieldAlert, Sparkles, MapPin, Check, Wallet, Gift, Store, History } from "lucide-react";
import { XPProgressBar } from "@/components/shared/xp-progress-bar";
import type { AttendanceLog } from "@/lib/types/database";
import { calculateLevelAndProgress } from "@/lib/utils/gamification";
import { useCheckinState } from "@/lib/hooks/use-checkin-state";

export default function StudentDashboard() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [userQuests, setUserQuests] = useState<any[]>([]);
  const [questsProgress, setQuestsProgress] = useState({ completed: 0, total: 3 });
  const [wallets, setWallets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [rewardsPreview, setRewardsPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdownText, setCountdownText] = useState<string>("");

  const checkinState = useCheckinState(profile?.id);
  const { rewardRules, isHoliday, holidayConfig: holidayToday, weekHolidays, status: checkinStatus, canCheckIn, timePhase } = checkinState;
  const isHolidayToday = isHoliday;
  const isAbsentToday = checkinStatus === "absent" || checkinStatus === "after_absent";


  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = toLocalYYYYMMDD();
    const todayDate = new Date();
    const day = todayDate.getDay();
    const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1); // Monday of this week
    const monday = new Date(todayDate.getFullYear(), todayDate.getMonth(), diff);
    const mondayStr = toLocalYYYYMMDD(monday);

    async function load() {
      try {
        const [
          attRes,
          streakRes,
          questRes,
          walletRes,
          txRes,
          shopRes,
          ownedCosmeticsRes
        ] = await Promise.all([
          supabase.from("attendance_logs").select("*").eq("student_id", profile!.id).gte("attendance_date", mondayStr),
          supabase.from("streaks").select("*").eq("student_id", profile!.id).maybeSingle(),
          supabase.from("user_quests").select("*, quests(*)").eq("user_id", profile!.id),
          supabase.from("wallets").select("*").eq("user_id", profile!.id),
          supabase.from("wallet_transactions").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(3),
          supabase.from("shop_items").select("*, cosmetics(*)").eq("active", true),
          supabase.from("user_cosmetics").select("cosmetic_id").eq("user_id", profile!.id)
        ]);

        const todayLog = attRes.data ? attRes.data.find(log => log.attendance_date === today) : null;
        if (attRes.data) {
          setRecentLogs(attRes.data);
          if (todayLog) setTodayAttendance(todayLog);
        }
        
        if (streakRes.data) {
          const isStreakBrokenToday = !todayLog && timePhase === 'ended' && !isHoliday && (rewardRules?.economy_config?.active_days?.includes(new Date().getDay()) ?? false);
          const displayStreak = isStreakBrokenToday ? 0 : (streakRes.data.current_streak || 0);
          setStreak({ current: displayStreak, longest: streakRes.data.longest_streak });
        } else {
          setStreak({ current: 0, longest: 0 }); 
        }

        if (questRes.data) {
          const typedData = questRes.data as unknown as { id: string; status: string; quests: { active: boolean; title: string; reward_xp: number; reward_coins: number } | null }[];
          const activeQuests = typedData.filter((uq) => uq.quests && uq.quests.active);
          setUserQuests(activeQuests);
          
          const completed = activeQuests.filter((uq) => uq.status === 'completed').length;
          setQuestsProgress({ completed, total: activeQuests.length || 3 });
        } else {
          setQuestsProgress({ completed: 0, total: 3 });
        }

        if (walletRes.data) {
          setWallets(walletRes.data);
        }

        if (txRes.data) {
          setRecentTransactions(txRes.data);
        }

        if (shopRes.data && ownedCosmeticsRes.data) {
          const ownedSet = new Set(ownedCosmeticsRes.data.map(c => c.cosmetic_id));
          const unowned = (shopRes.data || []).filter(item => {
            if (item.cosmetic_id) {
              return !ownedSet.has(item.cosmetic_id);
            }
            return true; // e.g. streak shield (can purchase multiple times)
          });
          unowned.sort((a, b) => (a.price_coins || 0) - (b.price_coins || 0));
          if (unowned.length > 0) {
            setRewardsPreview(unowned[0]);
          } else {
            setRewardsPreview(null);
          }
        }
      } catch (error) {
        console.error("Error loading student dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile]);

  useEffect(() => {
    if ((!rewardRules && !checkinState.activePolicy) || todayAttendance) {
      setCountdownText("");
      return;
    }

    const updateCountdown = () => {
      const todayDate = new Date();
      if (checkinState.isWeekend || checkinState.isHoliday) {
        setCountdownText("");
        return;
      }

      let startStr = "";
      let endStr = "";
      
      if (checkinState.activePolicy) {
         startStr = checkinState.activePolicy.checkin_open_at;
         endStr = checkinState.activePolicy.absent_after_at;
      } else if (rewardRules) {
         startStr = rewardRules.attendance_start_time;
         endStr = rewardRules.attendance_end_time;
      }

      if (!startStr || !endStr) return;

      const [sH, sM] = startStr.split(":").map(Number);
      const [eH, eM] = endStr.split(":").map(Number);
      
      const startDeadline = new Date();
      startDeadline.setHours(sH, sM, 0, 0);
      
      const endDeadline = new Date();
      endDeadline.setHours(eH, eM, 0, 0);

      const nowMs = todayDate.getTime();
      
      if (nowMs < startDeadline.getTime()) {
        const diffMs = startDeadline.getTime() - nowMs;
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);
        setCountdownText(`Opens in ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      } else if (nowMs < endDeadline.getTime()) {
        const diffMs = endDeadline.getTime() - nowMs;
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);
        setCountdownText(`Closes in ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      } else {
        setCountdownText("Time's up");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [rewardRules, checkinState.activePolicy, todayAttendance, checkinState.isWeekend, checkinState.isHoliday]);

  if (!isClient || loading || checkinState.loading) {
    return <DashboardSkeleton />;
  }

  // Get dynamic progressive flame levels (cool orange up to supernova blue)
  const getStreakStyles = (currentStreak: number) => {
    if (currentStreak === 0) {
      return {
        name: "Cold ❄️",
        iconColor: "text-slate-400 dark:text-slate-500",
        fillColor: "fill-slate-400/10",
        bgGradient: "from-slate-100 to-slate-50 dark:from-slate-900/40 dark:to-slate-800/20",
        badgeGradient: "from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600",
        shadowColor: "shadow-slate-500/5",
        textColor: "text-slate-500",
        badgeSize: "h-20 w-20",
        iconSize: "h-10 w-10",
        pulse: "",
        glowColor: "rgba(148, 163, 184, 0.1)",
      };
    } else if (currentStreak >= 30) {
      return {
        name: "Supernova 🔥",
        iconColor: "text-cyan-500",
        fillColor: "fill-cyan-500/30",
        bgGradient: "from-blue-600/15 via-cyan-500/10 to-sky-400/5",
        badgeGradient: "from-blue-600 via-cyan-500 to-sky-400",
        shadowColor: "shadow-blue-500/40",
        textColor: "text-cyan-600 dark:text-cyan-400",
        badgeSize: "h-28 w-28",
        iconSize: "h-14 w-14",
        pulse: "animate-flame-flicker",
        glowColor: "rgba(6, 182, 212, 0.4)",
      };
    } else if (currentStreak >= 14) {
      return {
        name: "Ultra Violet ⚡",
        iconColor: "text-violet-500",
        fillColor: "fill-violet-500/30",
        bgGradient: "from-violet-600/15 via-indigo-500/10 to-pink-500/5",
        badgeGradient: "from-violet-600 to-pink-500",
        shadowColor: "shadow-violet-500/30",
        textColor: "text-violet-600 dark:text-violet-400",
        badgeSize: "h-26 w-26",
        iconSize: "h-13 w-13",
        pulse: "animate-flame-flicker",
        glowColor: "rgba(168, 85, 247, 0.3)",
      };
    } else if (currentStreak >= 7) {
      return {
        name: "Solar Flare ☀️",
        iconColor: "text-rose-500",
        fillColor: "fill-rose-500/30",
        bgGradient: "from-rose-500/15 via-red-500/10 to-orange-500/5",
        badgeGradient: "from-rose-500 to-red-500",
        shadowColor: "shadow-rose-500/30",
        textColor: "text-rose-600 dark:text-rose-400",
        badgeSize: "h-24 w-24",
        iconSize: "h-12 w-12",
        pulse: "animate-flame-flicker",
        glowColor: "rgba(244, 63, 94, 0.25)",
      };
    } else if (currentStreak >= 3) {
      return {
        name: "Combustion 🌋",
        iconColor: "text-red-500",
        fillColor: "fill-red-500/20",
        bgGradient: "from-red-500/10 to-orange-500/5",
        badgeGradient: "from-red-500 to-orange-500",
        shadowColor: "shadow-red-500/20",
        textColor: "text-red-600 dark:text-red-400",
        badgeSize: "h-22 w-22",
        iconSize: "h-11 w-11",
        pulse: "animate-flame-flicker",
        glowColor: "rgba(239, 68, 68, 0.2)",
      };
    } else {
      return {
        name: "Kindling 🌱",
        iconColor: "text-orange-500",
        fillColor: "fill-orange-500/10",
        bgGradient: "from-orange-500/10 to-amber-500/5",
        badgeGradient: "from-orange-400 to-amber-500",
        shadowColor: "shadow-orange-500/10",
        textColor: "text-orange-600 dark:text-orange-400",
        badgeSize: "h-20 w-20",
        iconSize: "h-10 w-10",
        pulse: "",
        glowColor: "rgba(249, 115, 22, 0.15)",
      };
    }
  };

  const streakStyles = getStreakStyles(streak.current);
  
  // XP Progress Calculation
  const currentXp = profile?.xp || 0;
  const { 
    level: currentLevel, 
    xpInCurrentLevel, 
    xpForNextLevel, 
    progressPct: xpPct 
  } = calculateLevelAndProgress(currentXp, rewardRules?.economy_config, profile?.level);

  // Wallets check
  const coinWallet = wallets.find(w => w.currency_type === "COIN");
  const rupiahWallet = wallets.find(w => w.currency_type === "RUPIAH");

  const coinsBalance = coinWallet ? coinWallet.balance_available : (profile?.coins || 0);
  const rupiahBalance = rupiahWallet ? rupiahWallet.balance_available : 0;

  const hasClass = !!(profile as unknown as { class_name?: string })?.class_name;
  const hasCheckedInToday = !!todayAttendance;
  const isApproved = todayAttendance?.status === "approved";
  const isRejected = todayAttendance?.status === "rejected";
  const isPending = todayAttendance?.status === "pending_teacher_view" || todayAttendance?.status === "pending_admin_review";

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-md lg:max-w-4xl mx-auto px-1">
      {/* Dynamic particles and flicker micro-animations style block */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flame-flicker {
          0%, 100% { transform: scale(1) rotate(-1deg); }
          50% { transform: scale(1.06) rotate(1deg); filter: brightness(1.1); }
        }
        @keyframes particle-rise {
          0% { transform: translateY(10px) scale(0.6); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-30px) scale(0.2); opacity: 0; }
        }
        .animate-flame-flicker {
          animation: flame-flicker 1.8s ease-in-out infinite;
        }
        .particle {
          animation: particle-rise 2s ease-out infinite;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}} />

      {/* Responsive Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column (Streak Calendar + Check-in CTA + Wallet Row) */}
        <div className="space-y-6">
          {/* Dynamic Streak Calendar Hero Card */}
          <div className={`relative rounded-[32px] overflow-hidden bg-gradient-to-br ${streakStyles.bgGradient} border border-border/30 w-full shadow-sm flex flex-col p-6 sm:p-8 transition-all duration-500 gap-8 min-h-[400px]`}>
            {/* Top: Current Streak big fire */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div 
                className={`${streakStyles.badgeSize} rounded-[32px] bg-gradient-to-br ${streakStyles.badgeGradient} flex items-center justify-center text-white shadow-xl ${streakStyles.shadowColor} hover:scale-105 transition-transform duration-500 mb-6 relative`}
                style={{ "--glow-color": streakStyles.glowColor } as React.CSSProperties}
              >
                <Flame className={`${streakStyles.iconSize} fill-white/20 ${streakStyles.pulse} transition-all duration-300`} />
                {/* Float particles if streak is active */}
                {streak.current > 0 && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[32px]">
                    <div className="particle absolute bottom-2 left-1/3 w-1 h-1 bg-amber-400 rounded-full" style={{ animationDelay: '0s' }} />
                    <div className="particle absolute bottom-2 left-1/2 w-1.5 h-1.5 bg-orange-400 rounded-full" style={{ animationDelay: '0.5s' }} />
                    <div className="particle absolute bottom-2 left-2/3 w-1 h-1 bg-yellow-400 rounded-full" style={{ animationDelay: '1s' }} />
                    <div className="particle absolute bottom-2 left-2/5 w-1 h-1 bg-red-400 rounded-full" style={{ animationDelay: '1.5s' }} />
                  </div>
                )}
              </div>
              <h2 className="text-5xl font-black text-foreground tracking-tighter leading-none mb-2">
                {streak.current} <span className="text-2xl font-bold text-muted-foreground">{streak.current < 2 ? "Day" : "Days"}</span>
              </h2>
              <p className={`text-sm font-extrabold ${streakStyles.textColor} uppercase tracking-widest`}>
                {streak.current >= 30 ? "Supernova 🔥" : streak.current >= 14 ? "Ultra Violet ⚡" : streak.current >= 7 ? "Solar Flare ☀️" : streak.current >= 3 ? "Combustion 🌋" : streak.current > 0 ? "Kindling 🌱" : "Cold ❄️"}
              </p>

              {/* Daily status pill / Countdown */}
              {(() => {
                if (todayAttendance) {
                  const status = todayAttendance.status;
                  if (status === "approved") {
                    return (
                      <div className="mt-3 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Streak Secured</span>
                      </div>
                    );
                  } else if (status.startsWith("pending_")) {
                    return (
                      <div className="mt-3 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full animate-pulse">
                        <Clock className="h-3 w-3 text-amber-500 animate-spin-slow" />
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Awaiting Approval</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-3 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                        <ShieldAlert className="h-3 w-3 text-rose-500" />
                        <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Check-in Rejected</span>
                      </div>
                    );
                  }
                } else {
                  const activeDays = rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
                  const isWeekend = !activeDays.includes(new Date().getDay());
                  if (isWeekend) {
                    return (
                      <div className="mt-3 flex items-center gap-1 bg-slate-500/10 border border-slate-500/20 px-3 py-1 rounded-full">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Weekend</span>
                      </div>
                    );
                  } else if (isHolidayToday && holidayToday) {
                    return (
                      <div 
                        className="mt-3 flex items-center gap-1 px-3 py-1 rounded-full border shadow-sm transition-all"
                        style={{
                          backgroundColor: `${holidayToday.color_hex || "#3b82f6"}10`,
                          borderColor: `${holidayToday.color_hex || "#3b82f6"}30`,
                        }}
                      >
                        <span 
                          className="text-[9px] font-black uppercase tracking-wider"
                          style={{ color: holidayToday.color_hex || "#3b82f6" }}
                        >
                          {holidayToday.name}
                        </span>
                      </div>
                    );
                  } else if (isAbsentToday) {
                    return (
                      <div className="mt-3 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                        <ShieldAlert className="h-3 w-3 text-rose-500" />
                        <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Absent Today</span>
                      </div>
                    );
                  } else if (countdownText) {
                    return (
                      <div className="mt-3 flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider">Check-in Open</span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>

            {/* Bottom: 7-day mini calendar tracker */}
            <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center gap-1.5">
                {(() => {
                  const todayDate = new Date();
                  const day = todayDate.getDay();
                  const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
                  const dates = Array.from({ length: 7 }, (_, i) => {
                    return new Date(todayDate.getFullYear(), todayDate.getMonth(), diff + i);
                  });

                  return dates.map((date, idx) => {
                    const dateStr = toLocalYYYYMMDD(date);
                    const log = recentLogs.find(l => l.attendance_date && l.attendance_date.startsWith(dateStr));
                    const holiday = weekHolidays.find(h => h.date && h.date.startsWith(dateStr));
                    const isToday = toLocalYYYYMMDD(todayDate) === dateStr;
                    const isCheckedIn = !!log && log.status === "approved";
                    const isPending = !!log && (log.status === "pending_teacher_view" || log.status === "pending_admin_review");
                    const isRejected = !!log && log.status === "rejected";
                    const isWeekend = !(rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5]).includes(date.getDay());
                    
                    let hasDatePassed = false;
                    if (dateStr > toLocalYYYYMMDD(todayDate)) {
                        hasDatePassed = false;
                    } else if (isToday) {
                        const endTime = rewardRules?.economy_config?.attendance_end_time;
                        if (endTime) {
                            const nowTime = new Date();
                            const timeStr = `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;
                            if (timeStr > endTime) hasDatePassed = true;
                        }
                    } else {
                        hasDatePassed = true;
                    }
                    const isAbsent = !log && !holiday && !isWeekend && hasDatePassed;

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 group relative cursor-default">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 flex-col items-center z-10 pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 hidden sm:flex">
                          <div className="bg-background text-foreground border border-border px-2 py-1 rounded-lg shadow-lg text-[9px] font-bold whitespace-nowrap capitalize">
                            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            {log ? (
                              log.status === "approved" ? (
                                log.before_early_cutoff 
                                  ? ` (${t.history.early})` 
                                  : log.within_time_window === false 
                                    ? ` (${t.history.late})` 
                                    : ` (${t.history.onTime})`
                              ) : log.status.startsWith("pending_") 
                                ? ` (${t.history.filters.pending})` 
                                : ` (${t.history.filters.rejected})`
                            ) : holiday ? ` (${holiday.name})` : isWeekend ? ` (Weekend)` : isAbsent ? ` (Absent)` : ""}
                          </div>
                          <div className="w-1.5 h-1.5 bg-background border-r border-b border-border rotate-45 -mt-1" />
                        </div>
                        
                        <div 
                          className={`w-full aspect-square max-w-[32px] rounded-xl flex items-center justify-center transition-all duration-300 ${
                            isCheckedIn 
                              ? `bg-gradient-to-br ${streakStyles.badgeGradient} shadow-md ${streakStyles.shadowColor} scale-110` 
                              : isPending
                                ? "bg-amber-500/10 border-2 border-amber-500/30 text-amber-500 animate-pulse"
                                : (isRejected || isAbsent)
                                  ? "bg-rose-500/10 border-2 border-rose-500/30 text-rose-500"
                                  : holiday
                                  ? "border-2 shadow-sm"
                                  : isWeekend
                                    ? "bg-slate-500/10 border-2 border-slate-500/30 text-slate-500"
                                    : isToday
                                      ? "bg-muted border-2 border-primary/50"
                                      : dateStr > toLocalYYYYMMDD(todayDate)
                                        ? "bg-card border border-border/40 text-muted-foreground/30"
                                        : "bg-muted border border-border/50"
                          }`}
                          style={(!isCheckedIn && !isPending && !isRejected && !isAbsent && holiday) ? {
                            backgroundColor: `${holiday?.color_hex || "#3b82f6"}20`,
                            borderColor: `${holiday?.color_hex || "#3b82f6"}50`,
                            color: holiday?.color_hex || "#3b82f6"
                          } : {}}
                        >
                          {isCheckedIn ? (
                            <Flame className="h-4 w-4 text-white fill-white/20" />
                          ) : isPending ? (
                            <Clock className="h-4 w-4" />
                          ) : isRejected ? (
                            <ShieldAlert className="h-4 w-4" />
                          ) : (
                            <span className={`text-[10px] font-bold ${(!holiday && isToday) ? 'text-primary' : (!holiday) ? 'text-muted-foreground' : ''}`}>
                              {date.getDate()}
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Check-in CTA Card */}
          <div className="card rounded-[32px] p-6 border border-border/30 bg-card text-center space-y-4 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 opacity-50 pointer-events-none" />

            {(() => {
              const activeDays = rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
              const isWeekendToday = !activeDays.includes(new Date().getDay());

              return (
                <>
                  <h2 className="text-lg font-black text-foreground relative z-10">
                    {!hasClass ? "Ready for today?" : isHolidayToday ? "Enjoy your holiday!" : isWeekendToday ? "Enjoy your day off!" : "Ready for today?"}
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed relative z-10">
                    {hasClass 
                      ? isHolidayToday
                        ? "School is closed for a holiday. Relax and recharge!"
                        : isWeekendToday
                        ? "It's not an active school day. Relax and recharge!"
                        : hasCheckedInToday
                          ? isApproved
                            ? "Excellent! Your attendance is verified and your streak is secured today."
                            : isPending
                              ? "We've received your check-in! Once a teacher or admin approves it, your streak will update."
                              : "Your check-in was rejected. Please contact your teacher if you believe this is an error."
                          : isAbsentToday
                            ? "You missed today's check-in window. This day is counted as absent."
                            : `Check in to keep your streak alive and earn ${rewardRules?.economy_config?.xp?.attendance_present ?? 50} XP + Coins!`
                      : "Please join a class to begin logging your daily attendance."}
                  </p>
                  
                  <div className="pt-2 flex justify-center relative z-10">
                    {!hasClass ? (
                      <Link 
                        href="/student/class" 
                        className="w-full max-w-[220px] bg-primary text-white font-extrabold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 border-0 hover:brightness-105 active:scale-[0.98] transition-all duration-200"
                      >
                        <GraduationCap className="h-4.5 w-4.5" />
                        Join Class
                      </Link>
                    ) : isHolidayToday || isWeekendToday ? (
                      <div className="flex items-center justify-center gap-2.5 bg-slate-500/10 border border-slate-500/20 px-5 py-3.5 rounded-2xl w-full max-w-[260px] shadow-inner">
                        <span className="text-xs font-extrabold text-slate-500">{isHolidayToday ? "School closed today" : "Not a school day"}</span>
                      </div>
                    ) : hasCheckedInToday ? (
                      <div className="flex items-center justify-center gap-2.5 bg-muted/40 border border-border/30 px-5 py-3.5 rounded-2xl w-full max-w-[260px] shadow-inner">
                        {isApproved && (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-500">Streak Secured today!</span>
                          </>
                        )}
                        {isPending && (
                          <>
                            <Clock className="h-5 w-5 text-amber-500 shrink-0 animate-spin-slow" />
                            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-500">Awaiting approval...</span>
                          </>
                        )}
                        {isRejected && (
                          <>
                            <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
                            <span className="text-xs font-extrabold text-rose-600 dark:text-rose-500">Check-in Rejected</span>
                          </>
                        )}
                      </div>
                    ) : isAbsentToday ? (
                      <div className="flex items-center justify-center gap-2.5 bg-rose-500/10 border border-rose-500/20 px-5 py-3.5 rounded-2xl w-full max-w-[260px] shadow-inner">
                        <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
                        <span className="text-xs font-extrabold text-rose-600 dark:text-rose-500">Absent</span>
                      </div>
                    ) : countdownText.startsWith("Opens in") ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 bg-muted/40 border border-border/30 px-5 py-3 rounded-2xl w-full max-w-[260px] shadow-inner">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs font-extrabold text-muted-foreground">Not Open Yet</span>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground/80">{countdownText}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full max-w-[220px]">
                        <Link 
                          href="/student/check-in" 
                          className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 border-0 hover:brightness-105 active:scale-[0.98] transition-all duration-200"
                        >
                          <MapPin className="h-4.5 w-4.5 animate-bounce" />
                          {t.dashboard.checkInNow}
                        </Link>
                        {countdownText && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-wider mt-3 bg-primary/10 px-3 py-1.5 rounded-full animate-pulse">
                            <Clock className="h-3.5 w-3.5 animate-spin-slow" />
                            {countdownText.startsWith("Closes in") ? countdownText : `Closes in ${countdownText}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Level & XP Card */}
          <div className="card rounded-[32px] p-5 border border-border/30 bg-card flex flex-col justify-between shadow-sm hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Current Level</span>
                <p className="text-3xl font-black text-foreground mt-1.5 leading-none">Level {currentLevel}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <GraduationCap className="h-5.5 w-5.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2">
                <XPProgressBar 
                  xp={currentXp} 
                  economyConfig={rewardRules?.economy_config} 
                  userLevel={profile?.level} 
                  showDetails={false}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground leading-none">
                <span>{xpInCurrentLevel} / {xpForNextLevel} XP (Total: {currentXp} XP)</span>
                <span>Next Level {currentLevel + 1}</span>
              </div>
            </div>
          </div>

          {/* Wallets (Coins & Rupiah) Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Coins Wallet Balance */}
            <div className="card rounded-[24px] p-4 border border-border/30 bg-card flex flex-col justify-between shadow-sm hover:translate-y-[-2px] transition-all duration-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Coins</span>
                  <Coins className="h-4.5 w-4.5 text-amber-500 fill-amber-500/10 shrink-0" />
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-500 mt-2.5 leading-none truncate">
                  {coinsBalance.toLocaleString("id-ID")}
                </p>
              </div>
              <p className="text-[8px] font-bold text-muted-foreground mt-3 leading-none uppercase tracking-wider">Virtual Coin</p>
            </div>

            {/* Rupiah Wallet Balance */}
            <div className="card rounded-[24px] p-4 border border-border/30 bg-card flex flex-col justify-between shadow-sm hover:translate-y-[-2px] transition-all duration-300">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Rupiah</span>
                  <Wallet className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500 mt-2.5 leading-none truncate">
                  Rp{rupiahBalance.toLocaleString("id-ID")}
                </p>
              </div>
              <p className="text-[8px] font-bold text-muted-foreground mt-3 leading-none uppercase tracking-wider">Real Cash</p>
            </div>
          </div>
        </div>

        {/* Right Column (Quests + Rewards Preview + Recent Activity Feed) */}
        <div className="space-y-6">
          {/* Quests Card */}
          <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <h3 className="font-black text-sm text-foreground">Today's Quests</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {questsProgress.completed}/{questsProgress.total} Completed
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {userQuests.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-border/30 bg-muted/10 rounded-2xl text-muted-foreground text-xs font-semibold">
                  No quests active today. Check back tomorrow!
                </div>
              ) : (
                userQuests.slice(0, 3).map((uq, index) => {
                  const quest = uq.quests;
                  const isCompleted = uq.status === "completed";

                  return (
                    <div 
                      key={uq.id} 
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                        isCompleted 
                          ? "bg-muted/10 border-border/20 opacity-60" 
                          : "bg-muted/30 hover:bg-muted/50 border-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 cursor-default">
                          {isCompleted ? (
                            <div className="h-6 w-6 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="h-6 w-6 rounded-lg border-2 border-muted-foreground/30 flex items-center justify-center text-muted-foreground/30 text-xs font-bold">
                              {index + 1}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-extrabold text-xs text-foreground truncate leading-snug ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {quest?.title || "Daily Quest"}
                          </h4>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                            {quest?.description || "Complete to earn rewards!"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 pl-2">
                        {isCompleted ? (
                          <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Done
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                            +{quest?.reward_xp} XP
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Rewards Preview Card */}
          <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <h3 className="font-black text-sm text-foreground">Next Up Reward</h3>
            
            {rewardsPreview ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-muted/30 border border-border/20 p-4 rounded-[24px] relative group hover:bg-muted/50 transition-colors">
                  {/* Premium Cosmetic Preview Box */}
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 flex items-center justify-center border border-amber-500/20 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                    {rewardsPreview.category === "theme" ? (
                      <div className="flex flex-col gap-0.5 w-7 h-7 rounded overflow-hidden rotate-12 shadow">
                        <div className="bg-primary h-1/2 w-full" />
                        <div className="bg-amber-500 h-1/2 w-full" />
                      </div>
                    ) : rewardsPreview.category === "frame" ? (
                      <div className="relative h-8 w-8 rounded-full border-2 border-amber-400 flex items-center justify-center p-0.5 rotate-12">
                        <div className="bg-muted w-full h-full rounded-full" />
                      </div>
                    ) : rewardsPreview.category === "shield" ? (
                      <ShieldAlert className="h-6 w-6 text-amber-500 rotate-12" />
                    ) : (
                      <Gift className="h-6 w-6 text-amber-500 rotate-12" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                        {rewardsPreview.category}
                      </span>
                      {rewardsPreview.featured && (
                        <span className="text-[8px] font-black uppercase bg-primary text-white px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-xs text-foreground mt-1.5 leading-none truncate">
                      {rewardsPreview.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate leading-none">
                      {rewardsPreview.description}
                    </p>
                  </div>

                  {/* Price Tag */}
                  <div className="text-right pl-2 shrink-0">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-500 flex items-center gap-0.5">
                      <Coins className="h-3 w-3 fill-amber-500/10" />
                      {rewardsPreview.price_coins || 0}
                    </span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase block mt-0.5">Coins</span>
                  </div>
                </div>

                <Link 
                  href="/student/shop" 
                  className="w-full py-3 bg-muted hover:bg-muted/80 text-foreground font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 border border-border/40 active:scale-[0.99] transition-all"
                >
                  <Store className="h-3.5 w-3.5" />
                  View in Shop
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 bg-muted/10 border border-dashed border-border/30 rounded-[24px]">
                <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-xs font-extrabold text-foreground">All Rewards Owned!</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">You've unlocked every shop item. Nice job!</p>
              </div>
            )}
          </div>

          {/* Recent Activity Card (Wallet transactions list) */}
          <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-black text-sm text-foreground">Recent Activity</h3>
              </div>
              <Link 
                href="/student/wallet" 
                className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider"
              >
                View Wallet
              </Link>
            </div>

            <div className="space-y-0 divide-y divide-border/20">
              {recentTransactions.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs font-semibold">
                  No recent wallet activity.
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const isGain = tx.amount > 0;
                  const isCoin = tx.currency_type === "COIN";
                  const formattedDate = new Date(tx.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <div key={tx.id} className="flex justify-between items-center py-3.5 text-xs font-semibold first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCoin 
                            ? "bg-amber-500/10 text-amber-600" 
                            : isGain 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : "bg-rose-500/10 text-rose-600"
                        }`}>
                          {isCoin ? (
                            <Coins className="h-4 w-4 fill-amber-500/10" />
                          ) : (
                            <Wallet className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-foreground truncate leading-snug">
                            {tx.note || tx.event_type}
                          </h4>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{formattedDate}</p>
                        </div>
                      </div>
                      <div className="text-right pl-2 shrink-0">
                        <span className={`font-black text-xs block ${isGain ? "text-emerald-600 dark:text-emerald-500" : "text-rose-500"}`}>
                          {isGain ? "+" : ""}{tx.amount.toLocaleString("id-ID")}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-wider block mt-0.5 ${isCoin ? "text-amber-600" : "text-emerald-600"}`}>
                          {tx.currency_type}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Skeleton loaders to prevent jarring layout shifts during data fetches
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-md lg:max-w-4xl mx-auto px-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column Skeleton */}
        <div className="space-y-6">
          {/* Streak Hero Card Skeleton */}
          <div className="bg-card border border-border/30 rounded-[32px] aspect-[4/3] w-full p-6 flex flex-col justify-between animate-pulse">
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="h-24 w-24 rounded-3xl bg-muted" />
              <div className="h-8 w-32 bg-muted rounded-xl" />
              <div className="h-4 w-24 bg-muted rounded-lg" />
            </div>
            <div className="h-16 bg-muted/60 border border-border/40 rounded-2xl p-4 flex gap-2" />
          </div>

          {/* Check-in CTA Card Skeleton */}
          <div className="bg-card border border-border/30 rounded-[32px] p-6 space-y-4 animate-pulse">
            <div className="h-6 w-40 bg-muted rounded-lg mx-auto" />
            <div className="h-4 w-60 bg-muted rounded-md mx-auto" />
            <div className="h-12 w-44 bg-muted rounded-2xl mx-auto mt-2" />
          </div>

          {/* Level & XP Card Skeleton */}
          <div className="h-32 bg-card border border-border/30 rounded-[32px] p-5 animate-pulse" />

          {/* Wallets (Coins & Rupiah) Grid Skeleton */}
          <div className="grid grid-cols-2 gap-3 animate-pulse">
            <div className="h-28 bg-card border border-border/30 rounded-[24px] p-4" />
            <div className="h-28 bg-card border border-border/30 rounded-[24px] p-4" />
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
          {/* Quests Skeleton */}
          <div className="bg-card border border-border/30 rounded-[32px] p-6 space-y-4 animate-pulse">
            <div className="flex justify-between">
              <div className="h-6 w-24 bg-muted rounded-lg" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="space-y-3 pt-2">
              <div className="h-14 bg-muted/40 border border-border/10 rounded-2xl" />
              <div className="h-14 bg-muted/40 border border-border/10 rounded-2xl" />
              <div className="h-14 bg-muted/40 border border-border/10 rounded-2xl" />
            </div>
          </div>

          {/* Rewards Preview Skeleton */}
          <div className="bg-card border border-border/30 rounded-[32px] p-6 space-y-4 animate-pulse">
            <div className="h-6 w-36 bg-muted rounded-lg" />
            <div className="flex items-center gap-4 bg-muted/20 border border-border/20 p-4 rounded-2xl">
              <div className="h-12 w-12 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-muted rounded" />
                <div className="h-3 w-40 bg-muted rounded" />
              </div>
            </div>
            <div className="h-10 w-full bg-muted rounded-xl" />
          </div>

          {/* Recent Activity Skeleton */}
          <div className="bg-card border border-border/30 rounded-[32px] p-6 space-y-4 animate-pulse">
            <div className="flex justify-between">
              <div className="h-6 w-32 bg-muted rounded-lg" />
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
            <div className="space-y-3">
              <div className="h-12 bg-muted/30 rounded-xl" />
              <div className="h-12 bg-muted/30 rounded-xl" />
              <div className="h-12 bg-muted/30 rounded-xl" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

