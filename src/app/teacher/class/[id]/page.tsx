"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatTime, formatDistance, formatAccuracy } from "@/lib/utils/format";
import { flagLabel } from "@/lib/utils/fraud-flags";
import { Users, Clock, Send, AlertTriangle, Loader2 } from "lucide-react";
import type { AttendanceLog } from "@/lib/types/database";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUserRole();
  const [className, setClassName] = useState("");
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Feedback states
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
    if (!note?.trim()) return;
    
    setSavingId(logId);
    setErrorMsg("");
    setSuccessMsg("");
    
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
      setSuccessMsg("Note submitted successfully.");
    } catch (err: any) {
      setErrorMsg(`Failed to submit note: ${err.message || err}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleFlag = async (logId: string) => {
    if (!profile) return;
    setErrorMsg("");
    setSuccessMsg("");
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from("attendance_logs").update({ teacher_flag_status: "flagged" }).eq("id", logId);
      
      if (error) throw new Error(error.message);
      
      setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, teacher_flag_status: "flagged" } : l));
      setSuccessMsg("Attendance flagged successfully.");
    } catch (err: any) {
      setErrorMsg(`Failed to flag attendance: ${err.message || err}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link href="/teacher" className="text-xs text-primary hover:underline">← Back to Dashboard</Link>
        <h1 className="text-xl font-bold mt-2">{className}</h1>
        <p className="text-muted-foreground text-sm">Today&apos;s attendance submissions</p>
      </div>

      {errorMsg && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
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
        <EmptyState icon={Users} title="No submissions today" description="Students haven't checked in yet." />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{(log.profiles as unknown as { full_name: string })?.full_name || "Student"}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(log.submitted_at)} · {formatDistance(log.distance_m)} · Acc: {formatAccuracy(log.accuracy_m)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {log.teacher_flag_status && <StatusBadge status="flagged" />}
                  <StatusBadge status={log.status} />
                </div>
              </div>

              <div className="flex gap-3 items-start">
                {log.proof_image_url && <img src={log.proof_image_url} alt="Selfie" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className={log.within_radius ? "text-emerald-500" : "text-amber-500"}>{log.within_radius ? "✓ In radius" : "✗ Out of radius"}</span>
                    <span className={log.within_time_window ? "text-emerald-500" : "text-amber-500"}>{log.within_time_window ? "✓ On time" : "✗ Late"}</span>
                  </div>
                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">{log.fraud_flags.map((f) => <span key={f} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[10px]">{flagLabel(f as Parameters<typeof flagLabel>[0])}</span>)}</div>
                  )}
                </div>
              </div>

              {log.teacher_note_summary && <div className="bg-muted rounded-lg p-2.5 text-xs"><span className="font-medium">Your note: </span>{log.teacher_note_summary}</div>}

              {log.status === "pending_teacher_view" && (
                <div className="flex gap-2">
                  <input value={noteMap[log.id] || ""} onChange={(e) => setNoteMap((prev) => ({ ...prev, [log.id]: e.target.value }))} placeholder="Add note (e.g. seen in class)" className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  <button onClick={() => handleAddNote(log.id)} disabled={savingId === log.id} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1">{savingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send</button>
                  <button onClick={() => handleFlag(log.id)} className="px-3 py-2 rounded-lg bg-orange-500/10 text-orange-500 text-xs font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Flag</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
