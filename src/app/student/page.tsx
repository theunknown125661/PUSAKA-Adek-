"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { formatCurrency } from "@/lib/utils/format";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  MapPin, Flame, Trophy, Target, Wallet, Clock,
  ChevronRight, Calendar, Zap, Award, Star,
} from "lucide-react";
import type { AttendanceLog, Wallet as WalletType, StudentBadge } from "@/lib/types/database";

export default function StudentDashboard() {
  const { profile } = useUserRole();
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
      const [attRes, walRes, badgeRes, appRes] = await Promise.all([
        supabase.from("attendance_logs").select("*").eq("student_id", profile!.id).eq("attendance_date", today).limit(1),
        supabase.from("wallets").select("*").eq("student_id", profile!.id).single(),
        supabase.from("student_badges").select("*, badges(*)").eq("student_id", profile!.id),
        supabase.from("attendance_logs").select("id", { count: "exact" }).eq("student_id", profile!.id).eq("status", "approved"),
      ]);
      if (attRes.data?.[0]) setTodayAttendance(attRes.data[0]);
      if (walRes.data) setWallet(walRes.data);
      if (badgeRes.data) setBadges(badgeRes.data as unknown as StudentBadge[]);
      setTotalApproved(appRes.count || 0);
      setStreak({ current: Math.min(appRes.count || 0, 7), longest: appRes.count || 0 });
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nextBadge = totalApproved < 5 ? 5 : totalApproved < 20 ? 20 : 50;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{greet}, {profile?.full_name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here&apos;s your attendance overview</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4"><div className="flex items-center gap-2 mb-2"><Flame className="h-5 w-5 text-orange-500" /><span className="text-xs text-muted-foreground font-medium">Streak</span></div><p className="text-3xl font-bold">{streak.current}<span className="text-base text-muted-foreground ml-1">days</span></p></div>
        <div className="glass rounded-2xl p-4"><div className="flex items-center gap-2 mb-2"><Trophy className="h-5 w-5 text-amber-500" /><span className="text-xs text-muted-foreground font-medium">Best</span></div><p className="text-3xl font-bold">{streak.longest}<span className="text-base text-muted-foreground ml-1">days</span></p></div>
      </div>

      {!todayAttendance ? (
        <Link href="/student/check-in" className="block glass rounded-2xl p-5 border border-primary/30 hover:border-primary/60 transition-all group animate-pulse-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center"><MapPin className="h-6 w-6 text-primary" /></div><div><p className="font-semibold">Check In Now</p><p className="text-sm text-muted-foreground">Tap to verify your attendance</p></div></div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
          </div>
        </Link>
      ) : (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center"><Clock className="h-6 w-6 text-emerald-500" /></div><div><p className="font-semibold">Today&apos;s Attendance</p><p className="text-sm text-muted-foreground">Submitted at {new Date(todayAttendance.submitted_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p></div></div>
            <StatusBadge status={todayAttendance.status} />
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><h2 className="font-semibold">Wallet</h2></div><Link href="/student/wallet" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="h-3 w-3" /></Link></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Available</p><p className="text-sm font-bold text-emerald-500">{formatCurrency(wallet?.available_balance || 0)}</p></div>
          <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Pending</p><p className="text-sm font-bold text-amber-500">{formatCurrency(wallet?.pending_balance || 0)}</p></div>
          <div className="bg-muted rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground mb-1">Held</p><p className="text-sm font-bold text-blue-500">{formatCurrency(wallet?.held_balance || 0)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h2 className="font-semibold text-sm">Progress</h2></div>
          <div><div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span>{totalApproved} approved</span><span>Next at {nextBadge}</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all" style={{ width: `${Math.min((totalApproved / nextBadge) * 100, 100)}%` }} /></div></div>
        </div>
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" /><h2 className="font-semibold text-sm">Badges ({badges.length})</h2></div>
          <div className="flex gap-2 flex-wrap">{badges.length === 0 ? <p className="text-xs text-muted-foreground">Attend to earn badges!</p> : badges.slice(0, 4).map((sb) => <div key={sb.id} className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Star className="h-4 w-4 text-amber-500" /></div>)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/student/history" className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-colors"><Calendar className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">History</span></Link>
        <Link href="/student/wallet" className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-colors"><Zap className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">Withdraw</span></Link>
      </div>
    </div>
  );
}
