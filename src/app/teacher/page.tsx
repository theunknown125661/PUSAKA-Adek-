"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import { BookOpen, Users, AlertTriangle, CheckCircle, Clock, ChevronRight } from "lucide-react";

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

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalStudents = classes.reduce((a, c) => a + c.studentCount, 0);
  const totalPending = classes.reduce((a, c) => a + c.pendingReview, 0);
  const totalFlagged = classes.reduce((a, c) => a + c.flagged, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t.teacher.dashboardTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.teacher.dashboardDesc}</p>
      </div>

      {/* Metric Summaries Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{totalStudents}</p>
          <p className="text-xs text-muted-foreground font-medium">{t.teacher.students}</p>
        </div>
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center mb-2">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <p className="text-2xl font-bold">{totalPending}</p>
          <p className="text-xs text-muted-foreground font-medium">{t.teacher.pending}</p>
        </div>
        <div className="card rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-2xl font-bold">{totalFlagged}</p>
          <p className="text-xs text-muted-foreground font-medium">{t.teacher.flagged}</p>
        </div>
      </div>

      {/* Classes list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg px-1">{t.teacher.myClasses}</h2>
        {classes.length === 0 ? (
          <EmptyState 
            icon={BookOpen} 
            title={t.teacher.noClasses} 
            description={t.teacher.noClassesDesc} 
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {classes.map((cls) => (
              <Link 
                key={cls.id} 
                href={`/teacher/class/${cls.id}`} 
                className="card rounded-2xl p-5 hover:border-primary/40 active:scale-[0.99] transition-all group flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="font-bold text-base group-hover:text-primary transition-colors">{cls.name}</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {interpolate(t.teacher.classGrade, { grade: cls.grade_level })} • {interpolate(t.teacher.studentsCount, { count: cls.studentCount })}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1 bg-success/10 text-success px-2 py-1 rounded-lg">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {cls.presentToday} {t.teacher.presentToday}
                    </span>
                    {cls.pendingReview > 0 && (
                      <span className="flex items-center gap-1 bg-warning/10 text-warning px-2 py-1 rounded-lg animate-pulse">
                        <Clock className="h-3.5 w-3.5" />
                        {cls.pendingReview}
                      </span>
                    )}
                    {cls.flagged > 0 && (
                      <span className="flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-1 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {cls.flagged}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
