export type UserRole = "student" | "teacher" | "admin";

export type AttendanceStatus =
  | "pending_teacher_view"
  | "pending_admin_review"
  | "approved"
  | "rejected";

export type ArrivalStatus = "early" | "normal" | "late" | "absent";

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "token_issued" | "redeemed" | "expired" | "cancelled";

export type TransactionType =
  | "attendance_reward"
  | "early_bonus"
  | "monthly_hold_bonus"
  | "withdrawal"
  | "hold_lock"
  | "hold_release";

export type AvatarMode = "upload" | "builder" | "initials";
export type ProfileStatus = "active" | "moderated" | "hidden";
export type CosmeticType = "frame" | "theme" | "title" | "sticker";
export type CosmeticRarity = "common" | "rare" | "epic";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  school_id: string | null;
  // New profile fields
  username: string | null;
  bio: string | null;
  avatar_mode: AvatarMode;
  theme_id: string | null;
  title_id: string | null;
  frame_id: string | null;
  sticker_id: string | null;
  profile_status: ProfileStatus;
  created_at: string;
  updated_at: string | null;
  xp: number;
  level: number;
  coins: number;
  streak_current?: number;
  rupiah?: number;
}

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: string;
  description: string | null;
  asset_url: string | null;
  css_value: string | null;
  rarity: CosmeticRarity;
  unlock_type: string;
  unlock_rule: Record<string, any> | null;
  active: boolean;
  created_at: string;
}

export interface UserCosmetic {
  id: string;
  user_id: string;
  cosmetic_id: string;
  unlocked_at: string;
  equipped: boolean;
  cosmetics?: Cosmetic;
}

export interface ProfileModerationLog {
  id: string;
  user_id: string;
  target_type: string;
  action: string;
  reason: string | null;
  note: string | null;
  moderated_by: string;
  created_at: string;
}

export interface School {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  timezone: string;
  slug: string | null;
  school_code: string | null;
  description: string | null;
  city: string | null;
  province: string | null;
  country_code: string | null;
  logo_url: string | null;
  brand_color: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  grade_level: string;
  section: string | null;
  academic_year: string | null;
  homeroom_teacher_id: string | null;
  capacity: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string | null;
  profiles?: Profile;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  profiles?: Profile;
  classes?: Class;
}

export interface TeacherClassAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  classes?: Class;
}

export interface AttendanceLog {
  id: string;
  student_id: string;
  class_id: string;
  school_id: string;
  attendance_date: string;
  submitted_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  distance_m: number;
  within_radius: boolean;
  within_time_window: boolean;
  before_early_cutoff: boolean;
  proof_image_url: string | null;
  status: AttendanceStatus;
  teacher_flag_status: string | null;
  teacher_note_summary: string | null;
  admin_note: string | null;
  device_info: string | null;
  fraud_flags: string[] | null;
  arrival_status?: ArrivalStatus | null;
  policy_id?: string | null;
  minutes_delta_from_start?: number | null;
  penalty_applied?: boolean | null;
  penalty_type?: string | null;
  penalty_value?: number | null;
  warning_count_added?: number | null;
  profiles?: Profile;
  classes?: Class;
}

export interface AttendanceReview {
  id: string;
  attendance_id: string;
  reviewer_id: string;
  reviewer_role: UserRole;
  action: string;
  note: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface TeacherNote {
  id: string;
  attendance_id: string;
  teacher_id: string;
  note: string;
  flag_type: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface RewardRules {
  id: string;
  school_id: string;
  base_reward: number;
  early_bonus: number;
  monthly_hold_bonus_pct: number;
  attendance_start_time: string;
  attendance_end_time: string;
  early_cutoff_time: string;
  min_withdrawal_amount: number;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency_type: "COIN" | "RUPIAH";
  balance_available: number;
  balance_pending: number;
  balance_locked: number;
  created_at?: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  student_id: string;
  amount: number;
  status: WithdrawalStatus;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  
  // Token verification fields
  token_code?: string | null;
  token_hash?: string | null;
  token_issued_at?: string | null;
  token_expires_at?: string | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
  redemption_method?: 'qr' | 'manual' | null;
  payout_reference?: string | null;

  profiles?: Profile;
  wallets?: Wallet;
}

export interface PayoutRedemptionLog {
  id: string;
  withdrawal_request_id: string;
  student_id: string;
  admin_id?: string | null;
  attempt_type: 'scan' | 'manual';
  token_entered?: string | null;
  result: 'success' | 'expired' | 'invalid' | 'already_used' | 'forbidden';
  device_info?: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  name: string;
  description: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  earned_at: string;
  badges?: Badge;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  school_id: string;
}

// Dashboard aggregation types
export interface StudentStats {
  currentStreak: number;
  longestStreak: number;
  totalApproved: number;
  totalEarlyArrivals: number;
  perfectWeeks: number;
}

export interface AdminDashboardStats {
  pendingVerifications: number;
  flaggedToday: number;
  approvedToday: number;
  rejectedToday: number;
  pendingWithdrawals: number;
  totalHeldBalance: number;
}

export interface Streak {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_attendance_date: string | null;
  shield_count: number;
  shield_used_dates: string[];
  updated_at: string;
}

export type RecurrenceType = 'one_time' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface HolidayTag {
  id: string;
  school_id: string | null;
  name: string;
  icon_key: string | null;
  color_hex: string;
  is_preset: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HolidayRule {
  id: string;
  school_id: string;
  class_id?: string | null;
  name: string;
  description: string | null;
  recurrence_type: RecurrenceType;
  recurrence_value: Record<string, any> | null;
  tag_id: string | null;
  color_hex: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  applies_to: string;
  pause_streaks: boolean;
  pause_attendance: boolean;
  hide_checkin: boolean;
  show_banner: boolean;
  created_by: string | null;
  created_at: string;
  holiday_tags?: HolidayTag | null;
}

export type HolidayType = 'national' | 'school' | 'exam' | RecurrenceType;

export interface HolidayCalendar {
  id: string;
  school_id: string;
  class_id?: string | null;
  date: string;
  name: string;
  type: HolidayType;
  description?: string | null;
  rule_id?: string | null;
  tag_id?: string | null;
  color_hex?: string | null;
  pause_streaks?: boolean;
  pause_attendance?: boolean;
  hide_checkin?: boolean;
  created_by?: string;
  created_at: string;
  holiday_rules?: HolidayRule | null;
  holiday_tags?: HolidayTag | null;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'attendance' | 'early_bonus' | 'streak_milestone' | 'quest' | 'purchase' | 'badge_unlock';
  reference_id?: string | null;
  description: string;
  created_at: string;
}

export interface ShopItem {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  cosmetic_id?: string | null;
  name: string;
  description?: string;
  category: 'theme' | 'frame' | 'title' | 'sticker' | 'booster' | 'shield' | 'mascot' | 'decor' | 'seasonal';
  price_rp: number;
  price_coins?: number;
  stock?: number | null;
  featured: boolean;
  available_from?: string | null;
  available_until?: string | null;
  active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  shop_item_id: string;
  price_paid: number;
  currency: 'rp' | 'coins';
  purchased_at: string;
}

export interface Badge {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  family: string;
  unlock_rule: Record<string, any>;
  active: boolean;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  is_new: boolean;
}

export interface Quest {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  reward_xp: number;
  reward_coins: number;
  requirement_type: 'checkin_count' | 'early_bird_count' | 'streak_reach';
  requirement_value: number;
  active: boolean;
  created_at: string;
}

export interface UserQuest {
  id: string;
  user_id: string;
  quest_id: string;
  status: 'in_progress' | 'completed';
  progress: number;
  completed_at?: string | null;
  created_at: string;
}

// ── Notification System ──────────────────────────────────────────────

export type NotificationType =
  | 'attendance_approved'
  | 'attendance_rejected'
  | 'streak_milestone'
  | 'streak_protected'
  | 'badge_unlocked'
  | 'quest_completed'
  | 'coins_earned'
  | 'level_up'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'shop_purchase'
  | 'pending_reviews'
  | 'flagged_submission'
  | 'pending_withdrawals'
  | 'attendance_anomaly';

export type NotificationCategory =
  | 'transactional'
  | 'reminder'
  | 'reward'
  | 'alert'
  | 'digest';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  action_url: string | null;
  related_type: string | null;
  related_id: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

// ── Academic Management System Types ────────────────────────────────
export interface SchoolAdminAssignment {
  id: string;
  school_id: string;
  user_id: string;
  assignment_role: "school_admin" | "staff_admin";
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
  schools?: School;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  color_code: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClassSubject {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  is_required: boolean;
  selection_group: string | null;
  max_students: number | null;
  term_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  subjects?: Subject;
  classes?: Class;
}

export interface StudentSubject {
  id: string;
  school_id: string;
  student_id: string;
  class_subject_id: string;
  selection_status: "pending" | "approved" | "rejected";
  assigned_by: "student" | "system" | "admin";
  term_id: string | null;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
  class_subjects?: ClassSubject;
}

export interface TeacherSubjectAssignment {
  id: string;
  school_id: string;
  teacher_id: string;
  class_subject_id: string;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
  class_subjects?: ClassSubject;
}

export interface ClassSubjectPolicy {
  id: string;
  school_id: string;
  class_id: string;
  selection_start_date: string | null;
  selection_end_date: string | null;
  min_electives: number;
  max_electives: number;
  auto_enroll_required: boolean;
  term_id: string | null;
  selection_locked: boolean;
  created_at?: string;
  updated_at?: string;
  classes?: Class;
}

export interface AcademicTerm {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
}

export interface SchoolPeriod {
  id: string;
  school_id: string;
  day_index: number;
  period_order: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  term_id: string | null;
  created_at?: string;
}

export interface ClassScheduleSession {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  period_id: string;
  room_name: string | null;
  is_active: boolean;
  term_id: string | null;
  created_at?: string;
  subjects?: Subject;
  classes?: Class;
  profiles?: Profile;
  school_periods?: SchoolPeriod;
}

export interface StudentSchedulePreference {
  id: string;
  student_id: string;
  default_view: "weekly" | "daily";
  reminder_enabled: boolean;
  favorite_subject_ids: string[];
  color_mode: "subject" | "teacher" | "room";
  created_at?: string;
}

export interface AttendancePolicy {
  id: string;
  school_id: string;
  class_id: string | null;
  schedule_id: string | null;
  name: string;
  checkin_open_at: string;
  early_start_at: string;
  early_end_at: string;
  normal_start_at: string;
  normal_end_at: string;
  late_start_at: string;
  late_end_at: string;
  absent_after_at: string;
  late_enabled: boolean;
  late_grace_minutes: number;
  late_penalty_type: string | null;
  late_penalty_value: number | null;
  late_escalation_count: number | null;
  late_escalation_action: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at?: string;
  updated_at?: string;
}

