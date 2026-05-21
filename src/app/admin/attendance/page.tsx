"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatTime, formatDistance, formatAccuracy } from "@/lib/utils/format";
import { flagLabel, type FraudFlag } from "@/lib/utils/fraud-flags";
import { ClipboardCheck, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { AttendanceLog } from "@/lib/types/database";

export default function AttendanceReviewPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase
        .from("attendance_logs")
        .select("*, profiles(full_name, email), classes(name)")
        .in("status", ["pending_teacher_view", "pending_admin_review"])
        .order("submitted_at", { ascending: true });
      // Sort flagged first
      const sorted = (data || []).sort((a, b) => (a.teacher_flag_status ? -1 : 0) - (b.teacher_flag_status ? -1 : 0));
      setLogs(sorted as AttendanceLog[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleAction = async (logId: string, action: "approved" | "rejected") => {
    setProcessingId(logId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const supabase = createClient();
      const note = noteMap[logId] || "";
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase.from("attendance_logs").update({
        status: action,
        admin_note: note || null,
      }).eq("id", logId);
      if (updateError) throw updateError;

      // Create review record
      const { error: reviewError } = await supabase.from("attendance_reviews").insert({
        attendance_id: logId,
        reviewer_id: user?.id,
        reviewer_role: "admin",
        action,
        note: note || null,
      });
      if (reviewError) throw reviewError;

      // Wallet crediting is handled automatically by the 
      // process_attendance_economy_v2() database trigger when status changes to 'approved'

      setLogs((prev) => prev.filter((l) => l.id !== logId));
      setSuccessMsg(interpolate(t.adminAttendance.successMessage, { action: action === 'approved' ? t.admin.approvedAction : t.admin.rejectedAction }));
    } catch (err: any) {
      setErrorMsg(interpolate(t.adminAttendance.errorMessage, { message: err.message || "Unknown error" }));
    } finally {
      setProcessingId(null);
    }
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            {t.adminAttendance.title}
          </h1>
          <p className="text-muted-foreground text-xs font-semibold">{interpolate(t.adminAttendance.pendingSubmissions, { count: logs.length })}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="font-bold shrink-0">✓</span>
          {successMsg}
        </div>
      )}

      {logs.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t.adminAttendance.allCaughtUp} description={t.adminAttendance.noSubmissions} />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="card rounded-[32px] p-6 border border-border/30 bg-card shadow-sm space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-lg text-foreground">{(log.profiles as unknown as { full_name: string })?.full_name}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-0.5">{(log.classes as unknown as { name: string })?.name} · {formatDate(log.attendance_date)} · {formatTime(log.submitted_at)}</p>
                </div>
                <div className="flex gap-2">
                  {log.teacher_flag_status && <StatusBadge status="flagged" />}
                  <StatusBadge status={log.status} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 items-start">
                {log.proof_image_url && <img src={log.proof_image_url} alt="Selfie" className="w-24 h-24 rounded-2xl object-cover flex-shrink-0 border border-border/40 shadow-sm" />}
                <div className="flex-1 space-y-3 w-full">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10px] font-black uppercase tracking-wider">
                    <div className="bg-muted/40 border border-border/30 rounded-2xl p-3 flex flex-col justify-center"><span className="text-muted-foreground mb-1">{t.adminAttendance.distance}</span> <span className="text-sm">{formatDistance(log.distance_m)}</span></div>
                    <div className="bg-muted/40 border border-border/30 rounded-2xl p-3 flex flex-col justify-center"><span className="text-muted-foreground mb-1">{t.adminAttendance.accuracy}</span> <span className="text-sm">{formatAccuracy(log.accuracy_m)}</span></div>
                    <div className="bg-muted/40 border border-border/30 rounded-2xl p-3 flex flex-col justify-center"><span className="text-muted-foreground mb-1">{t.adminAttendance.inRadius}</span> <span className={`text-sm ${log.within_radius ? "text-emerald-500" : "text-rose-500"}`}>{log.within_radius ? t.adminAttendance.yes : t.adminAttendance.no}</span></div>
                    <div className="bg-muted/40 border border-border/30 rounded-2xl p-3 flex flex-col justify-center"><span className="text-muted-foreground mb-1">{t.adminAttendance.onTime}</span> <span className={`text-sm ${log.within_time_window ? "text-emerald-500" : "text-rose-500"}`}>{log.within_time_window ? t.adminAttendance.yes : t.adminAttendance.no}</span></div>
                  </div>
                  {log.before_early_cutoff && <span className="text-xs text-amber-500 font-bold inline-block mt-2">🌅 {t.adminAttendance.earlyBird}</span>}
                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {log.fraud_flags.map((f) => (
                        <span key={f} className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-500 font-extrabold text-[10px] uppercase tracking-wider border border-orange-500/20">
                          {t.fraud[f as keyof typeof t.fraud] || f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {log.teacher_note_summary && (
                <div className="bg-blue-500/10 rounded-2xl p-4 text-sm font-semibold border border-blue-500/20 text-foreground">
                  <span className="font-extrabold text-blue-600 dark:text-blue-500">{t.adminAttendance.teacherNote}: </span>
                  {log.teacher_note_summary}
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-3 pt-3 border-t border-border/30">
                <input 
                  value={noteMap[log.id] || ""} 
                  onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} 
                  placeholder={t.adminAttendance.adminNotePlaceholder} 
                  className="flex-1 px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 text-sm font-semibold focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground" 
                />
                <div className="flex gap-2 w-full lg:w-auto">
                  <button 
                    onClick={() => handleAction(log.id, "approved")} 
                    disabled={processingId === log.id} 
                    className="flex-1 lg:flex-none px-6 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                  >
                    {processingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} {t.adminAttendance.approve}
                  </button>
                  <button 
                    onClick={() => handleAction(log.id, "rejected")} 
                    disabled={processingId === log.id} 
                    className="flex-1 lg:flex-none px-6 py-3 rounded-2xl bg-rose-500 text-white text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <XCircle className="h-4 w-4" /> {t.adminAttendance.reject}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
