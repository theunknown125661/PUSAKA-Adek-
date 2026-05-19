"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { Medal, Flame, Star, Trophy, Shield, CheckCircle2, Lock, Sparkles } from "lucide-react";
import type { Badge, UserBadge } from "@/lib/types/database";

// Map string icon names to Lucide components
const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame,
  Star,
  Trophy,
  Shield,
  Medal,
  CheckCircle2
};

export default function StudentBadgesPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<Record<string, UserBadge>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchBadges();
  }, [profile]);

  async function fetchBadges() {
    const supabase = createClient();
    
    const [badgesRes, userBadgesRes] = await Promise.all([
      supabase.from("badges").select("*").eq("active", true).order("family").order("created_at"),
      supabase.from("user_badges").select("*").eq("user_id", profile!.id)
    ]);
    
    if (badgesRes.data) setAllBadges(badgesRes.data as Badge[]);
    if (userBadgesRes.data) {
      const unlockedMap: Record<string, UserBadge> = {};
      userBadgesRes.data.forEach((ub: any) => {
        unlockedMap[ub.badge_id] = ub;
      });
      setUnlockedBadges(unlockedMap);
    }
    
    setLoading(false);
  }

  // Group badges by family
  const groupedBadges = allBadges.reduce((acc, badge) => {
    if (!acc[badge.family]) acc[badge.family] = [];
    acc[badge.family].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Medal className="h-6 w-6 text-primary" />
            {t.badges.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.badges.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl transition-colors border border-primary/20">
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-primary leading-none mb-0.5">{t.badges.earned}</span>
            <span className="text-sm font-bold text-primary">{Object.keys(unlockedBadges).length} / {allBadges.length}</span>
          </div>
          <Trophy className="h-6 w-6 text-primary drop-shadow-sm ml-1" />
        </div>
      </div>

      <div className="space-y-10">
        {Object.entries(groupedBadges).map(([family, badges]) => (
          <div key={family} className="space-y-4">
            <h2 className="text-lg font-bold capitalize flex items-center gap-2">
              {family} {t.badges.familySuffix}
              <div className="h-px bg-border flex-grow ml-2 opacity-50"></div>
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {badges.map((badge) => {
                const isUnlocked = !!unlockedBadges[badge.id];
                const Icon = IconMap[badge.icon] || Medal;
                
                // Color mapping based on rarity
                let rarityColors = "from-zinc-200 to-zinc-400 text-zinc-700 border-zinc-300 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400 dark:border-zinc-700";
                let shadowColor = "";
                
                if (isUnlocked) {
                  if (badge.rarity === 'common') {
                    rarityColors = "from-slate-300 to-slate-400 text-slate-800 border-slate-400 shadow-slate-500/20";
                  } else if (badge.rarity === 'rare') {
                    rarityColors = "from-blue-400 to-blue-600 text-white border-blue-500 shadow-blue-500/30";
                  } else if (badge.rarity === 'epic') {
                    rarityColors = "from-purple-500 to-purple-700 text-white border-purple-600 shadow-purple-500/40";
                  } else if (badge.rarity === 'legendary') {
                    rarityColors = "from-amber-300 via-amber-500 to-orange-500 text-white border-amber-400 shadow-amber-500/50";
                  }
                }
                
                return (
                  <div 
                    key={badge.id} 
                    className={`relative flex flex-col items-center p-4 rounded-3xl border-2 transition-all duration-300 ${isUnlocked ? 'bg-card hover:-translate-y-1 hover:shadow-xl' : 'bg-muted/30 border-transparent opacity-70 grayscale'}`}
                  >
                    {isUnlocked && badge.rarity === 'legendary' && (
                      <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-400 animate-pulse drop-shadow-md z-10" />
                    )}
                    
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center mb-3 shadow-lg border-2 ${rarityColors}`}>
                      {isUnlocked ? <Icon className="h-8 w-8 drop-shadow-sm" /> : <Lock className="h-6 w-6 opacity-50" />}
                    </div>
                    
                    <h3 className="font-bold text-sm text-center line-clamp-1 mb-1">{badge.name}</h3>
                    <p className="text-[10px] text-center text-muted-foreground leading-snug line-clamp-2">{badge.description}</p>
                    
                    <div className="mt-3">
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        badge.rarity === 'legendary' ? 'bg-amber-500/10 text-amber-500' :
                        badge.rarity === 'epic' ? 'bg-purple-500/10 text-purple-500' :
                        badge.rarity === 'rare' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-muted-foreground/10 text-muted-foreground'
                      }`}>
                        {badge.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(groupedBadges).length === 0 && (
          <div className="p-12 text-center card rounded-2xl">
            <Medal className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.badges.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
