"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/shared/empty-state";
import { 
  Users, GraduationCap, BookOpen, Shield, Plus, Loader2, Mail, Lock, 
  User as UserIcon, Calendar, Wallet, Award, School, X, ChevronRight 
} from "lucide-react";
import type { Profile } from "@/lib/types/database";

export default function UserManagementPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  
  // Selected user detail view modal/drawer
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
  });

  const loadUsers = async () => {
    const supabase = createClient();
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (filterRole !== "all") query = query.eq("role", filterRole);
    const { data } = await query;
    setUsers((data || []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole]);

  // Load detailed profile parameters when clicked
  const handleViewDetails = async (user: Profile) => {
    setSelectedUser(user);
    setUserDetails(null);
    if (user.role !== "student") return; // Details like wallets/badges are only for students

    setLoadingDetails(true);
    try {
      const supabase = createClient();

      // 1. Fetch Student's Wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("student_id", user.id)
        .single();

      // 2. Fetch Class Enrollment
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select(`
          id,
          classes (
            name,
            grade_level
          )
        `)
        .eq("student_id", user.id)
        .maybeSingle();

      // 3. Fetch Earned Badges
      const { data: studentBadges } = await supabase
        .from("student_badges")
        .select(`
          earned_at,
          badges (
            name,
            description,
            icon
          )
        `)
        .eq("student_id", user.id);

      setUserDetails({
        wallet: wallet || { available_balance: 0, pending_balance: 0, held_balance: 0 },
        class: (enrollment as any)?.classes || null,
        badges: studentBadges || []
      });
    } catch (err) {
      console.error("Error loading student profile details:", err);
    } finally {
      setLoadingDetails(false);
    }
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
        setErrorMsg(data.error || "Failed to create user");
      } else {
        setSuccessMsg("User created successfully!");
        setFormData({ email: "", password: "", full_name: "", role: "student" });
        loadUsers(); // Refresh the list
        setTimeout(() => {
          setShowAddModal(false);
          setSuccessMsg("");
        }, 1500);
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred");
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const roleIcon = (role: string) => {
    switch (role) {
      case "student": return <GraduationCap className="h-4 w-4 text-primary" />;
      case "teacher": return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "admin": return <Shield className="h-4 w-4 text-amber-500" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const filters = [
    { value: "all", label: "All" },
    { value: "student", label: "Students" },
    { value: "teacher", label: "Teachers" },
    { value: "admin", label: "Admins" },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} users registered</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add User
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
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map((u) => (
            <div 
              key={u.id} 
              onClick={() => handleViewDetails(u)}
              className="glass rounded-xl p-4 flex items-center justify-between hover:border-primary/45 transition-colors cursor-pointer group"
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
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  u.role === "admin" ? "bg-amber-500/10 text-amber-500" : 
                  u.role === "teacher" ? "bg-blue-500/10 text-blue-500" : 
                  "bg-primary/10 text-primary"
                }`}>
                  {u.role}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/70 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="font-bold text-lg">Create New User</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    required
                    type="password" 
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role</label>
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

              {errorMsg && <p className="text-xs font-medium text-destructive bg-destructive/10 p-3 rounded-lg">{errorMsg}</p>}
              {successMsg && <p className="text-xs font-medium text-emerald-500 bg-emerald-500/10 p-3 rounded-lg">{successMsg}</p>}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isSubmitting ? "Creating..." : "Create User"}
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
                    {selectedUser.role} Profile Details
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
              
              {/* Account General Information Card */}
              <div className="glass rounded-2xl p-4 space-y-3.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Credentials</h3>
                
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Joined {new Date(selectedUser.created_at || "").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </div>

              {/* Loader for Student details */}
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2.5">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground animate-pulse">Loading academic and financial data...</p>
                </div>
              ) : (
                <>
                  {selectedUser.role === "student" && userDetails && (
                    <div className="space-y-6">
                      
                      {/* Academic Class Card */}
                      <div className="glass rounded-2xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <School className="h-3.5 w-3.5 text-primary" /> Class Enrollment
                        </h3>
                        {userDetails.class ? (
                          <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/40">
                            <div>
                              <p className="text-sm font-semibold">{userDetails.class.name}</p>
                              <p className="text-xs text-muted-foreground">Grade Level {userDetails.class.grade_level}</p>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Enrolled
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-lg">No active class enrollment found for this student.</p>
                        )}
                      </div>

                      {/* Wallet Balance Cards */}
                      <div className="glass rounded-2xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-primary" /> Financial Wallet
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Available</p>
                            <p className="text-sm font-bold text-emerald-500 mt-1">
                              {formatRupiah(userDetails.wallet.available_balance)}
                            </p>
                          </div>
                          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pending</p>
                            <p className="text-sm font-bold text-primary mt-1">
                              {formatRupiah(userDetails.wallet.pending_balance)}
                            </p>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 col-span-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Monthly Held Balance</p>
                            <p className="text-sm font-bold text-amber-500 mt-1">
                              {formatRupiah(userDetails.wallet.held_balance)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Badges Cards */}
                      <div className="glass rounded-2xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-primary" /> Earned Badges ({userDetails.badges.length})
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
                          <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-lg">This student has not earned any reward badges yet.</p>
                        )}
                      </div>

                    </div>
                  )}

                  {selectedUser.role !== "student" && (
                    <div className="glass rounded-2xl p-5 text-center space-y-2.5">
                      <School className="h-10 w-10 text-primary/40 mx-auto" />
                      <h4 className="font-semibold text-sm">Staff Account Overview</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Teachers and administrator profiles are locked to academic management roles. Academic roster controls and payout ledger triggers reside directly inside their respective dashboards.
                      </p>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
