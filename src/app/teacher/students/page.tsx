"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Users, GraduationCap, Search, Activity, Calendar } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

type StudentData = {
  id: string;
  full_name: string;
  email: string;
  class_name: string;
  attendance_count: number;
  last_attendance: string | null;
};

export default function TeacherStudentsPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get classes taught by this teacher
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .eq("teacher_id", user.id);
        
      if (!classes || classes.length === 0) {
        setLoading(false);
        return;
      }

      const classIds = classes.map(c => c.id);
      
      // 2. Get enrollments for these classes
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, classes(name), profiles!student_id(id, full_name, email)")
        .in("class_id", classIds);

      if (!enrollments) {
        setLoading(false);
        return;
      }

      // 3. Get basic attendance stats for these students (approved logs only)
      const studentIds = enrollments.map(e => e.student_id);
      
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("student_id, attendance_date")
        .eq("status", "approved")
        .in("student_id", studentIds)
        .order("attendance_date", { ascending: false });

      const statsMap = new Map<string, { count: number, lastDate: string | null }>();
      (logs || []).forEach(log => {
        if (!statsMap.has(log.student_id)) {
          statsMap.set(log.student_id, { count: 1, lastDate: log.attendance_date });
        } else {
          const s = statsMap.get(log.student_id)!;
          s.count += 1;
        }
      });

      // Format final data
      const formattedData: StudentData[] = enrollments.map(e => {
        const profile = e.profiles as unknown as { id: string, full_name: string, email: string };
        const cls = e.classes as unknown as { name: string };
        const stats = statsMap.get(profile.id) || { count: 0, lastDate: null };
        
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          class_name: cls.name,
          attendance_count: stats.count,
          last_attendance: stats.lastDate
        };
      });

      setStudents(formattedData.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setLoading(false);
    }
    load();
  }, []);

  const filteredStudents = students.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return s.full_name.toLowerCase().includes(search) || s.class_name.toLowerCase().includes(search);
  });

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header section with search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> {t.teacher.myStudents}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.teacher.myStudentsDesc}</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={t.teacher.searchPlaceholder} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-semibold" 
          />
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title={t.teacher.noStudents} 
          description={t.teacher.noStudentsDesc} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => (
            <Link 
              key={student.id} 
              href={`/teacher/student/${student.id}`} 
              className="card rounded-2xl p-5 hover:border-primary/40 active:scale-[0.99] transition-all flex flex-col justify-between h-full group"
            >
              <div>
                <div className="flex items-start justify-between mb-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{student.full_name}</h3>
                      <p className="text-xs text-muted-foreground truncate w-40 font-medium mt-0.5">{student.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{t.teacher.classLabel}</span>
                    <span className="bg-muted px-2.5 py-1 rounded-lg text-foreground font-bold">{student.class_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{t.teacher.totalCheckins}</span>
                    <span className="text-success flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" /> 
                      {student.attendance_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">{t.teacher.lastSeen}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                      {student.last_attendance ? student.last_attendance : t.teacher.never}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
