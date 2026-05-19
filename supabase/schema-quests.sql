-- ============================================
-- Gamification System Migration — Phase 5 (Quests)
-- Run AFTER schema-badges.sql
-- ============================================

-- DROP existing tables to ensure a clean state (Development only)
DROP TABLE IF EXISTS public.user_quests CASCADE;
DROP TABLE IF EXISTS public.quests CASCADE;

-- ============================================
-- QUESTS DEFINITION
-- ============================================
CREATE TABLE IF NOT EXISTS public.quests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL, -- daily, weekly, special
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  requirement_type TEXT NOT NULL, -- checkin_count, early_bird_count, streak_reach
  requirement_value INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active quests" ON public.quests;
CREATE POLICY "Anyone reads active quests" ON public.quests FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins manage quests" ON public.quests;
CREATE POLICY "Admins manage quests" ON public.quests FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- USER QUESTS (Progress tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_quests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quest_id)
);

-- RLS
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own quests" ON public.user_quests;
CREATE POLICY "Users read own quests" ON public.user_quests FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- QUEST COMPLETION LOGIC
-- ============================================

-- Function to complete a quest and grant rewards
CREATE OR REPLACE FUNCTION public.complete_quest(p_user_id UUID, p_quest_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_quest RECORD;
  v_user_quest RECORD;
BEGIN
  -- Get the quest and user_quest
  SELECT * INTO v_quest FROM public.quests WHERE id = p_quest_id;
  SELECT * INTO v_user_quest FROM public.user_quests WHERE user_id = p_user_id AND quest_id = p_quest_id;
  
  IF NOT FOUND OR v_user_quest.status = 'completed' THEN
    RETURN false;
  END IF;

  -- Mark as completed
  UPDATE public.user_quests 
  SET status = 'completed', completed_at = now() 
  WHERE id = v_user_quest.id;

  -- Grant rewards
  UPDATE public.profiles 
  SET 
    xp = xp + v_quest.reward_xp,
    coins = coins + v_quest.reward_coins,
    level = FLOOR(SQRT((xp + v_quest.reward_xp) / 100.0)) + 1
  WHERE id = p_user_id;

  -- Log coin transaction
  IF v_quest.reward_coins > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
    VALUES (p_user_id, v_quest.reward_coins, 'quest', p_quest_id, 'Completed Quest: ' || v_quest.title);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO public.quests (title, description, type, reward_xp, reward_coins, requirement_type, requirement_value) VALUES
  ('First Step', 'Check in for the first time.', 'special', 50, 10, 'checkin_count', 1),
  ('Habit Builder', 'Check in 5 times total.', 'weekly', 200, 50, 'checkin_count', 5),
  ('Early Bird', 'Check in before the early cutoff once.', 'daily', 100, 20, 'early_bird_count', 1),
  ('Streak Starter', 'Reach a 5-day streak.', 'special', 150, 30, 'streak_reach', 5)
ON CONFLICT DO NOTHING;
