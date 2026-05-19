-- ============================================
-- Gamification System Migration — Phase 3 (Shop)
-- Run AFTER schema-gamification.sql
-- ============================================

-- Add 'purchase' to transaction_type enum if it doesn't exist
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'purchase';

-- ============================================
-- SHOP ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cosmetic_id UUID REFERENCES public.cosmetics(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- theme, frame, title, sticker, booster, shield, mascot, decor, seasonal
  price_rp INTEGER NOT NULL,
  price_coins INTEGER, -- Keep for future if needed
  stock INTEGER, -- NULL = unlimited
  featured BOOLEAN NOT NULL DEFAULT false,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active shop items" ON public.shop_items;
CREATE POLICY "Anyone reads active shop items" ON public.shop_items FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins manage shop items" ON public.shop_items;
CREATE POLICY "Admins manage shop items" ON public.shop_items FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- PURCHASES HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE RESTRICT,
  price_paid INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'coins',
  purchased_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own purchases" ON public.purchases;
CREATE POLICY "Users read own purchases" ON public.purchases FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all purchases" ON public.purchases;
CREATE POLICY "Admins read all purchases" ON public.purchases FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- RPC FUNCTION: PURCHASE ITEM
-- ============================================
-- Safely handles deducting coins, granting cosmetic, and logging.
CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_user_id UUID, p_item_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_profile RECORD;
  v_already_owned BOOLEAN;
BEGIN
  -- 1. Get the item and verify it's available
  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id;
  IF NOT FOUND OR v_item.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is not available.');
  END IF;

  -- 2. If it's a cosmetic, check if user already owns it
  IF v_item.cosmetic_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_cosmetics 
      WHERE user_id = p_user_id AND cosmetic_id = v_item.cosmetic_id
    ) INTO v_already_owned;

    IF v_already_owned THEN
      RETURN jsonb_build_object('success', false, 'error', 'You already own this item.');
    END IF;
  END IF;

  -- 3. Get the user's profile for coins
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found.');
  END IF;

  -- 4. Check balance
  IF COALESCE(v_profile.coins, 0) < v_item.price_coins THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins.');
  END IF;

  -- 5. Deduct coins
  UPDATE public.profiles 
  SET coins = coins - v_item.price_coins,
      updated_at = now()
  WHERE id = p_user_id;

  -- 6. Log Coin Transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (p_user_id, 'purchase', -v_item.price_coins, p_item_id, 'Purchased shop item: ' || v_item.name);

  -- 7. Log Purchase
  INSERT INTO public.purchases (user_id, shop_item_id, price_paid, currency)
  VALUES (p_user_id, p_item_id, v_item.price_coins, 'coins');

  -- 8. Grant Item
  IF v_item.cosmetic_id IS NOT NULL THEN
    INSERT INTO public.user_cosmetics (user_id, cosmetic_id)
    VALUES (p_user_id, v_item.cosmetic_id);
  ELSIF v_item.category = 'shield' THEN
    UPDATE public.streaks SET shield_count = shield_count + 1 WHERE student_id = p_user_id;
  END IF;
  
  -- Handle 'booster' here later if needed

  RETURN jsonb_build_object('success', true, 'message', 'Purchase successful!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SEED DATA
-- ============================================
-- Get some cosmetic IDs to link them to the shop
DO $$
DECLARE
  v_sunset_id UUID;
  v_forest_id UUID;
  v_silver_frame_id UUID;
  v_star_sticker_id UUID;
BEGIN
  SELECT id INTO v_sunset_id FROM public.cosmetics WHERE name = 'Sunset' AND type = 'theme' LIMIT 1;
  SELECT id INTO v_forest_id FROM public.cosmetics WHERE name = 'Forest' AND type = 'theme' LIMIT 1;
  SELECT id INTO v_silver_frame_id FROM public.cosmetics WHERE name = 'Silver Frame' AND type = 'frame' LIMIT 1;
  SELECT id INTO v_star_sticker_id FROM public.cosmetics WHERE name = 'Star' AND type = 'sticker' LIMIT 1;

  INSERT INTO public.shop_items (name, description, category, price_rp, price_coins, featured, cosmetic_id) VALUES
    ('Streak Shield', 'Protects your streak for 1 missed day.', 'shield', 0, 100, true, NULL),
    ('Sunset Theme', 'Warm orange glow for your profile.', 'theme', 0, 300, false, v_sunset_id),
    ('Forest Theme', 'Natural green tones for your profile.', 'theme', 0, 300, false, v_forest_id),
    ('Silver Frame', 'A shiny silver border for your avatar.', 'frame', 0, 750, true, v_silver_frame_id),
    ('Star Sticker', 'A shining star for dedicated students.', 'sticker', 0, 50, false, v_star_sticker_id);

EXCEPTION WHEN OTHERS THEN
  -- Ignore seed errors if cosmetics don't match exactly
  NULL;
END $$;
