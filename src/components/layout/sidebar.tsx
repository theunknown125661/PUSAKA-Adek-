"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole, Profile } from "@/lib/types/database";
import type { Messages } from "@/lib/i18n/types";
import { XPProgressBar } from "@/components/shared/xp-progress-bar";
import AvatarDisplay from "@/components/profile/avatar-display";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  LayoutDashboard, MapPin, History, Wallet, Users, User, Coins, Flame,
  ClipboardCheck, Settings, BookOpen, LogOut, GraduationCap,
  AlertTriangle, Gift, Library, BarChart3, Sun, Moon, Globe, Calendar as CalendarIcon, Store, Medal, ClipboardList,
  Menu, X, Bell, School, QrCode
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateLevelAndProgress } from "@/lib/utils/gamification";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/shared/notification-bell";
import { useNotifications } from "@/lib/hooks/use-notifications";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavSection = { title?: string; items: NavItem[] };

const getNavConfig = (t: Messages): Record<UserRole, NavSection[]> => ({
  student: [
    {
      items: [
        { href: "/student", label: t.navigation.dashboard, icon: LayoutDashboard },
        { href: "/student/class", label: t.navigation.myClass, icon: BookOpen },
        { href: "/student/shop", label: t.navigation.rewardShop, icon: Store },
        { href: "/student/badges", label: t.navigation.badges, icon: Medal },
        { href: "/student/quests", label: t.navigation.quests, icon: ClipboardList },
        { href: "/student/notifications", label: t.notifications.title, icon: Bell },
        { href: "/student/history", label: t.navigation.history, icon: History },
        { href: "/student/wallet", label: t.navigation.wallet, icon: Wallet },
      ]
    }
  ],
  teacher: [
    {
      items: [
        { href: "/teacher", label: t.navigation.dashboard, icon: LayoutDashboard },
        { href: "/teacher/classes", label: t.navigation.myClasses, icon: BookOpen },
        { href: "/teacher/students", label: t.navigation.students, icon: Users },
        { href: "/teacher/notifications", label: t.notifications.title, icon: Bell },
      ]
    }
  ],
  admin: [
    {
      title: t.navigation.sections.overview,
      items: [
        { href: "/admin", label: t.navigation.dashboard, icon: LayoutDashboard },
        { href: "/admin/notifications", label: t.notifications.title, icon: Bell },
      ]
    },
    {
      title: t.navigation.sections.verification,
      items: [
        { href: "/admin/attendance", label: t.navigation.reviews, icon: ClipboardCheck, exact: true },
        { href: "/admin/flagged", label: t.navigation.flagged, icon: AlertTriangle },
        { href: "/admin/attendance/calendar", label: t.navigation.calendar, icon: CalendarIcon },
      ]
    },
    {
      title: t.navigation.sections.financial,
      items: [
        { href: "/admin/withdrawals", label: t.navigation.payouts, icon: Wallet },
        { href: "/admin/rewards", label: t.navigation.rewards, icon: Gift },
      ]
    },
    {
      title: t.navigation.sections.management,
      items: [
        { href: "/admin/schools", label: "Schools Directory", icon: School },
        { href: "/admin/subjects", label: "Global Subjects", icon: BookOpen },
        { href: "/admin/timetable", label: "Timetable Builder", icon: CalendarIcon },
        { href: "/admin/users", label: t.navigation.users, icon: Users },

        { href: "/admin/holidays", label: t.navigation.holidays, icon: CalendarIcon },
        { href: "/admin/shop", label: t.navigation.shopItems, icon: Store },
        { href: "/admin/badges", label: t.navigation.badges, icon: Medal },
        { href: "/admin/quests", label: t.navigation.quests, icon: ClipboardList },
      ]
    },
    {
      title: t.navigation.sections.system,
      items: [
        { href: "/admin/reports", label: t.navigation.reports, icon: BarChart3 },
        { href: "/admin/settings", label: t.navigation.settings, icon: Settings },
      ]
    }
  ],
});

export function Sidebar({ role, profile }: { role: UserRole; profile: Profile }) {
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const { theme, setTheme } = useTheme();
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const { unreadCount } = useNotifications({ realtime: true, limit: 1 });
  const router = useRouter();

  const studentBottomItems = [
    { href: "/student", label: t.navigation.dashboard, icon: LayoutDashboard },
    { href: "/student/wallet", label: t.navigation.wallet, icon: Wallet },
    { href: "/student/shop", label: t.navigation.rewardShop, icon: Store },
    { href: "/student/settings", label: t.navigation.profile, icon: User },
  ];

  const [metrics, setMetrics] = useState<{
    classesCount?: number;
    studentsCount?: number;
    totalStudents?: number;
    pendingReviews?: number;
    pendingWithdrawals?: number;
  }>({});
  const [economyConfig, setEconomyConfig] = useState<any>(null);

  useEffect(() => {
    if (role !== "student" || !profile?.school_id) return;
    const supabase = createClient();
    async function loadConfig() {
      const { data } = await supabase
        .from("reward_rules")
        .select("economy_config")
        .eq("school_id", profile.school_id)
        .maybeSingle();
      if (data && data.economy_config) {
        setEconomyConfig(data.economy_config);
      }
    }
    loadConfig();
  }, [role, profile?.school_id]);

  useEffect(() => {
    const supabase = createClient();
    async function loadMetrics() {
      if (role === "teacher") {
        // Fetch classes taught by this teacher
        const { data: classesData } = await supabase
          .from("classes")
          .select("id")
          .eq("teacher_id", profile.id);
        
        const classesCount = classesData?.length || 0;
        let studentsCount = 0;
        if (classesData && classesData.length > 0) {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("class_id", classesData.map(c => c.id));
          studentsCount = count || 0;
        }
        setMetrics({ classesCount, studentsCount });
      } else if (role === "admin") {
        // Fetch total student count, flagged logs, and pending payouts
        const { count: studentCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student");

        const { count: flaggedCount } = await supabase
          .from("attendance_logs")
          .select("*", { count: "exact", head: true })
          .eq("status", "flagged");

        const { count: payoutCount } = await supabase
          .from("withdrawal_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        setMetrics({
          totalStudents: studentCount || 0,
          pendingReviews: flaggedCount || 0,
          pendingWithdrawals: payoutCount || 0,
        });
      }
    }

    loadMetrics();

    // Listen for custom profile updates to synchronize metrics in real-time
    window.addEventListener("profile-updated", loadMetrics);
    return () => {
      window.removeEventListener("profile-updated", loadMetrics);
    };
  }, [role, profile.id]);
  
  const navConfig = getNavConfig(t);
  const sections = navConfig[role] || [];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getStreakStyles = (streak: number) => {
    if (streak >= 30) {
      return { iconColor: "text-blue-500", fillColor: "fill-blue-500/30", scale: "scale-125", pulse: "animate-pulse" };
    } else if (streak >= 14) {
      return { iconColor: "text-purple-500", fillColor: "fill-purple-500/30", scale: "scale-110", pulse: "animate-pulse" };
    } else if (streak >= 7) {
      return { iconColor: "text-rose-500", fillColor: "fill-rose-500/30", scale: "scale-105", pulse: "animate-pulse" };
    } else if (streak >= 3) {
      return { iconColor: "text-red-500", fillColor: "fill-red-500/20", scale: "scale-100", pulse: "animate-pulse" };
    } else {
      return { iconColor: "text-orange-500", fillColor: "fill-orange-500/10", scale: "scale-100", pulse: "" };
    }
  };
  const streakStyles = getStreakStyles(profile?.streak_current || 0);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card h-screen fixed left-0 top-0 z-30">
        <div className="h-16 px-5 flex items-center border-b border-border shrink-0">
          <Link href={`/${role}`} className="flex items-center gap-2.5 w-full">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SP</span>
            </div>
            <div>
              <span className="font-bold text-sm">School Present</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-4 hide-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && (
                <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2">
                  {section.title}
                </h4>
              )}
              {section.items.map((item) => {
                const isActive = item.exact 
                  ? pathname === item.href 
                  : pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(`${item.href}/`));
                const isNotifications = item.href.endsWith("/notifications");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                    </div>
                    {isNotifications && unreadCount > 0 && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border h-14 flex items-center justify-between px-4 safe-area-top">
        {role === "student" ? (
          <>
            {/* Left: Avatar triggers profile sheet */}
            <button
              onClick={() => setShowMobileProfile(true)}
              className="relative focus:outline-none focus:ring-2 focus:ring-primary rounded-full transition-transform active:scale-95 border-2 border-primary/20 hover:border-primary/50 shrink-0"
              title="Profile Menu"
            >
              <AvatarDisplay
                fullName={profile.full_name || "User"}
                avatarUrl={profile.avatar_url}
                avatarMode={profile.avatar_mode}
                size="sm"
              />
            </button>

            {/* Center: School Present Logo & text */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-xs">SP</span>
              </div>
              <span className="font-bold text-sm truncate">School Present</span>
            </div>

            {/* Right: Notification Bell */}
            <NotificationBell size="sm" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileDrawer(!showMobileDrawer)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1"
                title="Toggle Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-xs">SP</span>
              </div>
              <span className="font-bold text-sm truncate">School Present</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell size="sm" />
              <button
                onClick={() => setShowMobileProfile(true)}
                className="relative focus:outline-none focus:ring-2 focus:ring-primary rounded-full transition-transform active:scale-95 border-2 border-primary/20 hover:border-primary/50 shrink-0"
                title="Profile Menu"
              >
                <AvatarDisplay
                  fullName={profile.full_name || "User"}
                  avatarUrl={profile.avatar_url}
                  avatarMode={profile.avatar_mode}
                  size="sm"
                />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Mobile Side Drawer for Teachers and Admins */}
      {role !== "student" && showMobileDrawer && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border p-5 flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-5 border-b border-border mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xs">SP</span>
                </div>
                <div>
                  <span className="font-bold text-sm">School Present</span>
                </div>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Scrollable Nav */}
            <nav className="flex-grow overflow-y-auto space-y-4 pr-1 hide-scrollbar">
              {sections.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  {section.title && (
                    <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2">
                      {section.title}
                    </h4>
                  )}
                  {section.items.map((item) => {
                    const isActive = item.exact 
                      ? pathname === item.href 
                      : pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(`${item.href}/`));
                    const isNotifications = item.href.endsWith("/notifications");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setShowMobileDrawer(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4.5 w-4.5" />
                          <span>{item.label}</span>
                        </div>
                        {isNotifications && unreadCount > 0 && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Drawer Profile Info and Sign out */}
            <div className="pt-4 border-t border-border mt-auto">
              <div className="flex items-center gap-3 mb-4">
                <AvatarDisplay
                  fullName={profile.full_name || "User"}
                  avatarUrl={profile.avatar_url}
                  avatarMode={profile.avatar_mode}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{role}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowMobileDrawer(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t.navigation.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav - student only */}
      {role === "student" && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-around gap-1 px-2 py-1.5 overflow-x-auto hide-scrollbar">
            {studentBottomItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/student" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl text-[10px] font-medium transition-all active:scale-95",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn("relative flex items-center justify-center p-1 rounded-full transition-all duration-300", isActive && "bg-primary/10 text-primary")}>
                    <item.icon className={cn("h-5 w-5 transition-transform duration-300", isActive && "scale-110")} />
                  </div>
                  <span className={cn("truncate w-full text-center transition-all duration-300", isActive ? "opacity-100 font-bold" : "opacity-80")}>{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary animate-slide-up" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile Profile Bottom Sheet */}
      {showMobileProfile && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowMobileProfile(false)} />
          
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 flex flex-col space-y-4 shadow-2xl">
            {/* Handle bar & Close */}
            <div className="flex items-center justify-between relative pb-2 border-b border-border/40">
              <div className="w-12 h-1 bg-muted rounded-full mx-auto absolute top-[-8px] left-1/2 -translate-x-1/2" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground">{t.navigation.profile}</h3>
              <button
                onClick={() => setShowMobileProfile(false)}
                className="p-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Info Details */}
            <div className="flex items-center gap-4 py-2">
              <AvatarDisplay
                fullName={profile.full_name || "User"}
                avatarUrl={profile.avatar_url}
                avatarMode={profile.avatar_mode}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-black truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile.username ? `@${profile.username}` : role}
                </p>
                {(profile as unknown as { class_name?: string; school_name?: string }).class_name && (
                  <p className="text-xs text-primary font-bold truncate mt-0.5">
                    {(profile as unknown as { class_name?: string; school_name?: string }).class_name} • {(profile as unknown as { class_name?: string; school_name?: string }).school_name}
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl italic border border-border/30">
                &ldquo;{profile.bio}&rdquo;
              </p>
            )}

            {/* Role-based Stats */}
            {role === "student" ? (
              <div className="space-y-2 bg-muted/40 p-3.5 rounded-2xl border border-border/50">
                <XPProgressBar 
                  xp={profile?.xp || 0} 
                  economyConfig={economyConfig} 
                  userLevel={profile?.level} 
                />
                {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 mt-2">
                      <div className="flex items-center justify-between px-3 py-2 bg-card rounded-xl border border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Coins</span>
                        <span className="text-sm font-black text-amber-500 flex items-center gap-0.5">
                          <Coins className="h-3.5 w-3.5" />
                          {profile.coins || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 bg-card rounded-xl border border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Streak</span>
                        <span className={`text-sm font-black ${streakStyles.iconColor} flex items-center gap-0.5`}>
                          <Flame className={`h-3.5 w-3.5 ${streakStyles.fillColor} ${streakStyles.scale} ${streakStyles.pulse} transition-all duration-300`} />
                          {profile.streak_current || 0}d
                        </span>
                      </div>
                    </div>
                  </div>
            ) : role === "teacher" ? (
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-2xl border border-border/40">
                <div className="bg-card border border-border/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">Assigned Classes</p>
                  <p className="text-xl font-black text-primary mt-1">{metrics.classesCount ?? "-"}</p>
                </div>
                <div className="bg-card border border-border/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">Enrolled Students</p>
                  <p className="text-xl font-black text-primary mt-1">{metrics.studentsCount ?? "-"}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-2xl border border-border/40">
                <div className="bg-card border border-border/50 p-2.5 rounded-xl text-center">
                  <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest">Students</p>
                  <p className="text-base font-black text-primary mt-1">{metrics.totalStudents ?? "-"}</p>
                </div>
                <div className="bg-card border border-border/50 p-2.5 rounded-xl text-center">
                  <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest">Pending Flags</p>
                  <p className="text-base font-black text-rose-500 mt-1">{metrics.pendingReviews ?? "-"}</p>
                </div>
                <div className="bg-card border border-border/50 p-2.5 rounded-xl text-center">
                  <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest">Payouts</p>
                  <p className="text-base font-black text-amber-500 mt-1">{metrics.pendingWithdrawals ?? "-"}</p>
                </div>
              </div>
            )}

            {/* Quick App Preferences Settings */}
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                <span>Preferences</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-3">
                <span className="text-xs font-semibold text-foreground">Theme Selection</span>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted font-bold text-xs text-muted-foreground hover:text-foreground transition-all active:scale-95"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Light Theme</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Dark Theme</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-border/30 pt-3">
                <span className="text-xs font-semibold text-foreground">Language Select</span>
                <button
                  onClick={() => {
                    const newLocale = locale === "en" ? "id" : "en";
                    localStorage.setItem("app-locale", newLocale);
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted font-bold text-xs text-muted-foreground hover:text-foreground transition-all active:scale-95"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>{locale === "en" ? "Bahasa Indonesia" : "English"}</span>
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Link
                href={`/${role}/settings`}
                onClick={() => setShowMobileProfile(false)}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-md shadow-primary/20"
              >
                {role === "student" ? <User className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                {role === "student" ? t.navigation.profile : t.navigation.updateProfile}
              </Link>
              <button
                onClick={() => {
                  setShowMobileProfile(false);
                  handleLogout();
                }}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 font-black text-xs uppercase tracking-wider transition-colors active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                {t.navigation.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
