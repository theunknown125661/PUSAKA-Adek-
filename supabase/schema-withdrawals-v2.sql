-- ============================================
-- School Streak — Tokenized Withdrawal Redemption System
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ADD NEW WITHDRAWAL STATUS VALUES
-- Postgres ENUMs can be altered to add values (but cannot remove them easily)
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'token_issued';
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'redeemed';
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. ALTER WITHDRAWAL_REQUESTS TABLE
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS token_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS redemption_method TEXT CHECK (redemption_method IN ('qr', 'manual')),
  ADD COLUMN IF NOT EXISTS payout_reference TEXT;

-- 3. CREATE PAYOUT_REDEMPTION_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.payout_redemption_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  withdrawal_request_id UUID NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_id UUID REFERENCES public.profiles(id),
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('scan', 'manual')),
  token_entered TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'expired', 'invalid', 'already_used', 'forbidden')),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_token ON public.withdrawal_requests(token_code);
CREATE INDEX IF NOT EXISTS idx_redemption_logs_request ON public.payout_redemption_logs(withdrawal_request_id);

-- Row Level Security (RLS)
ALTER TABLE public.payout_redemption_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own logs" ON public.payout_redemption_logs 
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admins manage logs" ON public.payout_redemption_logs 
  FOR ALL USING (get_my_role() = 'admin');
