"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { ClipboardList, CheckCircle2, Circle, Trophy, Star, Zap, Loader2, Sparkles, Gift } from "lucide-react";
import type { Quest, UserQuest } from "@/lib/types/database";

export default function StudentQuestsPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [quests, setQuests] = useState<(Quest & { user_quest?: UserQuest })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "DAILY" | "WEEKLY" | "SPECIAL">("ALL");

  useEffect(() => {
    if (profile) fetchQuests();
  }, [profile]);

  async function fetchQuests() {
    const supabase = createClient();
    
    const [questsRes, userQuestsRes] = await Promise.all([
      supabase.from("quests").select("*").eq("active", true).order("type"),
      supabase.from("user_quests").select("*").eq("user_id", profile!.id)
    ]);
    
    if (questsRes.data) {
      const uqMap: Record<string, UserQuest> = {};
      if (userQuestsRes.data) {
        userQuestsRes.data.forEach((uq: any) => {
          uqMap[uq.quest_id] = uq;
        });
      }
      
      const combined = questsRes.data.map((q: any) => ({
        ...q,
        user_quest: uqMap[q.id]
      }));
      
      setQuests(combined);
    }
    
    setLoading(false);
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Filter logic
  const filteredQuests = quests.filter(q => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "DAILY") return q.type === "daily";
    if (activeFilter === "WEEKLY") return q.type === "weekly";
    if (activeFilter === "SPECIAL") return q.type === "special";
    return true;
  });

  // Calculate daily progress chest
  const dailyQuests = quests.filter(q => q.type === "daily");
  const completedDailyCount = dailyQuests.filter(q => q.user_quest?.status === "completed").length;
  const totalDailyCount = dailyQuests.length || 3;
  const chestProgressPct = Math.min(100, (completedDailyCount / totalDailyCount) * 100);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            {t.quests.title}
          </h1>
          <p className="text-muted-foreground text-xs mt-1">{t.quests.subtitle}</p>
        </div>
      </div>

      {/* Daily Quest Chest Card */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 p-5 space-y-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl animate-pulse" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center text-white relative shadow-lg shadow-teal-500/20">
              <Gift className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">Daily Quest Chest</h3>
              <p className="text-[10px] text-muted-foreground">Unlock rewards upon completing all daily quests</p>
            </div>
          </div>
          <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full shrink-0">
            {completedDailyCount} / {totalDailyCount} Completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/10 p-[1px]">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${chestProgressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground font-bold px-0.5">
            <span>Progress: {Math.round(chestProgressPct)}%</span>
            <span>+100 Coins chest bonus!</span>
          </div>
        </div>
      </div>

      {/* Filter Category Tabs */}
      <div className="bg-muted/60 p-1 rounded-2xl flex gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveFilter("ALL")}
          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
            activeFilter === 'ALL' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Quests
        </button>
        <button
          onClick={() => setActiveFilter("DAILY")}
          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
            activeFilter === 'DAILY' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setActiveFilter("WEEKLY")}
          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
            activeFilter === 'WEEKLY' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setActiveFilter("SPECIAL")}
          className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
            activeFilter === 'SPECIAL' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Special
        </button>
      </div>

      {/* Quests Lists */}
      <div className="space-y-3">
        {filteredQuests.map((quest) => {
          const isCompleted = quest.user_quest?.status === 'completed';
          const progress = quest.user_quest?.progress || 0;
          const target = quest.requirement_value;
          const percent = Math.min(Math.round((progress / target) * 100), 100);
          
          return (
            <div 
              key={quest.id} 
              className={`card rounded-[28px] p-5 border-2 transition-all duration-300 ${
                isCompleted 
                  ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5' 
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-grow space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        quest.type === 'daily' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                        quest.type === 'weekly' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
                        'bg-amber-500/10 border-amber-500/20 text-amber-600'
                      }`}>
                        {quest.type}
                      </span>
                      <h3 className="font-extrabold text-sm">{quest.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pr-6">{quest.description}</p>
                  </div>
                  
                  {/* Stepper Progress bar inside quest card */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground px-0.5">
                      <span>Progress</span>
                      <span>{progress} / {target}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/10 p-[0.5px]">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right side: Rewards list & completion status */}
                <div className="flex sm:flex-col justify-between items-end gap-3 sm:min-w-[130px] border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0 shrink-0">
                  <div className="flex sm:flex-col items-start sm:items-end gap-3 sm:gap-1 mt-1 sm:mt-0">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-indigo-500" />
                      <span>+{quest.reward_xp} XP</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[9px] text-white font-bold">$</div>
                      <span>+{quest.reward_coins} Coins</span>
                    </div>
                  </div>

                  {isCompleted ? (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-black bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                      <CheckCircle2 className="h-4 w-4" /> Completed
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-extrabold bg-muted/50 px-3 py-1 rounded-xl">
                      <Circle className="h-4 w-4" /> In Progress
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredQuests.length === 0 && (
          <div className="p-12 text-center card rounded-[28px] border border-border/50 bg-card">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-semibold">{t.quests.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
