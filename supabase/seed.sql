-- ============================================
-- School Present Reward — Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================
-- IMPORTANT: You must first create these 3 users in Supabase Auth (Dashboard > Authentication > Users):
--   1. admin@school.test / Test1234!  (set metadata: {"role": "admin", "full_name": "Admin Utama"})
--   2. teacher@school.test / Test1234! (set metadata: {"role": "teacher", "full_name": "Ibu Sari"})
--   3. student@school.test / Test1234! (set metadata: {"role": "student", "full_name": "Budi Santoso"})
--
-- After creating users, copy their UUIDs below:
-- Replace these placeholder UUIDs with the real ones from auth.users

DO $$
DECLARE
  v_admin_id UUID;
  v_teacher_id UUID;
  v_student_id UUID;
  v_school_id UUID;
  v_class_a_id UUID;
  v_class_b_id UUID;
  v_wallet_id UUID;
BEGIN

  -- Get user IDs from auth (match by email)
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@school.test';
  SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'teacher@school.test';
  SELECT id INTO v_student_id FROM auth.users WHERE email = 'student@school.test';

  -- Skip if users not found
  IF v_admin_id IS NULL OR v_teacher_id IS NULL OR v_student_id IS NULL THEN
    RAISE NOTICE 'Please create the 3 test users in Auth first.';
    RETURN;
  END IF;

  -- ==========================================
  -- SCHOOL
  -- ==========================================
  INSERT INTO public.schools (id, name, address, latitude, longitude, radius_m, timezone)
  VALUES (uuid_generate_v4(), 'SMA Nusantara', 'Jl. Pendidikan No. 1, Jakarta', -6.2088, 106.8456, 200, 'Asia/Jakarta')
  RETURNING id INTO v_school_id;

  -- Update profiles with school
  UPDATE public.profiles SET school_id = v_school_id WHERE id IN (v_admin_id, v_teacher_id, v_student_id);

  -- ==========================================
  -- CLASSES
  -- ==========================================
  INSERT INTO public.classes (id, school_id, name, grade_level)
  VALUES (uuid_generate_v4(), v_school_id, 'XII IPA-1', '12')
  RETURNING id INTO v_class_a_id;

  INSERT INTO public.classes (id, school_id, name, grade_level)
  VALUES (uuid_generate_v4(), v_school_id, 'XII IPA-2', '12')
  RETURNING id INTO v_class_b_id;

  -- ==========================================
  -- ASSIGNMENTS & ENROLLMENTS
  -- ==========================================
  INSERT INTO public.teacher_class_assignments (teacher_id, class_id) VALUES (v_teacher_id, v_class_a_id);
  INSERT INTO public.teacher_class_assignments (teacher_id, class_id) VALUES (v_teacher_id, v_class_b_id);
  INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_a_id);

  -- ==========================================
  -- REWARD RULES
  -- ==========================================
  INSERT INTO public.reward_rules (school_id, base_reward, early_bonus, monthly_hold_bonus_pct, attendance_start_time, attendance_end_time, early_cutoff_time, min_withdrawal_amount)
  VALUES (v_school_id, 5000, 2000, 5.00, '06:00', '09:00', '06:45', 10000);

  -- ==========================================
  -- WALLET
  -- ==========================================
  INSERT INTO public.wallets (id, student_id, pending_balance, available_balance, held_balance)
  VALUES (uuid_generate_v4(), v_student_id, 5000, 25000, 10000)
  RETURNING id INTO v_wallet_id;

  -- Sample transactions
  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description) VALUES
    (v_wallet_id, 'attendance_reward', 5000, 'Attendance reward 12 May 2026'),
    (v_wallet_id, 'attendance_reward', 5000, 'Attendance reward 13 May 2026'),
    (v_wallet_id, 'early_bonus', 2000, 'Early bird bonus 13 May 2026'),
    (v_wallet_id, 'attendance_reward', 5000, 'Attendance reward 14 May 2026'),
    (v_wallet_id, 'attendance_reward', 5000, 'Attendance reward 15 May 2026'),
    (v_wallet_id, 'early_bonus', 2000, 'Early bird bonus 15 May 2026'),
    (v_wallet_id, 'hold_lock', 10000, 'Monthly hold locked'),
    (v_wallet_id, 'withdrawal', 4000, 'Withdrawal processed');

  -- ==========================================
  -- SAMPLE ATTENDANCE
  -- ==========================================
  INSERT INTO public.attendance_logs (student_id, class_id, school_id, attendance_date, submitted_at, latitude, longitude, accuracy_m, distance_m, within_radius, within_time_window, before_early_cutoff, status) VALUES
    (v_student_id, v_class_a_id, v_school_id, CURRENT_DATE - 5, now() - interval '5 days', -6.2090, 106.8458, 15, 30, true, true, true, 'approved'),
    (v_student_id, v_class_a_id, v_school_id, CURRENT_DATE - 4, now() - interval '4 days', -6.2091, 106.8457, 20, 45, true, true, false, 'approved'),
    (v_student_id, v_class_a_id, v_school_id, CURRENT_DATE - 3, now() - interval '3 days', -6.2085, 106.8460, 12, 55, true, true, true, 'approved'),
    (v_student_id, v_class_a_id, v_school_id, CURRENT_DATE - 2, now() - interval '2 days', -6.2100, 106.8470, 50, 180, true, true, false, 'pending_admin_review'),
    (v_student_id, v_class_a_id, v_school_id, CURRENT_DATE - 1, now() - interval '1 day', -6.2200, 106.8500, 80, 1350, false, true, false, 'rejected');

  -- ==========================================
  -- BADGES
  -- ==========================================
  INSERT INTO public.badges (name, description, icon, criteria_type, criteria_value) VALUES
    ('First Step', 'Complete your first approved attendance', 'footprints', 'approved_count', 1),
    ('5-Day Streak', 'Maintain a 5-day attendance streak', 'flame', 'streak', 5),
    ('Consistent 20', 'Reach 20 approved attendance days', 'target', 'approved_count', 20),
    ('Early Bird x5', 'Arrive early 5 times', 'sunrise', 'early_count', 5),
    ('Perfect Week', 'Attend all 5 days in a week', 'trophy', 'perfect_week', 1),
    ('Perfect Month', 'Attend all school days in a month', 'crown', 'perfect_month', 1),
    ('Dedicated 50', 'Reach 50 approved attendance days', 'medal', 'approved_count', 50);

  -- Award sample badge
  INSERT INTO public.student_badges (student_id, badge_id)
  SELECT v_student_id, id FROM public.badges WHERE criteria_type = 'approved_count' AND criteria_value = 1;

  -- ==========================================
  -- SYSTEM SETTINGS
  -- ==========================================
  INSERT INTO public.system_settings (key, value, school_id) VALUES
    ('monthly_hold_release_day', '28', v_school_id),
    ('max_weekly_withdrawals', '1', v_school_id);

  RAISE NOTICE 'Seed data inserted successfully!';
END $$;
