"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatTime, formatDistance, formatAccuracy } from "@/lib/utils/format";
import { flagLabel, type FraudFlag } from "@/lib/utils/fraud-flags";
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { AttendanceLog } from "@/lib/types/database";

export default function FlaggedCasesPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase
        .from("attendance_logs")
        .select("*, profiles(full_name, email), classes(name)")
        .not("teacher_flag_status", "is", null)
        .in("status", ["pending_teacher_view", "pending_admin_review"])
        .order("submitted_at", { ascending: true });
      
      setLogs((data || []) as AttendanceLog[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleAction = async (logId: string, action: "approved" | "rejected") => {
    setProcessingId(logId);
    const supabase = createClient();
    const note = noteMap[logId] || "";
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("attendance_logs").update({
      status: action,
      admin_note: note || null,
    }).eq("id", logId);

    // Create review record
    await supabase.from("attendance_reviews").insert({
      attendance_id: logId,
      reviewer_id: user!.id,
      reviewer_role: "admin",
      action,
      note: note || null,
    });

    // If approved, credit wallet
    if (action === "approved") {
      const log = logs.find((l) => l.id === logId);
      if (log) {
        const { data: rules } = await supabase.from("reward_rules").select("base_reward, early_bonus").eq("school_id", log.school_id).single();
        if (rules) {
          let reward = rules.base_reward;
          if (log.before_early_cutoff) reward += rules.early_bonus;
          await supabase.rpc("credit_wallet", { p_student_id: log.student_id, p_amount: reward, p_description: `Attendance reward ${formatDate(log.attendance_date)}`, p_reference_id: logId });
        }
      }
    }

    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setProcessingId(null);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-orange-500">
          <AlertTriangle className="h-5 w-5" /> {t.adminFlagged.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{interpolate(t.adminFlagged.subtitle, { count: logs.length })}</p>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={t.adminFlagged.noCasesTitle} description={t.adminFlagged.noCasesDesc} />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="glass border-orange-500/20 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{(log.profiles as unknown as { full_name: string })?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{(log.classes as unknown as { name: string })?.name} · {formatDate(log.attendance_date)} · {formatTime(log.submitted_at)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-orange-500 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {t.adminFlagged.flaggedLabel}
                  </span>
                </div>
              </div>

              {/* Teacher Flag Context */}
              <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 space-y-2">
                <p className="text-xs font-semibold text-orange-500 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t.adminFlagged.escalationNote}
                </p>
                <p className="text-sm font-medium">{log.teacher_note_summary}</p>
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
                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {log.fraud_flags.map((f) => (
                        <span key={f} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium">
                          {t.fraud[f as keyof typeof t.fraud] || f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-end pt-2 border-t border-border/50">
                <input 
                  value={noteMap[log.id] || ""} 
                  onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} 
                  placeholder={t.adminFlagged.decisionPlaceholder} 
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" 
                />
                <button onClick={() => handleAction(log.id, "approved")} disabled={processingId === log.id} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-600 disabled:opacity-50">
                  {processingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} {t.adminFlagged.overruleApprove}
                </button>
                <button onClick={() => handleAction(log.id, "rejected")} disabled={processingId === log.id} className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-red-600 disabled:opacity-50">
                  <XCircle className="h-3.5 w-3.5" /> {t.adminFlagged.confirmReject}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
