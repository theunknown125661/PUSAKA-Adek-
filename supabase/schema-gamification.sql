-- ============================================
-- Gamification System Migration — Phase 1 & 2
-- Run AFTER schema-profile.sql
-- ============================================

-- ============================================
-- ADD ECONOMY COLUMNS TO PROFILES (Phase 2 prep)
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;

-- ============================================
-- STREAKS TABLE (Phase 1)
-- ============================================
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_attendance_date DATE,
  shield_count INTEGER NOT NULL DEFAULT 0,
  shield_used_dates DATE[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own streak" ON public.streaks;
CREATE POLICY "Users read own streak" ON public.streaks FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all streaks" ON public.streaks;
CREATE POLICY "Admins read all streaks" ON public.streaks FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

-- Trigger to create empty streak on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_streak() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO public.streaks (student_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_streak') THEN
    CREATE TRIGGER on_auth_user_created_streak
      AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_streak();
  END IF;
END
$$;

-- Create streaks for existing students
INSERT INTO public.streaks (student_id)
SELECT id FROM public.profiles WHERE role = 'student'
ON CONFLICT (student_id) DO NOTHING;


-- ============================================
-- HOLIDAY CALENDAR (Phase 1)
-- ============================================
CREATE TABLE IF NOT EXISTS public.holiday_calendar (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- national, school, exam
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, date)
);

-- RLS
ALTER TABLE public.holiday_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads holidays" ON public.holiday_calendar;
CREATE POLICY "Anyone reads holidays" ON public.holiday_calendar FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage holidays" ON public.holiday_calendar;
CREATE POLICY "Admins manage holidays" ON public.holiday_calendar FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- STREAK ENGINE TRIGGER
-- ============================================
-- This function runs when an attendance log is approved.
-- It correctly handles holidays and weekends (assuming Mon-Fri school).
CREATE OR REPLACE FUNCTION public.process_attendance_streak()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_streak_record RECORD;
  v_eligible_days_missed INTEGER;
  v_last_date DATE;
  v_current_date DATE;
BEGIN
  -- Only act when status changes TO approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    v_current_date := NEW.attendance_date;
    
    -- Get or create streak record
    SELECT * INTO v_streak_record FROM public.streaks WHERE student_id = NEW.student_id;
    IF NOT FOUND THEN
       INSERT INTO public.streaks (student_id, current_streak, longest_streak, last_attendance_date)
       VALUES (NEW.student_id, 1, 1, v_current_date)
       RETURNING * INTO v_streak_record;
       RETURN NEW;
    END IF;

    v_last_date := v_streak_record.last_attendance_date;

    -- If no previous attendance, just start at 1
    IF v_last_date IS NULL THEN
       UPDATE public.streaks SET 
         current_streak = 1, 
         longest_streak = 1, 
         last_attendance_date = v_current_date,
         updated_at = now()
       WHERE id = v_streak_record.id;
       RETURN NEW;
    END IF;

    -- If attending same day twice (shouldn't happen due to unique constraint, but safe)
    IF v_last_date = v_current_date THEN
       RETURN NEW;
    END IF;

    -- Calculate eligible missed days.
    -- We count days between v_last_date and v_current_date (exclusive of boundaries).
    -- We exclude Weekends (Sat=6, Sun=0 in extract DOW) and Holidays.
    SELECT COUNT(*) INTO v_eligible_days_missed
    FROM generate_series(v_last_date + interval '1 day', v_current_date - interval '1 day', '1 day'::interval) as d(date)
    WHERE EXTRACT(DOW FROM d.date) NOT IN (0, 6) -- not weekend
    AND d.date::date NOT IN (
      SELECT date FROM public.holiday_calendar WHERE school_id = NEW.school_id
    );

    IF v_eligible_days_missed = 0 THEN
       -- Consecutive eligible day! Increase streak.
       UPDATE public.streaks SET
         current_streak = v_streak_record.current_streak + 1,
         longest_streak = GREATEST(v_streak_record.longest_streak, v_streak_record.current_streak + 1),
         last_attendance_date = v_current_date,
         updated_at = now()
       WHERE id = v_streak_record.id;
       
    ELSIF v_eligible_days_missed = 1 AND v_streak_record.shield_count > 0 THEN
       -- Missed 1 eligible day, but has a shield!
       UPDATE public.streaks SET
         current_streak = v_streak_record.current_streak + 1, -- +1 for today, shield covered the miss
         longest_streak = GREATEST(v_streak_record.longest_streak, v_streak_record.current_streak + 1),
         last_attendance_date = v_current_date,
         shield_count = v_streak_record.shield_count - 1,
         shield_used_dates = array_append(v_streak_record.shield_used_dates, (v_current_date - interval '1 day')::date),
         updated_at = now()
       WHERE id = v_streak_record.id;
       
    ELSE
       -- Streak broken. Reset.
       UPDATE public.streaks SET
         current_streak = 1,
         last_attendance_date = v_current_date,
         updated_at = now()
       WHERE id = v_streak_record.id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attendance updates
DROP TRIGGER IF EXISTS on_attendance_approved_update_streak ON public.attendance_logs;
CREATE TRIGGER on_attendance_approved_update_streak
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_streak();

-- Trigger for attendance inserts (if inserted already approved)
DROP TRIGGER IF EXISTS on_attendance_insert_update_streak ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert_update_streak
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_streak();

-- ============================================
-- COIN TRANSACTIONS (Phase 2)
-- ============================================
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users read own coin transactions" ON public.coin_transactions FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- ECONOMY ENGINE TRIGGER (XP & Coins)
-- ============================================
CREATE OR REPLACE FUNCTION public.process_attendance_economy()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_xp_reward INTEGER := 100;
  v_coin_reward INTEGER := 10;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Only act when status changes TO approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Bonus for early
    IF NEW.before_early_cutoff = true THEN
      v_xp_reward := v_xp_reward + 50;
      v_coin_reward := v_coin_reward + 5;
    END IF;

    -- Insert coin transaction log
    INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
    VALUES (NEW.student_id, v_coin_reward, 'attendance', NEW.id, 'Daily Check-in Reward');

    -- Update Profile (add XP and Coins, recalculate level based on simple formula: Level = Floor(SQRT(XP/100)) + 1 )
    UPDATE public.profiles
    SET 
      xp = xp + v_xp_reward,
      coins = coins + v_coin_reward,
      level = FLOOR(SQRT((xp + v_xp_reward) / 100.0)) + 1
    WHERE id = NEW.student_id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_attendance_approved_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_approved_update_economy
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy();

DROP TRIGGER IF EXISTS on_attendance_insert_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert_update_economy
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy();
