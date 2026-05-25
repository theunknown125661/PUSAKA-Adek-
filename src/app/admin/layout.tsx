"use client";

import { AppShell } from "@/components/layout/app-shell";
import { UserRoleProvider } from "@/components/providers/user-role-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserRoleProvider>
      <AppShell>{children}</AppShell>
    </UserRoleProvider>
  );
}
