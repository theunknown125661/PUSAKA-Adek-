"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  BookOpen, Library, Check, Plus, Loader2, ArrowRight, Save,
  ToggleLeft, ToggleRight, Calendar, Info, Clock, AlertCircle, X
} from "lucide-react";
import { toast } from "sonner";

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  color_code: string | null;
  is_active: boolean;
}

interface ClassSubject {
  id?: string;
  subject_id: string;
  is_required: boolean;
  selection_group: string | null;
  max_students: number | null;
  is_active: boolean;
}

interface Policy {
  id?: string;
  selection_start_date: string | null;
  selection_end_date: string | null;
  min_electives: number;
  max_electives: number;
  auto_enroll_required: boolean;
}

export default function ClassSubjectsAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const { t, isClient } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [schoolId, setSchoolId] = useState("");

  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [assigned, setAssigned] = useState<ClassSubject[]>([]);
  
  const [policy, setPolicy] = useState<Policy>({
    selection_start_date: "",
    selection_end_date: "",
    min_electives: 0,
    max_electives: 0,
    auto_enroll_required: true
  });

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch Class Info
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("*, school_id")
        .eq("id", classId)
        .single();

      if (clsErr || !cls) throw new Error("Failed to load class");

      setClassName(cls.name);
      setGradeLevel(cls.grade_level);
      setSchoolId(cls.school_id);

      // Fetch School's Subject Catalog
      const { data: subjectsData, error: subErr } = await supabase
        .from("subjects")
        .select("*")
        .eq("school_id", cls.school_id)
        .eq("is_active", true);

      if (subErr) throw new Error("Failed to load catalog");
      setCatalog(subjectsData || []);

      // Fetch currently assigned subjects
      const { data: assignedData, error: assignErr } = await supabase
        .from("class_subjects")
        .select("*")
        .eq("class_id", classId);

      if (assignErr) throw new Error("Failed to load assignments");
      setAssigned(assignedData || []);

      // Fetch enrollment policy
      const { data: policyData, error: polErr } = await supabase
        .from("class_subject_policies")
        .select("*")
        .eq("class_id", classId)
        .maybeSingle();

      if (policyData) {
        setPolicy({
          id: policyData.id,
          selection_start_date: policyData.selection_start_date ? new Date(policyData.selection_start_date).toISOString().slice(0, 16) : "",
          selection_end_date: policyData.selection_end_date ? new Date(policyData.selection_end_date).toISOString().slice(0, 16) : "",
          min_electives: policyData.min_electives || 0,
          max_electives: policyData.max_electives || 0,
          auto_enroll_required: policyData.auto_enroll_required ?? true
        });
      }
    } catch (err: any) {
      toast.error(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    try {
      // 1. Save Policy
      const policyPayload = {
        class_id: classId,
        selection_start_date: policy.selection_start_date || null,
        selection_end_date: policy.selection_end_date || null,
        min_electives: policy.min_electives,
        max_electives: policy.max_electives,
        auto_enroll_required: policy.auto_enroll_required
      };

      if (policy.id) {
        await supabase.from("class_subject_policies").update(policyPayload).eq("id", policy.id);
      } else {
        const { data: newPol } = await supabase.from("class_subject_policies").insert(policyPayload).select().single();
        if (newPol) setPolicy(prev => ({ ...prev, id: newPol.id }));
      }

      // 2. Save Subjects
      // We will delete all current and re-insert for simplicity in this demo,
      // or we can upsert if id is present. 
      // Upserting is safer.
      const subjectsPayload = assigned.map(a => ({
        ...(a.id ? { id: a.id } : {}),
        class_id: classId,
        subject_id: a.subject_id,
        is_required: a.is_required,
        selection_group: a.selection_group || null,
        max_students: a.max_students || null,
        is_active: a.is_active
      }));

      // Find deleted ones
      const currentIds = assigned.filter(a => a.id).map(a => a.id);
      if (currentIds.length > 0) {
        // Just delete all existing and insert new to avoid complex diffing
        await supabase.from("class_subjects").delete().eq("class_id", classId);
      } else {
        await supabase.from("class_subjects").delete().eq("class_id", classId);
      }

      if (subjectsPayload.length > 0) {
        const { error: insertErr } = await supabase.from("class_subjects").insert(subjectsPayload);
        if (insertErr) throw insertErr;
      }

      toast.success("Class subjects and policies updated successfully!");
      loadData(); // reload to get new IDs
    } catch (err: any) {
      toast.error("Failed to save changes: " + err.message);
      console.error("Save class subjects and policies failed:", {
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

  const handleAddSubject = (sub: Subject) => {
    if (assigned.some(a => a.subject_id === sub.id)) return;
    setAssigned([...assigned, {
      subject_id: sub.id,
      is_required: true,
      selection_group: null,
      max_students: null,
      is_active: true
    }]);
  };

  const handleRemoveSubject = (subId: string) => {
    setAssigned(assigned.filter(a => a.subject_id !== subId));
  };

  const updateAssigned = (subId: string, updates: Partial<ClassSubject>) => {
    setAssigned(assigned.map(a => a.subject_id === subId ? { ...a, ...updates } : a));
  };

  if (!isClient || loading) {
    return (
      <div className="p-8 flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  // Filter catalog to show only unassigned
  const availableCatalog = catalog.filter(c => !assigned.some(a => a.subject_id === c.id));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Class Subjects
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage subject offerings, electives, and enrollment policies for {className} ({gradeLevel}).
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Enrollment Policies */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-primary" /> Enrollment Window
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Start Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={policy.selection_start_date || ""}
                  onChange={(e) => setPolicy({...policy, selection_start_date: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">End Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={policy.selection_end_date || ""}
                  onChange={(e) => setPolicy({...policy, selection_end_date: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <ToggleRight className="h-4 w-4 text-emerald-500" /> Elective Rules
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Min Electives</label>
                  <input 
                    type="number" min="0"
                    value={policy.min_electives}
                    onChange={(e) => setPolicy({...policy, min_electives: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0)})}
                    className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Max Electives</label>
                  <input 
                    type="number" min="0"
                    value={policy.max_electives}
                    onChange={(e) => setPolicy({...policy, max_electives: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0)})}
                    className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-semibold text-foreground">Auto-Enroll Required</p>
                  <p className="text-xs text-muted-foreground">Automatically enroll students in required subjects.</p>
                </div>
                <button 
                  onClick={() => setPolicy({...policy, auto_enroll_required: !policy.auto_enroll_required})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${policy.auto_enroll_required ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${policy.auto_enroll_required ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Subjects Assigner */}
        <div className="lg:col-span-2 flex flex-col md:flex-row gap-6">
          
          {/* Catalog */}
          <div className="flex-1 bg-card rounded-2xl border border-border/50 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-muted/10">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Library className="h-4 w-4 text-muted-foreground" /> Subject Catalog
              </h3>
            </div>
            <div className="p-4 overflow-y-auto max-h-[500px] space-y-2">
              {availableCatalog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No more subjects available in catalog.</p>
                </div>
              ) : (
                availableCatalog.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: sub.color_code || '#6366F1' }}>
                        {sub.code.substring(0,2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{sub.name}</p>
                        <p className="text-[10px] text-muted-foreground">{sub.code} • {sub.credits} Credits</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddSubject(sub)}
                      className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Assigned */}
          <div className="flex-1 bg-card rounded-2xl border border-primary/20 shadow-sm flex flex-col overflow-hidden ring-1 ring-primary/5">
            <div className="p-4 border-b border-border/50 bg-primary/5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Assigned to Class ({assigned.length})
              </h3>
            </div>
            <div className="p-4 overflow-y-auto max-h-[500px] space-y-3">
              {assigned.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <ArrowRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm">Add subjects from the catalog</p>
                </div>
              ) : (
                assigned.map(a => {
                  const sub = catalog.find(c => c.id === a.subject_id);
                  if (!sub) return null;
                  return (
                    <div key={a.subject_id} className="p-3 rounded-xl border border-primary/10 bg-primary/5 space-y-3 relative group">
                      <button 
                        onClick={() => handleRemoveSubject(a.subject_id)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: sub.color_code || '#6366F1' }}>
                          {sub.code.substring(0,2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{sub.name}</p>
                          <p className="text-[10px] text-muted-foreground">{sub.code}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10">
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Type</label>
                          <select 
                            value={a.is_required ? "required" : "elective"}
                            onChange={(e) => updateAssigned(a.subject_id, { is_required: e.target.value === "required" })}
                            className="w-full px-2 py-1.5 rounded-lg bg-card border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                          >
                            <option value="required">Required</option>
                            <option value="elective">Elective</option>
                          </select>
                        </div>
                        {!a.is_required && (
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Group (Optional)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Science"
                              value={a.selection_group || ""}
                              onChange={(e) => updateAssigned(a.subject_id, { selection_group: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg bg-card border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}