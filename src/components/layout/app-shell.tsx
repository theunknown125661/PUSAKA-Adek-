"use client";

import { useUserRole } from "@/lib/hooks/use-user-role";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role || !profile) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <Sidebar role={role} userName={profile.full_name || "User"} />
      <main className="lg:ml-64 pt-14 pb-20 lg:pt-0 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
