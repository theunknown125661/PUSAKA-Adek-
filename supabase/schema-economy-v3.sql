-- ============================================
-- Dynamic Attendance Economy Trigger Function (V3)
-- Supports Early, Normal, Late metrics & Penalties per School
-- ============================================

CREATE OR REPLACE FUNCTION public.process_attendance_economy_v3()
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
  
  v_penalty_amount INTEGER := 0;
BEGIN
  -- Get wallet IDs
  SELECT id INTO v_coin_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'COIN';
  SELECT id INTO v_rupiah_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'RUPIAH';

  -- Get config from reward_rules for the specific school
  SELECT economy_config INTO v_config FROM public.reward_rules WHERE school_id = NEW.school_id LIMIT 1;

  IF v_config IS NULL THEN
    v_config := '{"coins": {"early": 30, "normal": 20, "late": 10}, "rupiah": {"early": 1500, "normal": 1000, "late": 500}, "xp": {"early": 150, "normal": 100, "late": 50, "formula_type": "progressive", "constant_xp_per_level": 1000, "progressive_base": 100}}'::jsonb;
  END IF;

  -- Extract XP config
  v_xp_config := v_config->'xp';
  IF v_xp_config IS NOT NULL THEN
    v_xp_formula_type := COALESCE(v_xp_config->>'formula_type', 'progressive');
    v_constant_xp := COALESCE((v_xp_config->>'constant_xp_per_level')::INTEGER, 1000);
    v_prog_base := COALESCE((v_xp_config->>'progressive_base')::INTEGER, 100);
  END IF;

  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Evaluate rewards based on arrival_status
    IF NEW.arrival_status = 'early' THEN
      v_coin_reward := COALESCE((v_config->'coins'->>'early')::INTEGER, COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20) + COALESCE((v_config->'coins'->>'attendance_ontime')::INTEGER, 10));
      v_rupiah_reward := COALESCE((v_config->'rupiah'->>'early')::INTEGER, COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000) + COALESCE((v_config->'rupiah'->>'attendance_ontime')::INTEGER, 500));
      v_xp_reward := COALESCE((v_xp_config->>'early')::INTEGER, COALESCE((v_xp_config->>'attendance_present')::INTEGER, 100) + COALESCE((v_xp_config->>'attendance_ontime')::INTEGER, 50));
    ELSIF NEW.arrival_status = 'late' THEN
      v_coin_reward := COALESCE((v_config->'coins'->>'late')::INTEGER, COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20));
      v_rupiah_reward := COALESCE((v_config->'rupiah'->>'late')::INTEGER, COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000));
      v_xp_reward := COALESCE((v_xp_config->>'late')::INTEGER, COALESCE((v_xp_config->>'attendance_present')::INTEGER, 100));
    ELSE
      -- Normal (or fallback for absent/invalid if it accidentally triggers)
      v_coin_reward := COALESCE((v_config->'coins'->>'normal')::INTEGER, COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20));
      v_rupiah_reward := COALESCE((v_config->'rupiah'->>'normal')::INTEGER, COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000));
      v_xp_reward := COALESCE((v_xp_config->>'normal')::INTEGER, COALESCE((v_xp_config->>'attendance_present')::INTEGER, 100));
    END IF;

    -- Apply Points Deduction Penalty if applicable
    IF NEW.penalty_applied = true AND NEW.penalty_type = 'points_deduction' THEN
      v_penalty_amount := COALESCE(NEW.penalty_value, 0);
      -- Deduct from coin reward. Limit so it doesn't go negative on the reward itself, 
      -- or allow negative to subtract from main balance? 
      -- A penalty usually reduces existing balance. 
      -- We will just make v_coin_reward a net change (which could be negative).
      v_coin_reward := v_coin_reward - v_penalty_amount;
    END IF;

    IF NEW.status = 'approved' THEN
      -- Coins
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_coin_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_coin_reward, 'COIN', 'RELEASED', 'Daily Check-in Reward (incl. penalties)');
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
      
      -- Ensure XP doesn't go below 0
      IF v_new_xp < 0 THEN v_new_xp := 0; END IF;

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
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v3();

DROP TRIGGER IF EXISTS on_attendance_insert_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert_update_economy
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v3();
