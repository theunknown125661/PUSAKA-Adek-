"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  BookOpen, Library, Check, Loader2, Save, ArrowLeft, 
  Lock, Calendar, CheckCircle, AlertTriangle, ShieldCheck
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface SubjectData {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  color_code: string | null;
}

interface ClassSubjectOffering {
  id: string;
  subject_id: string;
  is_required: boolean;
  selection_group: string | null;
  max_students: number | null;
  subjects?: SubjectData | null;
}

interface PolicyData {
  min_electives: number;
  max_electives: number;
  selection_start_date: string | null;
  selection_end_date: string | null;
  auto_enroll_required: boolean;
  selection_locked: boolean;
}

export default function StudentSubjectsPage() {
  const router = useRouter();
  const { t, isClient } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [classInfo, setClassInfo] = useState<{ id: string; name: string; grade_level: string } | null>(null);

  // Subject catalogs
  const [offerings, setOfferings] = useState<ClassSubjectOffering[]>([]);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [selectedElectiveIds, setSelectedElectiveIds] = useState<string[]>([]); // class_subject IDs

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 1. Fetch Profile
      const { data: pData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(pData);

      // 2. Fetch Enrollment details
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, grade_level)")
        .eq("student_id", user.id)
        .maybeSingle();

      if (!enr || !enr.classes) {
        setLoading(false);
        return;
      }

      const classId = enr.class_id;
      setClassInfo(enr.classes as any);

      // 3. Fetch Class Subjects
      const { data: subsData } = await supabase
        .from("class_subjects")
        .select("*, subjects!subject_id(*)")
        .eq("class_id", classId)
        .eq("is_active", true);
      
      const offeringsList = (subsData || []) as unknown as ClassSubjectOffering[];
      setOfferings(offeringsList);

      // 4. Fetch Elective Policies
      const { data: policyData } = await supabase
        .from("class_subject_policies")
        .select("*")
        .eq("class_id", classId)
        .maybeSingle();

      if (policyData) {
        setPolicy(policyData as PolicyData);
      } else {
        // Default fallback policy
        setPolicy({
          min_electives: 0,
          max_electives: offeringsList.filter(o => !o.is_required).length,
          selection_start_date: null,
          selection_end_date: null,
          auto_enroll_required: true,
          selection_locked: false
        });
      }

      // 5. Fetch Student's active selections
      const { data: selections } = await supabase
        .from("student_subjects")
        .select("class_subject_id")
        .eq("student_id", user.id)
        .eq("selection_status", "approved");

      if (selections) {
        // Pre-select active electives
        const activeClassSubjectIds = selections.map(s => s.class_subject_id);
        setSelectedElectiveIds(activeClassSubjectIds);
      }
    } catch (err: any) {
      console.error("Error loading student subject offerings:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        error: err
      });
      toast.error("Error loading subject offerings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleElective = (classSubjectId: string) => {
    // Check if selection window is closed or locked
    if (policy) {
      if (policy.selection_locked) {
        toast.error("Subject selections have been locked by the administrator.");
        return;
      }
      const now = new Date();
      if (policy.selection_start_date && new Date(policy.selection_start_date) > now) {
        toast.error("Elective selection period has not started yet.");
        return;
      }
      if (policy.selection_end_date && new Date(policy.selection_end_date) < now) {
        toast.error("Elective selection period has already closed.");
        return;
      }
    }

    setSelectedElectiveIds(prev => {
      const isSelected = prev.includes(classSubjectId);
      if (isSelected) {
        return prev.filter(id => id !== classSubjectId);
      } else {
        // Enforce max electives policy
        if (policy && policy.max_electives > 0 && prev.length >= policy.max_electives) {
          toast.error(`You can select at most ${policy.max_electives} electives.`);
          return prev;
        }
        return [...prev, classSubjectId];
      }
    });
  };

  const handleSave = async () => {
    const supabase = createClient();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classInfo) return;

      // 1. Delete prior elective selections for this student
      // To preserve required selections, we only delete selections corresponding to elective offerings
      const electiveOfferingIds = offerings.filter(o => !o.is_required).map(o => o.id);
      
      if (electiveOfferingIds.length > 0) {
        await supabase
          .from("student_subjects")
          .delete()
          .eq("student_id", user.id)
          .in("class_subject_id", electiveOfferingIds);
      }

      // 2. Insert new selections
      const inserts = [];

      // Required subjects: auto-enroll if enabled
      if (policy?.auto_enroll_required !== false) {
        const requiredOfferingIds = offerings.filter(o => o.is_required).map(o => o.id);
        
        for (const reqId of requiredOfferingIds) {
          inserts.push({
            school_id: profile.school_id,
            student_id: user.id,
            class_subject_id: reqId,
            selection_status: "approved",
            assigned_by: "system"
          });
        }
      }

      // Selected electives
      for (const selId of selectedElectiveIds) {
        // Avoid inserting duplicates if auto-enroll overlaps (shouldn't because electives are distinct)
        if (!inserts.some(i => i.class_subject_id === selId)) {
          inserts.push({
            school_id: profile.school_id,
            student_id: user.id,
            class_subject_id: selId,
            selection_status: "approved",
            assigned_by: "student"
          });
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase
          .from("student_subjects")
          .upsert(inserts, { onConflict: "student_id,class_subject_id" });
        if (error) throw error;
      }

      toast.success("Academic subjects successfully enrolled! 🎉");
      router.back();
    } catch (err: any) {
      toast.error("Failed to enroll subjects: " + err.message);
      console.error("Student confirm enrollment failed:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        error: err
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not enrolled in a class state
  if (!classInfo) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState 
          icon={Library}
          title="Not Enrolled in any Class"
          description="Go to My Class to select your school and enroll in a class before choosing electives."
        />
        <div className="flex justify-center mt-6">
          <button 
            onClick={() => router.push("/student/class")}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
          >
            Enroll in Class
          </button>
        </div>
      </div>
    );
  }

  // Filter offerings
  const requiredOfferings = offerings.filter(o => o.is_required);
  const electiveOfferings = offerings.filter(o => !o.is_required);

  // Group electives by selection_group
  const groupedElectives: Record<string, ClassSubjectOffering[]> = {};
  electiveOfferings.forEach(off => {
    const groupName = off.selection_group || "General Electives";
    if (!groupedElectives[groupName]) {
      groupedElectives[groupName] = [];
    }
    groupedElectives[groupName].push(off);
  });

  // Verification checks
  const minRequired = policy?.min_electives || 0;
  const maxRequired = policy?.max_electives || 0;
  const selectedCount = selectedElectiveIds.filter(id => {
    const off = offerings.find(o => o.id === id);
    return off && !off.is_required;
  }).length;

  const isMinSatisfied = selectedCount >= minRequired;
  const isMaxSatisfied = maxRequired === 0 || selectedCount <= maxRequired;
  const isValid = isMinSatisfied && isMaxSatisfied && (!policy || !policy.selection_locked);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5.5 w-5.5 text-primary" /> My Academic Subjects
            </h1>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Class: <span className="text-primary font-bold">{classInfo.name}</span> (Grade {classInfo.grade_level})
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !isValid || policy?.selection_locked}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 active:scale-[0.98] transition-all shadow-md shadow-primary/10 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Confirm Enrollment
        </button>
      </div>

      {/* Policy warning header if constraints exist */}
      {policy?.selection_locked ? (
        <div className="p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed font-semibold shadow-sm bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/10">
          <Lock className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-wide">Selections Locked</p>
            <p className="mt-0.5 text-muted-foreground">
              Your elective subject selections have been locked by the administrator. You can no longer make changes.
            </p>
          </div>
        </div>
      ) : policy && (minRequired > 0 || maxRequired > 0) && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed font-semibold shadow-sm ${
          isValid 
            ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10" 
            : "bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/10"
        }`}>
          {isValid ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-extrabold uppercase tracking-wide">Electives Policy Alert</p>
            <p className="mt-0.5 text-muted-foreground">
              You have selected <span className="font-black text-foreground">{selectedCount}</span> electives. 
              Class rule requires: <span className="font-bold text-foreground">Min {minRequired}</span> and <span className="font-bold text-foreground">Max {maxRequired}</span> electives.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* REQUIRED SUBJECTS (LOCKED COLUMN) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-indigo-500" /> Required Courses ({requiredOfferings.length})
            </h2>
            <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Locked
            </span>
          </div>

          <div className="space-y-3">
            {requiredOfferings.length === 0 ? (
              <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                No core required subjects assigned to this class.
              </div>
            ) : (
              requiredOfferings.map((off) => {
                const sub = off.subjects;
                if (!sub) return null;
                return (
                  <div 
                    key={off.id}
                    className="card rounded-2xl p-4 border border-border/50 bg-muted/10 flex items-start gap-3 relative overflow-hidden"
                  >
                    {/* Visual left bar color */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: sub.color_code || "#3B82F6" }} />
                    
                    <div className="flex-1 min-w-0 pl-1.5">
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-sm font-mono"
                          style={{ backgroundColor: sub.color_code || "#3B82F6" }}
                        >
                          {sub.code}
                        </span>
                        <h4 className="font-extrabold text-xs text-foreground truncate">{sub.name}</h4>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-1">Credits: {sub.credits} SKS • Required</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ELECTIVE SUBJECTS (SELECTABLE COLUMN) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4.5 w-4.5 text-amber-500" /> Elective Offerings
            </h2>
            <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Interactive
            </span>
          </div>

          {Object.keys(groupedElectives).length === 0 ? (
            <EmptyState 
              icon={BookOpen}
              title="No Electives Offered"
              description="There are no elective subjects assigned to your class catalog for this semester."
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedElectives).map(([groupName, groupOfferings]) => (
                <div key={groupName} className="space-y-3">
                  <h3 className="text-xs font-black text-foreground uppercase tracking-widest bg-muted/40 px-3 py-1.5 rounded-xl border border-border/30">
                    {groupName}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {groupOfferings.map((off) => {
                      const sub = off.subjects;
                      if (!sub) return null;
                      const isSelected = selectedElectiveIds.includes(off.id);
                      
                      return (
                        <button
                          key={off.id}
                          onClick={() => handleToggleElective(off.id)}
                          className={`card rounded-2xl p-4 border transition-all text-left flex items-start justify-between relative group active:scale-[0.99] ${
                            isSelected 
                              ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" 
                              : "bg-card border-border/50 hover:bg-muted/30 hover:border-border"
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span 
                                className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-sm font-mono"
                                style={{ backgroundColor: sub.color_code || "#3B82F6" }}
                              >
                                {sub.code}
                              </span>
                              <h4 className="font-extrabold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                {sub.name}
                              </h4>
                            </div>
                            
                            {sub.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed font-medium">
                                {sub.description}
                              </p>
                            )}

                            <p className="text-[9px] text-muted-foreground font-semibold mt-2.5">
                              Credits: {sub.credits} SKS
                            </p>
                          </div>

                          <div className={`h-5.5 w-5.5 rounded-full flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                            isSelected 
                              ? "bg-primary border-primary text-white shadow-sm" 
                              : "border-border/60 group-hover:border-primary/40"
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
