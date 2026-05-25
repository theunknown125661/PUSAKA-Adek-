-- 1. Add school_id and class_id to badges
ALTER TABLE badges ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_badges_school_id ON badges(school_id);
CREATE INDEX IF NOT EXISTS idx_badges_class_id ON badges(class_id);

-- 2. Add school_id and class_id to shop_items
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_shop_items_school_id ON shop_items(school_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_class_id ON shop_items(class_id);

-- 3. Add school_id and class_id to quests
ALTER TABLE quests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quests_school_id ON quests(school_id);
CREATE INDEX IF NOT EXISTS idx_quests_class_id ON quests(class_id);

-- 4. Add class_id to holiday_rules and holiday_calendar
ALTER TABLE holiday_rules ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_holiday_rules_class_id ON holiday_rules(class_id);

ALTER TABLE holiday_calendar ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_class_id ON holiday_calendar(class_id);

-- 5. Drop existing restrictive policies and create scoped ones
-- Quests
DROP POLICY IF EXISTS "Anyone reads active quests" ON quests;
CREATE POLICY "Anyone reads active quests" ON quests FOR SELECT USING (
  active = true AND 
  (school_id IS NULL OR school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())) AND
  (class_id IS NULL OR class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid()))
);

-- Shop Items
DROP POLICY IF EXISTS "Anyone reads active shop items" ON shop_items;
CREATE POLICY "Anyone reads active shop items" ON shop_items FOR SELECT USING (
  active = true AND 
  (school_id IS NULL OR school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())) AND
  (class_id IS NULL OR class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid()))
);

-- Badges
DROP POLICY IF EXISTS "Anyone reads active badges" ON badges;
CREATE POLICY "Anyone reads active badges" ON badges FOR SELECT USING (
  active = true AND 
  (school_id IS NULL OR school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())) AND
  (class_id IS NULL OR class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid()))
);

-- Admins see all for their managed schools
DROP POLICY IF EXISTS "Admins read all shop items" ON shop_items;
CREATE POLICY "Admins read all shop items" ON shop_items FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Admins read all badges" ON badges;
CREATE POLICY "Admins read all badges" ON badges FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "Admins read all quests" ON quests;
CREATE POLICY "Admins read all quests" ON quests FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

-- 6. Update Gamification Triggers to respect scoping
CREATE OR REPLACE FUNCTION public.evaluate_streak_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
  v_rule_val INTEGER;
  v_school_id UUID;
BEGIN
  -- Only evaluate if longest_streak actually increased
  IF NEW.longest_streak > OLD.longest_streak THEN
    
    -- Get user's school_id for filtering
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = NEW.student_id;
    
    FOR v_badge IN 
      SELECT * FROM public.badges 
      WHERE active = true 
      AND unlock_rule->>'type' = 'streak'
      AND (school_id IS NULL OR school_id = v_school_id)
      AND (class_id IS NULL OR class_id IN (SELECT class_id FROM public.enrollments WHERE student_id = NEW.student_id))
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
      AND (school_id IS NULL OR school_id = NEW.school_id)
      AND (class_id IS NULL OR class_id IN (SELECT class_id FROM public.enrollments WHERE student_id = NEW.id))
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
