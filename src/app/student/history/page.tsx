"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatTime, formatDistance } from "@/lib/utils/format";
import { History, Calendar } from "lucide-react";
import type { AttendanceLog } from "@/lib/types/database";

export default function AttendanceHistoryPage() {
  const { profile } = useUserRole();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    async function load() {
      let query = supabase.from("attendance_logs").select("*").eq("student_id", profile!.id).order("attendance_date", { ascending: false }).limit(50);
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      setLogs((data || []) as AttendanceLog[]);
      setLoading(false);
    }
    load();
  }, [profile, filter]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const filters = [
    { value: "all", label: "All" },
    { value: "pending_teacher_view", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-xl font-bold flex items-center gap-2"><History className="h-5 w-5" /> Attendance History</h1></div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{f.label}</button>
        ))}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={Calendar} title="No records found" description="Your attendance records will appear here." />
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{formatDate(log.attendance_date)}</p>
                  <p className="text-xs text-muted-foreground">Submitted {formatTime(log.submitted_at)}</p>
                </div>
                <StatusBadge status={log.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatDistance(log.distance_m)} from school</span>
                <span className={log.within_radius ? "text-emerald-500" : "text-amber-500"}>{log.within_radius ? "In radius" : "Out of radius"}</span>
                {log.before_early_cutoff && <span className="text-amber-500">🌅 Early</span>}
              </div>
              {log.proof_image_url && (
                <img src={log.proof_image_url} alt="Selfie proof" className="w-16 h-16 rounded-lg object-cover" />
              )}
              {log.admin_note && (
                <div className="bg-muted rounded-lg p-2.5 text-xs">
                  <span className="font-medium">Admin note: </span>{log.admin_note}
                </div>
              )}
              {log.teacher_note_summary && (
                <div className="bg-muted rounded-lg p-2.5 text-xs">
                  <span className="font-medium">Teacher note: </span>{log.teacher_note_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
