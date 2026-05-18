"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Wallet, Clock, Activity, Users, Gift, ChevronRight } from "lucide-react";
import type { AttendanceReview } from "@/lib/types/database";

export default function AdminDashboard() {
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const cards = [
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", href: "/admin/attendance" },
    { label: "Flagged Today", value: stats.flagged, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", href: "/admin/flagged" },
    { label: "Approved Today", value: stats.approved, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", href: "/admin/attendance" },
    { label: "Rejected Today", value: stats.rejected, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", href: "/admin/attendance" },
    { label: "Pending Payouts", value: stats.pendingWithdrawals, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10", href: "/admin/withdrawals" },
    { label: "Total Held", value: formatCurrency(stats.totalHeld), icon: ClipboardCheck, color: "text-indigo-500", bg: "bg-indigo-500/10", href: "/admin/rewards" },
    { label: "Today's Rate", value: `${stats.attendanceRate}%`, icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10", href: "/admin/reports" },
    { label: "Weekly Rewards", value: formatCurrency(stats.weeklyRewards), icon: Gift, color: "text-primary", bg: "bg-primary/10", href: "/admin/rewards" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">School attendance & financial overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="glass rounded-2xl p-4 hover:border-primary/30 transition-colors flex flex-col justify-between">
            <div className={`h-9 w-9 rounded-xl ${c.bg} flex items-center justify-center mb-3 shrink-0`}>
              <c.icon className={`h-4.5 w-4.5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold truncate">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="glass rounded-2xl p-5 lg:col-span-1 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/admin/attendance" className="flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
              <span className="text-sm font-medium">Verify Attendance</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/withdrawals" className="flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
              <span className="text-sm font-medium">Process Withdrawals</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/users" className="flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
              <span className="text-sm font-medium">Add New User</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/admin/reports" className="flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
              <span className="text-sm font-medium">View Reports</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="glass rounded-2xl p-5 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Recent Verification Activity</h2>
            <Link href="/admin/audit" className="text-xs text-primary hover:underline">View Audit Log</Link>
          </div>
          
          <div className="flex-1 space-y-4">
            {recentActivity.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                <ClipboardCheck className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${activity.action === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold">{activity.reviewer?.full_name}</span>{" "}
                      <span className={activity.action === 'approved' ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                        {activity.action}
                      </span>{" "}
                      attendance for <span className="font-semibold">{activity.attendance_logs?.profiles?.full_name}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {activity.note && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[200px]">
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
