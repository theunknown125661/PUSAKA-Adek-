-- ============================================
-- Dual-Currency Reward System (Coins + Rupiah)
-- Run AFTER all previous schemas
-- ============================================

-- DROP existing tables if they exist (Development only)
DROP TABLE IF EXISTS public.payout_requests CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;

-- Add economy_config to reward_rules table instead of schools
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reward_rules' AND column_name='economy_config') THEN
    ALTER TABLE public.reward_rules ADD COLUMN economy_config JSONB DEFAULT '{
      "coins": {
        "attendance_present": 20,
        "attendance_ontime": 10
      },
      "rupiah": {
        "attendance_present": 1000,
        "attendance_ontime": 500
      }
    }'::jsonb;
  END IF;
END $$;

-- ============================================
-- WALLETS
-- ============================================
CREATE TABLE public.wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency_type TEXT NOT NULL CHECK (currency_type IN ('COIN', 'RUPIAH')),
  balance_available INTEGER NOT NULL DEFAULT 0,
  balance_pending INTEGER NOT NULL DEFAULT 0,
  balance_locked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, currency_type)
);

-- RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallets" ON public.wallets;
CREATE POLICY "Users read own wallets" ON public.wallets FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all wallets" ON public.wallets;
CREATE POLICY "Admins read all wallets" ON public.wallets FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- WALLET TRANSACTIONS (Ledger)
-- ============================================
CREATE TABLE public.wallet_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id TEXT,
  amount INTEGER NOT NULL, -- Positive for credit, negative for debit
  currency_type TEXT NOT NULL CHECK (currency_type IN ('COIN', 'RUPIAH')),
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'APPROVED', 'RELEASED', 'PAID', 'REJECTED')),
  daily_cap_applied BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own transactions" ON public.wallet_transactions;
CREATE POLICY "Users read own transactions" ON public.wallet_transactions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all transactions" ON public.wallet_transactions;
CREATE POLICY "Admins read all transactions" ON public.wallet_transactions FOR SELECT USING (get_my_role() = 'admin');

-- ============================================
-- PAYOUT REQUESTS
-- ============================================
CREATE TABLE public.payout_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  destination TEXT NOT NULL DEFAULT 'cash',
  state TEXT NOT NULL CHECK (state IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED')) DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payout requests" ON public.payout_requests;
CREATE POLICY "Users read own payout requests" ON public.payout_requests FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create payout requests" ON public.payout_requests;
CREATE POLICY "Users create payout requests" ON public.payout_requests FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage payout requests" ON public.payout_requests;
CREATE POLICY "Admins manage payout requests" ON public.payout_requests FOR ALL USING (get_my_role() = 'admin');

-- ============================================
-- INITIALIZATION & MIGRATION
-- ============================================

-- Function to ensure wallets exist for a user
CREATE OR REPLACE FUNCTION public.ensure_user_wallets()
RETURNS TRIGGER AS $$
BEGIN
  -- Create COIN wallet
  INSERT INTO public.wallets (user_id, currency_type, balance_available)
  VALUES (NEW.id, 'COIN', COALESCE(NEW.coins, 0))
  ON CONFLICT (user_id, currency_type) DO NOTHING;

  -- Create RUPIAH wallet
  INSERT INTO public.wallets (user_id, currency_type, balance_available)
  VALUES (NEW.id, 'RUPIAH', 0)
  ON CONFLICT (user_id, currency_type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new users
DROP TRIGGER IF EXISTS on_profile_created_ensure_wallets ON public.profiles;
CREATE TRIGGER on_profile_created_ensure_wallets
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_wallets();

-- Run migration for existing users
DO $$
DECLARE
  v_profile RECORD;
BEGIN
  FOR v_profile IN SELECT id, coins FROM public.profiles LOOP
    -- Create COIN wallet with existing coins
    INSERT INTO public.wallets (user_id, currency_type, balance_available)
    VALUES (v_profile.id, 'COIN', COALESCE(v_profile.coins, 0))
    ON CONFLICT (user_id, currency_type) DO UPDATE
    SET balance_available = public.wallets.balance_available + EXCLUDED.balance_available;

    -- Create RUPIAH wallet
    INSERT INTO public.wallets (user_id, currency_type, balance_available)
    VALUES (v_profile.id, 'RUPIAH', 0)
    ON CONFLICT (user_id, currency_type) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- ECONOMY ENGINE (V2)
-- ============================================

CREATE OR REPLACE FUNCTION public.process_attendance_economy_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_config JSONB;
  v_coin_reward INTEGER := 20;
  v_rupiah_reward INTEGER := 1000;
  v_coin_wallet_id UUID;
  v_rupiah_wallet_id UUID;
BEGIN
  -- Get wallet IDs
  SELECT id INTO v_coin_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'COIN';
  SELECT id INTO v_rupiah_wallet_id FROM public.wallets WHERE user_id = NEW.student_id AND currency_type = 'RUPIAH';

  -- Get config from reward_rules (Global config)
  SELECT economy_config INTO v_config FROM public.reward_rules LIMIT 1;
  
  -- Fallback to defaults if null or table empty
  IF v_config IS NULL THEN
    v_config := '{
      "coins": {"attendance_present": 20, "attendance_ontime": 10},
      "rupiah": {"attendance_present": 1000, "attendance_ontime": 500}
    }'::jsonb;
  END IF;

  -- Extract values from config
  v_coin_reward := COALESCE((v_config->'coins'->>'attendance_present')::INTEGER, 20);
  v_rupiah_reward := COALESCE((v_config->'rupiah'->>'attendance_present')::INTEGER, 1000);

  -- Handle INSERT (or initial state)
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Bonus for early bird
    IF NEW.before_early_cutoff = true THEN
      v_coin_reward := v_coin_reward + COALESCE((v_config->'coins'->>'attendance_ontime')::INTEGER, 10);
      v_rupiah_reward := v_rupiah_reward + COALESCE((v_config->'rupiah'->>'attendance_ontime')::INTEGER, 500);
    END IF;

    -- If status is 'approved' (either on insert or update)
    IF NEW.status = 'approved' THEN
      -- Award Coins (RELEASED)
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_coin_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_coin_reward, 'COIN', 'RELEASED', 'Daily Check-in Reward');

      -- Update coin wallet available balance
      UPDATE public.wallets SET balance_available = balance_available + v_coin_reward WHERE id = v_coin_wallet_id;

      -- Award Rupiah (APPROVED)
      -- Check if we already have a pending transaction for this event
      IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING') THEN
        -- Update existing transaction state
        UPDATE public.wallet_transactions 
        SET state = 'APPROVED' 
        WHERE wallet_id = v_rupiah_wallet_id AND event_id = NEW.id::text AND state = 'PENDING';

        -- Move balance from pending to available
        UPDATE public.wallets 
        SET 
          balance_pending = balance_pending - v_rupiah_reward,
          balance_available = balance_available + v_rupiah_reward
        WHERE id = v_rupiah_wallet_id;
      ELSE
        -- Insert as APPROVED directly (e.g. if auto-approved or inserted as approved)
        INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
        VALUES (v_rupiah_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_rupiah_reward, 'RUPIAH', 'APPROVED', 'Daily Attendance Reward');

        -- Update rupiah wallet available balance
        UPDATE public.wallets SET balance_available = balance_available + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      END IF;
      
      -- Also give XP (Keep this from old system)
      UPDATE public.profiles
      SET 
        xp = xp + 100,
        level = FLOOR(SQRT((xp + 100) / 100.0)) + 1
      WHERE id = NEW.student_id;

    -- If status is 'pending' (waiting for teacher review)
    ELSIF NEW.status = 'pending' THEN
      -- Insert Rupiah as PENDING
      INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
      VALUES (v_rupiah_wallet_id, NEW.student_id, 'attendance', NEW.id::text, v_rupiah_reward, 'RUPIAH', 'PENDING', 'Attendance Rupiah pending teacher verification');

      -- Update rupiah wallet pending balance
      UPDATE public.wallets SET balance_pending = balance_pending + v_rupiah_reward WHERE id = v_rupiah_wallet_id;
      
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind triggers to use V2 function
DROP TRIGGER IF EXISTS on_attendance_approved_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_approved_update_economy
  AFTER UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v2();

DROP TRIGGER IF EXISTS on_attendance_insert_update_economy ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert_update_economy
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.process_attendance_economy_v2();
