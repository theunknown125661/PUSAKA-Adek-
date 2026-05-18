"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatTime } from "@/lib/utils/format";
import { User, TrendingUp, ChevronLeft, Award, Percent, Calendar } from "lucide-react";
import type { AttendanceLog, Profile } from "@/lib/types/database";

export default function StudentMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const { t, isClient } = useTranslation();
  const [student, setStudent] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    async function load() {
      const [profRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("attendance_logs").select("*").eq("student_id", id).order("attendance_date", { ascending: false }).limit(30),
      ]);
      if (profRes.data) setStudent(profRes.data as Profile);
      setLogs((logsRes.data || []) as AttendanceLog[]);
      setLoading(false);
    }
    load();
  }, [id]);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const approved = logs.filter((l) => l.status === "approved").length;
  const total = logs.length;
  const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back link */}
      <div>
        <Link 
          href="/teacher/students" 
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 w-fit px-3 py-1.5 rounded-full transition-all active:scale-[0.98]"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {t.common.back}
        </Link>
      </div>

      {/* Student Profile Card */}
      <div className="card rounded-3xl p-6 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border-primary/20 flex items-center gap-4 shadow-lg shadow-primary/5">
        <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <User className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{student?.full_name}</h1>
          <p className="text-xs text-muted-foreground font-medium truncate">{student?.email}</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center mb-1">
            <TrendingUp className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-extrabold">{total}</p>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.teacher.total}</p>
        </div>
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center mb-1">
            <Award className="h-4.5 w-4.5 text-success" />
          </div>
          <p className="text-xl font-extrabold text-success">{approved}</p>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.dashboard.approved}</p>
        </div>
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center mb-1">
            <Percent className="h-4.5 w-4.5 text-info" />
          </div>
          <p className="text-xl font-extrabold text-info">{rate}%</p>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.teacher.attendanceRate}</p>
        </div>
      </div>

      {/* History section */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base flex items-center gap-2 px-1">
          <Calendar className="h-4 w-4 text-primary" /> {t.teacher.attendanceHistory}
        </h2>
        
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium py-4 px-1">{t.common.noData}</p>
        ) : (
          <div className="card rounded-2xl overflow-hidden divide-y divide-border/60">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">{formatDate(log.attendance_date)}</p>
                  <p className="text-xs text-muted-foreground font-medium">{formatTime(log.submitted_at)}</p>
                </div>
                <StatusBadge status={log.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
