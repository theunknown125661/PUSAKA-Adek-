-- ============================================
-- Gamified Profile System (V2)
-- Run AFTER all previous schemas
-- ============================================

-- Add missing columns to profiles
DO $$
BEGIN
  -- Streak columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='streak_current') THEN
    ALTER TABLE public.profiles ADD COLUMN streak_current INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='streak_best') THEN
    ALTER TABLE public.profiles ADD COLUMN streak_best INTEGER DEFAULT 0;
  END IF;

  -- Avatar Config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_config') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_config JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Featured slots (Arrays or IDs)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='featured_badge_ids') THEN
    ALTER TABLE public.profiles ADD COLUMN featured_badge_ids UUID[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='featured_frame_id') THEN
    ALTER TABLE public.profiles ADD COLUMN featured_frame_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='featured_background_id') THEN
    ALTER TABLE public.profiles ADD COLUMN featured_background_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='featured_effect_id') THEN
    ALTER TABLE public.profiles ADD COLUMN featured_effect_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='featured_mascot_id') THEN
    ALTER TABLE public.profiles ADD COLUMN featured_mascot_id UUID;
  END IF;
END $$;

-- ============================================
-- TITLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.titles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')) DEFAULT 'COMMON',
  unlock_logic TEXT,
  visual_style TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads titles" ON public.titles;
CREATE POLICY "Anyone reads titles" ON public.titles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage titles" ON public.titles;
CREATE POLICY "Admins manage titles" ON public.titles FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- PROFILE SLOTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.profile_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slot_key TEXT NOT NULL UNIQUE,
  slot_type TEXT NOT NULL, -- 'BADGE', 'TITLE', 'FRAME', 'BACKGROUND', 'EFFECT'
  required_level INTEGER DEFAULT 1,
  required_badge_id UUID, -- Can reference badges(id) if needed
  is_public BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- RLS
ALTER TABLE public.profile_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads profile slots" ON public.profile_slots;
CREATE POLICY "Anyone reads profile slots" ON public.profile_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage profile slots" ON public.profile_slots;
CREATE POLICY "Admins manage profile slots" ON public.profile_slots FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- USER PROFILE SLOTS (Equipped Items)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profile_slots (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL REFERENCES public.profile_slots(slot_key) ON DELETE CASCADE,
  item_id UUID NOT NULL, -- References cosmetics or badges depending on slot_type
  equipped_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, slot_key)
);

-- RLS
ALTER TABLE public.user_profile_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own slot equipment" ON public.user_profile_slots;
CREATE POLICY "Users read own slot equipment" ON public.user_profile_slots FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own slot equipment" ON public.user_profile_slots;
CREATE POLICY "Users manage own slot equipment" ON public.user_profile_slots FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read all slot equipment" ON public.user_profile_slots;
CREATE POLICY "Admins read all slot equipment" ON public.user_profile_slots FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- SEED PROFILE SLOTS
-- ============================================
INSERT INTO public.profile_slots (slot_key, slot_type, required_level, sort_order) VALUES
('badge_1', 'BADGE', 1, 1),
('title', 'TITLE', 3, 2),
('badge_2', 'BADGE', 5, 3),
('frame', 'FRAME', 10, 4),
('background', 'BACKGROUND', 15, 5),
('badge_3', 'BADGE', 20, 6),
('effect', 'EFFECT', 25, 7)
ON CONFLICT (slot_key) DO NOTHING;

-- ============================================
-- SEED SAMPLE TITLES
-- ============================================
INSERT INTO public.titles (name, rarity, visual_style) VALUES
('Fresh Start', 'COMMON', 'text-muted-foreground'),
('Reliable', 'COMMON', 'text-emerald-500'),
('Streak Builder', 'RARE', 'text-amber-500 font-semibold'),
('Early Bird', 'RARE', 'text-sky-500 font-semibold'),
('Scholar', 'EPIC', 'text-purple-500 font-bold'),
('Gold Standard', 'LEGENDARY', 'text-yellow-500 font-bold animate-pulse')
ON CONFLICT DO NOTHING;
