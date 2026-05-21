-- ============================================================================
-- NOTIFICATION SYSTEM — TABLES, INDEXES, RLS & REALTIME
-- ============================================================================
-- Creates:
--   1. notifications              — stores every notification sent to a user
--   2. notification_preferences   — per-user delivery / quiet-hours settings
--
-- Indexes:
--   - idx_notifications_user_unread   (partial, unread only)
--   - idx_notifications_user_created  (reverse-chrono feed)
--   - idx_notifications_type          (filter by notification type)
--
-- RLS:
--   - notifications:              users read & mark-read their own rows
--   - notification_preferences:   users manage their own row
--
-- Realtime:
--   - notifications table added to supabase_realtime publication
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. notifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'transactional',
  priority      TEXT        NOT NULL DEFAULT 'low',
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  action_url    TEXT,
  related_type  TEXT,
  related_id    UUID,
  is_read       BOOLEAN     NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

-- Partial index — fast "unread count / list" queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read)
  WHERE is_read = false;

-- Reverse-chrono feed per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Filter by notification type
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications (type);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (update is_read / read_at)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy for authenticated users — inserts happen via
-- SECURITY DEFINER trigger functions (see schema-notification-triggers.sql).
-- service_role bypasses RLS automatically.

-- Supabase Realtime — push new rows to the client in real time
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- --------------------------------------------------------------------------
-- 2. notification_preferences
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  muted_categories  TEXT[]  DEFAULT '{}',
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  push_enabled      BOOLEAN DEFAULT true,
  email_enabled     BOOLEAN DEFAULT false,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read, insert, update, and delete their own preferences row
CREATE POLICY "Users manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
