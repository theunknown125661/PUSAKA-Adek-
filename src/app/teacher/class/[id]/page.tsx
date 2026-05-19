"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatTime, formatDistance, formatAccuracy } from "@/lib/utils/format";
import { flagLabel } from "@/lib/utils/fraud-flags";
import { Users, Clock, Send, AlertTriangle, ChevronLeft, MapPin, Sparkles, CheckCircle2 } from "lucide-react";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";
import { toast } from "sonner";
import type { AttendanceLog } from "@/lib/types/database";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const [className, setClassName] = useState("");
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  
  const [actionStates, setActionStates] = useState<Record<string, ButtonState>>({});
  const [flagStates, setFlagStates] = useState<Record<string, ButtonState>>({});

  useEffect(() => {
    if (!profile || !id) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

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

  const handleAddNote = async (logId: string) => {
    if (!profile) return;
    const note = noteMap[logId];
    if (!note?.trim()) {
      toast.error(t.wallet.enterAmount); // Generic "enter value" fallback
      return;
    }
    
    setActionStates(prev => ({ ...prev, [logId]: "loading" }));
    
    try {
      const supabase = createClient();
      
      const { error: noteError } = await supabase.from("teacher_notes").insert({
        attendance_id: logId,
        teacher_id: profile.id,
        note: note.trim(),
      });
      
      if (noteError) throw new Error(noteError.message);

      // Update attendance status to pending_admin_review
      const { error: updateError } = await supabase.from("attendance_logs").update({
        status: "pending_admin_review",
        teacher_note_summary: note.trim(),
      }).eq("id", logId);
      
      if (updateError) throw new Error(updateError.message);

      setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, status: "pending_admin_review" as const, teacher_note_summary: note.trim() } : l));
      setNoteMap((prev) => ({ ...prev, [logId]: "" }));
      setActionStates(prev => ({ ...prev, [logId]: "success" }));
      toast.success(t.teacher.noteSuccess);
      setTimeout(() => setActionStates(prev => ({ ...prev, [logId]: "idle" })), 2000);
    } catch (err: any) {
      setActionStates(prev => ({ ...prev, [logId]: "error" }));
      toast.error(`Failed: ${err.message}`);
      setTimeout(() => setActionStates(prev => ({ ...prev, [logId]: "idle" })), 3000);
    }
  };

  const handleFlag = async (logId: string) => {
    if (!profile) return;
    setFlagStates(prev => ({ ...prev, [logId]: "loading" }));
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from("attendance_logs").update({ teacher_flag_status: "flagged" }).eq("id", logId);
      
      if (error) throw new Error(error.message);
      
      setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, teacher_flag_status: "flagged" } : l));
      setFlagStates(prev => ({ ...prev, [logId]: "success" }));
      toast.success(t.teacher.flagSuccess);
      setTimeout(() => setFlagStates(prev => ({ ...prev, [logId]: "idle" })), 2000);
    } catch (err: any) {
      setFlagStates(prev => ({ ...prev, [logId]: "error" }));
      toast.error(`Failed to flag: ${err.message}`);
      setTimeout(() => setFlagStates(prev => ({ ...prev, [logId]: "idle" })), 3000);
    }
  };

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <Link 
          href="/teacher" 
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 w-fit px-3 py-1.5 rounded-full mb-3 transition-all active:scale-[0.98]"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {t.teacher.backToDashboard}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{className}</h1>
        <p className="text-muted-foreground text-sm">{t.teacher.classDetailSub}</p>
      </div>

      {logs.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title={t.teacher.noSubmissions} 
          description={t.teacher.noSubmissionsDesc} 
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="card rounded-2xl p-5 space-y-4 hover:shadow-md transition-all border-border/80">
              {/* Submission Row Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-base">{(log.profiles as unknown as { full_name: string })?.full_name || "Student"}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {formatTime(log.submitted_at)} • {formatDistance(log.distance_m)} • {t.teacher.accuracy}: {formatAccuracy(log.accuracy_m)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {log.teacher_flag_status && <StatusBadge status="flagged" />}
                  <StatusBadge status={log.status} />
                </div>
              </div>

              {/* Snapshot & Radius details */}
              <div className="flex gap-4 items-start bg-muted/30 p-3 rounded-xl">
                {log.proof_image_url ? (
                  <div className="relative group overflow-hidden rounded-lg w-20 h-20 shrink-0 border border-border/50">
                    <img 
                      src={log.proof_image_url} 
                      alt="Selfie Proof" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 bg-muted rounded-lg flex items-center justify-center shrink-0 border border-border/50">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold">
                    <span className={`flex items-center gap-1 ${log.within_radius ? "text-success" : "text-warning"}`}>
                      <MapPin className="h-3.5 w-3.5" />
                      {log.within_radius ? t.teacher.inRadius : t.teacher.outRadius}
                    </span>
                    <span className={`flex items-center gap-1 ${log.within_time_window ? "text-success" : "text-warning"}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {log.within_time_window ? t.teacher.onTime : t.teacher.late}
                    </span>
                  </div>
                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {log.fraud_flags.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t.fraud[f as keyof typeof t.fraud] || f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Teacher Note Display */}
              {log.teacher_note_summary && (
                <div className="bg-primary/5 rounded-xl p-3.5 text-xs font-medium border border-primary/10">
                  <span className="font-bold text-primary">{t.teacher.yourNote}: </span>
                  <span className="text-foreground/90">{log.teacher_note_summary}</span>
                </div>
              )}

              {/* Actions panel */}
              {log.status === "pending_teacher_view" && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input 
                    value={noteMap[log.id] || ""} 
                    onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} 
                    placeholder={t.teacher.addNotePlaceholder} 
                    className="flex-1 px-4 py-2.5 rounded-xl bg-muted/60 border-none text-xs font-semibold focus:ring-2 focus:ring-primary focus:bg-background transition-all" 
                  />
                  <div className="flex gap-2 shrink-0">
                    <StatefulButton
                      onClick={() => handleAddNote(log.id)}
                      state={actionStates[log.id] || "idle"}
                      label={t.teacher.send}
                      loadingLabel={t.teacher.send}
                      icon={Send}
                      className="px-4 py-2 text-xs font-bold"
                    />
                    <StatefulButton
                      onClick={() => handleFlag(log.id)}
                      state={flagStates[log.id] || "idle"}
                      label={t.teacher.flag}
                      loadingLabel={t.teacher.flag}
                      icon={AlertTriangle}
                      variant="destructive"
                      className="px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
