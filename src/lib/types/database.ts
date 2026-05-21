export type UserRole = "student" | "teacher" | "admin";

export type AttendanceStatus =
  | "pending_teacher_view"
  | "pending_admin_review"
  | "approved"
  | "rejected";

export type WithdrawalStatus = "pending" | "approved" | "rejected";

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
  address: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  timezone: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  grade_level: string;
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
  profiles?: Profile;
  wallets?: Wallet;
}

export interface Badge {
  id: string;
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

export type HolidayType = 'national' | 'school' | 'exam';

export interface HolidayCalendar {
  id: string;
  school_id: string;
  date: string;
  name: string;
  type: HolidayType;
  created_by?: string;
  created_at: string;
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
