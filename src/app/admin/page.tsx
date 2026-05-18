"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/utils/format";
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Wallet, Clock, Activity, Users, Gift, ChevronRight } from "lucide-react";
import type { AttendanceReview } from "@/lib/types/database";

export default function AdminDashboard() {
  const { t, isClient } = useTranslation();
  const [stats, setStats] = useState({ 
    pending: 0, 
    flagged: 0, 
    approved: 0, 
    rejected: 0, 
    pendingWithdrawals: 0, 
    totalHeld: 0,
    attendanceRate: 0,
    weeklyRewards: 0
  });
  
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    
    // Calculate date for 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastWeekIso = sevenDaysAgo.toISOString();

    async function load() {
      const [
        pendingRes, flaggedRes, approvedRes, rejectedRes, wdRes, heldRes, 
        studentsRes, rewardsRes, activityRes
      ] = await Promise.all([
        supabase.from("attendance_logs").select("id", { count: "exact" }).in("status", ["pending_teacher_view", "pending_admin_review"]),
        supabase.from("attendance_logs").select("id", { count: "exact" }).not("teacher_flag_status", "is", null).eq("attendance_date", today),
        supabase.from("attendance_logs").select("id", { count: "exact" }).eq("status", "approved").eq("attendance_date", today),
        supabase.from("attendance_logs").select("id", { count: "exact" }).eq("status", "rejected").eq("attendance_date", today),
        supabase.from("withdrawal_requests").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("wallets").select("held_balance"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
        supabase.from("wallet_transactions").select("amount").eq("type", "attendance_reward").gte("created_at", lastWeekIso),
        supabase.from("attendance_reviews").select("*, reviewer:profiles!reviewer_id(full_name), attendance_logs!inner(attendance_date, profiles!student_id(full_name))").order("created_at", { ascending: false }).limit(5)
      ]);

      const totalHeld = (heldRes.data || []).reduce((a: number, w: { held_balance: number }) => a + (w.held_balance || 0), 0);
      const totalWeeklyRewards = (rewardsRes.data || []).reduce((a: number, t: { amount: number }) => a + (t.amount || 0), 0);
      
      const totalStudents = studentsRes.count || 1; // Prevent div by 0
      const approved = approvedRes.count || 0;
      const attRate = Math.round((approved / totalStudents) * 100);

      setStats({
        pending: pendingRes.count || 0,
        flagged: flaggedRes.count || 0,
        approved,
        rejected: rejectedRes.count || 0,
        pendingWithdrawals: wdRes.count || 0,
        totalHeld,
        attendanceRate: attRate > 100 ? 100 : attRate,
        weeklyRewards: totalWeeklyRewards
      });
      
      setRecentActivity(activityRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const cards = [
    { label: t.admin.pendingReview, value: stats.pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", href: "/admin/attendance" },
    { label: t.admin.flaggedToday, value: stats.flagged, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", href: "/admin/flagged" },
    { label: t.admin.approvedToday, value: stats.approved, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", href: "/admin/attendance" },
    { label: t.admin.rejectedToday, value: stats.rejected, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", href: "/admin/attendance" },
    { label: t.admin.pendingPayouts, value: stats.pendingWithdrawals, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10", href: "/admin/withdrawals" },
    { label: t.admin.totalHeld, value: formatCurrency(stats.totalHeld), icon: ClipboardCheck, color: "text-indigo-500", bg: "bg-indigo-500/10", href: "/admin/rewards" },
    { label: t.admin.todaysRate, value: `${stats.attendanceRate}%`, icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10", href: "/admin/reports" },
    { label: t.admin.weeklyRewards, value: formatCurrency(stats.weeklyRewards), icon: Gift, color: "text-primary", bg: "bg-primary/10", href: "/admin/rewards" },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t.admin.dashboardTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.admin.dashboardDesc}</p>
      </div>

      {/* Grid stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link 
            key={c.label} 
            href={c.href} 
            className="card rounded-2xl p-5 hover:border-primary/40 active:scale-[0.99] transition-all flex flex-col justify-between group"
          >
            <div className={`h-10 w-10 rounded-xl ${c.bg} flex items-center justify-center mb-4 shrink-0 transition-transform group-hover:scale-105`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xl font-extrabold truncate">{c.value}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1 truncate">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="card rounded-2xl p-5 lg:col-span-1 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg flex items-center gap-2 px-1">
            <Activity className="h-5 w-5 text-primary" /> {t.admin.quickActions}
          </h2>
          <div className="space-y-2">
            <Link href="/admin/attendance" className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all font-semibold text-sm active:scale-[0.98]">
              <span>{t.admin.verifyAttendance}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/withdrawals" className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all font-semibold text-sm active:scale-[0.98]">
              <span>{t.admin.processWithdrawals}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/users" className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all font-semibold text-sm active:scale-[0.98]">
              <span>{t.admin.addNewUser}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/reports" className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all font-semibold text-sm active:scale-[0.98]">
              <span>{t.admin.viewReports}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card rounded-2xl p-5 lg:col-span-2 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-5 px-1">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> {t.admin.recentVerification}
            </h2>
            <Link href="/admin/audit" className="text-xs font-bold text-primary hover:underline">{t.admin.viewAuditLog}</Link>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[320px] hide-scrollbar">
            {recentActivity.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                <ClipboardCheck className="h-10 w-10 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm font-semibold">{t.admin.noRecentActivity}</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 bg-muted/20 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                  <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${activity.action === 'approved' ? 'bg-success' : 'bg-destructive'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">
                      <span className="font-bold">{activity.reviewer?.full_name}</span>{" "}
                      <span className={activity.action === 'approved' ? 'text-success font-bold' : 'text-destructive font-bold'}>
                        {activity.action === 'approved' ? t.admin.approvedAction : t.admin.rejectedAction}
                      </span>{" "}
                      attendance for <span className="font-bold">{(activity.attendance_logs?.profiles as unknown as { full_name: string })?.full_name}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground font-semibold">
                      <span>
                        {new Date(activity.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {activity.note && (
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full max-w-[280px] truncate">
                          Note: {activity.note}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
