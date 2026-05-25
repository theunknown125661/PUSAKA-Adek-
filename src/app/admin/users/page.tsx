"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import { 
  Users, GraduationCap, BookOpen, Shield, Plus, Loader2, Mail, Lock, 
  User as UserIcon, Calendar, Wallet, Award, School, X, ChevronRight, Save,
  Flame, Star, Trophy
} from "lucide-react";
import type { Profile } from "@/lib/types/database";
import { toast } from "sonner";

export default function UserManagementPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  
  // Selected user detail view modal/drawer
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Edit profile states
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editRole, setEditRole] = useState("student");
  const [editXP, setEditXP] = useState(0);
  const [editLevel, setEditLevel] = useState(1);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // New admin management states
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [showAdjustWalletModal, setShowAdjustWalletModal] = useState(false);
  const [adjustCurrencyType, setAdjustCurrencyType] = useState("COIN");
  const [adjustAvailable, setAdjustAvailable] = useState(0);
  const [adjustPending, setAdjustPending] = useState(0);
  const [adjustHeld, setAdjustHeld] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingWallet, setIsAdjustingWallet] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [updatingEnrollment, setUpdatingEnrollment] = useState(false);

  // Modal state for adding a user
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "student",
    school_id: ""
  });
  const [allSchools, setAllSchools] = useState<{ id: string; name: string }[]>([]);

  const loadUsers = async () => {
    const supabase = createClient();
    let query = supabase.from("profiles").select(`
      *,
      schools ( name ),
      enrollments ( classes ( name ) )
    `).order("created_at", { ascending: false });
    if (filterRole !== "all") query = query.eq("role", filterRole);
    const { data } = await query;
    setUsers((data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole]);

  useEffect(() => {
    async function loadGlobals() {
      const supabase = createClient();
      const [{ data: classesData }, { data: schoolsData }] = await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("schools").select("id, name").order("name")
      ]);
      if (classesData) setAllClasses(classesData);
      if (schoolsData) setAllSchools(schoolsData);
    }
    loadGlobals();
  }, []);

  // Load detailed profile parameters when clicked
  const handleViewDetails = async (user: Profile) => {
    setSelectedUser(user);
    setUserDetails(null);
    setEditFullName(user.full_name || "");
    setEditUsername((user as any).username || "");
    setEditBio((user as any).bio || "");
    setEditRole(user.role || "student");
    setEditXP(user.xp || 0);
    setEditLevel(user.level || 1);
    
    // Also init a state for editSchool
    setFormData(prev => ({ ...prev, school_id: user.school_id || "" }));
    
    if (user.role !== "student") return; // Details like wallets/badges are only for students

    setLoadingDetails(true);
    try {
      const supabase = createClient();

      // 1. Fetch Student's Wallets
      const { data: wallets } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id);

      // 2. Fetch Class Enrollment
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select(`
          id,
          class_id,
          classes (
            name,
            grade_level
          )
        `)
        .eq("student_id", user.id)
        .maybeSingle();

      // 3. Fetch Earned Badges
      const { data: studentBadges } = await supabase
        .from("user_badges")
        .select(`
          unlocked_at,
          badges (
            name,
            description,
            icon
          )
        `)
        .eq("user_id", user.id);

      const coinWallet = wallets?.find(w => w.currency_type === "COIN") || { balance_available: 0, balance_pending: 0, balance_locked: 0 };
      const rupiahWallet = wallets?.find(w => w.currency_type === "RUPIAH") || { balance_available: 0, balance_pending: 0, balance_locked: 0 };

      setUserDetails({
        wallets: wallets || [],
        coinWallet,
        rupiahWallet,
        class: (enrollment as any)?.classes || null,
        class_id: (enrollment as any)?.class_id || "",
        enrollment_id: (enrollment as any)?.id || "",
        badges: studentBadges || []
      });
      setSelectedClassId((enrollment as any)?.class_id || "");
    } catch (err) {
      console.error("Error loading student profile details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleClassChange = async (newClassId: string) => {
    if (!selectedUser) return;
    setUpdatingEnrollment(true);
    try {
      const supabase = createClient();
      
      if (!newClassId) {
        // Delete enrollment
        const { error } = await supabase
          .from("enrollments")
          .delete()
          .eq("student_id", selectedUser.id);
          
        if (error) {
          toast.error("Failed to unassign class: " + error.message);
        } else {
          toast.success("Student successfully unassigned from class");
          setSelectedClassId("");
          loadUsers();
          if (userDetails) {
            setUserDetails({
              ...userDetails,
              class: null,
              class_id: "",
              enrollment_id: ""
            });
          }
        }
      } else {
        // Upsert enrollment
        const { data: existing } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", selectedUser.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("enrollments")
            .update({ class_id: newClassId })
            .eq("student_id", selectedUser.id);
            
          if (error) {
            toast.error("Failed to update class enrollment: " + error.message);
          } else {
            toast.success("Class enrollment updated successfully!");
            setSelectedClassId(newClassId);
            loadUsers();
            const { data: cls } = await supabase.from("classes").select("name, grade_level").eq("id", newClassId).single();
            if (userDetails) {
              setUserDetails({
                ...userDetails,
                class: cls,
                class_id: newClassId
              });
            }
          }
        } else {
          const { data: newEnr, error } = await supabase
            .from("enrollments")
            .insert({
              student_id: selectedUser.id,
              class_id: newClassId
            })
            .select()
            .single();
            
          if (error) {
            toast.error("Failed to enroll student: " + error.message);
          } else {
            toast.success("Student enrolled in class successfully!");
            setSelectedClassId(newClassId);
            loadUsers();
            const { data: cls } = await supabase.from("classes").select("name, grade_level").eq("id", newClassId).single();
            if (userDetails) {
              setUserDetails({
                ...userDetails,
                class: cls,
                class_id: newClassId,
                enrollment_id: newEnr.id
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred during assignment.");
    } finally {
      setUpdatingEnrollment(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedUser) return;
    setUpdatingProfile(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: editFullName.trim(), 
        username: editUsername.trim() || null, 
        bio: editBio.trim() || null,
        role: editRole,
        school_id: formData.school_id || null,
        xp: editRole === "student" ? editXP : undefined,
        level: editRole === "student" ? editLevel : undefined
      })
      .eq("id", selectedUser.id);
      
    if (error) {
      toast.error(interpolate(t.adminUsers.errorUpdating, { message: error.message }));
    } else {
      toast.success(t.adminUsers.successUpdating);
      // We must reload users so the school relation query updates, ensuring it jumps to the right group
      loadUsers();
      setSelectedUser({ ...selectedUser, full_name: editFullName, username: editUsername, bio: editBio, role: editRole as any, school_id: formData.school_id || null, xp: editRole === "student" ? editXP : selectedUser.xp, level: editRole === "student" ? editLevel : selectedUser.level } as Profile);
    }
    setUpdatingProfile(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(interpolate(t.adminUsers.errorCreating, { message: data.error || "" }));
      } else {
        setSuccessMsg(t.adminUsers.successCreating);
        setFormData({ email: "", password: "", full_name: "", role: "student", school_id: "" });
        loadUsers(); // Refresh the list
        setTimeout(() => {
          setShowAddModal(false);
          setSuccessMsg("");
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(t.adminUsers.unexpectedError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const roleIcon = (role: string) => {
    switch (role) {
      case "student": return <GraduationCap className="h-4 w-4 text-primary" />;
      case "teacher": return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "admin": return <Shield className="h-4 w-4 text-amber-500" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const filters = [
    { value: "all", label: t.adminUsers.filterAll },
    { value: "student", label: t.adminUsers.filterStudents },
    { value: "teacher", label: t.adminUsers.filterTeachers },
    { value: "admin", label: t.adminUsers.filterAdmins },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> {t.adminUsers.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{interpolate(t.adminUsers.usersRegistered, { count: users.length })}</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> {t.adminUsers.addUser}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {filters.map((f) => (
          <button 
            key={f.value} 
            onClick={() => setFilterRole(f.value)} 
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterRole === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Users} title={t.adminUsers.noUsers} />
      ) : (
        <div className="space-y-12">
          {["admin", "teacher", "student"].map(roleFilter => {
            // Check if there are users for this role
            const roleUsers = users.filter(u => u.role === roleFilter);
            if (roleUsers.length === 0) return null;

            // Group by School
            const schoolGroups = roleUsers.reduce((acc, u: any) => {
              const schoolName = u.schools?.name || "Unassigned School";
              if (!acc[schoolName]) acc[schoolName] = [];
              acc[schoolName].push(u);
              return acc;
            }, {} as Record<string, any[]>);

            return (
              <div key={roleFilter} className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-2">
                  <div className={`p-2 rounded-lg ${
                    roleFilter === "admin" ? "bg-amber-500/10 text-amber-500" :
                    roleFilter === "teacher" ? "bg-blue-500/10 text-blue-500" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {roleIcon(roleFilter)}
                  </div>
                  <h2 className="text-xl font-bold capitalize tracking-tight">{roleFilter}s</h2>
                </div>

                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  {Object.entries(schoolGroups).map(([schoolName, schoolUsers]) => {
                    
                    // Group by Class for students, otherwise just list
                    const classGroups = schoolUsers.reduce((acc, u: any) => {
                      let className = "Staff / No Class";
                      if (roleFilter === "student") {
                        const enr = Array.isArray(u.enrollments) ? u.enrollments[0] : u.enrollments;
                        className = enr?.classes?.name || "Unassigned Class";
                      }
                      
                      if (!acc[className]) acc[className] = [];
                      acc[className].push(u);
                      return acc;
                    }, {} as Record<string, any[]>);

                    return (
                      <div key={schoolName} className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                          <School className="h-4 w-4 text-muted-foreground" /> {schoolName}
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">{schoolUsers.length}</span>
                        </h3>
                        
                        <div className="space-y-6 pl-4 border-l-2 border-muted/50">
                          {Object.entries(classGroups).map(([className, _classUsers]) => {
                            const classUsers = _classUsers as any[];
                            return (
                            <div key={className} className="space-y-3">
                              {roleFilter === "student" && (
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  {className}
                                  <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{classUsers.length}</span>
                                </h4>
                              )}
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {classUsers.map((u) => (
                                  <div 
                                    key={u.id} 
                                    onClick={() => handleViewDetails(u)}
                                    className="glass rounded-xl p-4 flex items-center justify-between hover:border-primary/45 transition-colors cursor-pointer group shadow-sm"
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                        {roleIcon(u.role)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{u.full_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/70 transition-colors" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="font-bold text-lg">{t.adminUsers.createNewUser}</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminUsers.fullName}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    required
                    type="text" 
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminUsers.emailAddress}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    required
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    placeholder="john@school.test"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminUsers.password}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    required
                    type="password" 
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    placeholder={t.adminUsers.passwordPlaceholder}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.adminUsers.role}</label>
                <div className="grid grid-cols-3 gap-2">
                  {["student", "teacher", "admin"].map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({...formData, role})}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${
                        formData.role === role 
                          ? "bg-primary/10 border-primary/30 text-primary" 
                          : "bg-muted border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign to School (Optional)</label>
                <div className="relative">
                  <School className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <select
                    value={formData.school_id}
                    onChange={(e) => setFormData({...formData, school_id: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {allSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {errorMsg && <p className="text-xs font-medium text-destructive bg-destructive/10 p-3 rounded-lg">{errorMsg}</p>}
              {successMsg && <p className="text-xs font-medium text-emerald-500 bg-emerald-500/10 p-3 rounded-lg">{successMsg}</p>}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isSubmitting ? t.adminUsers.creating : t.adminUsers.createUser}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Slide-Over Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-all duration-300">
          {/* Overlay Close Area */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedUser(null)} />
          
          {/* Drawer Body */}
          <div className="relative w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl animate-slide-in relative z-10 overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {roleIcon(selectedUser.role)}
                </div>
                <div>
                  <h2 className="font-bold text-sm leading-tight">{selectedUser.full_name}</h2>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80 mt-0.5 inline-block">
                    {interpolate(t.adminUsers.profileDetails, { role: selectedUser.role })}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Visual Profile Header */}
              <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>

                <div className="h-24 w-24 rounded-full bg-background/50 backdrop-blur-md border-[3px] border-background shadow-xl flex items-center justify-center mb-3 overflow-hidden relative z-10">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-10 w-10 text-primary/40" />
                  )}
                </div>
                
                <h3 className="font-bold text-xl relative z-10">{selectedUser.full_name}</h3>
                {selectedUser.username ? (
                  <p className="text-sm font-semibold text-primary mb-1 relative z-10">@{selectedUser.username}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic mb-1 relative z-10">No username set</p>
                )}
                
                {selectedUser.bio && (
                  <p className="text-xs text-center text-muted-foreground mt-2 max-w-[250px] relative z-10">"{selectedUser.bio}"</p>
                )}

                {selectedUser.role === "student" && (
                  <div className="grid grid-cols-3 gap-2 w-full mt-6 relative z-10">
                    <div className="bg-background/60 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm border border-white/10 dark:border-white/5 transition-transform hover:scale-105">
                      <Trophy className="h-4 w-4 text-yellow-500 mb-1.5" />
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Level</span>
                      <span className="font-black text-sm">{selectedUser.level || 1}</span>
                    </div>
                    <div className="bg-background/60 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm border border-white/10 dark:border-white/5 transition-transform hover:scale-105">
                      <Star className="h-4 w-4 text-purple-500 mb-1.5" />
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">XP</span>
                      <span className="font-black text-sm">{selectedUser.xp || 0}</span>
                    </div>
                    <div className="bg-background/60 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm border border-white/10 dark:border-white/5 transition-transform hover:scale-105">
                      <Flame className="h-4 w-4 text-orange-500 mb-1.5" />
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Streak</span>
                      <span className="font-black text-sm">{selectedUser.streak_current || 0}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Account General Information Card */}
              <div className="glass rounded-2xl p-4 space-y-3.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.adminUsers.accountCredentials}</h3>
                
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{interpolate(t.adminUsers.joined, { date: new Date(selectedUser.created_at || "").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })}</span>
                  </div>
                </div>
              </div>

              {/* Loader for Student details */}
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2.5">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground animate-pulse">{t.adminUsers.loadingData}</p>
                </div>
              ) : (
                <>
                  {selectedUser.role === "student" && userDetails && (
                    <div className="space-y-6">
                      


                      {/* Wallet Balance Cards */}
                      <div className="glass rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-primary" /> Wallets
                          </h3>
                          <button
                            onClick={() => {
                              setAdjustCurrencyType("COIN");
                              setAdjustAvailable(userDetails.coinWallet.balance_available);
                              setAdjustPending(userDetails.coinWallet.balance_pending);
                              setAdjustHeld(userDetails.coinWallet.balance_locked);
                              setAdjustReason("");
                              setShowAdjustWalletModal(true);
                            }}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Adjust Balance
                          </button>
                        </div>

                        {/* Coin Wallet */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">🪙 Coin Wallet</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Available</p>
                              <p className="text-xs font-bold text-emerald-500 mt-0.5">{userDetails.coinWallet.balance_available}</p>
                            </div>
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Pending</p>
                              <p className="text-xs font-bold text-primary mt-0.5">{userDetails.coinWallet.balance_pending}</p>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Locked</p>
                              <p className="text-xs font-bold text-amber-500 mt-0.5">{userDetails.coinWallet.balance_locked}</p>
                            </div>
                          </div>
                        </div>

                        {/* Rupiah Wallet */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">💵 Rupiah Wallet</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Available</p>
                              <p className="text-xs font-bold text-emerald-500 mt-0.5">{formatRupiah(userDetails.rupiahWallet.balance_available)}</p>
                            </div>
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Pending</p>
                              <p className="text-xs font-bold text-primary mt-0.5">{formatRupiah(userDetails.rupiahWallet.balance_pending)}</p>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5">
                              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Locked</p>
                              <p className="text-xs font-bold text-amber-500 mt-0.5">{formatRupiah(userDetails.rupiahWallet.balance_locked)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Badges Cards */}
                      <div className="glass rounded-2xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-primary" /> {interpolate(t.adminUsers.earnedBadges, { count: userDetails.badges.length })}
                        </h3>

                        {userDetails.badges.length > 0 ? (
                          <div className="space-y-2">
                            {userDetails.badges.map((b: any, index: number) => (
                              <div key={index} className="flex gap-3 bg-muted/20 p-2.5 rounded-xl border border-border/20 items-start">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center font-bold text-lg">
                                  🏆
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold">{b.badges.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{b.badges.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-lg">{t.adminUsers.noBadges}</p>
                        )}
                      </div>

                    </div>
                  )}

                  {selectedUser.role !== "student" && (
                    <div className="glass rounded-2xl p-5 text-center space-y-2.5">
                      <School className="h-10 w-10 text-primary/40 mx-auto" />
                      <h4 className="font-semibold text-sm">{t.adminUsers.staffOverview}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t.adminUsers.staffOverviewDesc}
                      </p>
                    </div>
                  )}


              {/* Profile Customization Card */}
              <div className="glass rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-primary" /> {t.adminUsers.profileCustomization}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t.adminUsers.fullName}</label>
                    <input 
                      type="text" 
                      value={editFullName} 
                      onChange={(e) => setEditFullName(e.target.value)} 
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t.adminUsers.username}</label>
                    <input 
                      type="text" 
                      value={editUsername} 
                      onChange={(e) => setEditUsername(e.target.value)} 
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t.adminUsers.bio}</label>
                    <textarea 
                      value={editBio} 
                      onChange={(e) => setEditBio(e.target.value)} 
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">User Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">School Affiliation</label>
                    <select
                      value={formData.school_id}
                      onChange={(e) => setFormData({...formData, school_id: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="">-- Unassigned School --</option>
                      {allSchools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {editRole === "student" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-muted-foreground">Class Assignment (Auto-saves)</label>
                          {updatingEnrollment && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                        </div>
                        <select
                          value={selectedClassId}
                          onChange={(e) => handleClassChange(e.target.value)}
                          disabled={loadingDetails || updatingEnrollment}
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        >
                          <option value="">-- Unassigned / No Class --</option>
                          {allClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                        {selectedClassId ? (
                          <p className="text-[10px] text-emerald-500 font-semibold px-1 mt-1">✓ Enrolled for attendance.</p>
                        ) : (
                          <p className="text-[10px] text-amber-500 font-semibold px-1 mt-1">⚠ Unassigned.</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">XP</label>
                        <input 
                          type="number" 
                          value={editXP} 
                          onChange={(e) => setEditXP(e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0))} 
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Level</label>
                        <input 
                          type="number" 
                          value={editLevel} 
                          onChange={(e) => setEditLevel(e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0))} 
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                        />
                      </div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {updatingProfile ? t.adminUsers.saving : t.adminUsers.saveProfile}
                  </button>
                </div>
              </div>
                  {/* Danger Zone */}
                  <div className="glass rounded-2xl p-4 space-y-3 border-destructive/20 bg-destructive/5 mt-6">
                    <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider">Admin Danger Zone</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setNewPasswordVal("");
                          setShowResetPasswordModal(true);
                        }}
                        className="py-2 text-xs font-semibold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you absolutely sure you want to permanently delete user ${selectedUser.full_name}? This will remove all their auth credentials, attendance logs, wallet data, and profile. THIS ACTION CANNOT BE UNDONE.`)) {
                            setIsDeletingUser(true);
                            try {
                              const res = await fetch("/api/admin/delete-user", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: selectedUser.id })
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                toast.error(data.error || "Failed to delete user");
                              } else {
                                toast.success("User successfully deleted");
                                setSelectedUser(null);
                                loadUsers();
                              }
                            } catch (e) {
                              toast.error("An unexpected error occurred");
                            } finally {
                              setIsDeletingUser(false);
                            }
                          }
                        }}
                        disabled={isDeletingUser}
                        className="py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                      >
                        {isDeletingUser ? "Deleting..." : "Delete Account"}
                      </button>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="font-bold text-lg">Reset Password</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Change password for <b>{selectedUser.full_name}</b> ({selectedUser.email}).</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
                <input
                  type="password"
                  minLength={6}
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="Min 6 characters"
                />
              </div>
              <button
                onClick={async () => {
                  if (newPasswordVal.length < 6) {
                    toast.error("Password must be at least 6 characters");
                    return;
                  }
                  setIsResettingPassword(true);
                  try {
                    const res = await fetch("/api/admin/reset-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: selectedUser.id, newPassword: newPasswordVal })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast.error(data.error || "Failed to reset password");
                    } else {
                      toast.success("Password successfully reset");
                      setShowResetPasswordModal(false);
                    }
                  } catch (e) {
                    toast.error("An unexpected error occurred");
                  } finally {
                    setIsResettingPassword(false);
                  }
                }}
                disabled={isResettingPassword}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
              >
                {isResettingPassword ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Wallet Modal */}
      {showAdjustWalletModal && selectedUser && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="font-bold text-lg">Adjust Wallet Balance</h2>
              <button onClick={() => setShowAdjustWalletModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground font-medium">Adjusting balances for <b>{selectedUser.full_name}</b>.</p>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Currency Type</label>
                <select
                  value={adjustCurrencyType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setAdjustCurrencyType(newType);
                    const wallet = newType === "COIN" ? userDetails.coinWallet : userDetails.rupiahWallet;
                    setAdjustAvailable(wallet.balance_available);
                    setAdjustPending(wallet.balance_pending);
                    setAdjustHeld(wallet.balance_locked);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="COIN">🪙 COIN</option>
                  <option value="RUPIAH">💵 RUPIAH (IDR)</option>
                </select>
              </div>
              
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Available Balance</label>
                  <input
                    type="number"
                    value={adjustAvailable}
                    onChange={(e) => setAdjustAvailable(e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Pending Balance</label>
                  <input
                    type="number"
                    value={adjustPending}
                    onChange={(e) => setAdjustPending(e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Locked Balance</label>
                  <input
                    type="number"
                    value={adjustHeld}
                    onChange={(e) => setAdjustHeld(e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reason / Description</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Corrected manual check-in bonus"
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  setIsAdjustingWallet(true);
                  try {
                    const res = await fetch("/api/admin/adjust-wallet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        studentId: selectedUser.id,
                        currencyType: adjustCurrencyType,
                        available: adjustAvailable,
                        pending: adjustPending,
                        locked: adjustHeld,
                        reason: adjustReason
                      })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast.error(data.error || "Failed to adjust balance");
                    } else {
                      toast.success("Wallet successfully adjusted");
                      setShowAdjustWalletModal(false);
                      // Reload details
                      handleViewDetails(selectedUser);
                    }
                  } catch (e) {
                    toast.error("An unexpected error occurred");
                  } finally {
                    setIsAdjustingWallet(false);
                  }
                }}
                disabled={isAdjustingWallet}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
              >
                {isAdjustingWallet ? "Saving..." : "Save Balances"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
