"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import {
  BookOpen, GraduationCap, Users, Calendar, Clock, User, Mail, Plus,
  CheckCircle2, Trash2, Settings, Loader2, Save, MapPin, Info, ArrowLeft, School, ShieldAlert,
  List as ListIcon, CalendarDays, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import AvatarDisplay from "@/components/profile/avatar-display";
import { ScheduleComponent } from "./schedule-component";

const COLOR_OPTIONS = [
  { name: "Blue", key: "blue", class: "from-blue-500 to-indigo-600 bg-blue-500/10 text-blue-500 text-blue-300 border-blue-500/30" },
  { name: "Purple", key: "purple", class: "from-purple-500 to-pink-600 bg-purple-500/10 text-purple-500 text-purple-300 border-purple-500/30" },
  { name: "Amber", key: "amber", class: "from-amber-500 to-orange-600 bg-amber-500/10 text-amber-500 text-amber-300 border-amber-500/30" },
  { name: "Teal", key: "teal", class: "from-teal-500 to-emerald-600 bg-teal-500/10 text-teal-500 text-teal-300 border-teal-500/30" },
  { name: "Rose", key: "rose", class: "from-rose-500 to-red-600 bg-rose-500/10 text-rose-500 text-rose-300 border-rose-500/30" },
  { name: "Cyan", key: "cyan", class: "from-cyan-500 to-blue-600 bg-cyan-500/10 text-cyan-500 text-cyan-300 border-cyan-500/30" },
  { name: "Indigo", key: "indigo", class: "from-indigo-500 to-purple-600 bg-indigo-500/10 text-indigo-500 text-indigo-300 border-indigo-500/30" },
  { name: "Emerald", key: "emerald", class: "from-emerald-500 to-teal-600 bg-emerald-500/10 text-emerald-500 text-emerald-300 border-emerald-500/30" },
  { name: "Orange", key: "orange", class: "from-orange-500 to-red-600 bg-orange-500/10 text-orange-500 text-orange-300 border-orange-500/30" },
  { name: "Pink", key: "pink", class: "from-pink-500 to-rose-600 bg-pink-500/10 text-pink-500 text-pink-300 border-pink-500/30" }
];

interface ScheduleSlot {
  subject: string;
  time: string;
  teacher: string;
  color: string;
}

interface DaySchedule {
  day: string;
  slots: ScheduleSlot[];
}

const resolveSlotColor = (color: string) => {
  if (!color) return COLOR_OPTIONS[6].class;
  if (color.includes(" ")) return color;
  const match = COLOR_OPTIONS.find(o => o.key === color);
  return match ? match.class : COLOR_OPTIONS[6].class;
};

const getColorClasses = (colorKey: string) => {
  const match = COLOR_OPTIONS.find(o => o.key === colorKey);
  return match || COLOR_OPTIONS[6]; // Indigo fallback
};

export default function StudentClassPage() {
  const { t, isClient } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rewardRules, setRewardRules] = useState<any>(null);

  const [schoolColor, setSchoolColor] = useState<string>("indigo");
  const [classColor, setClassColor] = useState<string>("indigo");
  const [subjectLegends, setSubjectLegends] = useState<any[]>([]);

  // Selection/editing states
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loadingEnrollment, setLoadingEnrollment] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load Profile
      const { data: pData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(pData);

      // Load Enrollment
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, school_id, name, grade_level, schools(id, name))")
        .eq("student_id", user.id)
        .maybeSingle();

      setEnrollment(enr);

      if (enr) {
        const classId = enr.class_id;
        const schoolId = (enr.classes as any)?.school_id;

        // Fetch classmates (excluding self)
        const { data: classmatesRes } = await supabase
          .from("enrollments")
          .select("profiles:profiles!student_id(id, full_name, username, avatar_url, level)")
          .eq("class_id", classId);

        if (classmatesRes) {
          const formatted = classmatesRes
            .map((c: any) => c.profiles)
            .filter((p: any) => p && p.id !== user.id);
          setClassmates(formatted);
        }

        // Fetch teachers
        const { data: teachersRes } = await supabase
          .from("teacher_class_assignments")
          .select("profiles:profiles!teacher_id(id, full_name, email, avatar_url)")
          .eq("class_id", classId);

        if (teachersRes) {
          setTeachers(teachersRes.map((t: any) => t.profiles).filter(Boolean));
        }

        // Fetch school rules (for check-in window)
        const { data: rules } = await supabase
          .from("reward_rules")
          .select("*")
          .eq("school_id", schoolId)
          .maybeSingle();
        setRewardRules(rules);

        // Load settings from system_settings
        const { data: settingsData } = await supabase
          .from("system_settings")
          .select("key, value")
          .eq("school_id", schoolId);

        

        // Prepopulate dropdowns
        setSelectedSchoolId(schoolId || "");
        setSelectedClassId(classId || "");
      }

      // Fetch all schools
      const { data: schoolsData } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      setSchools(schoolsData || []);
    } catch (err) {
      console.error("Error loading class page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  // Fetch classes for selected school
  useEffect(() => {
    if (!selectedSchoolId) {
      setClasses([]);
      return;
    }
    const supabase = createClient();
    async function loadSchoolClasses() {
      const { data } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", selectedSchoolId)
        .order("name");
      setClasses(data || []);
    }
    loadSchoolClasses();
  }, [selectedSchoolId]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast.error("Please select a class");
      return;
    }
    setLoadingEnrollment(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", user.id)
        .maybeSingle();

      let error;
      if (existing) {
        const res = await supabase
          .from("enrollments")
          .update({ class_id: selectedClassId })
          .eq("student_id", user.id);
        error = res.error;
      } else {
        const res = await supabase
          .from("enrollments")
          .insert({
            student_id: user.id,
            class_id: selectedClassId
          });
        error = res.error;
      }

      if (error) {
        toast.error("Enrollment failed: " + error.message);
      } else {
        toast.success("Enrolled successfully!");
        setIsEditing(false);
        window.dispatchEvent(new Event("profile-updated"));
        await loadData();
      }
    } catch (err: any) {
      toast.error("Unexpected error: " + err.message);
    } finally {
      setLoadingEnrollment(false);
    }
  };

  const handleLeaveClass = async () => {
    if (!confirm("Are you sure you want to leave this class? You cannot record attendance until you enroll in a new class.")) {
      return;
    }
    setLoadingEnrollment(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("student_id", user.id);

      if (error) {
        toast.error("Failed to leave class: " + error.message);
      } else {
        toast.success("Successfully unassigned from class");
        setEnrollment(null);
        setClassmates([]);
        setTeachers([]);
        setSelectedClassId("");
        setSelectedSchoolId("");
        setIsEditing(false);
        window.dispatchEvent(new Event("profile-updated"));
        await loadData();
      }
    } catch (err: any) {
      toast.error("Unexpected error: " + err.message);
    } finally {
      setLoadingEnrollment(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const daysOfWeekNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    // Add padding days from previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Add days of current month
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  // Render helpers for Schedule component
  

  const classData = enrollment?.classes;
  const schoolData = classData?.schools;

  // RENDER: NOT ENROLLED OR CURRENTLY EDITING
  if (!enrollment || isEditing) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-12">
        <div className="flex items-center gap-3">
          {isEditing && (
            <button 
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <School className="h-6 w-6 text-primary" />
              {isEditing ? "Change Class" : "Select Your Class"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isEditing 
                ? "Select a new school and class. Your history and wallet balances will remain intact."
                : "You must enroll in a class to join School Streak and record your attendance."}
            </p>
          </div>
        </div>

        <div className="card rounded-3xl p-6 md:p-8 space-y-6">
          <form onSubmit={handleEnroll} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                Select School
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value);
                  setSelectedClassId("");
                }}
                className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                required
              >
                <option value="">Choose your school...</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                Select Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={!selectedSchoolId}
                className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow disabled:opacity-50"
                required
              >
                <option value="">Choose your class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (Grade {cls.grade_level})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loadingEnrollment || !selectedClassId}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loadingEnrollment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? "Save Class Change" : "Confirm Enrollment"}
            </button>
          </form>

          {!isEditing && (
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3 text-xs text-muted-foreground">
              <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-primary mb-1">What happens after joining?</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You will be eligible to perform location check-ins.</li>
                  <li>You will participate in daily reward pools configured by your school.</li>
                  <li>You will gain access to class schedules, teachers, and classmates roster.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // RENDER: CLASS PAGE (ENROLLED)
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Banner / Header */}
      {(() => {
        const schoolColorOption = getColorClasses(schoolColor);
        const schoolColorParts = schoolColorOption.class.split(" ");
        const bannerGradient = `${schoolColorParts[0]} ${schoolColorParts[1]}`;
        return (
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${bannerGradient} p-6 md:p-8 text-primary-foreground shadow-lg shadow-primary/20`}>
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md">
                  Grade {classData.grade_level}
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight">{classData.name}</h1>
                <p className="text-primary-foreground/80 text-sm font-medium flex items-center gap-1.5">
                  <School className="h-4 w-4" /> {schoolData.name}
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
                >
                  <Settings className="h-4 w-4" />
                  Change Class
                </button>
                <button
                  onClick={handleLeaveClass}
                  disabled={loadingEnrollment}
                  className="px-4 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  {loadingEnrollment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Leave Class
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Academic Subjects CTA */}
      <div className="card rounded-[24px] p-5 border border-border/50 bg-card shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">
              Academic Subjects Catalog & Electives
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select your elective subjects, view required courses, and track active academic listings.
            </p>
          </div>
        </div>
        <Link
          href="/student/class/subjects"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary transition-all active:scale-[0.98] shadow-md shadow-primary/10 hover:opacity-95 shrink-0"
        >
          Manage Subjects & Electives &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns (Schedules & Teacher) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Schedule & Attendance Window */}
          {rewardRules && (
            <div className="card rounded-2xl p-5 space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Attendance Requirements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-muted/40 p-4 rounded-xl space-y-0.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Attendance Window</span>
                  <p className="text-base font-bold text-foreground">{rewardRules.attendance_start_time} - {rewardRules.attendance_end_time}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl space-y-0.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Early Bonus Cutoff</span>
                  <p className="text-base font-bold text-primary">{rewardRules.early_cutoff_time}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl space-y-0.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Base Attendance Payout</span>
                  <p className="text-base font-bold text-emerald-500">Rp {rewardRules.base_reward}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timetable / Schedule */}
          <div className="card rounded-2xl p-6 space-y-5">
            <ScheduleComponent schoolId={schoolData.id} classId={classData.id} onSubjectsChange={setSubjectLegends} />
          </div>
        </div>

        {/* Right Column (Teachers & Roster) */}
        <div className="space-y-6">
          {/* Class Teacher */}
          <div className="card rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-primary" /> Class Teacher
            </h2>
            
            {teachers.length === 0 ? (
              <div className="text-center py-6 bg-muted/20 border border-border border-dashed rounded-xl">
                <p className="text-xs text-muted-foreground">No teachers assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/40">
                    <AvatarDisplay
                      fullName={teacher.full_name || "Teacher"}
                      avatarUrl={teacher.avatar_url}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{teacher.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{teacher.email}</p>
                    </div>
                    {teacher.email && (
                      <a
                        href={`mailto:${teacher.email}`}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Email Teacher"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subjects Legends Card */}
          <div className="card rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Subjects
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              {subjectLegends.map((legend, idx) => {
                const colorParts = resolveSlotColor(legend.color).split(" ");
                const bgGradient = `bg-gradient-to-br ${colorParts.slice(0, 2).join(" ")}`;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-3 w-3 rounded-full shrink-0 ${bgGradient}`} />
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground truncate">{legend.subject}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{legend.teacher}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold bg-muted px-2 py-0.5 rounded-md text-muted-foreground uppercase tracking-wider shrink-0">
                      Active
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class Roster (Classmates) */}
          <div className="card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-primary" /> Classmates
              </h2>
              <span className="text-[10px] font-bold bg-muted px-2.5 py-1 rounded-full">
                {classmates.length + 1} enrolled
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2.5">
              {/* Self */}
              {profile && (
                <div className="flex items-center justify-between p-2.5 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarDisplay
                      fullName={profile.full_name || "Me"}
                      avatarUrl={profile.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate">{profile.full_name} <span className="text-[9px] text-primary">(You)</span></p>
                      {profile.username && (
                        <p className="text-[9px] text-muted-foreground">@{profile.username}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full shrink-0">
                    Lvl {profile.level || 1}
                  </span>
                </div>
              )}

              {/* Classmates */}
              {classmates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-6">
                  You are the first student in this class!
                </p>
              ) : (
                classmates.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2.5 hover:bg-muted/20 rounded-xl transition-colors border border-border/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarDisplay
                        fullName={student.full_name || "Student"}
                        avatarUrl={student.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{student.full_name}</p>
                        {student.username && (
                          <p className="text-[9px] text-muted-foreground">@{student.username}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                      Lvl {student.level || 1}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
