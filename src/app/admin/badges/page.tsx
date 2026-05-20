"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Medal, Plus, Loader2, Edit2, Shield, Star, Trophy, Flame, Trash2, X } from "lucide-react";
import type { Badge } from "@/lib/types/database";
import { toast } from "sonner";

const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, Star, Trophy, Shield, Medal
};

export default function AdminBadgesPage() {
  const { t, isClient } = useTranslation();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "Medal",
    rarity: "common",
    family: "streak",
    unlock_type: "streak",
    unlock_value: 1,
    active: true
  });

  useEffect(() => {
    fetchBadges();
  }, []);

  async function fetchBadges() {
    const supabase = createClient();
    const { data } = await supabase
      .from("badges")
      .select("*")
      .order("family")
      .order("rarity");
    
    if (data) setBadges(data as Badge[]);
    setLoading(false);
  }

  function openModal(badge: Badge | null = null) {
    if (badge) {
      setEditingBadge(badge);
      setFormData({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        rarity: badge.rarity,
        family: badge.family,
        unlock_type: badge.unlock_rule?.type || "streak",
        unlock_value: badge.unlock_rule?.value || 1,
        active: badge.active
      });
    } else {
      setEditingBadge(null);
      setFormData({
        name: "",
        description: "",
        icon: "Medal",
        rarity: "common",
        family: "streak",
        unlock_type: "streak",
        unlock_value: 1,
        active: true
      });
    }
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name) {
      toast.error(t.adminBadges.nameRequired);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      rarity: formData.rarity,
      family: formData.family,
      unlock_rule: {
        type: formData.unlock_type,
        value: formData.unlock_value
      },
      active: formData.active
    };

    let error;
    if (editingBadge) {
      const res = await supabase.from("badges").update(payload).eq("id", editingBadge.id);
      error = res.error;
    } else {
      const res = await supabase.from("badges").insert([payload]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingBadge ? t.adminBadges.badgeUpdated : t.adminBadges.badgeCreated);
      setIsModalOpen(false);
      fetchBadges();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.adminBadges.confirmDelete)) return;
    
    const supabase = createClient();
    const { error } = await supabase.from("badges").delete().eq("id", id);
    
    if (error) toast.error(error.message);
    else {
      toast.success(t.adminBadges.badgeDeleted);
      fetchBadges();
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
            <Medal className="h-6 w-6 text-primary" />
            {t.adminBadges.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminBadges.subtitle}</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t.adminBadges.createBadge}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {badges.map((badge) => {
          const Icon = IconMap[badge.icon] || Medal;
          return (
            <div 
              key={badge.id} 
              className={`glass rounded-2xl p-5 border transition-all ${
                !badge.active 
                  ? 'opacity-40 border-border/20 bg-background/50' 
                  : badge.rarity === 'legendary' 
                    ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.03] to-amber-500/[0.08] shadow-lg shadow-amber-500/[0.02]' 
                    : badge.rarity === 'epic' 
                      ? 'border-purple-500/30 bg-gradient-to-br from-purple-500/[0.03] to-purple-500/[0.08] shadow-lg shadow-purple-500/[0.02]' 
                      : badge.rarity === 'rare' 
                        ? 'border-blue-500/30 bg-gradient-to-br from-blue-500/[0.03] to-blue-500/[0.08] shadow-lg shadow-blue-500/[0.02]' 
                        : 'border-border/60 bg-gradient-to-br from-zinc-500/[0.01] to-zinc-500/[0.04]'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/30">
                  {badge.family}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openModal(badge)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(badge.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  badge.rarity === 'legendary' 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-sm shadow-amber-500/10' 
                    : badge.rarity === 'epic' 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-500 shadow-sm shadow-purple-500/10' 
                      : badge.rarity === 'rare' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 shadow-sm shadow-blue-500/10' 
                        : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                }`}>
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-foreground">{badge.name}</h3>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${
                    badge.rarity === 'legendary' ? 'text-amber-500' :
                    badge.rarity === 'epic' ? 'text-purple-500' :
                    badge.rarity === 'rare' ? 'text-blue-500' :
                    'text-zinc-500'
                  }`}>
                    {badge.rarity === 'legendary' ? t.adminBadges.rarityLegendary :
                     badge.rarity === 'epic' ? t.adminBadges.rarityEpic :
                     badge.rarity === 'rare' ? t.adminBadges.rarityRare :
                     t.adminBadges.rarityCommon}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2 h-8 leading-relaxed">{badge.description}</p>
              
              <div className="mt-4 pt-4 border-t border-border/40 flex flex-col gap-1.5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.adminBadges.unlockRule}</div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
                  badge.unlock_rule?.type === "streak"
                    ? "bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/10"
                    : "bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10"
                }`}>
                  {badge.unlock_rule?.type === "streak" ? (
                    <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Trophy className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  )}
                  <span className="truncate">
                    {badge.unlock_rule?.type === "streak"
                      ? `${t.adminBadges.streakMetric}: ${badge.unlock_rule?.value} days`
                      : `${t.adminBadges.levelMetric}: Level ${badge.unlock_rule?.value}`
                    }
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {badges.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl">
            <Medal className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.adminBadges.noBadges}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 shadow-xl rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingBadge ? t.adminBadges.editBadge : t.adminBadges.createBadge}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminBadges.nameLabel}</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.adminBadges.namePlaceholder}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminBadges.descriptionLabel}</label>
                <textarea 
                  className="input w-full min-h-[80px]" 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.adminBadges.descriptionPlaceholder}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminBadges.iconLabel}</label>
                  <select 
                    className="input w-full" 
                    value={formData.icon} 
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  >
                    <option value="Medal">Medal</option>
                    <option value="Flame">Flame</option>
                    <option value="Star">Star</option>
                    <option value="Trophy">Trophy</option>
                    <option value="Shield">Shield</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminBadges.rarityLabel}</label>
                  <select 
                    className="input w-full" 
                    value={formData.rarity} 
                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value as any })}
                  >
                    <option value="common">{t.adminBadges.rarityCommon}</option>
                    <option value="rare">{t.adminBadges.rarityRare}</option>
                    <option value="epic">{t.adminBadges.rarityEpic}</option>
                    <option value="legendary">{t.adminBadges.rarityLegendary}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminBadges.familyLabel}</label>
                  <input 
                    type="text" 
                    className="input w-full" 
                    value={formData.family} 
                    onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                    placeholder="e.g., streak, level"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminBadges.activeLabel}</label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={formData.active} 
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      />
                      <span className="text-sm font-medium">{t.adminBadges.enabledLabel}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <h3 className="text-sm font-bold mb-3">{t.adminBadges.unlockRule}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.adminBadges.metricTypeLabel}</label>
                    <select 
                      className="input w-full" 
                      value={formData.unlock_type} 
                      onChange={(e) => setFormData({ ...formData, unlock_type: e.target.value })}
                    >
                      <option value="streak">{t.adminBadges.streakMetric}</option>
                      <option value="level">{t.adminBadges.levelMetric}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.adminBadges.requiredValueLabel}</label>
                    <input 
                      type="number" 
                      className="input w-full" 
                      value={formData.unlock_value} 
                      onChange={(e) => setFormData({ ...formData, unlock_value: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{t.adminBadges.ruleHint}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                {t.adminBadges.cancel}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.adminBadges.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
