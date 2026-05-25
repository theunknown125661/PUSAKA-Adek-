"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types/database";

interface UserRoleContextType {
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      try {
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
          setRole(data.role as UserRole);

          if (data.role === "student") {
            const [enrRes, streakRes, walletsRes] = await Promise.all([
              supabase
                .from("enrollments")
                .select("classes(name, schools(name))")
                .eq("student_id", user.id)
                .maybeSingle(),
              supabase
                .from("streaks")
                .select("current_streak")
                .eq("student_id", user.id)
                .maybeSingle(),
              supabase
                .from("wallets")
                .select("currency_type, balance_available")
                .eq("user_id", user.id)
            ]);

            const coinWallet = walletsRes.data?.find(w => w.currency_type === "COIN");
            const rupiahWallet = walletsRes.data?.find(w => w.currency_type === "RUPIAH");

            setProfile({
              ...data,
              class_name: (enrRes.data?.classes as any)?.name || null,
              school_name: ((enrRes.data?.classes as any)?.schools as any)?.name || null,
              streak_current: streakRes.data?.current_streak ?? 0,
              coins: coinWallet?.balance_available ?? data.coins ?? 0,
              rupiah: rupiahWallet?.balance_available ?? 0
            } as any);
          } else {
            setProfile(data as Profile);
          }
        }
      } catch (err) {
        console.error("Error fetching user profile context:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();

    const handleProfileUpdate = () => {
      fetchProfile();
    };

    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  return (
    <UserRoleContext.Provider value={{ profile, role, loading }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRoleContext() {
  return useContext(UserRoleContext);
}
