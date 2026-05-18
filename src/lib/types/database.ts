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

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  school_id: string | null;
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
  student_id: string;
  pending_balance: number;
  available_balance: number;
  held_balance: number;
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
