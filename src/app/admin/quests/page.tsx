"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ClipboardList, Plus, Edit2, Trash2, Loader2, Zap, X } from "lucide-react";
import type { Quest } from "@/lib/types/database";
import { toast } from "sonner";

export default function AdminQuestsPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "daily",
    reward_xp: 0,
    reward_coins: 0,
    requirement_type: "checkin_count",
    requirement_value: 1,
    active: true
  });

  useEffect(() => {
    fetchQuests();
  }, []);

  async function fetchQuests() {
    const supabase = createClient();
    const { data } = await supabase
      .from("quests")
      .select("*")
      .order("type")
      .order("created_at");
    
    if (data) setQuests(data as Quest[]);
    setLoading(false);
  }

  function openModal(quest: Quest | null = null) {
    if (quest) {
      setEditingQuest(quest);
      setFormData({
        title: quest.title,
        description: quest.description,
        type: quest.type,
        reward_xp: quest.reward_xp,
        reward_coins: quest.reward_coins,
        requirement_type: quest.requirement_type,
        requirement_value: quest.requirement_value,
        active: quest.active
      });
    } else {
      setEditingQuest(null);
      setFormData({
        title: "",
        description: "",
        type: "daily",
        reward_xp: 0,
        reward_coins: 0,
        requirement_type: "checkin_count",
        requirement_value: 1,
        active: true
      });
    }
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!formData.title) {
      toast.error(t.adminQuests.titleRequired);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      reward_xp: formData.reward_xp,
      reward_coins: formData.reward_coins,
      requirement_type: formData.requirement_type,
      requirement_value: formData.requirement_value,
      active: formData.active
    };

    let error;
    if (editingQuest) {
      const res = await supabase.from("quests").update(payload).eq("id", editingQuest.id);
      error = res.error;
    } else {
      const res = await supabase.from("quests").insert([payload]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingQuest ? t.adminQuests.questUpdated : t.adminQuests.questCreated);
      setIsModalOpen(false);
      fetchQuests();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.adminQuests.confirmDelete)) return;
    
    const supabase = createClient();
    const { error } = await supabase.from("quests").delete().eq("id", id);
    
    if (error) toast.error(error.message);
    else {
      toast.success(t.adminQuests.questDeleted);
      fetchQuests();
    }
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            {t.adminQuests.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminQuests.subtitle}</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t.adminQuests.createQuest}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quests.map((quest) => (
          <div key={quest.id} className={`card rounded-2xl p-5 border-2 transition-all ${!quest.active ? 'opacity-60 border-transparent' : 'border-transparent'}`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                quest.type === 'daily' ? 'bg-blue-500/10 text-blue-500' :
                quest.type === 'weekly' ? 'bg-purple-500/10 text-purple-500' :
                'bg-amber-500/10 text-amber-500'
              }`}>
                {quest.type === 'daily' ? t.adminQuests.daily : quest.type === 'weekly' ? t.adminQuests.weekly : t.adminQuests.special}
              </span>
              <div className="flex gap-2">
                <button onClick={() => openModal(quest)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(quest.id)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            
            <h3 className="font-bold text-base mb-1">{quest.title}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 h-10">{quest.description}</p>
            
            <div className="flex justify-between items-center pt-3 border-t text-xs">
              <div className="flex gap-3">
                <span className="flex items-center gap-1 font-bold text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-blue-500" /> {quest.reward_xp} XP
                </span>
                <span className="flex items-center gap-1 font-bold text-muted-foreground">
                  <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">$</div>
                  {quest.reward_coins} {t.adminShop.priceLabel.includes('Koin') ? 'Koin' : 'Coins'}
                </span>
              </div>
              
              <div className="text-muted-foreground">
                {t.adminQuests.requires} <span className="font-bold text-foreground">{quest.requirement_value}</span> {
                  quest.requirement_type === 'checkin_count' ? t.adminQuests.totalCheckins :
                  quest.requirement_type === 'early_bird_count' ? t.adminQuests.earlyCheckins :
                  t.adminQuests.streakReached
                }
              </div>
            </div>
          </div>
        ))}

        {quests.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.adminQuests.noQuests}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 shadow-xl rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingQuest ? t.adminQuests.editQuest : t.adminQuests.createQuest}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminQuests.titleLabel}</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t.adminQuests.titlePlaceholder}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminQuests.descriptionLabel}</label>
                <textarea 
                  className="input w-full min-h-[80px]" 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.adminQuests.descPlaceholder}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminQuests.typeLabel}</label>
                  <select 
                    className="input w-full" 
                    value={formData.type} 
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="daily">{t.adminQuests.daily}</option>
                    <option value="weekly">{t.adminQuests.weekly}</option>
                    <option value="special">{t.adminQuests.special}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminQuests.activeLabel}</label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={formData.active} 
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      />
                      <span className="text-sm font-medium">{t.adminQuests.enabled}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminQuests.rewardXp}</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={formData.reward_xp} 
                    onChange={(e) => setFormData({ ...formData, reward_xp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminQuests.rewardCoins}</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={formData.reward_coins} 
                    onChange={(e) => setFormData({ ...formData, reward_coins: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="pt-2 border-t">
                <h3 className="text-sm font-bold mb-3">{t.adminQuests.requirements}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.adminQuests.metric}</label>
                    <select 
                      className="input w-full" 
                      value={formData.requirement_type} 
                      onChange={(e) => setFormData({ ...formData, requirement_type: e.target.value as any })}
                    >
                      <option value="checkin_count">{t.adminQuests.totalCheckins}</option>
                      <option value="early_bird_count">{t.adminQuests.earlyCheckins}</option>
                      <option value="streak_reach">{t.adminQuests.streakReached}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.adminQuests.requiredValue}</label>
                    <input 
                      type="number" 
                      className="input w-full" 
                      value={formData.requirement_value} 
                      onChange={(e) => setFormData({ ...formData, requirement_value: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                {t.adminQuests.cancel}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.adminQuests.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
