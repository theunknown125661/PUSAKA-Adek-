-- ============================================
-- Attendance Policies & Penalties Schema Update
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Arrival Status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'arrival_status') THEN
        CREATE TYPE arrival_status AS ENUM ('early', 'normal', 'late', 'absent');
    END IF;
END$$;

-- 2. Create Attendance Policies Table
CREATE TABLE IF NOT EXISTS public.attendance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.class_schedule_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    checkin_open_at TIME NOT NULL,
    early_start_at TIME NOT NULL,
    early_end_at TIME NOT NULL,
    normal_start_at TIME NOT NULL,
    normal_end_at TIME NOT NULL,
    late_start_at TIME NOT NULL,
    late_end_at TIME NOT NULL,
    absent_after_at TIME NOT NULL,
    late_enabled BOOLEAN DEFAULT true,
    late_grace_minutes INTEGER DEFAULT 0,
    late_penalty_type TEXT,
    late_penalty_value INTEGER,
    late_escalation_count INTEGER,
    late_escalation_action TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for Policies
CREATE INDEX IF NOT EXISTS idx_attendance_policies_school ON public.attendance_policies(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_policies_class ON public.attendance_policies(class_id);

-- Enable RLS
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone reads attendance policies" ON public.attendance_policies;
    DROP POLICY IF EXISTS "Admins manage attendance policies" ON public.attendance_policies;
EXCEPTION
    WHEN undefined_object THEN
        -- Do nothing
END $$;

CREATE POLICY "Anyone reads attendance policies" ON public.attendance_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage attendance policies" ON public.attendance_policies FOR ALL USING (get_my_role() = 'admin');


-- 3. Modify Attendance Logs Table
DO $$
BEGIN
    -- Add columns if they don't exist
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS arrival_status arrival_status;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES public.attendance_policies(id);
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS minutes_delta_from_start INTEGER;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT false;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS penalty_type TEXT;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS penalty_value INTEGER;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS warning_count_added INTEGER DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN 
        -- Do nothing if columns already exist
        NULL;
END $$;

-- 4. Seed a Default Policy for Testing
-- Assuming we have at least one school
DO $$
DECLARE
    v_school_id UUID;
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM public.schools LIMIT 1;
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

    IF v_school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.attendance_policies WHERE name = 'Default School Policy') THEN
        INSERT INTO public.attendance_policies (
            school_id, name, 
            checkin_open_at, 
            early_start_at, early_end_at, 
            normal_start_at, normal_end_at, 
            late_start_at, late_end_at, 
            absent_after_at,
            late_enabled, late_grace_minutes,
            late_penalty_type, late_penalty_value,
            created_by
        ) VALUES (
            v_school_id, 'Default School Policy',
            '06:00',
            '06:30', '06:59',
            '07:00', '07:15',
            '07:16', '08:00',
            '08:00',
            true, 5,
            'points_deduction', 5,
            v_admin_id
        );
    END IF;
END $$;
