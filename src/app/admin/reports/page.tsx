"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { BarChart3, TrendingUp, Users, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";

interface ChartData {
  date: string;
  approved: number;
  rejected: number;
  flagged: number;
}

export default function AdminReportsPage() {
  const { t, isClient } = useTranslation();
  const [data, setData] = useState<ChartData[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, averageRate: 0, totalClasses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    async function load() {
      // Get last 7 days array
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return format(d, "yyyy-MM-dd");
      });

      // Fetch logs for the last 7 days
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("attendance_date, status, teacher_flag_status")
        .gte("attendance_date", last7Days[0])
        .lte("attendance_date", last7Days[6]);

      // Aggregate data by date
      const chartData: ChartData[] = last7Days.map(dateStr => {
        const dayLogs = (logs || []).filter(l => l.attendance_date === dateStr);
        return {
          date: format(new Date(dateStr), "MMM dd"),
          approved: dayLogs.filter(l => l.status === "approved").length,
          rejected: dayLogs.filter(l => l.status === "rejected").length,
          flagged: dayLogs.filter(l => l.teacher_flag_status !== null).length,
        };
      });

      // Get basic stats
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
        supabase.from("classes").select("id", { count: "exact" })
      ]);

      const totalStudents = studentsRes.count || 0;
      
      // Calculate average attendance rate over 7 days
      const totalApproved = chartData.reduce((acc, curr) => acc + curr.approved, 0);
      const possibleAttendances = totalStudents * 7;
      const avgRate = possibleAttendances > 0 ? Math.round((totalApproved / possibleAttendances) * 100) : 0;

      setData(chartData);
      setStats({
        totalStudents,
        totalClasses: classesRes.count || 0,
        averageRate: avgRate
      });
      setLoading(false);
    }
    load();
  }, []);

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-500">
          <BarChart3 className="h-5 w-5" /> {t.adminReports.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t.adminReports.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 flex items-center gap-4 border border-cyan-500/20">
          <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.adminReports.avgAttendance}</p>
            <p className="text-2xl font-bold">{stats.averageRate}%</p>
          </div>
        </div>
        
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.adminReports.totalStudents}</p>
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.adminReports.activeClasses}</p>
            <p className="text-2xl font-bold">{stats.totalClasses}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass rounded-2xl p-6 h-[400px]">
        <h2 className="font-bold mb-6 text-sm">{t.adminReports.chartTitle}</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip 
              cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="approved" name={t.adminReports.approved} fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="flagged" name={t.adminReports.flagged} fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="rejected" name={t.adminReports.rejected} fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
