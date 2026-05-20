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
import { Users, Clock, Send, AlertTriangle, ChevronLeft, MapPin, Sparkles, CheckCircle2, X } from "lucide-react";
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

  // Lightbox overlay state for zooming student selfies
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
      toast.error("Please enter a note.");
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
                    <h3 className="font-extrabold text-sm leading-snug">{(log.profiles as any)?.full_name || "Student"}</h3>
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
                      <span className={`flex items-center gap-1 ${log.within_time_window ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {log.within_time_window ? t.teacher.onTime : t.teacher.late}
                      </span>
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
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
                    <input 
                      value={noteMap[log.id] || ""} 
                      onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} 
                      placeholder="Add an approval note or query..." 
                      className="flex-1 px-4 py-3 rounded-xl bg-muted/60 border-none text-xs font-bold focus:ring-2 focus:ring-primary focus:bg-background transition-all" 
                    />
                    <div className="flex gap-2 shrink-0">
                      <StatefulButton
                        onClick={() => handleAddNote(log.id)}
                        state={actionStates[log.id] || "idle"}
                        label="Submit Note"
                        loadingLabel="Submitting"
                        icon={Send}
                        className="px-4 py-3 text-xs font-black rounded-xl border-0 shrink-0 shadow-sm"
                      />
                      <StatefulButton
                        onClick={() => handleFlag(log.id)}
                        state={flagStates[log.id] || "idle"}
                        label="Flag Submission"
                        loadingLabel="Flagging"
                        icon={AlertTriangle}
                        variant="destructive"
                        className="px-4 py-3 text-xs font-black rounded-xl border-0 text-rose-600 bg-rose-500/10 hover:bg-rose-500/15 shrink-0"
                      />
                    </div>
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
