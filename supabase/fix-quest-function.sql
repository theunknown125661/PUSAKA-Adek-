-- ============================================
-- Dynamic Quest Completion function (V2)
-- Overwrite to load XP and leveling parameters dynamically from reward_rules.economy_config
-- ============================================

CREATE OR REPLACE FUNCTION public.complete_quest(p_user_id UUID, p_quest_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_quest RECORD;
  v_user_quest RECORD;
  v_config JSONB;
  v_xp_config JSONB;
  v_xp_formula_type TEXT := 'progressive';
  v_constant_xp INTEGER := 1000;
  v_prog_base INTEGER := 100;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_coin_wallet_id UUID;
BEGIN
  -- Get the quest and user_quest
  SELECT * INTO v_quest FROM public.quests WHERE id = p_quest_id;
  SELECT * INTO v_user_quest FROM public.user_quests WHERE user_id = p_user_id AND quest_id = p_quest_id;
  
  IF NOT FOUND OR v_user_quest.status = 'completed' THEN
    RETURN false;
  END IF;

  -- Mark as completed
  UPDATE public.user_quests 
  SET status = 'completed', completed_at = now() 
  WHERE id = v_user_quest.id;

  -- Get config from reward_rules
  SELECT economy_config INTO v_config FROM public.reward_rules LIMIT 1;

  IF v_config IS NULL THEN
    v_config := '{"xp": {"formula_type": "progressive", "constant_xp_per_level": 1000, "progressive_base": 100}}'::jsonb;
  END IF;

  v_xp_config := v_config->'xp';
  IF v_xp_config IS NOT NULL THEN
    v_xp_formula_type := COALESCE(v_xp_config->>'formula_type', 'progressive');
    v_constant_xp := COALESCE((v_xp_config->>'constant_xp_per_level')::INTEGER, 1000);
    v_prog_base := COALESCE((v_xp_config->>'progressive_base')::INTEGER, 100);
  END IF;

  -- Get current user XP
  SELECT xp INTO v_current_xp FROM public.profiles WHERE id = p_user_id;
  v_new_xp := COALESCE(v_current_xp, 0) + v_quest.reward_xp;
  
  -- Calculate level dynamically
  IF v_xp_formula_type = 'constant' THEN
    IF v_constant_xp <= 0 THEN v_constant_xp := 1000; END IF;
    v_new_level := FLOOR(v_new_xp / (v_constant_xp * 1.0)) + 1;
  ELSE
    IF v_prog_base <= 0 THEN v_prog_base := 100; END IF;
    v_new_level := FLOOR(SQRT(v_new_xp / (v_prog_base * 1.0))) + 1;
  END IF;

  -- Grant rewards in profiles
  UPDATE public.profiles 
  SET 
    xp = v_new_xp,
    coins = coins + v_quest.reward_coins,
    level = v_new_level
  WHERE id = p_user_id;

  -- Grant Coins in wallets too (if V2 wallets system is active)
  SELECT id INTO v_coin_wallet_id FROM public.wallets WHERE user_id = p_user_id AND currency_type = 'COIN';
  IF v_coin_wallet_id IS NOT NULL AND v_quest.reward_coins > 0 THEN
    INSERT INTO public.wallet_transactions (wallet_id, user_id, event_type, event_id, amount, currency_type, state, note)
    VALUES (v_coin_wallet_id, p_user_id, 'quest', p_quest_id::text, v_quest.reward_coins, 'COIN', 'RELEASED', 'Completed Quest: ' || v_quest.title);
    UPDATE public.wallets SET balance_available = balance_available + v_quest.reward_coins WHERE id = v_coin_wallet_id;
  END IF;

  -- Log coin transaction in coin_transactions (legacy tracking fallback)
  IF v_quest.reward_coins > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
    VALUES (p_user_id, v_quest.reward_coins, 'quest', p_quest_id, 'Completed Quest: ' || v_quest.title);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
