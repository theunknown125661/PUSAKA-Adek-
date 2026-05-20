"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole, Profile } from "@/lib/types/database";
import AvatarDisplay from "@/components/profile/avatar-display";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  LayoutDashboard, MapPin, History, Wallet, Users, User, Coins, Flame,
  ClipboardCheck, Settings, BookOpen, Shield, LogOut, GraduationCap,
  AlertTriangle, Gift, Library, BarChart3, ChevronUp, Sun, Moon, Globe, Calendar as CalendarIcon, Store, Medal, ClipboardList
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title?: string; items: NavItem[] };

const getNavConfig = (t: any): Record<UserRole, NavSection[]> => ({
  student: [
    {
      items: [
        { href: "/student", label: t.navigation.dashboard, icon: LayoutDashboard },
        { href: "/student/check-in", label: t.navigation.checkIn, icon: MapPin },
        { href: "/student/class", label: t.navigation.myClass, icon: BookOpen },
        { href: "/student/shop", label: t.navigation.rewardShop, icon: Store },
        { href: "/student/badges", label: t.navigation.badges, icon: Medal },
        { href: "/student/quests", label: t.navigation.quests, icon: ClipboardList },
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
      ]
    }
  ],
  admin: [
    {
      title: t.navigation.sections.overview,
      items: [
        { href: "/admin", label: t.navigation.dashboard, icon: LayoutDashboard },
      ]
    },
    {
      title: t.navigation.sections.verification,
      items: [
        { href: "/admin/attendance", label: t.navigation.reviews, icon: ClipboardCheck },
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
        { href: "/admin/users", label: t.navigation.users, icon: Users },
        { href: "/admin/classes", label: t.navigation.classes, icon: Library },
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHoverProfile, setShowHoverProfile] = useState(false);
  const { theme, setTheme } = useTheme();
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const [metrics, setMetrics] = useState<{
    classesCount?: number;
    studentsCount?: number;
    totalStudents?: number;
    pendingReviews?: number;
    pendingWithdrawals?: number;
  }>({});

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
          .from("payout_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "REQUESTED");

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
  
  // Flatten items for mobile bottom nav so we don't have sections there
  const allItems = sections.flatMap(s => s.items);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleIcon = {
    student: GraduationCap,
    teacher: BookOpen,
    admin: Shield,
  };
  const RoleIcon = roleIcon[role];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card min-h-screen fixed left-0 top-0 z-30">
        <div className="p-5 border-b border-border">
          <Link href={`/${role}`} className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SP</span>
            </div>
            <div>
              <span className="font-bold text-sm">School Present</span>
              <span className="text-xs text-muted-foreground block capitalize">{role} Portal</span>
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
                const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border bg-card relative">
          {/* Profile Popover */}
          {showProfileMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 p-4 bg-card border border-border shadow-lg rounded-xl animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <AvatarDisplay
                  fullName={profile.full_name || "User"}
                  avatarUrl={profile.avatar_url}
                  avatarMode={profile.avatar_mode}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.username ? `@${profile.username}` : role}
                  </p>
                  {(profile as any).class_name && (
                    <p className="text-xs text-primary font-medium truncate mt-0.5">
                      {(profile as any).class_name} • {(profile as any).school_name}
                    </p>
                  )}
                </div>
              </div>
              
              {profile.bio && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 italic">
                  "{profile.bio}"
                </p>
              )}

              {role === "student" ? (
                /* Student XP Bar */
                <div className="space-y-1 mb-3 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Level {profile.level || 1}</span>
                    <span className="text-muted-foreground">{profile.xp || 0} XP</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${Math.min(100, ((profile.xp || 0) / ((profile.level || 1) * 100)) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : role === "teacher" ? (
                /* Teacher Stats */
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/30 border border-border/40 p-2 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Classes</p>
                    <p className="text-lg font-extrabold text-primary mt-0.5">{metrics.classesCount ?? "-"}</p>
                  </div>
                  <div className="bg-muted/30 border border-border/40 p-2 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Students</p>
                    <p className="text-lg font-extrabold text-primary mt-0.5">{metrics.studentsCount ?? "-"}</p>
                  </div>
                </div>
              ) : (
                /* Admin Stats */
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="bg-muted/30 border border-border/40 p-1.5 rounded-xl text-center">
                    <p className="text-[9px] font-medium text-muted-foreground uppercase">Students</p>
                    <p className="text-sm font-extrabold text-primary mt-0.5">{metrics.totalStudents ?? "-"}</p>
                  </div>
                  <div className="bg-muted/30 border border-border/40 p-1.5 rounded-xl text-center">
                    <p className="text-[9px] font-medium text-muted-foreground uppercase">Flags</p>
                    <p className="text-sm font-extrabold text-rose-500 mt-0.5">{metrics.pendingReviews ?? "-"}</p>
                  </div>
                  <div className="bg-muted/30 border border-border/40 p-1.5 rounded-xl text-center">
                    <p className="text-[9px] font-medium text-muted-foreground uppercase">Payouts</p>
                    <p className="text-sm font-extrabold text-amber-500 mt-0.5">{metrics.pendingWithdrawals ?? "-"}</p>
                  </div>
                </div>
              )}

              {/* Minimalist Settings Row */}
              <div className="flex items-center justify-between gap-2 mb-3 border-t border-border pt-2">
                <span className="text-xs font-medium text-muted-foreground">{t.navigation.appSettings}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      const newLocale = locale === "en" ? "id" : "en";
                      localStorage.setItem("app-locale", newLocale);
                      window.location.reload();
                    }}
                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1 text-xs"
                    title="Change Language"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>{locale === "en" ? "EN" : "ID"}</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-1 border-t border-border pt-2">
                <Link
                  href={`/${role}/settings`}
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
                >
                  {role === "student" ? <User className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                  {role === "student" ? t.navigation.profile : t.navigation.updateProfile}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t.navigation.signOut}
                </button>
              </div>
            </div>
          )}

          {/* Trigger Button */}
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted w-full transition-colors text-left",
              showProfileMenu && "bg-muted"
            )}
          >
            <AvatarDisplay
              fullName={profile.full_name || "User"}
              avatarUrl={profile.avatar_url}
              avatarMode={profile.avatar_mode}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile.full_name}</p>
              {role === "student" ? (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>Lvl {profile.level || 1}</span>
                  <span className="flex items-center gap-0.5">
                    <Coins className="h-2.5 w-2.5 text-amber-500" />
                    {profile.coins || 0}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Flame className="h-2.5 w-2.5 text-orange-500" />
                    {profile.streak_current || 0}
                  </span>
                </div>
              ) : role === "teacher" ? (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Tutor · {metrics.classesCount ?? 0} cls · {metrics.studentsCount ?? 0} std
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Admin · {metrics.totalStudents ?? 0} std · {metrics.pendingReviews ?? 0} flg
                </p>
              )}
            </div>
            <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", showProfileMenu && "rotate-180")} />
          </button>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border h-14 flex items-center justify-between px-4 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xs">SP</span>
          </div>
          <span className="font-bold text-sm truncate">School Present</span>
        </div>
        <button
          onClick={handleLogout}
          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-red-500/10 transition-colors"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile bottom nav - scrollable horizontally for many items */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-around gap-1 px-2 py-1.5 overflow-x-auto hide-scrollbar">
          {allItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
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
    </>
  );
}
