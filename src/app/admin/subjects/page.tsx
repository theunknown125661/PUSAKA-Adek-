"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  BookOpen, School, Plus, Pencil, Trash2, X, Check, Loader2, Search, Filter
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface SubjectData {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  color_code: string | null;
  is_active: boolean;
  schools?: {
    id: string;
    name: string;
  } | null;
}

interface SchoolOption {
  id: string;
  name: string;
}

export default function PlatformSubjectsPage() {
  const router = useRouter();
  const { t, isClient } = useTranslation();

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState("all");

  // Modals state
  const [showModal, setShowModal] = useState<"add" | "edit" | "none">("none");
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form state
  const [form, setForm] = useState({
    school_id: "",
    name: "",
    code: "",
    description: "",
    credits: 3,
    color_code: "#3B82F6",
    is_active: true
  });

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch subjects with school names and active schools list
    const [subRes, schoolRes] = await Promise.all([
      supabase.from("subjects").select("*, schools:schools(id, name)").order("name"),
      supabase.from("schools").select("id, name").eq("is_active", true).order("name")
    ]);

    if (subRes.data) setSubjects(subRes.data as unknown as SubjectData[]);
    if (schoolRes.data) {
      const activeSchools = schoolRes.data as SchoolOption[];
      setSchools(activeSchools);
      if (activeSchools.length > 0) {
        setForm(prev => ({ ...prev, school_id: activeSchools[0].id }));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddSubject = () => {
    setForm({
      school_id: schools.length > 0 ? schools[0].id : "",
      name: "",
      code: "",
      description: "",
      credits: 3,
      color_code: "#3B82F6",
      is_active: true
    });
    setErrorMsg("");
    setShowModal("add");
  };

  const openEditSubject = (sub: SubjectData) => {
    setSelectedSubject(sub);
    setForm({
      school_id: sub.school_id,
      name: sub.name,
      code: sub.code,
      description: sub.description || "",
      credits: sub.credits || 3,
      color_code: sub.color_code || "#3B82F6",
      is_active: sub.is_active
    });
    setErrorMsg("");
    setShowModal("edit");
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.school_id) {
      setErrorMsg("Subject Name, Code, and School Selection are required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("subjects")
      .insert({
        school_id: form.school_id,
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description || null,
        credits: form.credits,
        color_code: form.color_code,
        is_active: form.is_active
      });

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Subject added to catalog successfully!");
      setShowModal("none");
      await loadData();
    }
    setSaving(false);
  };

  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    if (!form.name || !form.code) {
      setErrorMsg("Subject Name and Code are required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("subjects")
      .update({
        school_id: form.school_id,
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description || null,
        credits: form.credits,
        color_code: form.color_code,
        is_active: form.is_active
      })
      .eq("id", selectedSubject.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Subject catalog details updated!");
      setShowModal("none");
      setSelectedSubject(null);
      await loadData();
    }
    setSaving(false);
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject catalog? This will remove all class offering associations.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete subject: " + error.message);
    } else {
      toast.success("Subject deleted.");
      await loadData();
    }
  };

  const filteredSubjects = subjects.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sub.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSchool = selectedSchoolFilter === "all" || sub.school_id === selectedSchoolFilter;
    return matchesSearch && matchesSchool;
  });

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Global Subjects Catalog
          </h1>
          <p className="text-muted-foreground text-xs font-semibold">
            Manage subject catalogs across all multi-school tenants.
          </p>
        </div>

        <button
          onClick={openAddSubject}
          disabled={schools.length === 0}
          className="flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all bg-primary shadow-lg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Global Catalog
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card border border-border/40 p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search subject name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-border transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <select
            value={selectedSchoolFilter}
            onChange={(e) => setSelectedSchoolFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Schools</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subjects Catalog Grid */}
      {filteredSubjects.length === 0 ? (
        <EmptyState 
          icon={BookOpen}
          title="No Subjects Found"
          description={searchQuery || selectedSchoolFilter !== "all" ? "Adjust your search parameters." : "Add your first subject catalog to begin."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((sub) => (
            <div key={sub.id} className="card rounded-2xl p-5 border border-border/40 bg-card hover:border-primary/25 transition-all flex flex-col justify-between space-y-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span 
                    className="px-2 py-0.5 rounded text-[9px] font-black uppercase text-white shadow-sm font-mono"
                    style={{ backgroundColor: sub.color_code || "#3B82F6" }}
                  >
                    {sub.code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                    sub.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {sub.is_active ? "Active" : "Disabled"}
                  </span>
                </div>
                
                <h3 className="font-extrabold text-base text-foreground leading-snug">{sub.name}</h3>
                
                {sub.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {sub.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md uppercase">
                    {sub.credits} Credits
                  </span>
                  
                  {sub.schools && (
                    <span className="text-[10px] font-extrabold text-primary bg-primary/5 border border-primary/15 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <School className="h-3 w-3" />
                      {sub.schools.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                <button
                  onClick={() => openEditSubject(sub)}
                  className="p-1.5 rounded-lg border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteSubject(sub.id)}
                  className="p-1.5 rounded-lg border border-border/50 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Subject Modal */}
      {showModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Add Subject to Catalog
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-500/10 text-rose-500 p-3 rounded-xl text-xs font-semibold">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Target School *</label>
                <select 
                  required
                  value={form.school_id}
                  onChange={(e) => setForm(prev => ({ ...prev, school_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Name *</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Advanced Physics"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Code *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. PHYS-XII"
                    value={form.code}
                    onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm font-mono uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Credits (SKS)</label>
                  <input 
                    type="number" 
                    value={form.credits}
                    onChange={(e) => setForm(prev => ({ ...prev, credits: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Brand Display Color</label>
                <div className="grid grid-cols-8 gap-1.5 pt-0.5">
                  {["#3B82F6", "#6366F1", "#8B5CF6", "#14B8A6", "#10B981", "#F59E0B", "#F97316", "#F43F5E"].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, color_code: col }))}
                      className={`h-7 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative ${
                        form.color_code === col ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {form.color_code === col && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
                <textarea 
                  rows={2}
                  placeholder="Subject syllabus description..."
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm resize-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="form-subject-active"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="form-subject-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Enable subject immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setShowModal("none")}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5 shadow-md"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {showModal === "edit" && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Edit Subject Details
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubject} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-500/10 text-rose-500 p-3 rounded-xl text-xs font-semibold">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Target School *</label>
                <select 
                  required
                  value={form.school_id}
                  onChange={(e) => setForm(prev => ({ ...prev, school_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Name *</label>
                <input 
                  required
                  type="text" 
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Code *</label>
                  <input 
                    required
                    type="text" 
                    value={form.code}
                    onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm font-mono uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Credits (SKS)</label>
                  <input 
                    type="number" 
                    value={form.credits}
                    onChange={(e) => setForm(prev => ({ ...prev, credits: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Brand Display Color</label>
                <div className="grid grid-cols-8 gap-1.5 pt-0.5">
                  {["#3B82F6", "#6366F1", "#8B5CF6", "#14B8A6", "#10B981", "#F59E0B", "#F97316", "#F43F5E"].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, color_code: col }))}
                      className={`h-7 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative ${
                        form.color_code === col ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {form.color_code === col && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
                <textarea 
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm resize-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="edit-form-subject-active"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit-form-subject-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Enable subject active status
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setShowModal("none")}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5 shadow-md"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
