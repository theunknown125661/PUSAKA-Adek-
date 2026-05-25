"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { Store, Loader2, Sparkles, Shield, Search, X, Coins, Palette, Frame as FrameIcon } from "lucide-react";
import type { ShopItem, Cosmetic } from "@/lib/types/database";
import { toast } from "sonner";
import AvatarDisplay from "@/components/profile/avatar-display";
import { NotificationBell } from "@/components/shared/notification-bell";

export default function StudentShopPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [items, setItems] = useState<(ShopItem & { cosmetics: Cosmetic | null })[]>([]);
  const [ownedCosmetics, setOwnedCosmetics] = useState<Set<string>>(new Set());
  const [currentCoins, setCurrentCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  
  // Custom Filter & Search States
  const [activeCategory, setActiveCategory] = useState<"ALL" | "SHIELD" | "THEME" | "FRAME">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchShopData = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    
    try {
      const [shopRes, profileRes, ownedRes] = await Promise.all([
        supabase.from("shop_items").select("*, cosmetics(*)").eq("active", true).order("featured", { ascending: false }),
        supabase.from("profiles").select("coins").eq("id", profile.id).single(),
        supabase.from("user_cosmetics").select("cosmetic_id").eq("user_id", profile.id)
      ]);
      
      if (shopRes.data) setItems(shopRes.data as unknown as (ShopItem & { cosmetics: Cosmetic | null })[]);
      if (profileRes.data) setCurrentCoins(profileRes.data.coins || 0);
      if (ownedRes.data) {
        setOwnedCosmetics(new Set(ownedRes.data.map(c => c.cosmetic_id)));
      }
    } catch (error) {
      console.error("Error fetching shop data:", error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchShopData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchShopData]);

  async function initiatePurchase(item: ShopItem) {
    const price = item.price_coins || 0;
    if (currentCoins < price) {
      toast.error(t.shop.notEnoughCoins);
      return;
    }
    setConfirmItem(item);
  }

  async function executePurchase() {
    if (!confirmItem) return;
    
    const purchasedItem = confirmItem;
    setPurchasing(confirmItem.id);
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('purchase_shop_item', {
      p_user_id: profile!.id,
      p_item_id: confirmItem.id
    });

    setPurchasing(null);
    setConfirmItem(null);

    if (error) {
      toast.error(error.message);
    } else if (data && !data.success) {
      toast.error(data.error || t.shop.purchaseFailed);
    } else {
      toast.success(data.message || t.shop.purchaseSuccess);

      // Notify admins about the shop purchase
      fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "shop_purchase",
          category: "transactional",
          priority: "low",
          title: "New Shop Purchase",
          message: `${profile?.full_name || "A student"} purchased ${purchasedItem.name} for ${purchasedItem.price_coins} coins.`,
          action_url: "/admin/reports",
        }),
      }).catch(err => console.error("Failed to send admin notification:", err));

      fetchShopData(); // Refresh
    }
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Filter items by category and search query
  const filteredItems = items.filter(item => {
    // Category match
    const categoryMatch = 
      activeCategory === "ALL" || 
      (activeCategory === "SHIELD" && item.category === "shield") ||
      (activeCategory === "THEME" && item.category === "theme") ||
      (activeCategory === "FRAME" && item.category === "frame");
      
    // Search match
    const searchMatch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
    return categoryMatch && searchMatch;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-md lg:max-w-5xl mx-auto px-1">
      {/* Top Header */}
      <div className="flex justify-between items-center py-1 lg:hidden">
        <div>
          <span className="text-xs font-extrabold text-muted-foreground">School Shop</span>
          <h2 className="font-black text-lg text-foreground leading-none mt-1">Shop Rewards</h2>
        </div>
      </div>

      {/* Current Balance Card (Mockup 1 styling) */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">
      <div className="lg:col-span-1">
      <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-4 shadow-sm relative overflow-hidden">
        <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-amber-500/5 flex items-center justify-center">
          <Coins className="h-7 w-7 text-amber-500/70" />
        </div>
        <div>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Current Balance</p>
          <h2 className="text-3.5xl font-black text-amber-600 dark:text-amber-500 mt-2.5 leading-none">
            {currentCoins.toLocaleString("id-ID")} <span className="text-sm font-extrabold text-muted-foreground">Coins</span>
          </h2>
        </div>
      </div>
      </div>

      {/* Search & Filter section */}
      <div className="space-y-3 lg:col-span-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10 pr-10 py-3 rounded-2xl text-xs font-bold"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Chips scrollable wrapper */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <button
            onClick={() => setActiveCategory("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition-all ${
              activeCategory === "ALL" 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setActiveCategory("SHIELD")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition-all flex items-center gap-1 ${
              activeCategory === "SHIELD" 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-600" 
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            Shields
          </button>
          <button
            onClick={() => setActiveCategory("THEME")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition-all flex items-center gap-1 ${
              activeCategory === "THEME" 
                ? "bg-purple-500/10 border-purple-500/20 text-purple-600" 
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            Themes
          </button>
          <button
            onClick={() => setActiveCategory("FRAME")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border shrink-0 transition-all flex items-center gap-1 ${
              activeCategory === "FRAME" 
                ? "bg-blue-500/10 border-blue-500/20 text-blue-600" 
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            <FrameIcon className="h-3.5 w-3.5" />
            Frames
          </button>
        </div>
      </div>
      </div>

      {/* Featured Banner Card (renders wide at top if present) */}
      {filteredItems.some(item => item.featured) && (
        (() => {
          const featuredItem = filteredItems.find(item => item.featured)!;
          const isOwned = featuredItem.cosmetic_id && ownedCosmetics.has(featuredItem.cosmetic_id);
          const price = featuredItem.price_coins || 0;
          const canAfford = currentCoins >= price;
          return (
            <div className="card rounded-[32px] p-5 border border-amber-400/60 bg-gradient-to-r from-amber-500/5 via-card to-card flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-bl-xl z-10 flex items-center gap-1 shadow-sm">
                <Sparkles className="h-3 w-3" /> Featured
              </div>
              <div className="flex gap-4 items-start pr-12">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  {featuredItem.category === 'shield' ? (
                    <Shield className="h-6 w-6 text-amber-600" />
                  ) : featuredItem.category === 'theme' ? (
                    <Palette className="h-6 w-6 text-purple-600" />
                  ) : (
                    <FrameIcon className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">{featuredItem.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{featuredItem.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-border/20">
                <div className="flex items-center gap-1 text-xs font-black text-amber-600">
                  <Coins className="h-4 w-4" />
                  <span>{price} Coins</span>
                </div>
                {isOwned ? (
                  <button disabled className="px-4 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 font-extrabold text-[10px] border border-emerald-500/20">
                    Owned
                  </button>
                ) : (
                  <button 
                    onClick={() => initiatePurchase(featuredItem)}
                    disabled={!canAfford || purchasing === featuredItem.id}
                    className={`px-4 py-1.5 rounded-xl font-black text-[10px] transition-all border-0 ${
                      canAfford 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.98]'
                        : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                    }`}
                  >
                    Unlock
                  </button>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Grid of standard items (2 columns on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.filter(item => !item.featured).map((item) => {
          const isOwned = item.cosmetic_id && ownedCosmetics.has(item.cosmetic_id);
          const price = item.price_coins || 0;
          const canAfford = currentCoins >= price;
          
          return (
            <div 
              key={item.id} 
              className="card rounded-[28px] p-4.5 border border-border/30 bg-card flex flex-col justify-between shadow-sm min-h-[160px]"
            >
              <div className="space-y-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  item.category === 'theme' ? 'bg-purple-500/10 text-purple-600' :
                  item.category === 'frame' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                  {item.category === 'shield' ? (
                    <Shield className="h-4.5 w-4.5" />
                  ) : item.category === 'theme' ? (
                    <Palette className="h-4.5 w-4.5" />
                  ) : (
                    <FrameIcon className="h-4.5 w-4.5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-foreground truncate">{item.name}</h3>
                  <p className="text-[9px] text-muted-foreground leading-normal mt-0.5 line-clamp-2">{item.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-0.5 text-[10px] font-black text-amber-600 shrink-0">
                  <Coins className="h-3 w-3" />
                  <span>{price}</span>
                </div>
                
                {isOwned ? (
                  <button disabled className="py-1 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-extrabold text-[9px] border border-emerald-500/20">
                    Owned
                  </button>
                ) : (
                  <button 
                    onClick={() => initiatePurchase(item)}
                    disabled={!canAfford || purchasing === item.id}
                    className={`py-1 px-2.5 rounded-lg font-black text-[9px] transition-all border-0 ${
                      canAfford 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.98]'
                        : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                    }`}
                  >
                    Buy
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl border border-border/30 bg-card">
            <Store className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-xs font-semibold">No items found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Confirmation Bottom Sheet Drawer */}
      {confirmItem && (
        <>
          <div 
            onClick={() => setConfirmItem(null)} 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300" 
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 shadow-2xl rounded-t-[32px] p-6 space-y-6 max-w-md mx-auto animate-in slide-in-from-bottom duration-300 pb-safe">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto" />
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                confirmItem.category === 'theme' ? 'bg-purple-500/10 text-purple-600' :
                confirmItem.category === 'frame' ? 'bg-blue-500/10 text-blue-600' :
                'bg-amber-500/10 text-amber-500'
              }`}>
                {confirmItem.category === 'shield' ? (
                  <Shield className="h-6 w-6" />
                ) : confirmItem.category === 'theme' ? (
                  <Palette className="h-6 w-6" />
                ) : (
                  <FrameIcon className="h-6 w-6" />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {confirmItem.category}
                </span>
                <h2 className="text-base font-extrabold leading-tight text-foreground">{confirmItem.name}</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-xl text-xs space-y-2 font-semibold">
                <p className="text-foreground leading-normal font-bold">{confirmItem.description}</p>
              </div>
              <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                <span className="text-xs font-extrabold text-amber-600">Total Cost</span>
                <div className="flex items-center gap-1 text-sm font-black text-amber-600">
                  <Coins className="h-4 w-4" />
                  <span>{confirmItem.price_coins === 0 ? "FREE" : `${confirmItem.price_coins} Coins`}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmItem(null)}
                disabled={purchasing !== null}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={executePurchase}
                disabled={purchasing !== null}
                className="flex-1 py-3 rounded-xl font-black text-xs bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 border-0"
              >
                {purchasing !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Buy"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
