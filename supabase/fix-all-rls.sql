-- ============================================
-- COMPREHENSIVE RLS FIX
-- Run this ONCE in Supabase SQL Editor
-- IMPORTANT: Turn OFF "Enable RLS on new tables" toggle first!
-- ============================================

-- ============================================
-- 1. PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers read class student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Teachers read class student profiles" ON public.profiles FOR SELECT USING (
  get_my_role() = 'teacher' AND id IN (
    SELECT e.student_id FROM public.enrollments e
    JOIN public.teacher_class_assignments t ON t.class_id = e.class_id
    WHERE t.teacher_id = auth.uid()
  )
);

-- ============================================
-- 2. SCHOOLS
-- ============================================
DROP POLICY IF EXISTS "Anyone authenticated reads schools" ON public.schools;
DROP POLICY IF EXISTS "Admins manage schools" ON public.schools;

CREATE POLICY "Anyone authenticated reads schools" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage schools" ON public.schools FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 3. CLASSES
-- ============================================
DROP POLICY IF EXISTS "Anyone authenticated reads classes" ON public.classes;
DROP POLICY IF EXISTS "Admins manage classes" ON public.classes;

CREATE POLICY "Anyone authenticated reads classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 4. TEACHER_CLASS_ASSIGNMENTS
-- ============================================
DROP POLICY IF EXISTS "Teachers read own assignments" ON public.teacher_class_assignments;
DROP POLICY IF EXISTS "Admins manage assignments" ON public.teacher_class_assignments;

CREATE POLICY "Teachers read own assignments" ON public.teacher_class_assignments FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Admins manage assignments" ON public.teacher_class_assignments FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 5. ENROLLMENTS (student can CRUD their own)
-- ============================================
DROP POLICY IF EXISTS "Students read own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Students insert own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Students update own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Students delete own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Teachers read class enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;

CREATE POLICY "Students read own enrollment" ON public.enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students insert own enrollment" ON public.enrollments FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students update own enrollment" ON public.enrollments FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students delete own enrollment" ON public.enrollments FOR DELETE USING (student_id = auth.uid());
CREATE POLICY "Teachers read class enrollments" ON public.enrollments FOR SELECT USING (teacher_has_class(class_id));
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 6. ATTENDANCE_LOGS
-- ============================================
DROP POLICY IF EXISTS "Students read own attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Students insert own attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Teachers read class attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Teachers update class attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance_logs;

CREATE POLICY "Students read own attendance" ON public.attendance_logs FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students insert own attendance" ON public.attendance_logs FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers read class attendance" ON public.attendance_logs FOR SELECT USING (teacher_has_class(class_id));
CREATE POLICY "Teachers update class attendance" ON public.attendance_logs FOR UPDATE USING (teacher_has_class(class_id));
CREATE POLICY "Admins manage attendance" ON public.attendance_logs FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 7. ATTENDANCE_REVIEWS
-- ============================================
DROP POLICY IF EXISTS "Students read own reviews" ON public.attendance_reviews;
DROP POLICY IF EXISTS "Teachers insert reviews" ON public.attendance_reviews;
DROP POLICY IF EXISTS "Admins manage reviews" ON public.attendance_reviews;

CREATE POLICY "Students read own reviews" ON public.attendance_reviews FOR SELECT USING (
  attendance_id IN (SELECT id FROM public.attendance_logs WHERE student_id = auth.uid())
);
CREATE POLICY "Teachers insert reviews" ON public.attendance_reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "Admins manage reviews" ON public.attendance_reviews FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 8. TEACHER_NOTES
-- ============================================
DROP POLICY IF EXISTS "Teachers manage own notes" ON public.teacher_notes;
DROP POLICY IF EXISTS "Admins read notes" ON public.teacher_notes;

CREATE POLICY "Teachers manage own notes" ON public.teacher_notes FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Admins read notes" ON public.teacher_notes FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- 9. REWARD_RULES
-- ============================================
DROP POLICY IF EXISTS "Anyone reads reward rules" ON public.reward_rules;
DROP POLICY IF EXISTS "Admins manage rules" ON public.reward_rules;

CREATE POLICY "Anyone reads reward rules" ON public.reward_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rules" ON public.reward_rules FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 10. STREAKS
-- ============================================
DROP POLICY IF EXISTS "Users read own streak" ON public.streaks;
DROP POLICY IF EXISTS "Admins read all streaks" ON public.streaks;

CREATE POLICY "Users read own streak" ON public.streaks FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admins and teachers read all streaks" ON public.streaks FOR SELECT USING (get_my_role() IN ('admin', 'teacher'));

-- ============================================
-- 11. HOLIDAY_CALENDAR
-- ============================================
DROP POLICY IF EXISTS "Anyone reads holidays" ON public.holiday_calendar;
DROP POLICY IF EXISTS "Admins manage holidays" ON public.holiday_calendar;

CREATE POLICY "Anyone reads holidays" ON public.holiday_calendar FOR SELECT USING (true);
CREATE POLICY "Admins manage holidays" ON public.holiday_calendar FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- 12. WALLETS (v2 uses user_id)
-- ============================================
DROP POLICY IF EXISTS "Students read own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users read own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins read wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins read all wallets" ON public.wallets;

-- Try both column names so this works regardless of which schema is live
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE POLICY "Users read own wallets" ON public.wallets FOR SELECT USING (user_id = auth.uid())';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'student_id') THEN
    EXECUTE 'CREATE POLICY "Users read own wallets" ON public.wallets FOR SELECT USING (student_id = auth.uid())';
  END IF;
END $do$;
CREATE POLICY "Admins read all wallets" ON public.wallets FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- 13. WALLET_TRANSACTIONS (v2 uses user_id)
-- ============================================
DROP POLICY IF EXISTS "Students read own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users read own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins read transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins read all transactions" ON public.wallet_transactions;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE POLICY "Users read own transactions" ON public.wallet_transactions FOR SELECT USING (user_id = auth.uid())';
  ELSE
    EXECUTE 'CREATE POLICY "Users read own transactions" ON public.wallet_transactions FOR SELECT USING (wallet_id IN (SELECT id FROM public.wallets WHERE student_id = auth.uid()))';
  END IF;
END $do$;
CREATE POLICY "Admins read all transactions" ON public.wallet_transactions FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- 14. WITHDRAWAL_REQUESTS / PAYOUT_REQUESTS
-- ============================================
-- Old table
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawal_requests') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Students read own withdrawals" ON public.withdrawal_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Students insert withdrawals" ON public.withdrawal_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.withdrawal_requests';
    EXECUTE 'CREATE POLICY "Students read own withdrawals" ON public.withdrawal_requests FOR SELECT USING (student_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Students insert withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (student_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests FOR ALL USING (get_my_role() = ''admin'')';
  END IF;
END $do$;

-- New table
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_requests') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users read own payout requests" ON public.payout_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Users create payout requests" ON public.payout_requests';
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage payout requests" ON public.payout_requests';
    EXECUTE 'CREATE POLICY "Users read own payout requests" ON public.payout_requests FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Users create payout requests" ON public.payout_requests FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins manage payout requests" ON public.payout_requests FOR ALL USING (get_my_role() = ''admin'')';
  END IF;
END $do$;

-- ============================================
-- 15. BADGES & USER_BADGES
-- ============================================
DROP POLICY IF EXISTS "Anyone reads badges" ON public.badges;
DROP POLICY IF EXISTS "Anyone reads active badges" ON public.badges;
DROP POLICY IF EXISTS "Admins manage badges" ON public.badges;

CREATE POLICY "Anyone reads badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage badges" ON public.badges FOR ALL USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Students read own badges" ON public.student_badges;
DROP POLICY IF EXISTS "Admins manage student badges" ON public.student_badges;
DROP POLICY IF EXISTS "Users read own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Anyone reads all user badges" ON public.user_badges;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_badges') THEN
    EXECUTE 'CREATE POLICY "Users read own badges" ON public.user_badges FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Anyone reads all user badges" ON public.user_badges FOR SELECT USING (true)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_badges') THEN
    EXECUTE 'CREATE POLICY "Students read own badges" ON public.student_badges FOR SELECT USING (student_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins manage student badges" ON public.student_badges FOR ALL USING (get_my_role() = ''admin'')';
  END IF;
END $do$;

-- ============================================
-- 16. COIN_TRANSACTIONS
-- ============================================
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_transactions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users read own coin transactions" ON public.coin_transactions';
    EXECUTE 'CREATE POLICY "Users read own coin transactions" ON public.coin_transactions FOR SELECT USING (user_id = auth.uid())';
  END IF;
END $do$;

-- ============================================
-- 17. SHOP ITEMS & PURCHASES
-- ============================================
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone reads active shop items" ON public.shop_items';
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage shop items" ON public.shop_items';
    EXECUTE 'CREATE POLICY "Anyone reads active shop items" ON public.shop_items FOR SELECT USING (active = true)';
    EXECUTE 'CREATE POLICY "Admins manage shop items" ON public.shop_items FOR ALL USING (get_my_role() = ''admin'')';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchases') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users read own purchases" ON public.purchases';
    EXECUTE 'DROP POLICY IF EXISTS "Users insert own purchases" ON public.purchases';
    EXECUTE 'DROP POLICY IF EXISTS "Admins read all purchases" ON public.purchases';
    EXECUTE 'CREATE POLICY "Users read own purchases" ON public.purchases FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Users insert own purchases" ON public.purchases FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins read all purchases" ON public.purchases FOR SELECT USING (get_my_role() = ''admin'')';
  END IF;
END $do$;

-- ============================================
-- 18. SYSTEM_SETTINGS
-- ============================================
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone reads settings" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage settings" ON public.system_settings';
    EXECUTE 'CREATE POLICY "Anyone reads settings" ON public.system_settings FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL USING (get_my_role() = ''admin'')';
  END IF;
END $do$;

-- ============================================
-- 19. STORAGE BUCKET POLICIES
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Users upload own selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anyone reads selfies" ON storage.objects;
DROP POLICY IF EXISTS "Users update own selfies" ON storage.objects;

CREATE POLICY "Users upload own selfies" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attendance-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone reads selfies" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attendance-selfies');

CREATE POLICY "Users update own selfies" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attendance-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- 20. MAKE ALL TRIGGER FUNCTIONS SECURITY DEFINER
-- ============================================
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;
ALTER FUNCTION public.get_my_role() SECURITY DEFINER;
ALTER FUNCTION public.teacher_has_class(UUID) SECURITY DEFINER;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_attendance_streak') THEN
    EXECUTE 'ALTER FUNCTION public.process_attendance_streak() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_attendance_economy') THEN
    EXECUTE 'ALTER FUNCTION public.process_attendance_economy() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_attendance_economy_v2') THEN
    EXECUTE 'ALTER FUNCTION public.process_attendance_economy_v2() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ensure_user_wallets') THEN
    EXECUTE 'ALTER FUNCTION public.ensure_user_wallets() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_streak') THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user_streak() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'evaluate_streak_badges') THEN
    EXECUTE 'ALTER FUNCTION public.evaluate_streak_badges() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'evaluate_level_badges') THEN
    EXECUTE 'ALTER FUNCTION public.evaluate_level_badges() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'credit_wallet') THEN
    EXECUTE 'ALTER FUNCTION public.credit_wallet(UUID, INTEGER, TEXT, UUID) SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_withdrawal') THEN
    EXECUTE 'ALTER FUNCTION public.process_withdrawal(UUID, INTEGER) SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_monthly_hold') THEN
    EXECUTE 'ALTER FUNCTION public.process_monthly_hold() SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_shop_item') THEN
    EXECUTE 'ALTER FUNCTION public.purchase_shop_item(UUID, UUID) SECURITY DEFINER';
  END IF;
END $do$;

-- ============================================
-- 21. ADD accuracy_tolerance_m COLUMN IF MISSING
-- ============================================
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS accuracy_tolerance_m INTEGER NOT NULL DEFAULT 100;

-- ============================================
-- DONE! All RLS policies have been reset.
-- ============================================
