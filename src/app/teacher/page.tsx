"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { EmptyState } from "@/components/shared/empty-state";
import { BookOpen, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ClassSummary {
  id: string;
  name: string;
  grade_level: string;
  studentCount: number;
  presentToday: number;
  pendingReview: number;
  flagged: number;
}

export default function TeacherDashboard() {
  const { profile } = useUserRole();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    async function load() {
      const { data: assignments } = await supabase
        .from("teacher_class_assignments")
        .select("class_id, classes(id, name, grade_level)")
        .eq("teacher_id", profile!.id);

      if (!assignments) { setLoading(false); return; }

      const summaries: ClassSummary[] = [];
      for (const a of assignments) {
        const cls = a.classes as unknown as { id: string; name: string; grade_level: string };
        const [enrollRes, attRes] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact" }).eq("class_id", cls.id),
          supabase.from("attendance_logs").select("status, teacher_flag_status").eq("class_id", cls.id).eq("attendance_date", today),
        ]);
        const logs = attRes.data || [];
        summaries.push({
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          studentCount: enrollRes.count || 0,
          presentToday: logs.length,
          pendingReview: logs.filter((l) => l.status === "pending_teacher_view").length,
          flagged: logs.filter((l) => l.teacher_flag_status).length,
        });
      }
      setClasses(summaries);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-xl font-bold">Teacher Dashboard</h1><p className="text-muted-foreground text-sm mt-1">Monitor your assigned classes</p></div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 text-center"><Users className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{classes.reduce((a, c) => a + c.studentCount, 0)}</p><p className="text-xs text-muted-foreground">Students</p></div>
        <div className="glass rounded-2xl p-4 text-center"><Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" /><p className="text-2xl font-bold">{classes.reduce((a, c) => a + c.pendingReview, 0)}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        <div className="glass rounded-2xl p-4 text-center"><AlertTriangle className="h-5 w-5 text-orange-500 mx-auto mb-1" /><p className="text-2xl font-bold">{classes.reduce((a, c) => a + c.flagged, 0)}</p><p className="text-xs text-muted-foreground">Flagged</p></div>
      </div>

      {/* Classes */}
      {classes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No classes assigned" description="You haven't been assigned to any classes yet." />
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold">My Classes</h2>
          {classes.map((cls) => (
            <Link key={cls.id} href={`/teacher/class/${cls.id}`} className="block glass rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{cls.name}</p><p className="text-xs text-muted-foreground">Grade {cls.grade_level} · {cls.studentCount} students</p></div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="h-3.5 w-3.5" />{cls.presentToday}</span>
                  {cls.pendingReview > 0 && <span className="flex items-center gap-1 text-amber-500"><Clock className="h-3.5 w-3.5" />{cls.pendingReview}</span>}
                  {cls.flagged > 0 && <span className="flex items-center gap-1 text-orange-500"><AlertTriangle className="h-3.5 w-3.5" />{cls.flagged}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
