-- =========================================================================
-- RECURRING HOLIDAY MANAGER MIGRATION
-- =========================================================================

-- 1. Create holiday_tags table
CREATE TABLE IF NOT EXISTS public.holiday_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL = global preset
  name TEXT NOT NULL,
  icon_key TEXT,                                                   -- lucide icon name
  color_hex TEXT NOT NULL DEFAULT '#6366f1',
  is_preset BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create holiday_rules table
CREATE TABLE IF NOT EXISTS public.holiday_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recurrence_type TEXT NOT NULL DEFAULT 'one_time',                -- one_time, weekly, monthly, yearly, custom
  recurrence_value JSONB,                                          -- custom JSON data per recurrence type
  tag_id UUID REFERENCES public.holiday_tags(id) ON DELETE SET NULL,
  color_hex TEXT NOT NULL DEFAULT '#6366f1',
  start_date DATE NOT NULL,
  end_date DATE,                                                   -- limit of the holiday rules
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'school',                                -- school, teacher, student, custom
  pause_streaks BOOLEAN DEFAULT true,
  pause_attendance BOOLEAN DEFAULT true,
  hide_checkin BOOLEAN DEFAULT false,
  show_banner BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Alter holiday_calendar to add new columns and support rules linking
ALTER TABLE public.holiday_calendar
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.holiday_rules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.holiday_tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color_hex TEXT,
  ADD COLUMN IF NOT EXISTS pause_streaks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS pause_attendance BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_checkin BOOLEAN DEFAULT false;

-- 4. Enable RLS
ALTER TABLE public.holiday_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_rules ENABLE ROW LEVEL SECURITY;

-- 5. Set RLS Policies
DROP POLICY IF EXISTS "Anyone reads holiday tags" ON public.holiday_tags;
CREATE POLICY "Anyone reads holiday tags" ON public.holiday_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage holiday tags" ON public.holiday_tags;
CREATE POLICY "Admins manage holiday tags" ON public.holiday_tags FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Anyone reads holiday rules" ON public.holiday_rules;
CREATE POLICY "Anyone reads holiday rules" ON public.holiday_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage holiday rules" ON public.holiday_rules;
CREATE POLICY "Admins manage holiday rules" ON public.holiday_rules FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 6. Seed preset tags
INSERT INTO public.holiday_tags (name, icon_key, color_hex, is_preset) VALUES
  ('National Holiday', 'Flag', '#FF9F1C', true),
  ('Religious Holiday', 'Heart', '#2EC4B6', true),
  ('School Break', 'Calendar', '#FFBF69', true),
  ('Exam Period', 'BookOpen', '#895100', true),
  ('Special Event', 'Sparkles', '#FF99C8', true),
  ('Custom', 'Tag', '#6366f1', true)
ON CONFLICT DO NOTHING;

-- 7. Define generation function
CREATE OR REPLACE FUNCTION public.generate_holiday_dates(rule_id UUID, generation_end DATE DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  current_date_val DATE;
  calc_end DATE;
  day_val INT;
  month_val INT;
  date_str TEXT;
BEGIN
  -- Fetch the rule
  SELECT * INTO r FROM public.holiday_rules WHERE id = rule_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate the generation end date
  IF generation_end IS NOT NULL THEN
    calc_end := generation_end;
  ELSIF r.end_date IS NOT NULL THEN
    calc_end := r.end_date;
  ELSE
    calc_end := r.start_date + INTERVAL '12 months';
  END IF;

  -- Resolve based on recurrence type
  IF r.recurrence_type = 'one_time' THEN
    -- One time rule is easy, generate all days from start_date to calc_end (which is either rule's end_date or start_date if null)
    calc_end := COALESCE(r.end_date, r.start_date);
    FOR current_date_val IN 
      SELECT d::date FROM generate_series(r.start_date, calc_end, '1 day'::interval) d
    LOOP
      INSERT INTO public.holiday_calendar (
        school_id, date, name, type, description, rule_id, tag_id, color_hex, pause_streaks, pause_attendance, hide_checkin
      ) VALUES (
        r.school_id, current_date_val, r.name, r.recurrence_type, r.description, r.id, r.tag_id, r.color_hex, r.pause_streaks, r.pause_attendance, r.hide_checkin
      ) ON CONFLICT (school_id, date) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        description = EXCLUDED.description,
        rule_id = EXCLUDED.rule_id,
        tag_id = EXCLUDED.tag_id,
        color_hex = EXCLUDED.color_hex,
        pause_streaks = EXCLUDED.pause_streaks,
        pause_attendance = EXCLUDED.pause_attendance,
        hide_checkin = EXCLUDED.hide_checkin;
    END LOOP;

  ELSIF r.recurrence_type = 'weekly' THEN
    day_val := (r.recurrence_value->>'day_of_week')::INT;
    IF day_val IS NOT NULL THEN
      FOR current_date_val IN 
        SELECT d::date FROM generate_series(r.start_date, calc_end, '1 day'::interval) d
        WHERE EXTRACT(dow FROM d) = day_val
      LOOP
        INSERT INTO public.holiday_calendar (
          school_id, date, name, type, description, rule_id, tag_id, color_hex, pause_streaks, pause_attendance, hide_checkin
        ) VALUES (
          r.school_id, current_date_val, r.name, r.recurrence_type, r.description, r.id, r.tag_id, r.color_hex, r.pause_streaks, r.pause_attendance, r.hide_checkin
        ) ON CONFLICT (school_id, date) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          rule_id = EXCLUDED.rule_id,
          tag_id = EXCLUDED.tag_id,
          color_hex = EXCLUDED.color_hex,
          pause_streaks = EXCLUDED.pause_streaks,
          pause_attendance = EXCLUDED.pause_attendance,
          hide_checkin = EXCLUDED.hide_checkin;
      END LOOP;
    END IF;

  ELSIF r.recurrence_type = 'monthly' THEN
    day_val := (r.recurrence_value->>'day_of_month')::INT;
    IF day_val IS NOT NULL THEN
      FOR current_date_val IN 
        SELECT d::date FROM generate_series(r.start_date, calc_end, '1 day'::interval) d
        WHERE EXTRACT(day FROM d) = day_val
      LOOP
        INSERT INTO public.holiday_calendar (
          school_id, date, name, type, description, rule_id, tag_id, color_hex, pause_streaks, pause_attendance, hide_checkin
        ) VALUES (
          r.school_id, current_date_val, r.name, r.recurrence_type, r.description, r.id, r.tag_id, r.color_hex, r.pause_streaks, r.pause_attendance, r.hide_checkin
        ) ON CONFLICT (school_id, date) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          rule_id = EXCLUDED.rule_id,
          tag_id = EXCLUDED.tag_id,
          color_hex = EXCLUDED.color_hex,
          pause_streaks = EXCLUDED.pause_streaks,
          pause_attendance = EXCLUDED.pause_attendance,
          hide_checkin = EXCLUDED.hide_checkin;
      END LOOP;
    END IF;

  ELSIF r.recurrence_type = 'yearly' THEN
    month_val := (r.recurrence_value->>'month')::INT;
    day_val := (r.recurrence_value->>'day')::INT;
    IF month_val IS NOT NULL AND day_val IS NOT NULL THEN
      FOR current_date_val IN
        SELECT make_date(y, month_val, day_val)
        FROM generate_series(EXTRACT(year FROM r.start_date)::int, EXTRACT(year FROM calc_end)::int) y
      LOOP
        IF current_date_val >= r.start_date AND current_date_val <= calc_end THEN
          INSERT INTO public.holiday_calendar (
            school_id, date, name, type, description, rule_id, tag_id, color_hex, pause_streaks, pause_attendance, hide_checkin
          ) VALUES (
            r.school_id, current_date_val, r.name, r.recurrence_type, r.description, r.id, r.tag_id, r.color_hex, r.pause_streaks, r.pause_attendance, r.hide_checkin
          ) ON CONFLICT (school_id, date) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            rule_id = EXCLUDED.rule_id,
            tag_id = EXCLUDED.tag_id,
            color_hex = EXCLUDED.color_hex,
            pause_streaks = EXCLUDED.pause_streaks,
            pause_attendance = EXCLUDED.pause_attendance,
            hide_checkin = EXCLUDED.hide_checkin;
        END IF;
      END LOOP;
    END IF;

  ELSIF r.recurrence_type = 'custom' THEN
    IF jsonb_typeof(r.recurrence_value->'dates') = 'array' THEN
      FOR date_str IN SELECT jsonb_array_elements_text(r.recurrence_value->'dates') LOOP
        current_date_val := date_str::DATE;
        IF current_date_val >= r.start_date AND current_date_val <= calc_end THEN
          INSERT INTO public.holiday_calendar (
            school_id, date, name, type, description, rule_id, tag_id, color_hex, pause_streaks, pause_attendance, hide_checkin
          ) VALUES (
            r.school_id, current_date_val, r.name, r.recurrence_type, r.description, r.id, r.tag_id, r.color_hex, r.pause_streaks, r.pause_attendance, r.hide_checkin
          ) ON CONFLICT (school_id, date) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            rule_id = EXCLUDED.rule_id,
            tag_id = EXCLUDED.tag_id,
            color_hex = EXCLUDED.color_hex,
            pause_streaks = EXCLUDED.pause_streaks,
            pause_attendance = EXCLUDED.pause_attendance,
            hide_checkin = EXCLUDED.hide_checkin;
        END IF;
      END LOOP;
    END IF;

  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create Sync Trigger Function
CREATE OR REPLACE FUNCTION public.trg_sync_holiday_rule_calendar()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.holiday_calendar WHERE rule_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM public.holiday_calendar WHERE rule_id = NEW.id;
  END IF;

  IF NEW.is_active = true THEN
    PERFORM public.generate_holiday_dates(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Bind Trigger to Table
DROP TRIGGER IF EXISTS trg_sync_holiday_rule ON public.holiday_rules;
CREATE TRIGGER trg_sync_holiday_rule
  AFTER INSERT OR UPDATE OR DELETE ON public.holiday_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_holiday_rule_calendar();
