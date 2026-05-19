"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import { 
  User, Award, Shield, Sparkles, Zap, Flame, Coins, Package, 
  Settings, Save, Loader2, Lock, Star, ChevronRight
} from "lucide-react";
import AvatarDisplay from "@/components/profile/avatar-display";
import BioEditor from "@/components/profile/bio-editor";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

export default function StudentProfilePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [equippedSlots, setEquippedSlots] = useState<Record<string, any>>({});
  const [inventory, setInventory] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        // Fetch school and class
        const { data: enr } = await supabase
          .from("enrollments")
          .select("classes(name, schools(name))")
          .eq("student_id", user.id)
          .maybeSingle();
  
        if (prof) {
          setProfile({
            ...prof,
            class_name: (enr?.classes as any)?.name,
            school_name: ((enr?.classes as any)?.schools as any)?.name
          });
          setFullName(prof.full_name || "");
          setUsername(prof.username || "");
          setBio(prof.bio || "");
        }
  
        // Fetch wallet
        const { data: wall } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .eq("currency_type", "COIN")
          .maybeSingle();
        
        setWallet(wall);
  
        // Fetch profile slots
        const { data: slotData } = await supabase
          .from("profile_slots")
          .select("*")
          .order("sort_order", { ascending: true });
        
        setSlots(slotData || []);
  
        // Fetch equipped slots
        const { data: equipped } = await supabase
          .from("user_profile_slots")
          .select("*")
          .eq("user_id", user.id);
        
        const equippedMap: Record<string, any> = {};
        equipped?.forEach(item => {
          equippedMap[item.slot_key] = item.item_id;
        });
        setEquippedSlots(equippedMap);
  
        // Fetch inventory (purchased cosmetics)
        const { data: inv } = await supabase
          .from("user_cosmetics")
          .select("*, cosmetics(*)")
          .eq("user_id", user.id);
        
        setInventory(inv || []);
  
        // Fetch earned badges
        const { data: earnedBadges } = await supabase
          .from("student_badges")
          .select("*, badges(*)")
          .eq("student_id", user.id);
        
        setBadges(earnedBadges || []);
      } catch (err) {
        console.error("Error loading profile details:", err);
        toast.error("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        username: username,
        bio: bio
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Error saving profile: " + error.message);
    } else {
      toast.success("Profile saved successfully!");
      setProfile({ ...profile, full_name: fullName, username: username, bio: bio });
    }
    setSaving(false);
  };

  const handleEquip = async (slotKey: string, itemId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_profile_slots")
      .upsert({
        user_id: user.id,
        slot_key: slotKey,
        item_id: itemId,
        equipped_at: new Date().toISOString()
      });

    if (error) {
      toast.error("Error equipping item: " + error.message);
    } else {
      toast.success("Item equipped!");
      setEquippedSlots({ ...equippedSlots, [slotKey]: itemId });
    }
  };

  const handleEquipBadge = async (badgeId: string) => {
    // Find first empty badge slot
    const badgeSlots = slots.filter(s => s.slot_type === "BADGE");
    let targetSlot = badgeSlots.find(s => !equippedSlots[s.slot_key])?.slot_key;
    
    // If all full, overwrite the first one
    if (!targetSlot && badgeSlots.length > 0) {
      targetSlot = badgeSlots[0].slot_key;
    }

    if (targetSlot) {
      await handleEquip(targetSlot, badgeId);
    } else {
      toast.error("No available badge slots!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate level progress (simple formula for display)
  const xpCurrent = profile?.xp || 0;
  const currentLevel = profile?.level || 1;
  const xpNeeded = currentLevel * 100; // Example formula
  const progressPercent = Math.min(100, (xpCurrent / xpNeeded) * 100);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-12">
      {/* 1. Header Identity */}
      <div className="glass rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10" />
        
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          {/* Avatar Section */}
          <div className="relative">
            <AvatarDisplay 
              avatarMode={profile?.avatar_mode || "initials"} 
              avatarUrl={profile?.avatar_url} 
              fullName={profile?.full_name || "Student"} 
              size="xl"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full border-2 border-card">
              Lvl {profile?.level || 1}
            </div>
          </div>

          {/* Identity Info */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div>
              <h1 className="text-2xl font-bold">{profile?.full_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile?.username || "username"}</p>
              {profile?.class_name && (
                <p className="text-xs text-primary font-medium mt-0.5">
                  {profile.class_name} • {profile.school_name}
                </p>
              )}
              {profile?.title_id && (
                <p className="text-sm font-medium text-primary mt-0.5 flex items-center justify-center md:justify-start gap-1">
                  <Star className="h-3.5 w-3.5" /> Scholar
                </p>
              )}
            </div>

            {/* Bio */}
            <p className="text-sm text-muted-foreground max-w-md">
              {profile?.bio || t.studentProfile.noBio}
            </p>

            {/* Stats Pills */}
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span>{wallet?.balance_available || 0} {t.studentProfile.coins}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span>{profile?.streak_current || 0} {t.studentProfile.dayStreak}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                <span>{profile?.xp || 0} {t.studentProfile.xp}</span>
              </div>
            </div>
          </div>

          {/* XP Bar (Right side on desktop) */}
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span>Progress to Level {currentLevel + 1}</span>
              <span>{xpCurrent} / {xpNeeded} XP</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Keep checking in daily to level up!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Edit & Customization */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. Showcase Strip (Badge Slots) */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Badge Showcase
            </h2>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {slots.filter(s => s.slot_type === "BADGE").map((slot) => {
                const isLocked = currentLevel < slot.required_level;
                const equippedItemId = equippedSlots[slot.slot_key];
                const equippedBadge = badges.find(b => b.badge_id === equippedItemId)?.badges;

                return (
                  <div 
                    key={slot.slot_key}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-2 relative group cursor-pointer transition-colors ${
                      isLocked ? "bg-muted/40 border-dashed border-border" : 
                      equippedBadge ? "bg-card border-primary/30" : "bg-muted/20 border-border hover:bg-muted/30"
                    }`}
                  >
                    {isLocked ? (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Lock className="h-4 w-4" />
                        <span className="text-[9px] font-medium">Lvl {slot.required_level}</span>
                      </div>
                    ) : equippedBadge ? (
                      <div className="text-2xl">{equippedBadge.icon || "🏅"}</div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-medium">Empty</span>
                    )}
                    
                    {/* Hover tooltip or label */}
                    {!isLocked && equippedBadge && (
                      <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl p-1 text-center">
                        <span className="text-[10px] font-medium truncate">{equippedBadge.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Profile Settings (Moved from settings page) */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" /> Profile Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Bio</label>
                <BioEditor value={bio} onChange={setBio} />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Inventory & Collection */}
        <div className="space-y-6">
          
          {/* 3. Cosmetic Inventory */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Inventory
            </h2>
            
            {inventory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                You haven't bought any items yet. Visit the shop!
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {inventory.map((item) => (
                  <div 
                    key={item.id}
                    className="aspect-square bg-muted/20 border border-border rounded-xl flex flex-col items-center justify-center p-2 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <span className="text-2xl">{item.cosmetics?.visual_data?.icon || "🎭"}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                      {item.cosmetics?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Badges Collection */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> Earned Badges
            </h2>
            
            {badges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Complete quests to earn badges!
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {badges.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleEquipBadge(item.badge_id)}
                    className="aspect-square bg-muted/20 border border-border rounded-xl flex flex-col items-center justify-center p-2 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <span className="text-2xl">{item.badges?.icon || "🏅"}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                      {item.badges?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
