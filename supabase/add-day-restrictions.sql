-- ============================================
-- ATTENDANCE DAY RESTRICTIONS (WEEKENDS & HOLIDAYS)
-- ============================================

CREATE OR REPLACE FUNCTION public.check_attendance_day_restrictions()
RETURNS TRIGGER AS $$
DECLARE
  v_is_holiday BOOLEAN;
  v_config JSONB;
  v_active_days JSONB;
  v_day_of_week INTEGER;
BEGIN
  -- 1. Check if the date is a holiday that hides check-in
  SELECT EXISTS (
    SELECT 1 FROM public.holiday_calendar
    WHERE school_id = NEW.school_id
      AND date = NEW.attendance_date
      AND hide_checkin = true
  ) INTO v_is_holiday;

  IF v_is_holiday THEN
    RAISE EXCEPTION 'Attendance submissions are blocked on holidays.';
  END IF;

  -- 2. Check if today is an active school day
  SELECT economy_config INTO v_config
  FROM public.reward_rules
  WHERE school_id = NEW.school_id;

  -- Get active days, fallback to [1, 2, 3, 4, 5] (Mon-Fri) if null or missing
  IF v_config IS NULL OR NOT (v_config ? 'active_days') THEN
    v_active_days := '[1, 2, 3, 4, 5]'::jsonb;
  ELSE
    v_active_days := v_config->'active_days';
  END IF;

  -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM NEW.attendance_date)::INTEGER;

  IF NOT (v_active_days @> jsonb_build_array(v_day_of_week)) THEN
    RAISE EXCEPTION 'Attendance submissions are not permitted on weekends or scheduled off-days.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger BEFORE INSERT on attendance_logs
DROP TRIGGER IF EXISTS trg_check_attendance_day_restrictions ON public.attendance_logs;
CREATE TRIGGER trg_check_attendance_day_restrictions
  BEFORE INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_day_restrictions();
