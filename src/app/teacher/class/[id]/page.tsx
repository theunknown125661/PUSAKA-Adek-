"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrivalBadge } from "@/components/shared/arrival-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatTime, formatDistance, toLocalYYYYMMDD } from "@/lib/utils/format";
import { Users, Clock, AlertTriangle, ChevronLeft, MapPin, X, Check, Flag } from "lucide-react";
import { type ButtonState } from "@/components/ui/stateful-button";
import { toast } from "sonner";
import type { AttendanceLog } from "@/lib/types/database";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [className, setClassName] = useState("");
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [actionStates, setActionStates] = useState<Record<string, ButtonState>>({});
  const [flagStates, setFlagStates] = useState<Record<string, ButtonState>>({});

  // Flag reason & quick choice states
  const [activeFlaggingLog, setActiveFlaggingLog] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  // Lightbox overlay state for zooming student selfies
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !id) return;
    const supabase = createClient();
    const today = toLocalYYYYMMDD(new Date());

    async function load() {
      const [clsRes, logsRes] = await Promise.all([
        supabase.from("classes").select("name").eq("id", id).single(),
        supabase.from("attendance_logs").select("*, profiles(full_name)").eq("class_id", id).eq("attendance_date", today).order("submitted_at", { ascending: false }),
      ]);
      if (clsRes.data) setClassName(clsRes.data.name);
      setLogs((logsRes.data || []) as AttendanceLog[]);
      setLoading(false);
    }
    load();
  }, [profile, id]);

  const handleApprove = async (logId: string) => {
    if (!profile || actionStates[logId] === "loading" || flagStates[logId] === "loading") return;
    setActionStates(prev => ({ ...prev, [logId]: "loading" }));
    
    try {
      const supabase = createClient();
      
      const { data, error: updateError } = await supabase.from("attendance_logs").update({
        status: "approved",
        teacher_note_summary: "Verified by teacher",
      }).eq("id", logId).eq("status", "pending_teacher_view").select();
      
      if (updateError) throw new Error(updateError.message);

      if (!data || data.length === 0) {
        // Already processed by another action
        setActionStates(prev => ({ ...prev, [logId]: "idle" }));
        toast.info("This attendance log was already reviewed.");
        return;
      }

      // Create review record
      await supabase.from("attendance_reviews").insert({
        attendance_id: logId,
        reviewer_id: profile.id,
        reviewer_role: "teacher",
        action: "approved",
        note: "Verified by teacher",
      });

      const targetLog = logs.find((l) => l.id === logId);
      const studentName = (targetLog?.profiles as any)?.full_name || "A student";

      setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, status: "approved" as const, teacher_note_summary: "Verified by teacher" } : l));
      setActionStates(prev => ({ ...prev, [logId]: "success" }));
      toast.success("Attendance verified successfully!");

      // Notify admins about the attendance approval
      fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "attendance_approved",
          category: "transactional",
          priority: "low",
          title: "Attendance Approved by Teacher",
          message: `Teacher ${profile.full_name || "A teacher"} verified and approved attendance for ${studentName}.`,
          action_url: "/admin/attendance",
        }),
      }).catch(err => console.error("Failed to send admin notification:", err));

      setTimeout(() => setActionStates(prev => ({ ...prev, [logId]: "idle" })), 2000);
    } catch (err: unknown) {
      setActionStates(prev => ({ ...prev, [logId]: "error" }));
      toast.error(`Failed to verify: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setActionStates(prev => ({ ...prev, [logId]: "idle" })), 3000);
    }
  };

  const handleFlagWithReason = async (logId: string) => {
    if (!profile || actionStates[logId] === "loading" || flagStates[logId] === "loading") return;
    const finalReason = selectedReason === "custom" ? customReason : selectedReason;
    if (!finalReason) {
      toast.error("Please select a reason or write a custom description.");
      return;
    }

    setFlagStates(prev => ({ ...prev, [logId]: "loading" }));
    
    try {
      const supabase = createClient();
      
      const { data, error: updateError } = await supabase.from("attendance_logs").update({
        status: "pending_admin_review",
        teacher_flag_status: "flagged",
        teacher_note_summary: finalReason,
      }).eq("id", logId).eq("status", "pending_teacher_view").select();
      
      if (updateError) throw new Error(updateError.message);

      if (!data || data.length === 0) {
        // Already processed
        setFlagStates(prev => ({ ...prev, [logId]: "idle" }));
        setActiveFlaggingLog(null);
        setSelectedReason("");
        setCustomReason("");
        toast.info("This attendance log was already reviewed.");
        return;
      }

      // Create review record
      await supabase.from("attendance_reviews").insert({
        attendance_id: logId,
        reviewer_id: profile.id,
        reviewer_role: "teacher",
        action: "rejected", // Teachers mark it as rejected/flagged for admin
        note: finalReason,
      });

      const targetLog = logs.find((l) => l.id === logId);
      const studentName = (targetLog?.profiles as any)?.full_name || "A student";

      setLogs((prev) => prev.map((l) => l.id === logId ? { 
        ...l, 
        status: "pending_admin_review" as const, 
        teacher_flag_status: "flagged",
        teacher_note_summary: finalReason 
      } : l));
      
      setFlagStates(prev => ({ ...prev, [logId]: "success" }));
      setActiveFlaggingLog(null);
      setSelectedReason("");
      setCustomReason("");
      toast.success("Submission flagged for review.");

      // Notify admins about the flagged submission
      fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "flagged_submission",
          category: "alert",
          priority: "high",
          title: "Attendance Submission Flagged ⚠️",
          message: `Teacher ${profile.full_name || "A teacher"} flagged attendance for ${studentName}. Reason: ${finalReason}`,
          action_url: "/admin/flagged",
        }),
      }).catch(err => console.error("Failed to send admin notification:", err));

      setTimeout(() => setFlagStates(prev => ({ ...prev, [logId]: "idle" })), 2000);
    } catch (err: unknown) {
      setFlagStates(prev => ({ ...prev, [logId]: "error" }));
      toast.error(`Failed to flag: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setFlagStates(prev => ({ ...prev, [logId]: "idle" })), 3000);
    }
  };

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header with back button */}
      <div>
        <Link 
          href="/teacher" 
          className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1 bg-primary/5 w-fit px-3.5 py-2 rounded-xl mb-4 transition-all active:scale-[0.98] border border-primary/10"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to hub
        </Link>
        <h1 className="text-2xl font-black mt-2 leading-none">{className}</h1>
        <p className="text-muted-foreground text-xs mt-1">{t.teacher.classDetailSub}</p>
      </div>

      {/* Logs details list */}
      {logs.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title={t.teacher.noSubmissions} 
          description={t.teacher.noSubmissionsDesc} 
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const hasFlags = log.fraud_flags && log.fraud_flags.length > 0;
            return (
              <div 
                key={log.id} 
                className={`card rounded-[28px] p-5 space-y-4 border-2 transition-all ${
                  hasFlags 
                    ? 'border-rose-500/20 bg-rose-500/5' 
                    : 'border-border bg-card'
                }`}
              >
                {/* Header row details */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-extrabold text-sm leading-snug">{(log.profiles as unknown as { full_name: string })?.full_name || "Student"}</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                      Submitted at {formatTime(log.submitted_at)} • {formatDistance(log.distance_m)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.teacher_flag_status && <span className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">Flagged</span>}
                    <StatusBadge status={log.status} />
                  </div>
                </div>

                {/* Proof selfie snapshot and coordinates */}
                <div className="flex gap-4 items-start bg-muted/40 p-3 rounded-2xl">
                  {log.proof_image_url ? (
                    <button 
                      onClick={() => setLightboxImage(log.proof_image_url || null)}
                      className="relative group overflow-hidden rounded-xl w-18 h-18 shrink-0 border border-border/40 cursor-zoom-in"
                    >
                      <img 
                        src={log.proof_image_url} 
                        alt="Selfie Proof" 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                      />
                    </button>
                  ) : (
                    <div className="h-18 w-18 bg-muted rounded-xl flex items-center justify-center shrink-0 border border-border/40">
                      <Users className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold">
                      <span className={`flex items-center gap-1 ${log.within_radius ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>
                        <MapPin className="h-3.5 w-3.5" />
                        {log.within_radius ? t.teacher.inRadius : t.teacher.outRadius} ({formatDistance(log.distance_m)})
                      </span>
                      <ArrivalBadge log={log} showIcon />
                    </div>

                    {/* Fraud flags list */}
                    {hasFlags && (
                      <div className="flex flex-wrap gap-1">
                        {log.fraud_flags!.map((f) => (
                          <span key={f} className="px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 font-black text-[8px] uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {t.fraud[f as keyof typeof t.fraud] || f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes log */}
                {log.teacher_note_summary && (
                  <div className="bg-primary/5 rounded-2xl p-4 text-xs font-semibold border border-primary/10 space-y-0.5">
                    <span className="font-extrabold text-primary block text-[10px] uppercase tracking-wider mb-1">Teacher review note:</span>
                    <span className="text-foreground/90 leading-relaxed font-bold">{log.teacher_note_summary}</span>
                  </div>
                )}

                {/* Interactive feedback inputs */}
                {log.status === "pending_teacher_view" && (
                  <div className="pt-3 border-t border-border/20 space-y-4">
                    {activeFlaggingLog !== log.id ? (
                      <div className="flex gap-2">
                        {/* Quick Verify button */}
                        <button
                          onClick={() => handleApprove(log.id)}
                          disabled={actionStates[log.id] === "loading" || flagStates[log.id] === "loading"}
                          className="flex-1 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 border-0 active:scale-[0.98] transition-all shadow-sm shadow-emerald-500/10"
                        >
                          {actionStates[log.id] === "loading" ? (
                            <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4.5 w-4.5" />
                              Verify Attendance
                            </>
                          )}
                        </button>

                        {/* Flag button */}
                        <button
                          onClick={() => {
                            setActiveFlaggingLog(log.id);
                            setSelectedReason("");
                          }}
                          disabled={actionStates[log.id] === "loading" || flagStates[log.id] === "loading"}
                          className="px-4 h-11 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 font-extrabold text-xs flex items-center justify-center gap-2 border-0 active:scale-[0.98] transition-all"
                        >
                          <Flag className="h-4 w-4" />
                          Flag
                        </button>
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-4 rounded-2xl border border-border/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Flag Reason</span>
                          <button 
                            onClick={() => setActiveFlaggingLog(null)}
                            className="text-muted-foreground hover:text-foreground text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "wrong_loc", label: "Wrong Location" },
                            { id: "bad_photo", label: "Invalid Photo / Blurry" },
                            { id: "late", label: "Outside Window / Late" },
                            { id: "custom", label: "Other..." }
                          ].map((reason) => (
                            <button
                              key={reason.id}
                              onClick={() => setSelectedReason(reason.id)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border ${
                                selectedReason === reason.id 
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600" 
                                  : "bg-muted border-transparent text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {reason.label}
                            </button>
                          ))}
                        </div>

                        {selectedReason === "custom" && (
                          <input
                            type="text"
                            placeholder="Type a custom reason..."
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            className="input w-full px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-rose-500 bg-background"
                          />
                        )}

                        <button
                          onClick={() => handleFlagWithReason(log.id)}
                          disabled={flagStates[log.id] === "loading" || !selectedReason || (selectedReason === "custom" && !customReason)}
                          className="w-full h-9 rounded-xl bg-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 border-0 shadow-sm"
                        >
                          {flagStates[log.id] === "loading" ? (
                            <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            "Confirm & Flag"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full screen Lightbox overlay */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground p-2.5 rounded-full shadow-md z-50 border border-border/40"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative max-w-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-border/50 bg-card">
            <img 
              src={lightboxImage} 
              alt="Proof Snapshot Zoomed" 
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
