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

      // If approved, credit wallet
      if (action === "approved") {
        const log = logs.find((l) => l.id === logId);
        if (log) {
          const { data: rules, error: rulesError } = await supabase.from("reward_rules").select("base_reward, early_bonus").eq("school_id", log.school_id).single();
          if (rulesError && rulesError.code !== 'PGRST116') throw rulesError;
          if (rules) {
            let reward = rules.base_reward;
            if (log.before_early_cutoff) reward += rules.early_bonus;
            const { error: rpcError } = await supabase.rpc("credit_wallet", { p_student_id: log.student_id, p_amount: reward, p_description: `Attendance reward ${formatDate(log.attendance_date)}`, p_reference_id: logId });
            if (rpcError) throw rpcError;
          }
        }
      }

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
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> {t.adminAttendance.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{interpolate(t.adminAttendance.pendingSubmissions, { count: logs.length })}</p>
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
            <div key={log.id} className="glass rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{(log.profiles as unknown as { full_name: string })?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{(log.classes as unknown as { name: string })?.name} · {formatDate(log.attendance_date)} · {formatTime(log.submitted_at)}</p>
                </div>
                <div className="flex gap-2">
                  {log.teacher_flag_status && <StatusBadge status="flagged" />}
                  <StatusBadge status={log.status} />
                </div>
              </div>

              <div className="flex gap-4 items-start">
                {log.proof_image_url && <img src={log.proof_image_url} alt="Selfie" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-lg p-2"><span className="text-muted-foreground">{t.adminAttendance.distance}:</span> <span className="font-medium">{formatDistance(log.distance_m)}</span></div>
                    <div className="bg-muted rounded-lg p-2"><span className="text-muted-foreground">{t.adminAttendance.accuracy}:</span> <span className="font-medium">{formatAccuracy(log.accuracy_m)}</span></div>
                    <div className="bg-muted rounded-lg p-2"><span className="text-muted-foreground">{t.adminAttendance.inRadius}:</span> <span className={`font-medium ${log.within_radius ? "text-emerald-500" : "text-red-400"}`}>{log.within_radius ? t.adminAttendance.yes : t.adminAttendance.no}</span></div>
                    <div className="bg-muted rounded-lg p-2"><span className="text-muted-foreground">{t.adminAttendance.onTime}:</span> <span className={`font-medium ${log.within_time_window ? "text-emerald-500" : "text-red-400"}`}>{log.within_time_window ? t.adminAttendance.yes : t.adminAttendance.no}</span></div>
                  </div>
                  {log.before_early_cutoff && <span className="text-xs text-amber-500">🌅 {t.adminAttendance.earlyBird}</span>}
                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {log.fraud_flags.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[10px]">
                          {t.fraud[f as keyof typeof t.fraud] || f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {log.teacher_note_summary && (
                <div className="bg-blue-500/10 rounded-lg p-2.5 text-xs border border-blue-500/20">
                  <span className="font-medium text-blue-400">{t.adminAttendance.teacherNote}: </span>
                  {log.teacher_note_summary}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <input 
                  value={noteMap[log.id] || ""} 
                  onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} 
                  placeholder={t.adminAttendance.adminNotePlaceholder} 
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" 
                />
                <button 
                  onClick={() => handleAction(log.id, "approved")} 
                  disabled={processingId === log.id} 
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-600 disabled:opacity-50"
                >
                  {processingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} {t.adminAttendance.approve}
                </button>
                <button 
                  onClick={() => handleAction(log.id, "rejected")} 
                  disabled={processingId === log.id} 
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> {t.adminAttendance.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
