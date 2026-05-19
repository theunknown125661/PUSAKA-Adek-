"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Library, Users, User, Plus, Loader2, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { Class } from "@/lib/types/database";

type ClassData = Class & {
  teacher: { full_name: string } | null;
  enrollments: { count: number }[];
};

export default function AdminClassesPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<{id: string, full_name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", teacher_id: "" });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    const supabase = createClient();
    
    // Fetch classes with teacher name and enrollment count
    const { data: cData } = await supabase
      .from("classes")
      .select("*, teacher:profiles!teacher_id(full_name), enrollments(count)")
      .order("name");
      
    // Fetch all teachers for the dropdown
    const { data: tData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher")
      .order("full_name");

    if (cData) setClasses(cData as unknown as ClassData[]);
    if (tData) setTeachers(tData as {id: string, full_name: string}[]);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.teacher_id) {
      setErrorMsg(t.adminClasses.fillFields);
      return;
    }
    
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();
    
    // get the school_id from the first school (since it's single-tenant)
    const { data: school } = await supabase.from("schools").select("id").limit(1).single();
    
    if (school) {
      const { error } = await supabase.from("classes").insert({
        school_id: school.id,
        teacher_id: formData.teacher_id,
        name: formData.name
      });
      
      if (error) {
        setErrorMsg(error.message);
      } else {
        await loadData();
        setShowModal(false);
        setFormData({ name: "", teacher_id: "" });
      }
    } else {
      setErrorMsg(t.adminClasses.schoolNotFound);
    }
    
    setSaving(false);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Library className="h-5 w-5 text-indigo-500" /> {t.adminClasses.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{interpolate(t.adminClasses.activeClasses, { count: classes.length })}</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" /> {t.adminClasses.addClass}
        </button>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Library} title={t.adminClasses.noClasses} description={t.adminClasses.noClassesDesc} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div key={cls.id} className="glass rounded-xl p-5 hover:border-indigo-500/30 transition-colors flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="bg-muted px-2.5 py-1 rounded-full text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> {interpolate(t.adminClasses.studentsCount, { count: cls.enrollments[0]?.count || 0 })}
                  </span>
                </div>
                <h3 className="font-bold text-lg">{cls.name}</h3>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">{cls.teacher?.full_name || t.adminClasses.unassigned}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Class Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="font-bold text-lg">{t.adminClasses.createNewClass}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminClasses.className}</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50" 
                  placeholder="e.g. Mathematics 101"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminClasses.assignTeacher}</label>
                <select 
                  required
                  value={formData.teacher_id}
                  onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 appearance-none" 
                >
                  <option value="" disabled>{t.adminClasses.selectTeacher}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              {errorMsg && <p className="text-xs font-medium text-destructive bg-destructive/10 p-3 rounded-lg">{errorMsg}</p>}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? t.adminClasses.creating : t.adminClasses.createClass}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
