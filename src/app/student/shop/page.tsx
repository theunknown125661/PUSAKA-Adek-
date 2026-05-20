"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { Store, Loader2, Sparkles, CheckCircle2, Shield, Search, X, Coins, Palette, Frame as FrameIcon, Info } from "lucide-react";
import type { ShopItem, Cosmetic } from "@/lib/types/database";
import { toast } from "sonner";

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

  useEffect(() => {
    if (profile) fetchShopData();
  }, [profile]);

  async function fetchShopData() {
    const supabase = createClient();
    
    const [shopRes, profileRes, ownedRes] = await Promise.all([
      supabase.from("shop_items").select("*, cosmetics(*)").eq("active", true).order("featured", { ascending: false }),
      supabase.from("profiles").select("coins").eq("id", profile!.id).single(),
      supabase.from("user_cosmetics").select("cosmetic_id").eq("user_id", profile!.id)
    ]);
    
    if (shopRes.data) setItems(shopRes.data as any);
    if (profileRes.data) setCurrentCoins(profileRes.data.coins || 0);
    if (ownedRes.data) {
      setOwnedCosmetics(new Set(ownedRes.data.map(c => c.cosmetic_id)));
    }
    
    setLoading(false);
  }

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
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            {t.shop.title}
          </h1>
          <p className="text-muted-foreground text-xs mt-1">{t.shop.subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20 shadow-sm shrink-0">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white font-bold text-xs">$</div>
          <div className="flex flex-col text-left">
            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 leading-none mb-0.5">{t.shop.balance}</span>
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-500 leading-none">{currentCoins} Coins</span>
          </div>
        </div>
      </div>

      {/* Search & Filter section */}
      <div className="space-y-3">
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
            Attendance Shields
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
            UI Themes
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
            Avatar Frames
          </button>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isOwned = item.cosmetic_id && ownedCosmetics.has(item.cosmetic_id);
          const price = item.price_coins || 0;
          const canAfford = currentCoins >= price;
          
          return (
            <div 
              key={item.id} 
              className={`card rounded-[28px] p-1 border-2 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg ${
                item.featured 
                  ? 'border-amber-400/50 shadow-md shadow-amber-500/5 bg-gradient-to-br from-card to-amber-500/5' 
                  : 'border-border bg-card'
              }`}
            >
              <div className="bg-card rounded-[24px] p-5 flex flex-col h-full relative">
                {item.featured && (
                  <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1 shadow-sm">
                    <Sparkles className="h-3 w-3" /> {t.shop.featured}
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-inner ${
                    item.category === 'theme' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                    item.category === 'frame' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                    item.category === 'shield' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-zinc-500/10 text-zinc-600'
                  }`}>
                    {item.category === 'shield' ? (
                      <Shield className="h-5 w-5" />
                    ) : item.category === 'theme' ? (
                      <Palette className="h-5 w-5" />
                    ) : item.category === 'frame' ? (
                      <FrameIcon className="h-5 w-5" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </div>
                </div>
                
                <h3 className="font-extrabold text-base mb-1 truncate pr-16">{item.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-grow">{item.description}</p>
                
                {isOwned ? (
                  <button disabled className="w-full py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" /> {t.shop.owned}
                  </button>
                ) : (
                  <button 
                    onClick={() => initiatePurchase(item)}
                    disabled={!canAfford || purchasing === item.id}
                    className={`w-full py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 border-0 ${
                      canAfford 
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/10 hover:opacity-90 active:scale-[0.98]'
                        : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    {price === 0 ? t.shop.free : `${price} Coins`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl border border-border/50 bg-card">
            <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-semibold">{t.shop.empty}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t.shop.emptyDesc}</p>
          </div>
        )}
      </div>

      {/* Confirmation Bottom Sheet Drawer (Mobile-first slide-up) */}
      {confirmItem && (
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setConfirmItem(null)} 
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-300" 
          />

          {/* Slide up Drawer content */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl rounded-t-[32px] p-6 space-y-6 max-w-md mx-auto animate-in slide-in-from-bottom duration-300 pb-safe">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto" />

            <div className="flex items-start gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                confirmItem.category === 'theme' ? 'bg-purple-500/10 text-purple-600' :
                confirmItem.category === 'frame' ? 'bg-blue-500/10 text-blue-600' :
                confirmItem.category === 'shield' ? 'bg-amber-500/10 text-amber-500' :
                'bg-zinc-500/10 text-zinc-600'
              }`}>
                {confirmItem.category === 'shield' ? (
                  <Shield className="h-7 w-7" />
                ) : confirmItem.category === 'theme' ? (
                  <Palette className="h-7 w-7" />
                ) : confirmItem.category === 'frame' ? (
                  <FrameIcon className="h-7 w-7" />
                ) : (
                  <Store className="h-7 w-7" />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {confirmItem.category}
                </span>
                <h2 className="text-lg font-extrabold leading-tight">{confirmItem.name}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/30 p-4.5 rounded-2xl text-xs space-y-2 font-semibold">
                <div className="flex justify-between text-muted-foreground">
                  <span>Product description</span>
                </div>
                <p className="text-foreground leading-relaxed font-bold">{confirmItem.description}</p>
              </div>

              <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
                <span className="text-xs font-extrabold text-amber-600">Total Price</span>
                <div className="flex items-center gap-1 text-sm font-black text-amber-600">
                  <Coins className="h-4.5 w-4.5" />
                  <span>{confirmItem.price_coins === 0 ? "FREE" : `${confirmItem.price_coins} Coins`}</span>
                </div>
              </div>
            </div>

            {/* CTA action buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmItem(null)}
                disabled={purchasing !== null}
                className="flex-1 py-4 rounded-2xl font-bold text-xs bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={executePurchase}
                disabled={purchasing !== null}
                className="flex-1 py-4 rounded-2xl font-black text-xs bg-amber-500 text-white shadow-lg shadow-amber-500/15 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 border-0"
              >
                {purchasing !== null ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Confirm Buy"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
