"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/utils/format";
import { Store, Plus, Trash2, Edit2, Loader2, Star, Image as ImageIcon, X } from "lucide-react";
import type { ShopItem, Cosmetic } from "@/lib/types/database";
import { toast } from "sonner";

export default function AdminShopPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [items, setItems] = useState<(ShopItem & { cosmetics: Cosmetic | null })[]>([]);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "theme",
    price_coins: 0,
    featured: false,
    active: true,
    cosmetic_id: ""
  });

  useEffect(() => {
    fetchItems();
    fetchCosmetics();
  }, []);

  async function fetchItems() {
    const supabase = createClient();
    const { data } = await supabase
      .from("shop_items")
      .select("*, cosmetics(*)")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    
    if (data) setItems(data as any);
    setLoading(false);
  }

  async function fetchCosmetics() {
    const supabase = createClient();
    const { data } = await supabase.from("cosmetics").select("*").order("name");
    if (data) setCosmetics(data as Cosmetic[]);
  }

  function openModal(item: ShopItem | null = null) {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || "",
        category: item.category,
        price_coins: item.price_coins || 0,
        featured: item.featured,
        active: item.active,
        cosmetic_id: item.cosmetic_id || ""
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        description: "",
        category: "theme",
        price_coins: 0,
        featured: false,
        active: true,
        cosmetic_id: ""
      });
    }
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name) {
      toast.error(t.adminShop.nameRequired);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price_coins: formData.price_coins,
      featured: formData.featured,
      active: formData.active,
      cosmetic_id: formData.cosmetic_id || null,
      price_rp: 0 // Default for now since we use coins
    };

    let error;
    if (editingItem) {
      const res = await supabase.from("shop_items").update(payload).eq("id", editingItem.id);
      error = res.error;
    } else {
      const res = await supabase.from("shop_items").insert([payload]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingItem ? t.adminShop.itemUpdated : t.adminShop.itemCreated);
      setIsModalOpen(false);
      fetchItems();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.adminShop.confirmDelete)) return;
    
    const supabase = createClient();
    const { error } = await supabase.from("shop_items").delete().eq("id", id);
    
    if (error) toast.error(error.message);
    else {
      toast.success(t.adminShop.itemDeleted);
      fetchItems();
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("shop_items").update({ active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchItems();
  }

  async function toggleFeatured(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("shop_items").update({ featured: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchItems();
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            {t.adminShop.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminShop.subtitle}</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t.adminShop.addItem}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className={`card rounded-2xl p-5 border-2 transition-all ${!item.active ? 'opacity-60 border-transparent' : item.featured ? 'border-primary/50' : 'border-transparent'}`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                item.category === 'theme' ? 'bg-purple-500/10 text-purple-500' :
                item.category === 'frame' ? 'bg-blue-500/10 text-blue-500' :
                item.category === 'shield' ? 'bg-amber-500/10 text-amber-500' :
                'bg-muted text-muted-foreground'
              }`}>
                {item.category}
              </span>
              <div className="flex gap-1">
                <button onClick={() => toggleFeatured(item.id, item.featured)} className={`p-1.5 rounded-md hover:bg-muted ${item.featured ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  <Star className={`h-4 w-4 ${item.featured ? 'fill-current' : ''}`} />
                </button>
                <button onClick={() => openModal(item)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <h3 className="font-bold text-lg mb-1">{item.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4 h-8">{item.description}</p>
            
            <div className="flex items-center justify-between mt-auto">
              <span className={`font-bold border px-2 py-1 rounded-lg text-sm flex items-center gap-1 ${
                !item.price_coins || item.price_coins === 0 
                  ? 'text-success bg-success/10 border-success/20' 
                  : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
              }`}>
                {(!item.price_coins || item.price_coins === 0) ? (
                  t.adminShop.free
                ) : (
                  <>
                    <div className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">$</div>
                    {item.price_coins}
                  </>
                )}
              </span>
              {item.cosmetics && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-lg">
                  <ImageIcon className="h-3.5 w-3.5" /> {t.adminShop.linked}
                </div>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full p-12 text-center card rounded-2xl">
            <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">{t.adminShop.noItems}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 shadow-xl rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingItem ? t.adminShop.editItem : t.adminShop.createItem}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminShop.nameLabel}</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.adminShop.namePlaceholder}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminShop.descriptionLabel}</label>
                <textarea 
                  className="input w-full min-h-[80px]" 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.adminShop.descPlaceholder}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminShop.categoryLabel}</label>
                  <select 
                    className="input w-full" 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  >
                    <option value="theme">Theme</option>
                    <option value="frame">Frame</option>
                    <option value="shield">Shield</option>
                    <option value="sticker">Sticker</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t.adminShop.priceLabel}</label>
                  <input 
                    type="number" 
                    className="input w-full" 
                    value={formData.price_coins} 
                    onChange={(e) => setFormData({ ...formData, price_coins: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.adminShop.linkCosmetic}</label>
                <select 
                  className="input w-full" 
                  value={formData.cosmetic_id} 
                  onChange={(e) => setFormData({ ...formData, cosmetic_id: e.target.value })}
                >
                  <option value="">{t.adminShop.none}</option>
                  {cosmetics.map((cosmetic) => (
                    <option key={cosmetic.id} value={cosmetic.id}>
                      {cosmetic.name} ({cosmetic.type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">{t.adminShop.linkCosmeticDesc}</p>
              </div>

              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={formData.featured} 
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  />
                  <span className="text-sm font-medium">{t.adminShop.featured}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={formData.active} 
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                  <span className="text-sm font-medium">{t.adminShop.active}</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                {t.adminShop.cancel}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.adminShop.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
