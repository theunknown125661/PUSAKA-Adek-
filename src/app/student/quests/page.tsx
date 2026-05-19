"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { ClipboardList, CheckCircle2, Circle, Trophy, Star, Zap, Loader2 } from "lucide-react";
import type { Quest, UserQuest } from "@/lib/types/database";
import { toast } from "sonner";

export default function StudentQuestsPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [quests, setQuests] = useState<(Quest & { user_quest?: UserQuest })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchQuests();
  }, [profile]);

  async function fetchQuests() {
    const supabase = createClient();
    
    // Fetch all active quests and the user's progress
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          {t.quests.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t.quests.subtitle}</p>
      </div>

      <div className="space-y-4">
        {quests.map((quest) => {
          const isCompleted = quest.user_quest?.status === 'completed';
          const progress = quest.user_quest?.progress || 0;
          const target = quest.requirement_value;
          const percent = Math.min(Math.round((progress / target) * 100), 100);
          const typeLabel = quest.type === 'daily' ? t.quests.types.daily :
                            quest.type === 'weekly' ? t.quests.types.weekly :
                            t.quests.types.monthly;
          
          return (
            <div key={quest.id} className={`card rounded-2xl p-5 border-2 transition-all ${isCompleted ? 'border-success/20 bg-success/5' : 'border-transparent'}`}>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      quest.type === 'daily' ? 'bg-blue-500/10 text-blue-500' :
                      quest.type === 'weekly' ? 'bg-purple-500/10 text-purple-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {typeLabel}
                    </span>
                    <h3 className="font-bold text-base">{quest.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{quest.description}</p>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-grow bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-success' : 'bg-primary'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold min-w-[40px] text-right">
                      {progress}/{target}
                    </span>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col justify-between items-end gap-2 sm:min-w-[120px]">
                  {/* Rewards */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      +{quest.reward_xp} XP
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">$</div>
                      +{quest.reward_coins} {t.shop.coins}
                    </div>
                  </div>

                  {/* Status Icon */}
                  {isCompleted ? (
                    <div className="flex items-center gap-1 text-success text-sm font-bold">
                      <CheckCircle2 className="h-4 w-4" /> {t.quests.completed}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground text-sm font-medium">
                      <Circle className="h-4 w-4" /> {t.quests.inProgress}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {quests.length === 0 && (
          <div className="p-12 text-center card rounded-2xl">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.quests.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
