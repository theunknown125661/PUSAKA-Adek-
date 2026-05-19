"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { formatCurrency } from "@/lib/utils/format";
import { Store, Loader2, Sparkles, CheckCircle2, Shield, Wallet, AlertTriangle } from "lucide-react";
import type { ShopItem, Cosmetic, Wallet as WalletType } from "@/lib/types/database";
import { toast } from "sonner";
import Link from "next/link";

export default function StudentShopPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  const [items, setItems] = useState<(ShopItem & { cosmetics: Cosmetic | null })[]>([]);
  const [ownedCosmetics, setOwnedCosmetics] = useState<Set<string>>(new Set());
  const [currentCoins, setCurrentCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);

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
    
    // Call our secure Postgres function
    const { data, error } = await supabase.rpc('purchase_shop_item', {
      p_user_id: profile!.id,
      p_item_id: confirmItem.id
    });

    if (error) {
      toast.error(error.message);
    } else if (data && !data.success) {
      toast.error(data.error || t.shop.purchaseFailed);
    } else {
      toast.success(data.message || t.shop.purchaseSuccess);
      // Refresh data
      fetchShopData();
    }
    setPurchasing(null);
    setConfirmItem(null);
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            {t.shop.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.shop.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 rounded-xl transition-colors border border-amber-500/20">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">$</div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 leading-none mb-0.5">{t.shop.balance}</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{currentCoins}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {items.map((item) => {
          const isOwned = item.cosmetic_id && ownedCosmetics.has(item.cosmetic_id);
          const price = item.price_coins || 0;
          const canAfford = currentCoins >= price;
          
          return (
            <div key={item.id} className={`card rounded-3xl p-1 border-2 overflow-hidden flex flex-col ${item.featured ? 'border-amber-400/50 shadow-lg shadow-amber-500/10' : 'border-transparent'}`}>
              <div className="bg-muted/30 rounded-[22px] p-5 flex flex-col h-full relative">
                {item.featured && (
                  <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1 shadow-sm">
                    <Sparkles className="h-3 w-3" /> {t.shop.featured}
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm ${
                    item.category === 'theme' ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                    item.category === 'frame' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    item.category === 'shield' ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                    'bg-gradient-to-br from-zinc-400 to-zinc-600'
                  }`}>
                    {item.category === 'shield' ? <Shield className="h-6 w-6 text-white" /> : <Store className="h-6 w-6 text-white" />}
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-grow">{item.description}</p>
                
                {isOwned ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-success/10 text-success font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {t.shop.owned}
                  </button>
                ) : (
                  <button 
                    onClick={() => initiatePurchase(item)}
                    disabled={!canAfford || purchasing === item.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      canAfford 
                        ? (price === 0 ? 'bg-success text-white shadow-md hover:opacity-90 active:scale-[0.98]' : 'bg-amber-500 text-white shadow-md hover:opacity-90 active:scale-[0.98]')
                        : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {purchasing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (price === 0 ? t.shop.free : `${price} ${t.shop.coins}`)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {items.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl">
            <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.shop.empty}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t.shop.emptyDesc}</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border-2 shadow-xl rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t.shop.confirmTitle}</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {t.shop.confirmDesc
                .replace("{name}", confirmItem.name)
                .replace("{price}", (!confirmItem.price_coins || confirmItem.price_coins === 0) ? t.shop.free : `${confirmItem.price_coins} ${t.shop.coins}`)
              }
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmItem(null)}
                disabled={purchasing !== null}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button 
                onClick={executePurchase}
                disabled={purchasing !== null}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-colors flex items-center justify-center gap-2"
              >
                {purchasing !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : t.shop.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
