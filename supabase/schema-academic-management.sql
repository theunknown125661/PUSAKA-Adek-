-- ============================================
-- School Streak — Academic Management Schema (Phase 1 & 2)
-- Run this in Supabase SQL Editor to apply school management & subjects structure
-- ============================================

-- ============================================
-- 1. ALTER EXISTING TABLES
-- ============================================

-- Alter public.schools to support advanced branding, active state, and location details
ALTER TABLE public.schools 
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS school_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'ID',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Alter public.classes to support sections, capacity, active states, and homeroom teachers
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS homeroom_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create unique constraint on name, section, and academic_year per school for class definition integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_classes_school_name_section_year'
  ) THEN
    ALTER TABLE public.classes 
      ADD CONSTRAINT uq_classes_school_name_section_year UNIQUE (school_id, name, section, academic_year);
  END IF;
END $$;

-- ============================================
-- 2. CREATE NEW TABLES
-- ============================================

-- Table for School Admins and Staff assignments (delegated administration)
CREATE TABLE IF NOT EXISTS public.school_admin_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'school_admin' CHECK (assignment_role IN ('school_admin', 'staff_admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, user_id)
);

-- Table for Subject Catalog (defined per school)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  credits INTEGER DEFAULT 3 CHECK (credits > 0),
  color_code TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, code)
);

-- Table for Class-level Subject Offerings (what subjects a class takes)
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  selection_group TEXT, -- e.g., 'Language Electives', 'Science Electives'
  max_students INTEGER DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

-- Table for Student Subject enrollments (active student-level selections)
CREATE TABLE IF NOT EXISTS public.student_subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_subject_id UUID NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  selection_status TEXT NOT NULL DEFAULT 'approved' CHECK (selection_status IN ('pending', 'approved', 'rejected')),
  assigned_by TEXT NOT NULL DEFAULT 'student' CHECK (assigned_by IN ('student', 'system', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, class_subject_id)
);

-- Table for Teacher-Subject assignments (which teacher teaches a specific class subject)
CREATE TABLE IF NOT EXISTS public.teacher_subject_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_subject_id UUID NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(teacher_id, class_subject_id)
);

-- Table for Class-level elective policy rules
CREATE TABLE IF NOT EXISTS public.class_subject_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE UNIQUE,
  selection_start_date TIMESTAMPTZ,
  selection_end_date TIMESTAMPTZ,
  min_electives INTEGER DEFAULT 0 CHECK (min_electives >= 0),
  max_electives INTEGER DEFAULT 0 CHECK (max_electives >= 0),
  auto_enroll_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_min_max_electives CHECK (min_electives <= max_electives)
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE AND ISOLATION
-- ============================================

CREATE INDEX IF NOT EXISTS idx_school_admin_school ON public.school_admin_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_school_admin_user ON public.school_admin_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON public.subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON public.class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON public.student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_class_subject ON public.student_subjects(class_subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_teacher ON public.teacher_subject_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_class_subject ON public.teacher_subject_assignments(class_subject_id);
CREATE INDEX IF NOT EXISTS idx_class_policies_class ON public.class_subject_policies(class_id);

-- ============================================
-- 4. UTILITIES AND TRIGGERS FOR TIMESTAMPS
-- ============================================

-- Function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE OR REPLACE TRIGGER tr_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_school_admin_assignments_updated_at BEFORE UPDATE ON public.school_admin_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_class_subjects_updated_at BEFORE UPDATE ON public.class_subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_student_subjects_updated_at BEFORE UPDATE ON public.student_subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_teacher_subject_assignments_updated_at BEFORE UPDATE ON public.teacher_subject_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER tr_class_subject_policies_updated_at BEFORE UPDATE ON public.class_subject_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE public.school_admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subject_policies ENABLE ROW LEVEL SECURITY;

-- Helper security definer function to check if the current user is a school admin for a specific school (or global admin)
CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_admin_assignments
    WHERE user_id = auth.uid() AND school_id = p_school_id AND assignment_role = 'school_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper security definer function to check if the current user is school staff (admin or staff role) for a specific school (or global admin)
CREATE OR REPLACE FUNCTION public.is_school_staff(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_admin_assignments
    WHERE user_id = auth.uid() AND school_id = p_school_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- --- RLS POLICIES ---

-- Policies for public.school_admin_assignments
CREATE POLICY "School admin assignments are readable by admins, school staff, or self"
  ON public.school_admin_assignments
  FOR SELECT
  USING (
    get_my_role() = 'admin' 
    OR user_id = auth.uid() 
    OR is_school_staff(school_id)
  );

CREATE POLICY "School admin assignments are manageable by platform admins or school admins"
  ON public.school_admin_assignments
  FOR ALL
  USING (
    get_my_role() = 'admin' 
    OR is_school_admin(school_id)
  );

-- Policies for public.subjects
CREATE POLICY "Subjects are readable by school members or staff"
  ON public.subjects
  FOR SELECT
  USING (
    is_school_staff(school_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND school_id = subjects.school_id
    )
  );

CREATE POLICY "Subjects are manageable by school admins"
  ON public.subjects
  FOR ALL
  USING (is_school_admin(school_id));

-- Policies for public.class_subjects
CREATE POLICY "Class subjects are readable by school members or staff"
  ON public.class_subjects
  FOR SELECT
  USING (
    is_school_staff(school_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND school_id = class_subjects.school_id
    )
  );

CREATE POLICY "Class subjects are manageable by school admins"
  ON public.class_subjects
  FOR ALL
  USING (is_school_admin(school_id));

-- Policies for public.student_subjects
CREATE POLICY "Students read own subjects, teachers view class subjects, staff view all"
  ON public.student_subjects
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR is_school_staff(school_id)
    OR (
      get_my_role() = 'teacher' 
      AND teacher_has_class((
        SELECT class_id FROM public.class_subjects WHERE id = class_subject_id
      ))
    )
  );

CREATE POLICY "Student subject selections can be created by student or staff"
  ON public.student_subjects
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    OR is_school_staff(school_id)
  );

CREATE POLICY "Student subject selections can be updated by student or staff"
  ON public.student_subjects
  FOR UPDATE
  USING (
    student_id = auth.uid()
    OR is_school_staff(school_id)
  )
  WITH CHECK (
    student_id = auth.uid()
    OR is_school_staff(school_id)
  );

CREATE POLICY "Student subject selections can be deleted by student or staff"
  ON public.student_subjects
  FOR DELETE
  USING (
    student_id = auth.uid()
    OR is_school_staff(school_id)
  );

-- Policies for public.teacher_subject_assignments
CREATE POLICY "Teacher subject assignments readable by school members or staff"
  ON public.teacher_subject_assignments
  FOR SELECT
  USING (
    is_school_staff(school_id)
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND school_id = teacher_subject_assignments.school_id
    )
  );

CREATE POLICY "Teacher subject assignments manageable by school admins"
  ON public.teacher_subject_assignments
  FOR ALL
  USING (is_school_admin(school_id));

-- Policies for public.class_subject_policies
CREATE POLICY "Class policies readable by school members or staff"
  ON public.class_subject_policies
  FOR SELECT
  USING (
    is_school_staff(school_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND school_id = class_subject_policies.school_id
    )
  );

CREATE POLICY "Class policies manageable by school admins"
  ON public.class_subject_policies
  FOR ALL
  USING (is_school_admin(school_id));
