"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types/database";

export function useUserRole() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
        setRole(data.role as UserRole);

        // Fetch school and class if student
        if (data.role === "student") {
          const { data: enr } = await supabase
            .from("enrollments")
            .select("classes(name, schools(name))")
            .eq("student_id", user.id)
            .maybeSingle();
          
          if (enr) {
            setProfile({
              ...data,
              class_name: (enr.classes as any)?.name,
              school_name: ((enr.classes as any)?.schools as any)?.name
            } as any);
          }
        }
      }
      setLoading(false);
    }

    fetchProfile();
  }, []);

  return { profile, role, loading };
}
