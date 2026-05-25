"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  School, Users, Library, Plus, Loader2, Pencil, Trash2, 
  X, Save, Check, Globe, MapPin, Search, ChevronRight, BookOpen
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface SchoolData {
  id: string;
  name: string;
  school_code: string | null;
  slug: string | null;
  description: string | null;
  city: string | null;
  province: string | null;
  brand_color: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  is_active: boolean;
  created_at?: string;
  // Computed aggregations
  classes?: { count: number }[];
  profiles?: { count: number }[];
  subjects?: { count: number }[];
}

const BRAND_COLORS = [
  { name: "Blue", key: "#3B82F6", class: "from-blue-500 to-blue-600 bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { name: "Indigo", key: "#6366F1", class: "from-indigo-500 to-indigo-600 bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  { name: "Purple", key: "#8B5CF6", class: "from-purple-500 to-purple-600 bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { name: "Teal", key: "#14B8A6", class: "from-teal-500 to-teal-600 bg-teal-500/10 text-teal-500 border-teal-500/20" },
  { name: "Emerald", key: "#10B981", class: "from-emerald-500 to-emerald-600 bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { name: "Amber", key: "#F59E0B", class: "from-amber-500 to-amber-600 bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { name: "Orange", key: "#F97316", class: "from-orange-500 to-orange-600 bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { name: "Rose", key: "#F43F5E", class: "from-rose-500 to-rose-600 bg-rose-500/10 text-rose-500 border-rose-500/20" }
];

const getBrandClasses = (colorHex: string | null) => {
  const match = BRAND_COLORS.find(o => o.key === colorHex);
  return match || BRAND_COLORS[1]; // Indigo default
};

export default function PlatformSchoolsPage() {
  const { t, isClient } = useTranslation();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    school_code: "",
    slug: "",
    description: "",
    city: "",
    province: "",
    brand_color: "#6366F1",
    latitude: -6.2088,
    longitude: 106.8456,
    radius_m: 200,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadSchools = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // In our new schema, profiles have school_id, classes have school_id, subjects have school_id
    // Fetch schools and their relation counts
    const { data: schoolsData, error } = await supabase
      .from("schools")
      .select(`
        *,
        classes:classes(count),
        profiles:profiles(count),
        subjects:subjects(count)
      `)
      .order("name");

    if (error) {
      toast.error("Failed to load schools: " + error.message);
      console.error("Database query failed loading schools:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    } else if (schoolsData) {
      setSchools(schoolsData as unknown as SchoolData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSchools();
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    if (!showEditModal) {
      const generatedSlug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setFormData(prev => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.name, showEditModal]);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      school_code: "",
      slug: "",
      description: "",
      city: "",
      province: "",
      brand_color: "#6366F1",
      latitude: -6.2088,
      longitude: 106.8456,
      radius_m: 200,
      is_active: true
    });
    setErrorMsg("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (school: SchoolData) => {
    setSelectedSchool(school);
    setFormData({
      name: school.name,
      school_code: school.school_code || "",
      slug: school.slug || "",
      description: school.description || "",
      city: school.city || "",
      province: school.province || "",
      brand_color: school.brand_color || "#6366F1",
      latitude: school.latitude,
      longitude: school.longitude,
      radius_m: school.radius_m || 200,
      is_active: school.is_active
    });
    setErrorMsg("");
    setShowEditModal(true);
  };

  const handleOpenDelete = (school: SchoolData) => {
    setSelectedSchool(school);
    setShowDeleteModal(true);
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      setErrorMsg("School Name and Slug are required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("schools")
      .select("id")
      .eq("slug", formData.slug)
      .maybeSingle();

    if (existing) {
      setErrorMsg("A school with this slug already exists.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("schools")
      .insert({
        name: formData.name,
        school_code: formData.school_code || null,
        slug: formData.slug,
        description: formData.description || null,
        city: formData.city || null,
        province: formData.province || null,
        brand_color: formData.brand_color,
        latitude: formData.latitude,
        longitude: formData.longitude,
        radius_m: formData.radius_m,
        is_active: formData.is_active
      });

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("School created successfully!");
      setShowAddModal(false);
      await loadSchools();
    }
    setSaving(false);
  };

  const handleEditSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    if (!formData.name || !formData.slug) {
      setErrorMsg("School Name and Slug are required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    // Check slug uniqueness excluding self
    const { data: existing } = await supabase
      .from("schools")
      .select("id")
      .eq("slug", formData.slug)
      .not("id", "eq", selectedSchool.id)
      .maybeSingle();

    if (existing) {
      setErrorMsg("A school with this slug already exists.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("schools")
      .update({
        name: formData.name,
        school_code: formData.school_code || null,
        slug: formData.slug,
        description: formData.description || null,
        city: formData.city || null,
        province: formData.province || null,
        brand_color: formData.brand_color,
        latitude: formData.latitude,
        longitude: formData.longitude,
        radius_m: formData.radius_m,
        is_active: formData.is_active
      })
      .eq("id", selectedSchool.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("School updated successfully!");
      setShowEditModal(false);
      await loadSchools();
    }
    setSaving(false);
  };

  const handleDeleteSchool = async () => {
    if (!selectedSchool) return;
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("schools")
      .delete()
      .eq("id", selectedSchool.id);

    if (error) {
      toast.error("Failed to delete school: " + error.message);
    } else {
      toast.success("School deleted successfully!");
      await loadSchools();
    }
    setShowDeleteModal(false);
    setSelectedSchool(null);
    setSaving(false);
  };

  const toggleSchoolActive = async (school: SchoolData) => {
    const supabase = createClient();
    const newStatus = !school.is_active;

    const { error } = await supabase
      .from("schools")
      .update({ is_active: newStatus })
      .eq("id", school.id);

    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success(`School ${newStatus ? 'activated' : 'deactivated'} successfully!`);
      // Optimistic update
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, is_active: newStatus } : s));
    }
  };

  const filteredSchools = schools.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      (s.school_code && s.school_code.toLowerCase().includes(query)) ||
      (s.city && s.city.toLowerCase().includes(query)) ||
      (s.province && s.province.toLowerCase().includes(query))
    );
  });

  const totalStudents = schools.reduce((acc, curr) => acc + (curr.profiles?.[0]?.count || 0), 0);
  const totalClasses = schools.reduce((acc, curr) => acc + (curr.classes?.[0]?.count || 0), 0);
  const totalSubjects = schools.reduce((acc, curr) => acc + (curr.subjects?.[0]?.count || 0), 0);

  if (!isClient || loading && schools.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <School className="h-7 w-7 text-primary" />
            Schools Directory
          </h1>
          <p className="text-muted-foreground text-xs font-semibold">
            Manage multi-school tenants, geofencing coordinates, and academic scope.
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-lg bg-primary"
        >
          <Plus className="h-4 w-4" /> Add New School
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <School className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black">{schools.length}</p>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Total Schools</p>
          </div>
        </div>

        <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black">{totalStudents}</p>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Total Students</p>
          </div>
        </div>

        <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
            <Library className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black">{totalClasses}</p>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Active Classes</p>
          </div>
        </div>

        <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
          <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center mb-4">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-black">{totalSubjects}</p>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Catalog Subjects</p>
          </div>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="flex items-center gap-3 bg-card border border-border/40 p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search school name, code, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-border transition-all"
          />
        </div>
      </div>

      {/* Schools List */}
      {filteredSchools.length === 0 ? (
        <EmptyState 
          icon={School} 
          title="No Schools Found" 
          description={searchQuery ? "Try refining your search keyword." : "Add your first school to begin Academic Tenant Scoping."} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSchools.map((school) => {
            const colorOption = getBrandClasses(school.brand_color);
            const bgGradient = `bg-gradient-to-br ${colorOption.class.split(" ").slice(0, 2).join(" ")}`;
            
            return (
              <div 
                key={school.id}
                className="card rounded-[28px] border border-border/50 bg-card shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Visual Header */}
                <div className={`h-3 ${bgGradient} shrink-0`} />
                
                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                  {/* Name and Meta */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-lg text-foreground leading-snug group-hover:text-primary transition-colors">
                          {school.name}
                        </h3>
                        {school.school_code && (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md mt-1 inline-block uppercase">
                            Code: {school.school_code}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSchoolActive(school)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 transition-all ${
                          school.is_active 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20" 
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        {school.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>

                    {school.description && (
                      <p className="text-xs text-muted-foreground/90 line-clamp-2">
                        {school.description}
                      </p>
                    )}

                    {/* Geofence info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        {school.city || "N/A"}, {school.province || "N/A"}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-blue-500" />
                        Radius: {school.radius_m}m ({school.latitude ? school.latitude.toFixed(5) : "0.00000"}, {school.longitude ? school.longitude.toFixed(5) : "0.00000"})
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Counters */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/30">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider leading-none">Students</p>
                      <p className="text-lg font-black text-foreground mt-1.5 leading-none">
                        {school.profiles?.[0]?.count || 0}
                      </p>
                    </div>
                    <div className="text-center border-x border-border/30">
                      <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider leading-none">Classes</p>
                      <p className="text-lg font-black text-foreground mt-1.5 leading-none">
                        {school.classes?.[0]?.count || 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-extrabold uppercase tracking-wider leading-none">Subjects</p>
                      <p className="text-lg font-black text-foreground mt-1.5 leading-none">
                        {school.subjects?.[0]?.count || 0}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/schools/${school.id}?tab=settings`}
                        className="p-2 rounded-xl border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-95 block"
                        title="Edit School Settings"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleOpenDelete(school)}
                        className="p-2 rounded-xl border border-border/50 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all active:scale-95"
                        title="Delete School"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <Link
                      href={`/admin/schools/${school.id}`}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide text-white transition-all active:scale-[0.97] shadow-sm ${bgGradient}`}
                    >
                      Workspace
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add School Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="font-black text-lg flex items-center gap-2">
                <School className="h-5.5 w-5.5 text-primary" /> Create New School
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSchool} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3.5 rounded-2xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Name *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. SMA Nusantara 1"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Slug (Auto-generated) *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. sma-nusantara-1"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SMANUS1"
                    value={formData.school_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, school_code: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Brand Theme Color</label>
                  <div className="grid grid-cols-8 gap-1.5 pt-0.5">
                    {BRAND_COLORS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, brand_color: opt.key }))}
                        title={opt.name}
                        className={`h-8 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative bg-gradient-to-br ${
                          opt.class.split(" ").slice(0, 2).join(" ")
                        } ${formData.brand_color === opt.key ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"}`}
                      >
                        {formData.brand_color === opt.key && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Description</label>
                <textarea 
                  rows={2}
                  placeholder="Describe the school and its academic structure..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">City</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Jakarta Selatan"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Province</label>
                  <input 
                    type="text" 
                    placeholder="e.g. DKI Jakarta"
                    value={formData.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 space-y-3.5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" /> Geofence Verification Settings
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Latitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={formData.latitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Longitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={formData.longitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Radius (meters)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.radius_m}
                      onChange={(e) => setFormData(prev => ({ ...prev, radius_m: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input 
                  type="checkbox" 
                  id="add-school-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <label htmlFor="add-school-active" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  Enable School Portal immediately (Active status)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5 transition-all shadow-md"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Create School
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {showEditModal && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="font-black text-lg flex items-center gap-2">
                <School className="h-5.5 w-5.5 text-primary" /> Edit School Details
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSchool} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3.5 rounded-2xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Name *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. SMA Nusantara 1"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Slug (Workspace URL) *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. sma-nusantara-1"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SMANUS1"
                    value={formData.school_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, school_code: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Brand Theme Color</label>
                  <div className="grid grid-cols-8 gap-1.5 pt-0.5">
                    {BRAND_COLORS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, brand_color: opt.key }))}
                        title={opt.name}
                        className={`h-8 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative bg-gradient-to-br ${
                          opt.class.split(" ").slice(0, 2).join(" ")
                        } ${formData.brand_color === opt.key ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"}`}
                      >
                        {formData.brand_color === opt.key && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Description</label>
                <textarea 
                  rows={2}
                  placeholder="Describe the school..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">City</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Jakarta Selatan"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Province</label>
                  <input 
                    type="text" 
                    placeholder="e.g. DKI Jakarta"
                    value={formData.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 space-y-3.5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" /> Geofence Verification Settings
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Latitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={formData.latitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Longitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={formData.longitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Radius (meters)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.radius_m}
                      onChange={(e) => setFormData(prev => ({ ...prev, radius_m: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input 
                  type="checkbox" 
                  id="edit-school-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit-school-active" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  Enable School Portal (Active status)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5 transition-all shadow-md"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete School Modal */}
      {showDeleteModal && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2 text-rose-500">
                <Trash2 className="h-5 w-5" /> Delete School
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Are you absolutely sure you want to delete <span className="font-black text-rose-500">{selectedSchool.name}</span>?
              </p>
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed">
                WARNING: This is a high-risk operation that will permanently delete the school records, classes, and subjects associated with it. This action cannot be undone.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteSchool}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 flex items-center gap-1.5 transition-all shadow-md"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
