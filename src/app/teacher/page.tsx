"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import { BookOpen, Users, AlertTriangle, CheckCircle, Clock, ChevronRight, GraduationCap } from "lucide-react";
import { toLocalYYYYMMDD } from "@/lib/utils/format";

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
  const { t, interpolate, isClient } = useTranslation();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = toLocalYYYYMMDD(new Date());

    async function load() {
      const { data: assignments } = await supabase
        .from("teacher_class_assignments")
        .select("class_id, classes(id, name, grade_level)")
        .eq("teacher_id", profile!.id);

      if (!assignments) { setLoading(false); return; }

      const summaries: ClassSummary[] = [];
      for (const a of assignments) {
        const cls = a.classes as unknown as { id: string; name: string; grade_level: string };
        if (!cls) continue;
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
          presentToday: logs.filter(l => l.status === 'present').length,
          pendingReview: logs.filter((l) => l.status === "pending_teacher_view").length,
          flagged: logs.filter((l) => l.teacher_flag_status).length,
        });
      }
      setClasses(summaries);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalStudents = classes.reduce((a, c) => a + c.studentCount, 0);
  const totalPending = classes.reduce((a, c) => a + c.pendingReview, 0);
  const totalFlagged = classes.reduce((a, c) => a + c.flagged, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Premium Teacher Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            Teacher Hub
          </h1>
          <p className="text-muted-foreground text-xs">{t.teacher.dashboardDesc}</p>
        </div>
      </div>

      {/* Metric Summaries Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Students */}
        <div className="card rounded-[24px] p-4 flex flex-col items-center justify-center text-center border border-border/50 bg-gradient-to-br from-indigo-500/5 to-transparent">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-2 shrink-0">
            <Users className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          <p className="text-xl font-black leading-none">{totalStudents}</p>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-1.5">{t.teacher.students}</p>
        </div>

        {/* Pending Review */}
        <div className="card rounded-[24px] p-4 flex flex-col items-center justify-center text-center border border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2 shrink-0">
            <Clock className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <p className="text-xl font-black leading-none">{totalPending}</p>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-1.5">{t.teacher.pending}</p>
        </div>

        {/* Flagged logs */}
        <div className="card rounded-[24px] p-4 flex flex-col items-center justify-center text-center border border-border/50 bg-gradient-to-br from-rose-500/5 to-transparent">
          <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center mb-2 shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
          </div>
          <p className="text-xl font-black leading-none">{totalFlagged}</p>
          <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mt-1.5">{t.teacher.flagged}</p>
        </div>
      </div>

      {/* Classes list */}
      <div className="space-y-4">
        <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground px-1">{t.teacher.myClasses}</h2>
        {classes.length === 0 ? (
          <EmptyState 
            icon={BookOpen} 
            title={t.teacher.noClasses} 
            description={t.teacher.noClassesDesc} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {classes.map((cls) => (
              <Link 
                key={cls.id} 
                href={`/teacher/class/${cls.id}`} 
                className="card rounded-[28px] p-5 hover:border-primary/30 hover:shadow-md active:scale-[0.99] transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border/50 bg-card"
              >
                <div className="space-y-1">
                  <p className="font-black text-base group-hover:text-primary transition-colors">{cls.name}</p>
                  <p className="text-[11px] text-muted-foreground font-bold">
                    {interpolate(t.teacher.classGrade, { grade: cls.grade_level })} • {interpolate(t.teacher.studentsCount, { count: cls.studentCount })}
                  </p>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      {cls.presentToday} Present
                    </span>
                    {cls.pendingReview > 0 && (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-xl animate-pulse border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        {cls.pendingReview} Pending
                      </span>
                    )}
                    {cls.flagged > 0 && (
                      <span className="flex items-center gap-1 bg-rose-500/10 text-rose-600 px-2.5 py-1 rounded-xl border border-rose-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                        {cls.flagged} Flagged
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all hidden sm:block" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
