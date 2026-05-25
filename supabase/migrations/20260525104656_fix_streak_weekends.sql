CREATE OR REPLACE FUNCTION public.process_attendance_streak()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_streak_record RECORD;
  v_eligible_days_missed INTEGER;
  v_last_date DATE;
  v_current_date DATE;
  v_active_days JSONB;
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

    -- Get active days for the school to determine weekends
    SELECT economy_config->'active_days' INTO v_active_days FROM public.reward_rules WHERE school_id = NEW.school_id;
    IF v_active_days IS NULL THEN
        v_active_days := '[1, 2, 3, 4, 5]'::jsonb;
    END IF;

    -- Calculate eligible missed days.
    -- We count days between v_last_date and v_current_date (exclusive of boundaries).
    -- We exclude Weekends (based on active_days) and Holidays.
    SELECT COUNT(*) INTO v_eligible_days_missed
    FROM generate_series(v_last_date + interval '1 day', v_current_date - interval '1 day', '1 day'::interval) as d(date)
    WHERE EXTRACT(DOW FROM d.date)::text IN (SELECT jsonb_array_elements_text(v_active_days))
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
