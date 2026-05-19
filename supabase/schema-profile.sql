-- ============================================
-- Profile System Migration — Phase 1
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- NEW COLUMNS ON profiles
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_mode TEXT NOT NULL DEFAULT 'initials';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frame_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sticker_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- COSMETICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cosmetics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,  -- frame / theme / title / sticker
  name TEXT NOT NULL,
  description TEXT,
  asset_url TEXT,
  css_value TEXT,      -- For themes: CSS color value
  rarity TEXT NOT NULL DEFAULT 'common',  -- common / rare / epic
  unlock_type TEXT NOT NULL DEFAULT 'milestone',  -- milestone / admin / seasonal
  unlock_rule JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- USER COSMETICS (unlocked + equipped tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  equipped BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, cosmetic_id)
);

-- ============================================
-- PROFILE MODERATION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.profile_moderation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,  -- bio / avatar / username
  action TEXT NOT NULL,       -- approve / hide / remove / warn
  reason TEXT,
  note TEXT,
  moderated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cosmetics_type ON public.cosmetics(type);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_user ON public.user_cosmetics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_equipped ON public.user_cosmetics(user_id, equipped) WHERE equipped = true;
CREATE INDEX IF NOT EXISTS idx_profile_mod_user ON public.profile_moderation_logs(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_moderation_logs ENABLE ROW LEVEL SECURITY;

-- Cosmetics: anyone can read, admins manage
CREATE POLICY "Anyone reads cosmetics" ON public.cosmetics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cosmetics" ON public.cosmetics FOR ALL USING (get_my_role() = 'admin');

-- User cosmetics: users read own, admins manage
CREATE POLICY "Users read own cosmetics" ON public.user_cosmetics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users equip own cosmetics" ON public.user_cosmetics FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins manage user cosmetics" ON public.user_cosmetics FOR ALL USING (get_my_role() = 'admin');

-- Moderation logs: admins only
CREATE POLICY "Admins manage moderation logs" ON public.profile_moderation_logs FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- FK REFERENCES for profile equipped cosmetics
-- ============================================
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_theme FOREIGN KEY (theme_id) REFERENCES public.cosmetics(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_title FOREIGN KEY (title_id) REFERENCES public.cosmetics(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_frame FOREIGN KEY (frame_id) REFERENCES public.cosmetics(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_sticker FOREIGN KEY (sticker_id) REFERENCES public.cosmetics(id) ON DELETE SET NULL;

-- ============================================
-- STORAGE BUCKET for profile photos
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own profile photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own profile photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone reads profile photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos');

-- ============================================
-- SEED COSMETICS
-- ============================================

-- Frames
INSERT INTO public.cosmetics (type, name, description, rarity, unlock_type, unlock_rule) VALUES
  ('frame', 'Bronze Frame', 'Earned by maintaining a 7-day attendance streak', 'common', 'milestone', '{"type": "streak", "value": 7}'),
  ('frame', 'Silver Frame', 'Earned by maintaining a 14-day attendance streak', 'rare', 'milestone', '{"type": "streak", "value": 14}'),
  ('frame', 'Gold Frame', 'Earned by maintaining a 30-day attendance streak', 'epic', 'milestone', '{"type": "streak", "value": 30}'),
  ('frame', 'Scholar Frame', 'Earned by reaching 50 approved check-ins', 'epic', 'milestone', '{"type": "approved_count", "value": 50}');

-- Titles
INSERT INTO public.cosmetics (type, name, description, rarity, unlock_type, unlock_rule) VALUES
  ('title', 'Newcomer', 'Default title for all students', 'common', 'milestone', '{"type": "approved_count", "value": 0}'),
  ('title', 'Regular', 'Complete 10 approved check-ins', 'common', 'milestone', '{"type": "approved_count", "value": 10}'),
  ('title', 'Perfect Week', 'Attend all 5 days in a week', 'rare', 'milestone', '{"type": "perfect_week", "value": 1}'),
  ('title', 'Attendance Hero', 'Maintain a 30-day attendance streak', 'epic', 'milestone', '{"type": "streak", "value": 30}'),
  ('title', 'Early Bird Champion', 'Arrive early 10 times', 'rare', 'milestone', '{"type": "early_count", "value": 10}');

-- Themes (css_value stores the HSL primary color)
INSERT INTO public.cosmetics (type, name, description, css_value, rarity, unlock_type, unlock_rule) VALUES
  ('theme', 'Default', 'The classic look', '#0d9488', 'common', 'milestone', '{"type": "approved_count", "value": 0}'),
  ('theme', 'Ocean', 'Cool blue vibes', '#2563eb', 'common', 'milestone', '{"type": "approved_count", "value": 5}'),
  ('theme', 'Sunset', 'Warm orange glow', '#ea580c', 'common', 'milestone', '{"type": "approved_count", "value": 10}'),
  ('theme', 'Night Sky', 'Deep purple ambiance', '#7c3aed', 'rare', 'milestone', '{"type": "streak", "value": 7}'),
  ('theme', 'Forest', 'Natural green tones', '#059669', 'rare', 'milestone', '{"type": "streak", "value": 14}'),
  ('theme', 'Sunrise', 'Golden morning energy', '#d97706', 'epic', 'milestone', '{"type": "streak", "value": 30}'),
  ('theme', 'Rose', 'Elegant pink vibes', '#e11d48', 'rare', 'milestone', '{"type": "approved_count", "value": 20}'),
  ('theme', 'Midnight', 'Sleek dark blue', '#1e40af', 'epic', 'milestone', '{"type": "streak", "value": 21}');

-- Stickers
INSERT INTO public.cosmetics (type, name, description, rarity, unlock_type, unlock_rule) VALUES
  ('sticker', 'Star', 'A shining star for dedicated students', 'common', 'milestone', '{"type": "approved_count", "value": 5}'),
  ('sticker', 'Lightning', 'Speed and consistency', 'rare', 'milestone', '{"type": "early_count", "value": 5}'),
  ('sticker', 'Crown', 'For the top achievers', 'epic', 'milestone', '{"type": "streak", "value": 30}');
