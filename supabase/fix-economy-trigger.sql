CREATE OR REPLACE FUNCTION public.process_attendance_economy_v2()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_config JSONB;
  v_coin_reward INTEGER := 20;
  v_rupiah_reward INTEGER := 1000;
  v_coin_wallet_id UUID;
  v_rupiah_wallet_id UUID;
BEGIN
  SELECT id INTO v_coin_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'COIN';
  SELECT id INTO v_rupiah_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'RUPIAH';

  SELECT economy_config INTO v_config FROM public.reward_rules LIMIT 1;

  IF v_config IS NULL THEN
    v_config := '{"coins": {"attendance_present": 20, "attendance_ontime": 10}, "rupiah": {"attendance_present": 1000, "attendance_ontime": 500}}'::jsonb;
  END IF;

  v_coin_reward := COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20);
  v_rupiah_reward := COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000);

  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.before_early_cutoff = true THEN
      v_coin_reward := v_coin_reward + COALESCE((v_config->'coins'->>'attendance_ontime')::INTEGER, 10);
      v_rupiah_reward := v_rupiah_reward + COALESCE((v_config->'rupiah'->>'attendance_ontime')::INTEGER, 500);
    END IF;

    IF NEW.status = 'approved' THEN
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_coin_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_coin_reward, 'COIN', 'RELEASED', 'Daily Check-in Reward');
      UPDATE public.wallets SET balance_available = balance_available + v_coin_reward WHERE id = v_coin_wallet_id;

      IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING') THEN
        UPDATE public.wallet_transactions SET state = 'APPROVED' WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING';
        UPDATE public.wallets SET balance_pending = balance_pending - v_rupiah_reward, balance_available = balance_available + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      ELSE
        INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
        VALUES (v_rupiah_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_rupiah_reward, 'RUPIAH', 'APPROVED', 'Daily Attendance Reward');
        UPDATE public.wallets SET balance_available = balance_available + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      END IF;

      UPDATE public.profiles SET xp = xp + 100, level = FLOOR(SQRT((xp + 100) / 100.0)) + 1 WHERE id = NEW.student_id;

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
