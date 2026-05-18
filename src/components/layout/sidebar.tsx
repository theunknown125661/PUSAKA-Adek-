"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";
import {
  LayoutDashboard, MapPin, History, Wallet, Users,
  ClipboardCheck, Settings, BookOpen, Shield, LogOut, GraduationCap,
  AlertTriangle, Gift, Library, BarChart3
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title?: string; items: NavItem[] };

const navConfig: Record<UserRole, NavSection[]> = {
  student: [
    {
      items: [
        { href: "/student", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/check-in", label: "Check In", icon: MapPin },
        { href: "/student/history", label: "History", icon: History },
        { href: "/student/wallet", label: "Wallet", icon: Wallet },
        { href: "/student/settings", label: "Settings", icon: Settings },
      ]
    }
  ],
  teacher: [
    {
      items: [
        { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
        { href: "/teacher/classes", label: "My Classes", icon: BookOpen },
        { href: "/teacher/students", label: "Students", icon: Users },
      ]
    }
  ],
  admin: [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      ]
    },
    {
      title: "Verification",
      items: [
        { href: "/admin/attendance", label: "Reviews", icon: ClipboardCheck },
        { href: "/admin/flagged", label: "Flagged", icon: AlertTriangle },
      ]
    },
    {
      title: "Financial",
      items: [
        { href: "/admin/withdrawals", label: "Payouts", icon: Wallet },
        { href: "/admin/rewards", label: "Rewards", icon: Gift },
      ]
    },
    {
      title: "Management",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/classes", label: "Classes", icon: Library },
      ]
    },
    {
      title: "System",
      items: [
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ]
    }
  ],
};

export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
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

        <div className="p-3 border-t border-border bg-card/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <RoleIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-red-500/10 w-full transition-colors"
          >
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto hide-scrollbar">
          {allItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors min-w-[64px] shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "animate-streak-fire")} />
                <span className="truncate w-full text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
