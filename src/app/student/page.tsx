"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/utils/format";
import { MapPin, Flame, Trophy, Target, Wallet, Clock, ChevronRight, Calendar, Zap, Award, Star, ShieldAlert, CheckCircle2, GraduationCap } from "lucide-react";
import type { AttendanceLog, Wallet as WalletType, StudentBadge } from "@/lib/types/database";

export default function StudentDashboard() {
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [badges, setBadges] = useState<StudentBadge[]>([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    async function load() {
      const [attRes, walRes, badgeRes, appRes, streakRes] = await Promise.all([
        supabase.from("attendance_logs").select("*").eq("student_id", profile!.id).eq("attendance_date", today).limit(1),
        supabase.from("wallets").select("*").eq("user_id", profile!.id).eq("currency_type", "RUPIAH").maybeSingle(),
        supabase.from("student_badges").select("*, badges(*)").eq("student_id", profile!.id),
        supabase.from("attendance_logs").select("id", { count: "exact" }).eq("student_id", profile!.id).eq("status", "approved"),
        supabase.from("streaks").select("*").eq("student_id", profile!.id).single(),
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
      setLoading(false);
    }
    load();
  }, [profile]);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? t.dashboard.greeting.morning : hour < 17 ? t.dashboard.greeting.afternoon : t.dashboard.greeting.evening;
  const nextBadge = totalApproved < 5 ? 5 : totalApproved < 20 ? 20 : 50;
  const progressPct = Math.min((totalApproved / nextBadge) * 100, 100);

  // Status Card (Hero) logic
  const renderStatusHero = () => {
    if (!(profile as any)?.class_name) {
      return (
        <Link href="/student/class" className="block w-full">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg shadow-orange-500/25 transition-transform active:scale-[0.98]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">Join a Class!</h2>
                <p className="text-white/80 text-sm font-medium">You need to choose a school and class before you can check in.</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-white/90 bg-black/10 w-fit px-4 py-2 rounded-full backdrop-blur-md">
              Choose Class <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      );
    }

    if (!todayAttendance) {
      return (
        <Link href="/student/check-in" className="block w-full">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">{t.dashboard.checkInNow}</h2>
                <p className="text-primary-foreground/80 text-sm font-medium">{t.dashboard.checkInDesc}</p>
              </div>
              <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <MapPin className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-white/90 bg-black/10 w-fit px-4 py-2 rounded-full backdrop-blur-md">
              {t.navigation.checkIn} <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      );
    }

    const { status } = todayAttendance;
    
    if (status === "approved") {
      return (
        <div className="relative overflow-hidden rounded-3xl bg-success/10 border border-success/20 p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-success flex items-center justify-center shrink-0 shadow-lg shadow-success/30">
              <CheckCircle2 className="h-6 w-6 text-success-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-success mb-1">{t.dashboard.approved}</h2>
              <p className="text-sm font-medium opacity-80">{t.dashboard.approvedDesc}</p>
              <p className="text-xs opacity-60 mt-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(todayAttendance.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    if (status === "rejected") {
      return (
        <div className="relative overflow-hidden rounded-3xl bg-destructive/10 border border-destructive/20 p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-destructive flex items-center justify-center shrink-0 shadow-lg shadow-destructive/30">
              <ShieldAlert className="h-6 w-6 text-destructive-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-destructive mb-1">{t.dashboard.rejected}</h2>
              <p className="text-sm font-medium opacity-80">{todayAttendance.admin_note || todayAttendance.teacher_note_summary || t.dashboard.rejectedDesc}</p>
            </div>
          </div>
        </div>
      );
    }

    // Pending (teacher or admin view)
    return (
      <div className="relative overflow-hidden rounded-3xl bg-warning/10 border border-warning/20 p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-warning flex items-center justify-center shrink-0 shadow-lg shadow-warning/30">
            <Clock className="h-6 w-6 text-warning-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-warning mb-1">{t.dashboard.submitted}</h2>
            <p className="text-sm font-medium opacity-80">{t.dashboard.submittedDesc}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {greet}, {profile?.full_name?.split(" ")[0]} 👋
            <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-1 rounded-full uppercase tracking-wider border border-primary/20">
              Lvl {profile?.level || 1}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.dashboard.overview}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">XP</span>
            <span className="text-sm font-bold">{profile?.xp || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 px-3 py-1 rounded-full border border-amber-500/20 shadow-sm">
            <div className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">$</div>
            <span className="text-sm font-bold">{profile?.coins || 0} Coins</span>
          </div>
        </div>
      </div>

      {/* Hero Action Card */}
      {renderStatusHero()}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card rounded-2xl p-4 transition-transform active:scale-[0.98]">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-orange-500 animate-streak-fire" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.dashboard.streak}</span>
          </div>
          <p className="text-3xl font-bold">{streak.current}<span className="text-base text-muted-foreground ml-1 font-medium">{t.dashboard.days}</span></p>
        </div>
        <div className="card rounded-2xl p-4 transition-transform active:scale-[0.98]">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t.dashboard.bestStreak}</span>
          </div>
          <p className="text-3xl font-bold">{streak.longest}<span className="text-base text-muted-foreground ml-1 font-medium">{t.dashboard.days}</span></p>
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Wallet className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-lg">{t.dashboard.wallet}</h2>
          </div>
          <Link href="/student/wallet" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-primary/5 px-3 py-1.5 rounded-full">
            {t.dashboard.viewAll} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{t.dashboard.available}</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight mb-2">{t.dashboard.availableHelp}</p>
            </div>
            <p className="text-sm font-bold text-success truncate">{formatCurrency(wallet?.balance_available || 0)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{t.dashboard.pending}</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight mb-2">{t.dashboard.pendingHelp}</p>
            </div>
            <p className="text-sm font-bold text-warning truncate">{formatCurrency(wallet?.balance_pending || 0)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{t.dashboard.held}</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight mb-2">{t.dashboard.heldHelp}</p>
            </div>
            <p className="text-sm font-bold text-info truncate">{formatCurrency(wallet?.balance_locked || 0)}</p>
          </div>
        </div>
      </div>

      {/* Progress & Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card rounded-2xl p-5 flex flex-col justify-between h-32">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">{t.dashboard.progress}</h2>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
              <span>{totalApproved} {t.dashboard.totalApproved.toLowerCase()}</span>
              <span>{interpolate(t.dashboard.nextAt, { count: nextBadge })}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="card rounded-2xl p-5 flex flex-col justify-between h-32">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-sm">{t.dashboard.badges} ({badges.length})</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {badges.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium">{t.dashboard.earnBadges}</p>
            ) : (
              badges.slice(0, 4).map((sb) => (
                <div key={sb.id} className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 border-2 border-background flex items-center justify-center shadow-sm">
                  <Star className="h-5 w-5 text-white drop-shadow-md" fill="currentColor" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/student/history" className="card rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 active:scale-[0.98] transition-all group">
          <div className="h-10 w-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold">{t.dashboard.history}</span>
        </Link>
        <Link href="/student/wallet" className="card rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 active:scale-[0.98] transition-all group">
          <div className="h-10 w-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
             <Zap className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold">{t.dashboard.withdraw}</span>
        </Link>
      </div>
    </div>
  );
}
