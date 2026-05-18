"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatTime } from "@/lib/utils/format";
import { User, TrendingUp } from "lucide-react";
import type { AttendanceLog, Profile } from "@/lib/types/database";

export default function StudentMonitorPage() {
  const { id } = useParams<{ id: string }>();
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const approved = logs.filter((l) => l.status === "approved").length;
  const total = logs.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/teacher" className="text-xs text-primary hover:underline">← Back</Link>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
        <div><h1 className="text-xl font-bold">{student?.full_name}</h1><p className="text-xs text-muted-foreground">{student?.email}</p></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 text-center"><p className="text-xl font-bold">{total}</p><p className="text-xs text-muted-foreground">Total</p></div>
        <div className="glass rounded-xl p-3 text-center"><p className="text-xl font-bold text-emerald-500">{approved}</p><p className="text-xs text-muted-foreground">Approved</p></div>
        <div className="glass rounded-xl p-3 text-center"><p className="text-xl font-bold">{total > 0 ? Math.round((approved / total) * 100) : 0}%</p><p className="text-xs text-muted-foreground">Rate</p></div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Attendance History</h2>
        {logs.map((log) => (
          <div key={log.id} className="glass rounded-xl p-3 flex items-center justify-between">
            <div><p className="text-sm font-medium">{formatDate(log.attendance_date)}</p><p className="text-xs text-muted-foreground">{formatTime(log.submitted_at)}</p></div>
            <StatusBadge status={log.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
