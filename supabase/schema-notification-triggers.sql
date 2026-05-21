-- ============================================================================
-- NOTIFICATION SYSTEM — TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================================
-- Depends on: schema-notifications.sql (notifications table must exist)
--
-- Creates 8 SECURITY DEFINER trigger functions that automatically insert
-- rows into the `notifications` table when domain events occur:
--
--   1. notify_attendance_status_change  — attendance approved / rejected
--   2. notify_badge_unlocked            — new badge earned
--   3. notify_streak_milestone          — 7 / 14 / 30 / 60 / 100-day streak
--   4. notify_level_up                  — student levels up
--   5. notify_payout_status             — withdrawal paid / rejected
--   6. notify_teacher_pending_review    — new check-in needs teacher review
--   7. notify_admin_flagged             — teacher flags a submission
--   8. notify_admin_pending_withdrawal  — new withdrawal request for admins
--
-- All functions run as SECURITY DEFINER so they can INSERT into notifications
-- without an authenticated-user INSERT policy.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Attendance approved / rejected
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_attendance_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when the status column actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    IF NEW.status = 'approved' THEN
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        NEW.student_id,
        'attendance_approved',
        'transactional',
        'medium',
        'Check-in Approved ✓',
        'Your attendance has been approved. Keep up the streak!',
        '/student/history',
        'attendance_log',
        NEW.id
      );

    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        NEW.student_id,
        'attendance_rejected',
        'alert',
        'high',
        'Check-in Rejected',
        'Your attendance was not approved. Check the details.',
        '/student/history',
        'attendance_log',
        NEW.id
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_attendance_status_change
  AFTER UPDATE OF status ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_attendance_status_change();


-- --------------------------------------------------------------------------
-- 2. Badge unlocked
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_badge_unlocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_name TEXT;
BEGIN
  SELECT name INTO v_badge_name
    FROM badges
   WHERE id = NEW.badge_id;

  INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id, metadata)
  VALUES (
    NEW.user_id,
    'badge_unlocked',
    'reward',
    'medium',
    'Badge Unlocked! 🏆',
    format('You earned the "%s" badge!', v_badge_name),
    '/student/badges',
    'badge',
    NEW.badge_id,
    jsonb_build_object('badge_name', v_badge_name)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_badge_unlocked
  AFTER INSERT ON user_badges
  FOR EACH ROW
  EXECUTE FUNCTION notify_badge_unlocked();


-- --------------------------------------------------------------------------
-- 3. Streak milestone (7, 14, 30, 60, 100 days)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_streak_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak IN (7, 14, 30, 60, 100)
     AND NEW.current_streak > OLD.current_streak THEN

    INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
    VALUES (
      NEW.student_id,
      'streak_milestone',
      'reward',
      'low',
      format('%s-Day Streak! 🔥', NEW.current_streak),
      format('Amazing! You''ve maintained a %s-day attendance streak.', NEW.current_streak),
      '/student',
      'streak',
      NEW.id
    );

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_streak_milestone
  AFTER UPDATE OF current_streak ON streaks
  FOR EACH ROW
  EXECUTE FUNCTION notify_streak_milestone();


-- --------------------------------------------------------------------------
-- 4. Level up (students only)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_level_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.level > OLD.level THEN

    INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
    VALUES (
      NEW.id,
      'level_up',
      'reward',
      'medium',
      format('Level %s Reached! ⭐', NEW.level),
      format('Congratulations! You advanced to level %s.', NEW.level),
      '/student',
      'profile',
      NEW.id
    );

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_level_up
  AFTER UPDATE OF level ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'student')
  EXECUTE FUNCTION notify_level_up();


-- --------------------------------------------------------------------------
-- 5. Payout status (paid / rejected)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_payout_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN

    IF NEW.state = 'PAID' THEN
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        NEW.user_id,
        'withdrawal_approved',
        'transactional',
        'high',
        'Withdrawal Approved 💸',
        'Your payout request has been approved and processed.',
        '/student/wallet',
        'payout_request',
        NEW.id
      );

    ELSIF NEW.state = 'REJECTED' THEN
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        NEW.user_id,
        'withdrawal_rejected',
        'alert',
        'high',
        'Withdrawal Rejected',
        'Your payout request was rejected. Please check the details.',
        '/student/wallet',
        'payout_request',
        NEW.id
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payout_status
  AFTER UPDATE OF state ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_payout_status();


-- --------------------------------------------------------------------------
-- 6. Teacher — pending review (new attendance log)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_teacher_pending_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher RECORD;
BEGIN
  IF NEW.status = 'pending_teacher_view' THEN

    FOR v_teacher IN
      SELECT teacher_id
        FROM teacher_class_assignments
       WHERE class_id = NEW.class_id
    LOOP
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        v_teacher.teacher_id,
        'pending_reviews',
        'reminder',
        'medium',
        'New Attendance to Review',
        'A student has submitted attendance for your class.',
        format('/teacher/class/%s', NEW.class_id),
        'attendance_log',
        NEW.id
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_teacher_pending_review
  AFTER INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_pending_review();


-- --------------------------------------------------------------------------
-- 7. Admin — flagged submission
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_admin_flagged()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  IF OLD.teacher_flag_status IS NULL AND NEW.teacher_flag_status IS NOT NULL THEN

    FOR v_admin IN
      SELECT id FROM profiles WHERE role = 'admin' LIMIT 10
    LOOP
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        v_admin.id,
        'flagged_submission',
        'alert',
        'high',
        'Flagged Attendance Submission ⚠️',
        'A teacher has flagged an attendance submission for review.',
        '/admin/flagged',
        'attendance_log',
        NEW.id
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_flagged
  AFTER UPDATE OF teacher_flag_status ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_flagged();


-- --------------------------------------------------------------------------
-- 8. Admin — pending withdrawal request
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_admin_pending_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  IF NEW.state = 'REQUESTED' THEN

    FOR v_admin IN
      SELECT id FROM profiles WHERE role = 'admin' LIMIT 10
    LOOP
      INSERT INTO notifications (user_id, type, category, priority, title, message, action_url, related_type, related_id)
      VALUES (
        v_admin.id,
        'pending_withdrawals',
        'reminder',
        'medium',
        'New Withdrawal Request 💰',
        'A student has submitted a payout request awaiting approval.',
        '/admin/withdrawals',
        'payout_request',
        NEW.id
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_pending_withdrawal
  AFTER INSERT ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_pending_withdrawal();

COMMIT;
