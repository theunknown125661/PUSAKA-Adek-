-- ============================================
-- Dynamic Attendance Economy Trigger Function (V2)
-- Overwrite to load XP and leveling parameters dynamically from reward_rules.economy_config
-- ============================================

CREATE OR REPLACE FUNCTION public.process_attendance_economy_v2()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_config JSONB;
  v_coin_reward INTEGER := 20;
  v_rupiah_reward INTEGER := 1000;
  v_xp_reward INTEGER := 100;
  
  v_coin_wallet_id UUID;
  v_rupiah_wallet_id UUID;
  
  v_xp_config JSONB;
  v_xp_formula_type TEXT := 'progressive';
  v_constant_xp INTEGER := 1000;
  v_prog_base INTEGER := 100;
  
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get wallet IDs
  SELECT id INTO v_coin_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'COIN';
  SELECT id INTO v_rupiah_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'RUPIAH';

  -- Get config from reward_rules
  SELECT economy_config INTO v_config FROM public.reward_rules LIMIT 1;

  IF v_config IS NULL THEN
    v_config := '{"coins": {"attendance_present": 20, "attendance_ontime": 10}, "rupiah": {"attendance_present": 1000, "attendance_ontime": 500}, "xp": {"attendance_present": 100, "attendance_ontime": 50, "formula_type": "progressive", "constant_xp_per_level": 1000, "progressive_base": 100}}'::jsonb;
  END IF;

  -- Extract coins and rupiah rewards
  v_coin_reward := COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20);
  v_rupiah_reward := COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000);
  
  -- Extract XP config
  v_xp_config := v_config->'xp';
  IF v_xp_config IS NOT NULL THEN
    v_xp_reward := COALESCE((v_xp_config->>'attendance_present')::INTEGER, 100);
    v_xp_formula_type := COALESCE(v_xp_config->>'formula_type', 'progressive');
    v_constant_xp := COALESCE((v_xp_config->>'constant_xp_per_level')::INTEGER, 1000);
    v_prog_base := COALESCE((v_xp_config->>'progressive_base')::INTEGER, 100);
  END IF;

  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Bonus for early
    IF NEW.before_early_cutoff = true THEN
      v_coin_reward := v_coin_reward + COALESCE((v_config->'coins'->>'attendance_ontime')::INTEGER, 10);
      v_rupiah_reward := v_rupiah_reward + COALESCE((v_config->'rupiah'->>'attendance_ontime')::INTEGER, 500);
      IF v_xp_config IS NOT NULL THEN
        v_xp_reward := v_xp_reward + COALESCE((v_xp_config->>'attendance_ontime')::INTEGER, 50);
      ELSE
        v_xp_reward := v_xp_reward + 50;
      END IF;
    END IF;

    IF NEW.status = 'approved' THEN
      -- Coins
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_coin_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_coin_reward, 'COIN', 'RELEASED', 'Daily Check-in Reward');
      UPDATE public.wallets SET balance_available = balance_available + v_coin_reward WHERE id = v_coin_wallet_id;

      -- Rupiah
      IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING') THEN
        UPDATE public.wallet_transactions SET state = 'APPROVED' WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING';
        UPDATE public.wallets SET balance_pending = balance_pending - v_rupiah_reward, balance_available = balance_available + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      ELSE
        INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
        VALUES (v_rupiah_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_rupiah_reward, 'RUPIAH', 'APPROVED', 'Daily Attendance Reward');
        UPDATE public.wallets SET balance_available = balance_available + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      END IF;

      -- Get current user XP
      SELECT xp INTO v_current_xp FROM public.profiles WHERE id = NEW.student_id;
      v_new_xp := COALESCE(v_current_xp, 0) + v_xp_reward;
      
      -- Calculate level dynamically
      IF v_xp_formula_type = 'constant' THEN
        IF v_constant_xp <= 0 THEN v_constant_xp := 1000; END IF;
        v_new_level := FLOOR(v_new_xp / (v_constant_xp * 1.0)) + 1;
      ELSE
        IF v_prog_base <= 0 THEN v_prog_base := 100; END IF;
        v_new_level := FLOOR(SQRT(v_new_xp / (v_prog_base * 1.0))) + 1;
      END IF;

      UPDATE public.profiles 
      SET xp = v_new_xp, level = v_new_level 
      WHERE id = NEW.student_id;

    ELSIF NEW.status = 'pending_teacher_view' THEN
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_rupiah_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_rupiah_reward, 'RUPIAH', 'PENDING', 'Attendance Rupiah pending teacher verification');
      UPDATE public.wallets SET balance_pending = balance_pending + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$fn$;

-- Re-bind triggers
DROP TRIGGER IF EXISTS on_attendance_approved_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_approved_update_economy
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v2();

DROP TRIGGER IF EXISTS on_attendance_insert_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert_update_economy
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v2();

-- Automatic Level Recalculation Trigger on reward_rules config changes
CREATE OR REPLACE FUNCTION public.recalculate_all_student_levels()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_xp_config JSONB;
  v_xp_formula_type TEXT := 'progressive';
  v_constant_xp INTEGER := 1000;
  v_prog_base INTEGER := 100;
BEGIN
  v_xp_config := NEW.economy_config->'xp';
  IF v_xp_config IS NOT NULL THEN
    v_xp_formula_type := COALESCE(v_xp_config->>'formula_type', 'progressive');
    v_constant_xp := COALESCE((v_xp_config->>'constant_xp_per_level')::INTEGER, 1000);
    v_prog_base := COALESCE((v_xp_config->>'progressive_base')::INTEGER, 100);
  END IF;

  IF v_xp_formula_type = 'constant' THEN
    IF v_constant_xp <= 0 THEN v_constant_xp := 1000; END IF;
    UPDATE public.profiles
    SET level = FLOOR(COALESCE(xp, 0) / (v_constant_xp * 1.0)) + 1
    WHERE role = 'student';
  ELSE
    IF v_prog_base <= 0 THEN v_prog_base := 100; END IF;
    UPDATE public.profiles
    SET level = FLOOR(SQRT(COALESCE(xp, 0) / (v_prog_base * 1.0))) + 1
    WHERE role = 'student';
  END IF;

  RETURN NEW;
END;
$fn$;


DROP TRIGGER IF EXISTS on_reward_rules_update_recalculate_levels ON public.reward_rules;
CREATE TRIGGER on_reward_rules_update_recalculate_levels
  AFTER UPDATE OF economy_config ON public.reward_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_all_student_levels();

-- Automatic Profile Level Synchronization on XP updates
CREATE OR REPLACE FUNCTION public.sync_profile_level_from_xp()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_config JSONB;
  v_xp_config JSONB;
  v_xp_formula_type TEXT := 'progressive';
  v_constant_xp INTEGER := 1000;
  v_prog_base INTEGER := 100;
BEGIN
  -- We only calculate level for students
  IF NEW.role != 'student' THEN
    RETURN NEW;
  END IF;

  -- If level is not being changed explicitly by the query, calculate it automatically
  IF (TG_OP = 'INSERT') OR (OLD.level IS NOT DISTINCT FROM NEW.level) THEN
    -- Load configuration
    SELECT economy_config INTO v_config FROM public.reward_rules LIMIT 1;
    IF v_config IS NOT NULL THEN
      v_xp_config := v_config->'xp';
      IF v_xp_config IS NOT NULL THEN
        v_xp_formula_type := COALESCE(v_xp_config->>'formula_type', 'progressive');
        v_constant_xp := COALESCE((v_xp_config->>'constant_xp_per_level')::INTEGER, 1000);
        v_prog_base := COALESCE((v_xp_config->>'progressive_base')::INTEGER, 100);
      END IF;
    END IF;

    -- Calculate level based on XP
    IF v_xp_formula_type = 'constant' THEN
      IF v_constant_xp <= 0 THEN v_constant_xp := 1000; END IF;
      NEW.level := FLOOR(COALESCE(NEW.xp, 0) / (v_constant_xp * 1.0)) + 1;
    ELSE
      IF v_prog_base <= 0 THEN v_prog_base := 100; END IF;
      NEW.level := FLOOR(SQRT(COALESCE(NEW.xp, 0) / (v_prog_base * 1.0))) + 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_profile_xp_update_sync_level ON public.profiles;
CREATE TRIGGER on_profile_xp_update_sync_level
  BEFORE INSERT OR UPDATE OF xp ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_level_from_xp();

