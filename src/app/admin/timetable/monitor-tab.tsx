"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Loader2, ShieldAlert, Lock, Unlock, CheckCircle2, Circle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Class, ClassSubjectPolicy, Profile, StudentSubject } from "@/lib/types/database";

export function SelectionMonitorTab({ schoolId }: { schoolId: string }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [policy, setPolicy] = useState<ClassSubjectPolicy | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selections, setSelections] = useState<StudentSubject[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [togglingLock, setTogglingLock] = useState(false);

  const loadBaseData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: clsData } = await supabase.from("classes").select("*").eq("school_id", schoolId).order("grade_level").order("name");
    if (clsData && clsData.length > 0) {
      setClasses(clsData as Class[]);
      setSelectedClassId(clsData[0].id);
    } else {
      setClasses([]);
      setSelectedClassId("");
    }
    
    setLoading(false);
  };

  const loadClassData = async () => {
    if (!selectedClassId) return;
    const supabase = createClient();
    
    // Fetch policy
    const { data: polData } = await supabase.from("class_subject_policies").select("*").eq("class_id", selectedClassId).single();
    setPolicy(polData as ClassSubjectPolicy || null);
    
    // Fetch students in class
    const { data: enrData } = await supabase.from("enrollments").select("profiles(*)").eq("class_id", selectedClassId);
    if (enrData) {
      const studs = enrData
        .map((e: any) => Array.isArray(e.profiles) ? e.profiles[0] : e.profiles)
        .filter(Boolean) as unknown as Profile[];
      setStudents(studs);
    }
    
    // Fetch selections
    const { data: selData } = await supabase.from("student_subjects").select("*, class_subjects(*)").eq("class_subjects.class_id", selectedClassId);
    // Since we filtered via joined table, some might be null if not matching, filter them out
    if (selData) {
      const validSels = (selData as any[]).filter(s => s.class_subjects) as StudentSubject[];
      setSelections(validSels);
    }
  };

  useEffect(() => {
    if (schoolId) loadBaseData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) loadClassData();
  }, [selectedClassId]);

  const handleToggleLock = async () => {
    if (!policy) return;
    setTogglingLock(true);
    const supabase = createClient();
    const newLockedStatus = !policy.selection_locked;
    
    const { error } = await supabase.from("class_subject_policies")
      .update({ selection_locked: newLockedStatus })
      .eq("id", policy.id);
      
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Selections ${newLockedStatus ? "locked" : "unlocked"} for this class.`);
      setPolicy({ ...policy, selection_locked: newLockedStatus });
    }
    setTogglingLock(false);
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  if (classes.length === 0) {
    return <EmptyState icon={ShieldAlert} title="No classes found" description="Create classes before monitoring student selections." />;
  }

  // Calculate stats
  const minRequired = policy?.min_electives || 0;
  const completedStudents = students.filter(student => {
    const studentSels = selections.filter(s => s.student_id === student.id);
    return studentSels.length >= minRequired;
  });
  
  const completionRate = students.length > 0 ? Math.round((completedStudents.length / students.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold">Selection Monitor</h2>
          <p className="text-sm text-muted-foreground">Monitor and lock student elective subject choices.</p>
        </div>
        
        <select 
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-4 py-2 rounded-xl bg-muted/50 border border-border text-sm font-bold w-full sm:w-auto"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.grade_level} - {c.name}</option>
          ))}
        </select>
      </div>

      {!policy ? (
        <EmptyState icon={ShieldAlert} title="No policy found" description="This class needs a subject policy (min/max electives) first." />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border/50 p-4 rounded-2xl flex flex-col justify-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Students</p>
              <p className="text-2xl font-black">{students.length}</p>
            </div>
            <div className="bg-card border border-border/50 p-4 rounded-2xl flex flex-col justify-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Completed Selections</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">{completedStudents.length}</p>
                <p className="text-sm font-bold text-muted-foreground">/ {students.length}</p>
              </div>
            </div>
            <div className="bg-card border border-border/50 p-4 rounded-2xl flex flex-col justify-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Completion Rate</p>
              <p className="text-2xl font-black">{completionRate}%</p>
            </div>
            
            <div className={`p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden transition-colors ${
              policy.selection_locked ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"
            }`}>
              <div className="relative z-10">
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${policy.selection_locked ? "text-rose-600" : "text-emerald-600"}`}>
                  Status
                </p>
                <p className={`text-xl font-black flex items-center gap-2 ${policy.selection_locked ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {policy.selection_locked ? <><Lock className="h-5 w-5" /> Locked</> : <><Unlock className="h-5 w-5" /> Open</>}
                </p>
              </div>
              
              <button 
                onClick={handleToggleLock}
                disabled={togglingLock}
                className={`absolute inset-0 z-0 opacity-0 hover:opacity-100 flex items-center justify-center font-bold text-sm backdrop-blur-sm transition-all ${
                  policy.selection_locked ? "bg-rose-500/90 text-white" : "bg-emerald-500/90 text-white"
                }`}
              >
                {togglingLock ? <Loader2 className="h-5 w-5 animate-spin" /> : policy.selection_locked ? "Click to Unlock" : "Click to Lock"}
              </button>
            </div>
          </div>

          {/* Student Table */}
          <div className="border border-border/50 rounded-2xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-bold">Student</th>
                    <th className="px-4 py-3 font-bold text-center">Electives Chosen</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {students.map(student => {
                    const studentSels = selections.filter(s => s.student_id === student.id);
                    const isComplete = studentSels.length >= minRequired;
                    
                    return (
                      <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase overflow-hidden">
                              {student.avatar_url ? (
                                <img src={student.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                student.full_name.substring(0, 2)
                              )}
                            </div>
                            <span className="font-semibold">{student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono bg-muted px-2 py-1 rounded-md font-bold">
                            {studentSels.length} / {minRequired}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isComplete ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold">
                              <Circle className="h-3.5 w-3.5" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No students enrolled in this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
