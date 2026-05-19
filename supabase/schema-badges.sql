-- ============================================
-- Gamification System Migration — Phase 4 (Badges)
-- Run AFTER schema-shop.sql
-- ============================================

-- DROP existing tables to ensure a clean state (Development only)
DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;

-- ============================================
-- BADGES DEFINITION
-- ============================================
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- Lucide icon name or emoji
  rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
  family TEXT NOT NULL, -- streak, level, early_bird, etc.
  unlock_rule JSONB NOT NULL, -- e.g., {"type": "streak", "value": 7}
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active badges" ON public.badges;
CREATE POLICY "Anyone reads active badges" ON public.badges FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins manage badges" ON public.badges;
CREATE POLICY "Admins manage badges" ON public.badges FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- USER BADGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  is_new BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, badge_id)
);

-- RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own badges" ON public.user_badges;
CREATE POLICY "Users read own badges" ON public.user_badges FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone reads all user badges" ON public.user_badges;
CREATE POLICY "Anyone reads all user badges" ON public.user_badges FOR SELECT USING (true); -- Public profiles might want to see badges

-- ============================================
-- BADGE EVALUATION ENGINE (TRIGGER FUNCTIONS)
-- ============================================

-- Function to evaluate STREAK badges
CREATE OR REPLACE FUNCTION public.evaluate_streak_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
  v_rule_val INTEGER;
BEGIN
  -- Only evaluate if longest_streak actually increased
  IF NEW.longest_streak > OLD.longest_streak THEN
    FOR v_badge IN 
      SELECT * FROM public.badges 
      WHERE active = true 
      AND unlock_rule->>'type' = 'streak'
      AND NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = NEW.student_id AND ub.badge_id = badges.id)
    LOOP
      v_rule_val := (v_badge.unlock_rule->>'value')::INTEGER;
      IF NEW.longest_streak >= v_rule_val THEN
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.student_id, v_badge.id);
        
        -- Optionally, grant coins for unlocking a badge
        INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
        VALUES (NEW.student_id, 50, 'badge_unlock', v_badge.id, 'Badge Unlocked: ' || v_badge.name);
        
        UPDATE public.profiles SET coins = coins + 50 WHERE id = NEW.student_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_streak_update_evaluate_badges ON public.streaks;
CREATE TRIGGER on_streak_update_evaluate_badges
  AFTER UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_streak_badges();

-- Function to evaluate LEVEL badges
CREATE OR REPLACE FUNCTION public.evaluate_level_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
  v_rule_val INTEGER;
BEGIN
  -- Only evaluate if level actually increased
  IF NEW.level > OLD.level THEN
    FOR v_badge IN 
      SELECT * FROM public.badges 
      WHERE active = true 
      AND unlock_rule->>'type' = 'level'
      AND NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = NEW.id AND ub.badge_id = badges.id)
    LOOP
      v_rule_val := (v_badge.unlock_rule->>'value')::INTEGER;
      IF NEW.level >= v_rule_val THEN
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.id, v_badge.id);
        
        INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
        VALUES (NEW.id, 50, 'badge_unlock', v_badge.id, 'Badge Unlocked: ' || v_badge.name);
        
        UPDATE public.profiles SET coins = coins + 50 WHERE id = NEW.id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_evaluate_badges ON public.profiles;
CREATE TRIGGER on_profile_update_evaluate_badges
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_level_badges();


-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO public.badges (name, description, icon, rarity, family, unlock_rule) VALUES
  ('Spark', 'Achieve a 3-day streak.', 'Flame', 'common', 'streak', '{"type": "streak", "value": 3}'),
  ('Fireball', 'Achieve a 7-day streak.', 'Flame', 'rare', 'streak', '{"type": "streak", "value": 7}'),
  ('Inferno', 'Achieve a 30-day streak.', 'Flame', 'epic', 'streak', '{"type": "streak", "value": 30}'),
  ('Sun God', 'Achieve a 100-day streak.', 'Sun', 'legendary', 'streak', '{"type": "streak", "value": 100}'),
  ('Rising Star', 'Reach Level 5.', 'Star', 'common', 'level', '{"type": "level", "value": 5}'),
  ('Shooting Star', 'Reach Level 15.', 'Star', 'rare', 'level', '{"type": "level", "value": 15}'),
  ('Supernova', 'Reach Level 50.', 'Star', 'legendary', 'level', '{"type": "level", "value": 50}')
ON CONFLICT DO NOTHING;
