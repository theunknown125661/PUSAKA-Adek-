"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { Medal, Flame, Star, Trophy, Shield, CheckCircle2, Lock, Sparkles, AlertCircle } from "lucide-react";
import type { Badge, StudentBadge } from "@/lib/types/database";

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
  const [unlockedBadges, setUnlockedBadges] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "UNLOCKED" | "LOCKED">("ALL");

  useEffect(() => {
    if (profile) fetchBadges();
  }, [profile]);

  async function fetchBadges() {
    const supabase = createClient();
    
    const [badgesRes, userBadgesRes] = await Promise.all([
      supabase.from("badges").select("*").eq("active", true).order("family").order("created_at"),
      supabase.from("student_badges").select("*, badges(*)").eq("student_id", profile!.id)
    ]);
    
    if (badgesRes.data) setAllBadges(badgesRes.data as Badge[]);
    if (userBadgesRes.data) {
      const unlockedMap: Record<string, any> = {};
      userBadgesRes.data.forEach((ub: any) => {
        unlockedMap[ub.badge_id] = ub;
      });
      setUnlockedBadges(unlockedMap);
    }
    
    setLoading(false);
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Filtered list based on tab
  const filteredBadges = allBadges.filter(badge => {
    const isUnlocked = !!unlockedBadges[badge.id];
    if (activeTab === "UNLOCKED") return isUnlocked;
    if (activeTab === "LOCKED") return !isUnlocked;
    return true;
  });

  // Group filtered badges by family
  const groupedBadges = filteredBadges.reduce((acc, badge) => {
    if (!acc[badge.family]) acc[badge.family] = [];
    acc[badge.family].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  const unlockedCount = Object.keys(unlockedBadges).length;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Medal className="h-6 w-6 text-primary" />
            {t.badges.title}
          </h1>
          <p className="text-muted-foreground text-xs mt-1">{t.badges.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 shadow-sm shrink-0">
          <Trophy className="h-5 w-5 text-amber-500 animate-bounce" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 leading-none mb-0.5">{t.badges.earned}</span>
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-500 leading-none">{unlockedCount} / {allBadges.length} Earned</span>
          </div>
        </div>
      </div>

      {/* Featured Badges strip (the legendary badges) */}
      <div className="bg-gradient-to-r from-amber-500/5 to-orange-600/5 border border-amber-500/10 p-5 rounded-[28px] space-y-3">
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-extrabold">Legendary Showcase</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {allBadges.filter(b => b.rarity === 'legendary').slice(0, 3).map(b => {
            const isUnlocked = !!unlockedBadges[b.id];
            const Icon = IconMap[b.icon] || Medal;
            return (
              <div key={b.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border ${
                isUnlocked 
                  ? "bg-card border-amber-500/30 shadow-sm shadow-amber-500/5" 
                  : "bg-muted/20 border-transparent opacity-65"
              }`}>
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                  isUnlocked 
                    ? "bg-gradient-to-br from-amber-300 to-orange-500 text-white" 
                    : "bg-muted border border-border/40 text-muted-foreground"
                }`}>
                  {isUnlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold truncate">{b.name}</p>
                  <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">{b.rarity}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Filter buttons */}
      <div className="bg-muted/60 p-1 rounded-2xl flex gap-1 max-w-sm">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'ALL' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Badges
        </button>
        <button
          onClick={() => setActiveTab("UNLOCKED")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'UNLOCKED' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Unlocked
        </button>
        <button
          onClick={() => setActiveTab("LOCKED")}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'LOCKED' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Locked
        </button>
      </div>

      {/* Badges List container */}
      <div className="space-y-8">
        {Object.entries(groupedBadges).map(([family, badges]) => (
          <div key={family} className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              {family} {t.badges.familySuffix}
              <div className="h-px bg-border/40 flex-grow ml-2" />
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {badges.map((badge) => {
                const isUnlocked = !!unlockedBadges[badge.id];
                const Icon = IconMap[badge.icon] || Medal;
                
                // Color mapping based on rarity
                let rarityColors = "from-zinc-100 to-zinc-200 text-zinc-600 border-zinc-200 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400 dark:border-zinc-700";
                
                if (isUnlocked) {
                  if (badge.rarity === 'common') {
                    rarityColors = "from-slate-200 to-slate-400 text-slate-800 border-slate-300 shadow-slate-500/5";
                  } else if (badge.rarity === 'rare') {
                    rarityColors = "from-blue-400 to-blue-600 text-white border-blue-400 shadow-blue-500/20";
                  } else if (badge.rarity === 'epic') {
                    rarityColors = "from-purple-500 to-purple-700 text-white border-purple-500 shadow-purple-500/25";
                  } else if (badge.rarity === 'legendary') {
                    rarityColors = "from-amber-300 via-amber-500 to-orange-500 text-white border-amber-400 shadow-amber-500/30";
                  }
                }
                
                return (
                  <div 
                    key={badge.id} 
                    className={`relative flex flex-col items-center p-5 rounded-[28px] border-2 transition-all duration-300 ${
                      isUnlocked 
                        ? 'bg-card border-border hover:-translate-y-1 hover:shadow-lg' 
                        : 'bg-muted/10 border-transparent opacity-65'
                    }`}
                  >
                    {isUnlocked && badge.rarity === 'legendary' && (
                      <Sparkles className="absolute -top-1.5 -right-1.5 h-5 w-5 text-amber-400 animate-pulse drop-shadow-md z-10" />
                    )}
                    
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center mb-3 shadow-md border-2 ${rarityColors}`}>
                      {isUnlocked ? <Icon className="h-6.5 w-6.5 drop-shadow-sm" /> : <Lock className="h-5 w-5 opacity-40" />}
                    </div>
                    
                    <h3 className="font-extrabold text-xs text-center line-clamp-1 mb-1">{badge.name}</h3>
                    <p className="text-[9px] text-center text-muted-foreground leading-snug line-clamp-2 pr-1 pl-1 min-h-[26px]">
                      {badge.description}
                    </p>
                    
                    <div className="mt-4">
                      <span className={`text-[8px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full border ${
                        badge.rarity === 'legendary' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        badge.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                        badge.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                        'bg-muted border-transparent text-muted-foreground'
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

        {filteredBadges.length === 0 && (
          <div className="p-12 text-center card rounded-[28px] border border-border/50 bg-card">
            <Medal className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-semibold">{t.badges.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
