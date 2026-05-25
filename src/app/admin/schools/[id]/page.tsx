"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";

const LocationMap = dynamic(() => import("@/components/admin/location-map"), { ssr: false });
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  School, Users, Library, BookOpen, Settings, ShieldAlert, ShieldCheck,
  Plus, Pencil, Trash2, X, Check, Save, Loader2, MapPin, Globe,
  Search, ChevronRight, GraduationCap, Calendar, Activity, Info
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
}

interface SchoolDetails {
  id: string;
  name: string;
  school_code: string | null;
  slug: string | null;
  description: string | null;
  city: string | null;
  province: string | null;
  country_code: string | null;
  brand_color: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  accuracy_tolerance_m: number;
  address: string | null;
  principal_name: string | null;
  contact_email: string | null;
  phone_number: string | null;
  is_active: boolean;
}

interface ClassData {
  id: string;
  name: string;
  grade_level: string;
  section: string | null;
  academic_year: string | null;
  homeroom_teacher_id: string | null;
  capacity: number;
  is_active: boolean;
  profiles?: ProfileData | null; // Homeroom teacher profile
  student_count?: number;
}

interface SubjectData {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  color_code: string | null;
  is_active: boolean;
}

interface TeacherAssignmentData {
  id: string;
  teacher_id: string;
  class_subject_id: string;
  profiles?: ProfileData | null;
  class_subjects?: {
    id: string;
    is_required: boolean;
    subjects?: SubjectData | null;
    classes?: ClassData | null;
  } | null;
}

interface AdminAssignmentData {
  id: string;
  user_id: string;
  assignment_role: "school_admin" | "staff_admin";
  profiles?: ProfileData | null;
}

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "classes", label: "Classes", icon: Library },
  { id: "subjects", label: "Subjects Catalog", icon: BookOpen },
  { id: "teachers", label: "Teachers & Subjects", icon: GraduationCap },
  { id: "students", label: "Students", icon: Users },
  { id: "admins", label: "School Admins", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings }
];

export default function SchoolWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;
  const { t, isClient } = useTranslation();

  const [activeTab, setActiveTab] = useState("overview");
  const [school, setSchool] = useState<SchoolDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && TABS.some(t => t.id === tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  // Lists state
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [teachers, setTeachers] = useState<ProfileData[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignmentData[]>([]);
  const [students, setStudents] = useState<ProfileData[]>([]);
  const [admins, setAdmins] = useState<AdminAssignmentData[]>([]);
  
  // Modals state
  const [showModal, setShowModal] = useState<"add_class" | "edit_class" | "add_subject" | "edit_subject" | "add_admin" | "none">("none");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(null);
  
  // Form states
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create/Edit Class Form
  const [classForm, setClassForm] = useState({
    name: "",
    grade_level: "10",
    section: "",
    academic_year: "2025/2026",
    homeroom_teacher_id: "",
    capacity: 40,
    is_active: true
  });

  // Create/Edit Subject Form
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    description: "",
    credits: 3,
    color_code: "#3B82F6",
    is_active: true
  });

  // Assign Admin Form
  const [adminForm, setAdminForm] = useState({
    user_id: "",
    assignment_role: "school_admin" as "school_admin" | "staff_admin"
  });

  // Settings tab form state
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    school_code: "",
    slug: "",
    description: "",
    city: "",
    province: "",
    brand_color: "#6366F1",
    latitude: 0,
    longitude: 0,
    radius_m: 200,
    accuracy_tolerance_m: 100,
    address: "",
    principal_name: "",
    contact_email: "",
    phone_number: "",
    payout_token_prefix: "PAY-",
    is_active: true
  });

  const loadSchoolData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch School Info
    const { data: schoolObj, error: schoolErr } = await supabase
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolErr || !schoolObj) {
      toast.error("Failed to load school workspace.");
      router.push("/admin/schools");
      return;
    }

    setSchool(schoolObj as SchoolDetails);
    setSettingsForm(prev => ({
      name: schoolObj.name,
      school_code: schoolObj.school_code || "",
      slug: schoolObj.slug || "",
      description: schoolObj.description || "",
      city: schoolObj.city || "",
      province: schoolObj.province || "",
      brand_color: schoolObj.brand_color || "#6366F1",
      latitude: schoolObj.latitude,
      longitude: schoolObj.longitude,
      radius_m: schoolObj.radius_m || 200,
      accuracy_tolerance_m: schoolObj.accuracy_tolerance_m || 100,
      address: schoolObj.address || "",
      principal_name: schoolObj.principal_name || "",
      contact_email: schoolObj.contact_email || "",
      phone_number: schoolObj.phone_number || "",
      payout_token_prefix: prev.payout_token_prefix,
      is_active: schoolObj.is_active
    }));

    // Auto-fetch reverse geocode if coordinates exist but no address
    if (!schoolObj.address && schoolObj.latitude !== 0 && schoolObj.longitude !== 0) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${schoolObj.latitude}&lon=${schoolObj.longitude}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.address) {
          setSettingsForm(prev => ({
            ...prev,
            address: prev.address || data.display_name || "",
            city: prev.city || data.address.city || data.address.town || data.address.village || data.address.county || "",
            province: prev.province || data.address.state || data.address.province || data.address.region || ""
          }));
          
          setSchool(prev => prev ? {
            ...prev,
            address: prev.address || data.display_name || "",
            city: prev.city || data.address.city || data.address.town || data.address.village || data.address.county || "",
            province: prev.province || data.address.state || data.address.province || data.address.region || ""
          } : null);
        }
      } catch (err) {
        console.error("Auto-geocoding failed on load:", err);
      }
    }

    // Parallel fetch related lists
    const [classesRes, subjectsRes, profilesRes, adminsRes, assignmentsRes, settingsRes] = await Promise.all([
      supabase.from("classes").select("*, profiles!homeroom_teacher_id(id, full_name)").eq("school_id", schoolId).order("name"),
      supabase.from("subjects").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("profiles").select("id, full_name, email, role, username").eq("school_id", schoolId),
      supabase.from("school_admin_assignments").select("*, profiles!user_id(id, full_name, email)").eq("school_id", schoolId),
      supabase.from("teacher_subject_assignments").select("*, profiles!teacher_id(id, full_name), class_subjects!class_subject_id(*, subjects!subject_id(*), classes!class_id(*))").eq("school_id", schoolId),
      supabase.from("system_settings").select("*").eq("school_id", schoolId).eq("key", "payout_token_prefix").maybeSingle()
    ]);
    
    if (settingsRes.data) {
      setSettingsForm(prev => ({ ...prev, payout_token_prefix: settingsRes.data.value }));
    }

    // Format Classes with counts
    if (classesRes.data) {
      // Fetch student count per class using enrollments count
      const classesFormatted = await Promise.all(classesRes.data.map(async (c: any) => {
        const { count } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("class_id", c.id);
        return {
          ...c,
          profiles: c.profiles,
          student_count: count || 0
        };
      }));
      setClasses(classesFormatted as ClassData[]);
    }

    if (subjectsRes.data) setSubjects(subjectsRes.data as SubjectData[]);
    
    if (profilesRes.data) {
      const allProfiles = profilesRes.data as any[];
      setTeachers(allProfiles.filter(p => p.role === "teacher"));
      setStudents(allProfiles.filter(p => p.role === "student"));
    }

    if (adminsRes.data) setAdmins(adminsRes.data as unknown as AdminAssignmentData[]);
    if (assignmentsRes.data) setTeacherAssignments(assignmentsRes.data as unknown as TeacherAssignmentData[]);

    setLoading(false);
  };

  useEffect(() => {
    loadSchoolData();
  }, [schoolId]);

  // Handle updates to school settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("schools")
      .update({
        name: settingsForm.name,
        school_code: settingsForm.school_code || null,
        slug: settingsForm.slug,
        description: settingsForm.description || null,
        city: settingsForm.city || null,
        province: settingsForm.province || null,
        brand_color: settingsForm.brand_color,
        latitude: settingsForm.latitude,
        longitude: settingsForm.longitude,
        radius_m: settingsForm.radius_m,
        accuracy_tolerance_m: settingsForm.accuracy_tolerance_m,
        address: settingsForm.address || null,
        principal_name: settingsForm.principal_name || null,
        contact_email: settingsForm.contact_email || null,
        phone_number: settingsForm.phone_number || null,
        is_active: settingsForm.is_active
      })
      .eq("id", schoolId);

    // Upsert the token prefix setting
    let prefixError = null;
    if (settingsForm.payout_token_prefix) {
      const { error: pErr } = await supabase
        .from("system_settings")
        .upsert({
          school_id: schoolId,
          key: "payout_token_prefix",
          value: settingsForm.payout_token_prefix.toUpperCase().replace(/[^A-Z0-9-]/g, '')
        }, { onConflict: "school_id, key" });
      prefixError = pErr;
    }

    if (error || prefixError) {
      toast.error("Failed to update school settings: " + (error?.message || prefixError?.message));
    } else {
      toast.success("School workspace settings updated!");
      await loadSchoolData();
    }
    setSaving(false);
  };

  // Add Class Submission
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name) {
      setErrorMsg("Class name is required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        name: classForm.name,
        grade_level: classForm.grade_level,
        section: classForm.section || null,
        academic_year: classForm.academic_year || null,
        homeroom_teacher_id: classForm.homeroom_teacher_id || null,
        capacity: classForm.capacity,
        is_active: classForm.is_active
      });

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Class created successfully!");
      setShowModal("none");
      await loadSchoolData();
    }
    setSaving(false);
  };

  // Edit Class Submission
  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!classForm.name) {
      setErrorMsg("Class name is required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("classes")
      .update({
        name: classForm.name,
        grade_level: classForm.grade_level,
        section: classForm.section || null,
        academic_year: classForm.academic_year || null,
        homeroom_teacher_id: classForm.homeroom_teacher_id || null,
        capacity: classForm.capacity,
        is_active: classForm.is_active
      })
      .eq("id", selectedClass.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Class details updated successfully!");
      setShowModal("none");
      setSelectedClass(null);
      await loadSchoolData();
    }
    setSaving(false);
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete class: " + error.message);
    } else {
      toast.success("Class deleted.");
      await loadSchoolData();
    }
  };

  // Add Subject Submission
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.code) {
      setErrorMsg("Name and Subject Code are required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("subjects")
      .insert({
        school_id: schoolId,
        name: subjectForm.name,
        code: subjectForm.code.toUpperCase(),
        description: subjectForm.description || null,
        credits: subjectForm.credits,
        color_code: subjectForm.color_code,
        is_active: subjectForm.is_active
      });

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Subject added to catalog!");
      setShowModal("none");
      await loadSchoolData();
    }
    setSaving(false);
  };

  // Edit Subject Submission
  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    if (!subjectForm.name || !subjectForm.code) {
      setErrorMsg("Name and Subject Code are required.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("subjects")
      .update({
        name: subjectForm.name,
        code: subjectForm.code.toUpperCase(),
        description: subjectForm.description || null,
        credits: subjectForm.credits,
        color_code: subjectForm.color_code,
        is_active: subjectForm.is_active
      })
      .eq("id", selectedSubject.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("Subject catalog details updated!");
      setShowModal("none");
      setSelectedSubject(null);
      await loadSchoolData();
    }
    setSaving(false);
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject? All class-level offerings will be removed.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete subject: " + error.message);
    } else {
      toast.success("Subject deleted.");
      await loadSchoolData();
    }
  };

  // Add School Admin Assignment
  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.user_id) {
      setErrorMsg("Please select a user.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase
      .from("school_admin_assignments")
      .insert({
        school_id: schoolId,
        user_id: adminForm.user_id,
        assignment_role: adminForm.assignment_role
      });

    if (error) {
      setErrorMsg(error.message);
    } else {
      toast.success("School administrator role assigned!");
      setShowModal("none");
      setAdminForm({ user_id: "", assignment_role: "school_admin" });
      await loadSchoolData();
    }
    setSaving(false);
  };

  const handleRevokeAdmin = async (id: string) => {
    if (!confirm("Are you sure you want to revoke admin credentials for this user?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("school_admin_assignments").delete().eq("id", id);
    if (error) {
      toast.error("Failed to revoke privileges: " + error.message);
    } else {
      toast.success("Privileges revoked.");
      await loadSchoolData();
    }
  };

  const openAddClass = () => {
    setClassForm({
      name: "",
      grade_level: "10",
      section: "",
      academic_year: "2025/2026",
      homeroom_teacher_id: "",
      capacity: 40,
      is_active: true
    });
    setErrorMsg("");
    setShowModal("add_class");
  };

  const openEditClass = (cls: ClassData) => {
    setSelectedClass(cls);
    setClassForm({
      name: cls.name,
      grade_level: cls.grade_level || "10",
      section: cls.section || "",
      academic_year: cls.academic_year || "2025/2026",
      homeroom_teacher_id: cls.homeroom_teacher_id || "",
      capacity: cls.capacity || 40,
      is_active: cls.is_active
    });
    setErrorMsg("");
    setShowModal("edit_class");
  };

  const openAddSubject = () => {
    setSubjectForm({
      name: "",
      code: "",
      description: "",
      credits: 3,
      color_code: "#3B82F6",
      is_active: true
    });
    setErrorMsg("");
    setShowModal("add_subject");
  };

  const openEditSubject = (sub: SubjectData) => {
    setSelectedSubject(sub);
    setSubjectForm({
      name: sub.name,
      code: sub.code,
      description: sub.description || "",
      credits: sub.credits || 3,
      color_code: sub.color_code || "#3B82F6",
      is_active: sub.is_active
    });
    setErrorMsg("");
    setShowModal("edit_subject");
  };

  // Filter lists based on query
  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.username && s.username.toLowerCase().includes(searchQuery.toLowerCase())));

  if (!isClient || loading && !school) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const brandColor = school?.brand_color || "#6366F1";

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {/* Visual top branding bar */}
      <div 
        className="h-2.5 rounded-full" 
        style={{ backgroundColor: brandColor }}
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            <School className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              {school?.name}
              {school?.school_code && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-muted border border-border/80 text-muted-foreground font-mono">
                  {school.school_code}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Admin Scoped Workspace slug: <span className="font-mono text-primary font-bold">/{school?.slug}</span>
            </p>
          </div>
        </div>
        
        <button
          onClick={() => router.push("/admin/schools")}
          className="px-3.5 py-1.5 rounded-xl border border-border/50 text-xs font-bold hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
        >
          &larr; Back to Directory
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex items-center gap-1.5 border-b border-border/40 overflow-x-auto pb-px scrollbar-none shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-extrabold uppercase tracking-wide border-b-2 whitespace-nowrap transition-all ${
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              style={{ borderBottomColor: isActive ? brandColor : undefined, color: isActive ? brandColor : undefined }}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab content space */}
      <div className="min-h-[400px]">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Library className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black">{classes.length}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Classes offering</p>
                </div>
              </div>

              <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center mb-4">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black">{subjects.length}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Subjects Scoped</p>
                </div>
              </div>

              <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black">{students.length}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Enrolled Students</p>
                </div>
              </div>

              <div className="card rounded-2xl p-5 border border-border/50 bg-card shadow-sm flex flex-col justify-between">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black">{teachers.length}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Active Faculty</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Geofence verification status */}
              <div className="card rounded-3xl p-6 border border-border/30 bg-card shadow-sm lg:col-span-1 space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-rose-500" /> Geofence Parameters
                </h3>
                
                <div className="space-y-3.5 pt-1">
                  <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border/40 text-xs">
                    <span className="font-bold text-muted-foreground">LATITUDE</span>
                    <span className="font-mono font-bold text-foreground">{school?.latitude}</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border/40 text-xs">
                    <span className="font-bold text-muted-foreground">LONGITUDE</span>
                    <span className="font-mono font-bold text-foreground">{school?.longitude}</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border/40 text-xs">
                    <span className="font-bold text-muted-foreground">GEOFENCE RADIUS</span>
                    <span className="font-bold text-foreground">{school?.radius_m} meters</span>
                  </div>
                  
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 text-xs leading-relaxed font-semibold">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    Geofence verification checks attendance logs locally against these parameters. Change in Settings tab.
                  </div>
                </div>
              </div>

              {/* Overview Details catalog description */}
              <div className="card rounded-3xl p-6 border border-border/30 bg-card shadow-sm lg:col-span-2 space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <School className="h-4.5 w-4.5 text-primary" /> About School Portal
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Address & Region</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {school?.address ? `${school.address}, ` : ""}{school?.city || "N/A"}, {school?.province || "N/A"} ({school?.country_code || "ID"})
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Principal</h4>
                      <p className="text-xs text-muted-foreground mt-1">{school?.principal_name || "Not Set"}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Contact</h4>
                      <p className="text-xs text-muted-foreground mt-1">{school?.contact_email || "No Email"}</p>
                      <p className="text-xs text-muted-foreground">{school?.phone_number || "No Phone"}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground">Workspace Description</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {school?.description || "No description set yet. Click on the settings tab to configure details."}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-extrabold uppercase text-muted-foreground">Portal Status:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      school?.is_active 
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {school?.is_active ? "Active & Accept Check-ins" : "Maintenance / Closed"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CLASSES TAB */}
        {activeTab === "classes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search classes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                onClick={openAddClass}
                className="flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                <Plus className="h-4 w-4" /> Add Class
              </button>
            </div>

            {filteredClasses.length === 0 ? (
              <EmptyState icon={Library} title="No Classes Found" description="Define class grade levels, academic years, and assign homeroom teachers." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClasses.map((cls) => (
                  <div key={cls.id} className="card rounded-2xl p-5 border border-border/40 bg-card hover:border-primary/25 transition-all flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest" style={{ color: brandColor }}>
                          Grade {cls.grade_level}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                          cls.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                        }`}>
                          {cls.is_active ? "Active" : "Closed"}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-foreground leading-snug">
                        {cls.name} {cls.section ? `(${cls.section})` : ""}
                      </h3>
                      <div className="text-[11px] text-muted-foreground font-semibold space-y-1 pt-1.5">
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          Students: {cls.student_count || 0} / {cls.capacity || 40}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          Homeroom: {cls.profiles?.full_name || "Unassigned"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                          Academic Year: {cls.academic_year || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <Link
                        href={`/admin/classes/${cls.id}/subjects`}
                        className="text-[10px] font-extrabold text-primary hover:underline uppercase tracking-wider"
                        style={{ color: brandColor }}
                      >
                        Assign Subjects
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditClass(cls)}
                          className="p-1.5 rounded-lg border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="p-1.5 rounded-lg border border-border/50 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBJECTS CATALOG TAB */}
        {activeTab === "subjects" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search catalog subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                onClick={openAddSubject}
                className="flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                <Plus className="h-4 w-4" /> Add Subject Catalog
              </button>
            </div>

            {filteredSubjects.length === 0 ? (
              <EmptyState icon={BookOpen} title="Subject Catalog is Empty" description="Create school-wide subjects catalogs with codes and credit points." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSubjects.map((sub) => (
                  <div key={sub.id} className="card rounded-2xl p-5 border border-border/40 bg-card hover:border-primary/25 transition-all flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span 
                          className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white shadow-sm"
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

                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full uppercase">
                          Credits: {sub.credits} SKS
                        </span>
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
          </div>
        )}

        {/* TEACHERS AND SUBJECTS TAB */}
        {activeTab === "teachers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Teacher Assignments List</h3>
              <span className="text-xs text-muted-foreground font-semibold">
                Teachers in School: {teachers.length} | Active Assignments: {teacherAssignments.length}
              </span>
            </div>

            {teacherAssignments.length === 0 ? (
              <EmptyState 
                icon={GraduationCap} 
                title="No Teacher Subject Assignments" 
                description="Link teachers to active class-subject offerings."
              />
            ) : (
              <div className="card rounded-2xl border border-border/30 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3.5">Faculty Name</th>
                        <th className="px-5 py-3.5">Class Offered</th>
                        <th className="px-5 py-3.5">Subject</th>
                        <th className="px-5 py-3.5">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 text-xs font-semibold">
                      {teacherAssignments.map((assign) => (
                        <tr key={assign.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 font-extrabold text-foreground">{assign.profiles?.full_name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{assign.class_subjects?.classes?.name}</td>
                          <td className="px-5 py-3">
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-white mr-2"
                              style={{ backgroundColor: assign.class_subjects?.subjects?.color_code || "#3B82F6" }}
                            >
                              {assign.class_subjects?.subjects?.code}
                            </span>
                            {assign.class_subjects?.subjects?.name}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              assign.class_subjects?.is_required 
                                ? "bg-indigo-500/10 text-indigo-500" 
                                : "bg-amber-500/10 text-amber-500"
                            }`}>
                              {assign.class_subjects?.is_required ? "Required" : "Elective"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <span className="text-xs text-muted-foreground font-semibold shrink-0">
                Total Students in School: {students.length}
              </span>
            </div>

            {filteredStudents.length === 0 ? (
              <EmptyState icon={Users} title="No Students Registered" description="Add students using system user manager and scope them to this school." />
            ) : (
              <div className="card rounded-2xl border border-border/30 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3.5">Student Name</th>
                        <th className="px-5 py-3.5">Username</th>
                        <th className="px-5 py-3.5">Email Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 text-xs font-semibold">
                      {filteredStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 font-extrabold text-foreground">{st.full_name}</td>
                          <td className="px-5 py-3 text-primary font-mono">{st.username ? `@${st.username}` : "-"}</td>
                          <td className="px-5 py-3 text-muted-foreground">{st.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCHOOL ADMINS ACCESS CONTROL */}
        {activeTab === "admins" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-foreground">Assigned School Administrators</h3>
              
              <button
                onClick={() => {
                  setAdminForm({ user_id: "", assignment_role: "school_admin" });
                  setErrorMsg("");
                  setShowModal("add_admin");
                }}
                className="flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                <Plus className="h-4 w-4" /> Assign School Admin
              </button>
            </div>

            {admins.length === 0 ? (
              <EmptyState 
                icon={ShieldAlert} 
                title="No Dedicated School Admins" 
                description="Assign administrative profiles to manage this specific school's catalog."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {admins.map((adm) => (
                  <div key={adm.id} className="card rounded-2xl p-5 border border-border/40 bg-card shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <GraduationCap className="h-5 w-5" style={{ color: brandColor }} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-foreground">{adm.profiles?.full_name}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                          Role: {adm.assignment_role === "school_admin" ? "School Admin" : "Staff Admin"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeAdmin(adm.id)}
                      className="text-[10px] font-extrabold text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-wider"
                    >
                      Revoke Privileges
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="card rounded-3xl p-6 border border-border/30 bg-card shadow-sm">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Name *</label>
                  <input 
                    required
                    type="text" 
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Slug (Workspace URL) *</label>
                  <input 
                    required
                    type="text" 
                    value={settingsForm.slug}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">School Code</label>
                  <input 
                    type="text" 
                    value={settingsForm.school_code}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, school_code: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Brand Theme Color</label>
                  <div className="grid grid-cols-8 gap-1.5 pt-0.5">
                    {["#3B82F6", "#6366F1", "#8B5CF6", "#14B8A6", "#10B981", "#F59E0B", "#F97316", "#F43F5E"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setSettingsForm(prev => ({ ...prev, brand_color: col }))}
                        className={`h-8 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative ${
                          settingsForm.brand_color === col ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"
                        }`}
                        style={{ backgroundColor: col }}
                      >
                        {settingsForm.brand_color === col && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Description / About</label>
                <textarea 
                  rows={3}
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" 
                />
              </div>

              {/* Location & Region */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 space-y-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-teal-500" /> Location & Region
                </p>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">Full Street Address</label>
                  <input 
                    type="text" 
                    value={settingsForm.address}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">City</label>
                    <input 
                      type="text" 
                      value={settingsForm.city}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">Province</label>
                    <input 
                      type="text" 
                      value={settingsForm.province}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, province: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                </div>
              </div>

              {/* Administrative Contacts */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 space-y-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-500" /> Administrative Contacts
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Principal Name</label>
                    <input 
                      type="text" 
                      value={settingsForm.principal_name}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, principal_name: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Contact Email</label>
                    <input 
                      type="email" 
                      value={settingsForm.contact_email}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, contact_email: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Phone Number</label>
                    <input 
                      type="tel" 
                      value={settingsForm.phone_number}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, phone_number: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                </div>
              </div>

              {/* Economy & Payout Settings */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 space-y-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-amber-500" /> Economy & Payout Configuration
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Payout Token Prefix</label>
                    <div className="flex">
                      <input 
                        type="text" 
                        value={settingsForm.payout_token_prefix}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, payout_token_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" 
                        placeholder="e.g. PAY-"
                        maxLength={8}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Maximum 8 characters. This prefix will be added to generated payout tokens (e.g. {settingsForm.payout_token_prefix || "PAY-"}XXXX-XXXX).
                    </p>
                  </div>
                </div>
              </div>

              {/* Geofence Parameters */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 space-y-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" /> Geofence Verification Parameters
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Latitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={settingsForm.latitude}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Longitude</label>
                    <input 
                      required
                      step="any"
                      type="number" 
                      value={settingsForm.longitude}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Radius (m)</label>
                    <input 
                      required
                      type="number" 
                      value={settingsForm.radius_m}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, radius_m: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">GPS Accuracy Tolerance (m)</label>
                    <input 
                      required
                      type="number" 
                      value={settingsForm.accuracy_tolerance_m}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, accuracy_tolerance_m: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                    />
                  </div>
                </div>

                <div className="bg-card p-4 rounded-xl border border-amber-500/20 flex items-start gap-3 mt-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">Geofencing Active</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Students must be within this radius to successfully log their attendance. Ensure you set an appropriate accuracy tolerance to account for GPS drift on mobile devices.
                    </p>
                  </div>
                </div>

                {/* Interactive Map */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-extrabold text-muted-foreground uppercase">Geofence Interactive Map</label>
                  <LocationMap 
                    latitude={settingsForm.latitude}
                    longitude={settingsForm.longitude}
                    radius_m={settingsForm.radius_m}
                    onLocationChange={async (lat, lng) => {
                      setSettingsForm(prev => ({
                        ...prev,
                        latitude: parseFloat(lat.toFixed(6)),
                        longitude: parseFloat(lng.toFixed(6))
                      }));
                      
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await res.json();
                        if (data && data.address) {
                          setSettingsForm(prev => ({
                            ...prev,
                            address: data.display_name || prev.address,
                            city: data.address.city || data.address.town || data.address.village || data.address.county || prev.city,
                            province: data.address.state || data.address.province || data.address.region || prev.province
                          }));
                          toast.success("Location details automatically updated from map pin!");
                        }
                      } catch (err) {
                        console.error("Geocoding failed:", err);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="settings-school-active"
                  checked={settingsForm.is_active}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary/20"
                />
                <label htmlFor="settings-school-active" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  Enable School Portal active status
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5 transition-all shadow-md"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  <Save className="h-4 w-4" />
                  Save Portal Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL VIEWS
      ======================================================== */}

      {/* Add Class Modal */}
      {showModal === "add_class" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" /> Create New Class
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddClass} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-500/10 text-rose-500 p-3 rounded-xl text-xs font-semibold">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Class Name *</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. XII MIPA 3"
                  value={classForm.name}
                  onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Grade Level *</label>
                  <select 
                    value={classForm.grade_level}
                    onChange={(e) => setClassForm(prev => ({ ...prev, grade_level: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                  >
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Section</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Science / Social"
                    value={classForm.section}
                    onChange={(e) => setClassForm(prev => ({ ...prev, section: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Academic Year</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2025/2026"
                    value={classForm.academic_year}
                    onChange={(e) => setClassForm(prev => ({ ...prev, academic_year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Capacity</label>
                  <input 
                    type="number" 
                    value={classForm.capacity}
                    onChange={(e) => setClassForm(prev => ({ ...prev, capacity: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Homeroom Teacher</label>
                <select 
                  value={classForm.homeroom_teacher_id}
                  onChange={(e) => setClassForm(prev => ({ ...prev, homeroom_teacher_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                >
                  <option value="">Select a teacher...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="class-active"
                  checked={classForm.is_active}
                  onChange={(e) => setClassForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="class-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Activate class enrollment
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
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showModal === "edit_class" && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" /> Edit Class Details
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditClass} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-500/10 text-rose-500 p-3 rounded-xl text-xs font-semibold">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Class Name *</label>
                <input 
                  required
                  type="text" 
                  value={classForm.name}
                  onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Grade Level *</label>
                  <select 
                    value={classForm.grade_level}
                    onChange={(e) => setClassForm(prev => ({ ...prev, grade_level: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                  >
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Section</label>
                  <input 
                    type="text" 
                    value={classForm.section}
                    onChange={(e) => setClassForm(prev => ({ ...prev, section: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Academic Year</label>
                  <input 
                    type="text" 
                    value={classForm.academic_year}
                    onChange={(e) => setClassForm(prev => ({ ...prev, academic_year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Capacity</label>
                  <input 
                    type="number" 
                    value={classForm.capacity}
                    onChange={(e) => setClassForm(prev => ({ ...prev, capacity: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Homeroom Teacher</label>
                <select 
                  value={classForm.homeroom_teacher_id}
                  onChange={(e) => setClassForm(prev => ({ ...prev, homeroom_teacher_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                >
                  <option value="">Select a teacher...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="edit-class-active"
                  checked={classForm.is_active}
                  onChange={(e) => setClassForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit-class-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Activate class enrollment
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
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {showModal === "add_subject" && (
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Name *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Advanced Physics"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Code *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. PHYS-XII"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm font-mono uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Credits (SKS)</label>
                  <input 
                    type="number" 
                    value={subjectForm.credits}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, credits: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
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
                      onClick={() => setSubjectForm(prev => ({ ...prev, color_code: col }))}
                      className={`h-7 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative ${
                        subjectForm.color_code === col ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {subjectForm.color_code === col && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
                <textarea 
                  rows={2}
                  placeholder="Subject syllabus description..."
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm resize-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="subject-active"
                  checked={subjectForm.is_active}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="subject-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
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
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
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
      {showModal === "edit_subject" && selectedSubject && (
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Name *</label>
                  <input 
                    required
                    type="text" 
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Subject Code *</label>
                  <input 
                    required
                    type="text" 
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm font-mono uppercase" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Credits (SKS)</label>
                  <input 
                    type="number" 
                    value={subjectForm.credits}
                    onChange={(e) => setSubjectForm(prev => ({ ...prev, credits: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm" 
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
                      onClick={() => setSubjectForm(prev => ({ ...prev, color_code: col }))}
                      className={`h-7 rounded-lg flex items-center justify-center text-white cursor-pointer transition-all relative ${
                        subjectForm.color_code === col ? "ring-2 ring-offset-2 ring-primary scale-105" : "opacity-80"
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {subjectForm.color_code === col && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
                <textarea 
                  rows={2}
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm resize-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="edit-subject-active"
                  checked={subjectForm.is_active}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit-subject-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
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
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showModal === "add_admin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Assign School Admin
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignAdmin} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-500/10 text-rose-500 p-3 rounded-xl text-xs font-semibold">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Select User (Faculty/Staff) *</label>
                <select 
                  required
                  value={adminForm.user_id}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                >
                  <option value="">Select a user...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Access Role *</label>
                <select 
                  value={adminForm.assignment_role}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, assignment_role: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none"
                >
                  <option value="school_admin">School Admin (Full privileges)</option>
                  <option value="staff_admin">Staff Admin (Roster read-only)</option>
                </select>
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
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
