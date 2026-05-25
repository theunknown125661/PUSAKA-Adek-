-- Auto-Scope Gamification and Holiday items to the primary school
-- If you only have one school, this connects all existing global records to it.

DO $$
DECLARE
  v_primary_school_id UUID;
BEGIN
  -- Get the first school ID
  SELECT id INTO v_primary_school_id FROM public.schools LIMIT 1;
  
  IF v_primary_school_id IS NOT NULL THEN
    
    -- 1. Scope Badges
    UPDATE public.badges 
    SET school_id = v_primary_school_id 
    WHERE school_id IS NULL;
    
    -- 2. Scope Shop Items
    UPDATE public.shop_items 
    SET school_id = v_primary_school_id 
    WHERE school_id IS NULL;
    
    -- 3. Scope Quests
    UPDATE public.quests 
    SET school_id = v_primary_school_id 
    WHERE school_id IS NULL;
    
    -- 4. Scope Holiday Rules (if missing school_id)
    UPDATE public.holiday_rules 
    SET school_id = v_primary_school_id 
    WHERE school_id IS NULL;
    
    -- 5. Scope Holiday Calendar (if missing school_id)
    UPDATE public.holiday_calendar 
    SET school_id = v_primary_school_id 
    WHERE school_id IS NULL;
    
    RAISE NOTICE 'Migration complete. Assigned to school: %', v_primary_school_id;
  ELSE
    RAISE NOTICE 'No schools found. Skipping migration.';
  END IF;
END $$;
