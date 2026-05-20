-- ============================================
-- School Present Reward — Database Schema
-- Run this in Supabase SQL Editor (Clean Slate Version)
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLEAN UP EXISTING OBJECTS (Allows Re-running)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.process_monthly_hold() CASCADE;
DROP FUNCTION IF EXISTS public.process_withdrawal() CASCADE;
DROP FUNCTION IF EXISTS public.credit_wallet() CASCADE;
DROP FUNCTION IF EXISTS public.teacher_has_class() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.student_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.withdrawal_requests CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.reward_rules CASCADE;
DROP TABLE IF EXISTS public.teacher_notes CASCADE;
DROP TABLE IF EXISTS public.attendance_reviews CASCADE;
DROP TABLE IF EXISTS public.attendance_logs CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.teacher_class_assignments CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;

-- Drop custom ENUM types
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS withdrawal_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Drop storage policies
DROP POLICY IF EXISTS "Users upload own selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anyone reads selfies" ON storage.objects;

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE attendance_status AS ENUM ('pending_teacher_view', 'pending_admin_review', 'approved', 'rejected');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE transaction_type AS ENUM ('attendance_reward', 'early_bonus', 'monthly_hold_bonus', 'withdrawal', 'hold_lock', 'hold_release');

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  school_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schools
CREATE TABLE public.schools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 200,
  accuracy_tolerance_m INTEGER NOT NULL DEFAULT 100,
  timezone TEXT DEFAULT 'Asia/Jakarta',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK after schools exists
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_school FOREIGN KEY (school_id) REFERENCES public.schools(id);

-- Classes
CREATE TABLE public.classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teacher ↔ Class assignments
CREATE TABLE public.teacher_class_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  UNIQUE(teacher_id, class_id)
);

-- Student ↔ Class enrollments
CREATE TABLE public.enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, class_id)
);

-- Attendance logs (core table)
CREATE TABLE public.attendance_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  school_id UUID NOT NULL REFERENCES public.schools(id),
  attendance_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL,
  distance_m DOUBLE PRECISION NOT NULL,
  within_radius BOOLEAN NOT NULL DEFAULT false,
  within_time_window BOOLEAN NOT NULL DEFAULT false,
  before_early_cutoff BOOLEAN NOT NULL DEFAULT false,
  proof_image_url TEXT,
  status attendance_status NOT NULL DEFAULT 'pending_teacher_view',
  teacher_flag_status TEXT,
  teacher_note_summary TEXT,
  admin_note TEXT,
  device_info TEXT,
  fraud_flags TEXT[],
  UNIQUE(student_id, attendance_date)
);

-- Attendance reviews (audit trail)
CREATE TABLE public.attendance_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID NOT NULL REFERENCES public.attendance_logs(id),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  reviewer_role user_role NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teacher notes
CREATE TABLE public.teacher_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID NOT NULL REFERENCES public.attendance_logs(id),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT NOT NULL,
  flag_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reward rules (per school)
CREATE TABLE public.reward_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) UNIQUE,
  base_reward INTEGER NOT NULL DEFAULT 5000,
  early_bonus INTEGER NOT NULL DEFAULT 2000,
  monthly_hold_bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  attendance_start_time TIME NOT NULL DEFAULT '06:00',
  attendance_end_time TIME NOT NULL DEFAULT '09:00',
  early_cutoff_time TIME NOT NULL DEFAULT '06:45',
  min_withdrawal_amount INTEGER NOT NULL DEFAULT 10000
);

-- Wallets
CREATE TABLE public.wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) UNIQUE,
  pending_balance INTEGER NOT NULL DEFAULT 0,
  available_balance INTEGER NOT NULL DEFAULT 0,
  held_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallet transactions (ledger)
CREATE TABLE public.wallet_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INTEGER NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Badges
CREATE TABLE public.badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'star',
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL
);

-- Student ↔ Badge
CREATE TABLE public.student_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  badge_id UUID NOT NULL REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, badge_id)
);

-- System settings
CREATE TABLE public.system_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id),
  UNIQUE(key, school_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_attendance_student_date ON public.attendance_logs(student_id, attendance_date);
CREATE INDEX idx_attendance_class_date ON public.attendance_logs(class_id, attendance_date);
CREATE INDEX idx_attendance_status ON public.attendance_logs(status);
CREATE INDEX idx_enrollments_class ON public.enrollments(class_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions(wallet_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if teacher has access to class
CREATE OR REPLACE FUNCTION public.teacher_has_class(p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_class_assignments
    WHERE teacher_id = auth.uid() AND class_id = p_class_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (get_my_role() = 'admin');
CREATE POLICY "Teachers read class student profiles" ON public.profiles FOR SELECT USING (
  get_my_role() = 'teacher' AND id IN (
    SELECT e.student_id FROM public.enrollments e
    JOIN public.teacher_class_assignments t ON t.class_id = e.class_id
    WHERE t.teacher_id = auth.uid()
  )
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (get_my_role() = 'admin');

-- SCHOOLS
CREATE POLICY "Anyone authenticated reads schools" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage schools" ON public.schools FOR ALL USING (get_my_role() = 'admin');

-- CLASSES
CREATE POLICY "Anyone authenticated reads classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL USING (get_my_role() = 'admin');

-- TEACHER_CLASS_ASSIGNMENTS
CREATE POLICY "Teachers read own assignments" ON public.teacher_class_assignments FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Admins manage assignments" ON public.teacher_class_assignments FOR ALL USING (get_my_role() = 'admin');

-- ENROLLMENTS
CREATE POLICY "Students read own enrollment" ON public.enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students insert own enrollment" ON public.enrollments FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students update own enrollment" ON public.enrollments FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students delete own enrollment" ON public.enrollments FOR DELETE USING (student_id = auth.uid());
CREATE POLICY "Teachers read class enrollments" ON public.enrollments FOR SELECT USING (teacher_has_class(class_id));
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL USING (get_my_role() = 'admin');

-- ATTENDANCE_LOGS
CREATE POLICY "Students read own attendance" ON public.attendance_logs FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students insert own attendance" ON public.attendance_logs FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers read class attendance" ON public.attendance_logs FOR SELECT USING (teacher_has_class(class_id));
CREATE POLICY "Teachers update class attendance" ON public.attendance_logs FOR UPDATE USING (teacher_has_class(class_id));
CREATE POLICY "Admins manage attendance" ON public.attendance_logs FOR ALL USING (get_my_role() = 'admin');

-- ATTENDANCE_REVIEWS
CREATE POLICY "Students read own reviews" ON public.attendance_reviews FOR SELECT USING (
  attendance_id IN (SELECT id FROM public.attendance_logs WHERE student_id = auth.uid())
);
CREATE POLICY "Admins manage reviews" ON public.attendance_reviews FOR ALL USING (get_my_role() = 'admin');

-- TEACHER_NOTES
CREATE POLICY "Teachers manage own notes" ON public.teacher_notes FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Admins read notes" ON public.teacher_notes FOR SELECT USING (get_my_role() = 'admin');

-- REWARD_RULES
CREATE POLICY "Anyone reads reward rules" ON public.reward_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rules" ON public.reward_rules FOR ALL USING (get_my_role() = 'admin');

-- WALLETS
CREATE POLICY "Students read own wallet" ON public.wallets FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins read wallets" ON public.wallets FOR SELECT USING (get_my_role() = 'admin');

-- WALLET_TRANSACTIONS
CREATE POLICY "Students read own transactions" ON public.wallet_transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM public.wallets WHERE student_id = auth.uid())
);
CREATE POLICY "Admins read transactions" ON public.wallet_transactions FOR SELECT USING (get_my_role() = 'admin');

-- WITHDRAWAL_REQUESTS
CREATE POLICY "Students read own withdrawals" ON public.withdrawal_requests FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students insert withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests FOR ALL USING (get_my_role() = 'admin');

-- BADGES
CREATE POLICY "Anyone reads badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage badges" ON public.badges FOR ALL USING (get_my_role() = 'admin');

-- STUDENT_BADGES
CREATE POLICY "Students read own badges" ON public.student_badges FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins manage student badges" ON public.student_badges FOR ALL USING (get_my_role() = 'admin');

-- SYSTEM_SETTINGS
CREATE POLICY "Anyone reads settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- SECURE DATABASE FUNCTIONS
-- ============================================

-- Credit wallet (called by admin on approval)
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_student_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM public.wallets WHERE student_id = p_student_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (student_id, available_balance)
    VALUES (p_student_id, p_amount)
    RETURNING id INTO v_wallet_id;
  ELSE
    UPDATE public.wallets SET available_balance = available_balance + p_amount, updated_at = now()
    WHERE id = v_wallet_id;
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, reference_id, description)
  VALUES (v_wallet_id, 'attendance_reward', p_amount, p_reference_id, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process withdrawal (deduct from available balance)
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_wallet_id UUID,
  p_amount INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets
  SET available_balance = available_balance - p_amount, updated_at = now()
  WHERE id = p_wallet_id AND available_balance >= p_amount;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description)
  VALUES (p_wallet_id, 'withdrawal', p_amount, 'Withdrawal processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly hold bonus release
CREATE OR REPLACE FUNCTION public.process_monthly_hold()
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_bonus INTEGER;
  v_bonus_pct NUMERIC;
BEGIN
  SELECT monthly_hold_bonus_pct INTO v_bonus_pct FROM public.reward_rules LIMIT 1;
  IF v_bonus_pct IS NULL THEN v_bonus_pct := 5.00; END IF;

  FOR r IN SELECT * FROM public.wallets WHERE held_balance > 0 LOOP
    v_bonus := FLOOR(r.held_balance * v_bonus_pct / 100);

    UPDATE public.wallets
    SET available_balance = available_balance + r.held_balance + v_bonus,
        held_balance = 0,
        updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description)
    VALUES (r.id, 'hold_release', r.held_balance, 'Monthly hold released');

    IF v_bonus > 0 THEN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description)
      VALUES (r.id, 'monthly_hold_bonus', v_bonus, 'Monthly hold bonus (' || v_bonus_pct || '%)');
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own selfies" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attendance-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone reads selfies" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attendance-selfies');
