"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/utils/format";
import {
  MapPin, Flame, Trophy, Target, Wallet, Clock, ChevronRight, Calendar,
  Zap, Award, Star, ShieldAlert, CheckCircle2, GraduationCap, BookOpen, ClipboardList
} from "lucide-react";
import type { AttendanceLog, Wallet as WalletType, StudentBadge } from "@/lib/types/database";
import AvatarDisplay from "@/components/profile/avatar-display";

export default function StudentDashboard() {
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [badges, setBadges] = useState<StudentBadge[]>([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [questsProgress, setQuestsProgress] = useState({ completed: 0, total: 3 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    async function load() {
      const [attRes, walRes, badgeRes, appRes, streakRes, questRes] = await Promise.all([
        supabase.from("attendance_logs").select("*").eq("student_id", profile!.id).eq("attendance_date", today).limit(1),
        supabase.from("wallets").select("*").eq("user_id", profile!.id).eq("currency_type", "RUPIAH").maybeSingle(),
        supabase.from("student_badges").select("*, badges(*)").eq("student_id", profile!.id),
        supabase.from("attendance_logs").select("id", { count: "exact" }).eq("student_id", profile!.id).eq("status", "approved"),
        supabase.from("streaks").select("*").eq("student_id", profile!.id).single(),
        supabase.from("user_quests").select("*, quests(*)").eq("user_id", profile!.id)
      ]);

      if (attRes.data?.[0]) setTodayAttendance(attRes.data[0]);
      if (walRes.data) setWallet(walRes.data as any);
      if (badgeRes.data) setBadges(badgeRes.data as unknown as StudentBadge[]);
      setTotalApproved(appRes.count || 0);
      
      if (streakRes.data) {
        setStreak({ current: streakRes.data.current_streak, longest: streakRes.data.longest_streak });
      } else {
        setStreak({ current: 0, longest: 0 }); 
      }

      if (questRes.data) {
        const dailyQuests = questRes.data.filter((uq: any) => uq.quests && uq.quests.type === 'daily');
        const completed = dailyQuests.filter((uq: any) => uq.status === 'completed').length;
        setQuestsProgress({ completed, total: dailyQuests.length || 3 });
      } else {
        setQuestsProgress({ completed: 0, total: 3 });
      }

      setLoading(false);
    }
    load();
  }, [profile]);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? t.dashboard.greeting.morning : hour < 17 ? t.dashboard.greeting.afternoon : t.dashboard.greeting.evening;
  
  // XP Progress Calculation
  const currentLevel = profile?.level || 1;
  const currentXp = profile?.xp || 0;
  const xpForNextLevel = currentLevel * 100;
  const xpPct = Math.min((currentXp / xpForNextLevel) * 100, 100);

  const hasClass = !!(profile as any)?.class_name;
  const hasCheckedInToday = !!todayAttendance;
  const isApproved = todayAttendance?.status === "approved";
  const isRejected = todayAttendance?.status === "rejected";
  const isPending = todayAttendance?.status === "pending_teacher_view" || todayAttendance?.status === "pending_admin_review";

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Premium Profile Header Card */}
      <div className="card rounded-[32px] p-6 border-b border-border bg-gradient-to-r from-card to-muted/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <AvatarDisplay
              fullName={profile?.full_name || "Student"}
              avatarUrl={profile?.avatar_url}
              avatarMode={profile?.avatar_mode}
              size="lg"
            />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                {greet}, {profile?.full_name?.split(" ")[0]} 👋
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasClass ? `${(profile as any).class_name} • ${(profile as any).school_name}` : "No school class joined yet"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 shadow-sm shrink-0">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white font-bold text-xs">$</div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 leading-none mb-0.5">Coins Balance</span>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-500 leading-none">{profile?.coins || 0}</span>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-4 border-t border-border/40 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-primary flex items-center gap-1">
              <Award className="h-4 w-4" /> Level {currentLevel}
            </span>
            <span className="text-muted-foreground font-semibold">{currentXp} / {xpForNextLevel} XP</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/10 p-[1px]">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gamified Streak Flame Hero Card */}
      <div className="relative overflow-hidden rounded-[32px] border-2 border-transparent bg-gradient-to-br from-zinc-900 to-zinc-950 dark:from-zinc-950 dark:to-black text-white p-6 shadow-xl shadow-orange-500/5">
        {/* Glow effect */}
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl animate-pulse" />
        <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              {/* Pulsing ring */}
              <span className="absolute -inset-1 rounded-full bg-orange-500/30 blur-sm animate-ping duration-1000" />
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Flame className="h-9 w-9 text-white animate-streak-fire" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-extrabold text-orange-400">Attendance Streak</span>
                <span className="bg-orange-500/20 text-orange-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-orange-500/30">
                  Best: {streak.longest}d
                </span>
              </div>
              <h2 className="text-3xl font-black mt-1 leading-none">
                {streak.current} <span className="text-lg font-bold text-white/70">Days active</span>
              </h2>
            </div>
          </div>

          <div className="shrink-0">
            {!hasClass ? (
              <Link 
                href="/student/class" 
                className="btn bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 active:scale-[0.97] transition-all text-white font-extrabold text-sm px-6 py-3 rounded-2xl flex items-center gap-2 border-0 shadow-md shadow-orange-500/20"
              >
                <GraduationCap className="h-5 w-5" />
                Join Class
              </Link>
            ) : !hasCheckedInToday ? (
              <Link 
                href="/student/check-in" 
                className="btn btn-primary hover:opacity-90 active:scale-[0.97] transition-all text-white font-extrabold text-sm px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/20 border-0"
              >
                <MapPin className="h-5 w-5" />
                {t.dashboard.checkInNow}
              </Link>
            ) : (
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                {isApproved && (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-300">Streak Secured today!</span>
                  </>
                )}
                {isPending && (
                  <>
                    <Clock className="h-5 w-5 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">Awaiting approval...</span>
                  </>
                )}
                {isRejected && (
                  <>
                    <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
                    <span className="text-xs font-bold text-rose-300">Check-in Rejected</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Core Features Hub Grid (3 custom cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Class Card */}
        <Link 
          href="/student/class" 
          className="card rounded-[28px] p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[140px] border border-border/60"
        >
          <div className="flex justify-between items-start">
            <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-indigo-500" />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">My Classroom</h3>
            <p className="text-base font-extrabold mt-1 truncate">
              {hasClass ? (profile as any).class_name : "Select Class"}
            </p>
          </div>
        </Link>

        {/* Badges Collection Card */}
        <Link 
          href="/student/badges" 
          className="card rounded-[28px] p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[140px] border border-border/60"
        >
          <div className="flex justify-between items-start">
            <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-xs font-extrabold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/20">
              {badges.length} Unlocked
            </span>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Badges Book</h3>
            <div className="flex items-center gap-1.5 mt-1.5 overflow-x-hidden">
              {badges.length === 0 ? (
                <p className="text-xs text-muted-foreground font-semibold">Earn badges from attendance</p>
              ) : (
                badges.slice(0, 4).map((sb) => (
                  <div key={sb.id} className="h-6.5 w-6.5 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 border border-background flex items-center justify-center shadow-sm shrink-0">
                    <Star className="h-3.5 w-3.5 text-white" fill="currentColor" />
                  </div>
                ))
              )}
            </div>
          </div>
        </Link>

        {/* Daily Quests Chest Card */}
        <Link 
          href="/student/quests" 
          className="card rounded-[28px] p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[140px] border border-border/60"
        >
          <div className="flex justify-between items-start">
            <div className="h-11 w-11 rounded-2xl bg-teal-500/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-teal-500" />
            </div>
            <span className="text-xs font-extrabold bg-teal-500/10 text-teal-600 px-2 py-0.5 rounded-full border border-teal-500/20">
              {questsProgress.completed} / {questsProgress.total} Done
            </span>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Daily Chest</h3>
            <div className="mt-2 space-y-1">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (questsProgress.completed / questsProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/80 font-medium">Complete daily quests to open</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Wallet Summary Block */}
      <div className="card rounded-[32px] p-6 border border-border/50 bg-card">
        <div className="flex items-center justify-between mb-5 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">{t.dashboard.wallet}</h2>
              <p className="text-xs text-muted-foreground">Receive attendance payouts</p>
            </div>
          </div>
          <Link href="/student/wallet" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 px-3 py-1.5 rounded-full">
            {t.dashboard.viewAll} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider mb-0.5">{t.dashboard.available}</p>
              <p className="text-[9px] text-muted-foreground/60 leading-tight mb-2">Claimable now</p>
            </div>
            <p className="text-base font-black text-emerald-500 truncate">{formatCurrency(wallet?.balance_available || 0)}</p>
          </div>
          <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider mb-0.5">{t.dashboard.pending}</p>
              <p className="text-[9px] text-muted-foreground/60 leading-tight mb-2">Awaiting confirmation</p>
            </div>
            <p className="text-base font-black text-amber-500 truncate">{formatCurrency(wallet?.balance_pending || 0)}</p>
          </div>
          <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider mb-0.5">{t.dashboard.held}</p>
              <p className="text-[9px] text-muted-foreground/60 leading-tight mb-2">Released at end of month</p>
            </div>
            <p className="text-base font-black text-blue-500 truncate">{formatCurrency(wallet?.balance_locked || 0)}</p>
          </div>
        </div>
      </div>

      {/* Mobile-Only Sticky Floating Check-in Banner */}
      {hasClass && !hasCheckedInToday && (
        <div className="fixed bottom-20 left-4 right-4 z-40 lg:hidden shadow-xl animate-in slide-in-from-bottom duration-300">
          <Link href="/student/check-in" className="block w-full">
            <div className="bg-gradient-to-r from-primary to-accent p-4 rounded-2xl text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold animate-pulse">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black">Check-in Pending!</p>
                  <p className="text-[10px] text-white/80 font-semibold">Keep your streak alive today</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-white/20 px-3.5 py-1.5 rounded-xl font-bold text-xs">
                Go <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
