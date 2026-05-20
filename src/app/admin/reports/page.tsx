"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  BarChart3, TrendingUp, Users, Calendar, Download, RefreshCw,
  Trophy, Shield, Wallet, AlertTriangle, Search, ChevronRight,
  User, Settings, ArrowUpRight, ArrowDownRight, Award, 
  ShoppingBag, Landmark, Eye, HelpCircle, Flame, CheckCircle, XCircle
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, 
  PieChart, Pie, Cell 
} from "recharts";
import { format, subDays, differenceInDays, addDays } from "date-fns";
import { toast } from "sonner";

// Interfaces
interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  level: number;
  xp: number;
  coins: number;
  title_id: string | null;
  created_at: string;
  streaks?: {
    current_streak: number;
    longest_streak: number;
    shield_count: number;
    shield_used_dates: string[];
    last_attendance_date: string | null;
  };
  class_id?: string;
  class_name?: string;
  grade_level?: string;
}

interface ClassModel {
  id: string;
  name: string;
  grade_level: string;
}

interface WalletModel {
  id: string;
  user_id: string;
  currency_type: "COIN" | "RUPIAH";
  balance_available: number;
  balance_pending: number;
  balance_locked: number;
}

interface WalletTransactionModel {
  id: string;
  wallet_id: string;
  user_id: string;
  event_type: string;
  amount: number;
  currency_type: "COIN" | "RUPIAH";
  state: "PENDING" | "APPROVED" | "RELEASED" | "PAID" | "REJECTED";
  daily_cap_applied: boolean;
  note: string | null;
  created_at: string;
}

interface PayoutRequestModel {
  id: string;
  user_id: string;
  amount: number;
  destination: string;
  state: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED";
  created_at: string;
  processed_at: string | null;
}

interface UserBadgeModel {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  badges?: {
    name: string;
    description: string;
    icon: string;
    rarity: string;
    family: string;
  };
}

interface PurchaseModel {
  id: string;
  user_id: string;
  shop_item_id: string;
  price_paid: number;
  currency: string;
  purchased_at: string;
  shop_items?: {
    name: string;
    category: string;
  };
}

// Chart Colors
const COLORS = {
  emerald: "#10b981",
  teal: "#0d9488",
  indigo: "#6366f1",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  rose: "#f43f5e",
  orange: "#f97316",
  purple: "#8b5cf6",
  fuchsia: "#d946ef",
  slate: "#64748b"
};

const PIE_COLORS = [COLORS.emerald, COLORS.cyan, COLORS.indigo, COLORS.amber, COLORS.rose];

export default function AdminReportsPage() {
  const { t, isClient } = useTranslation();
  
  // Date and filter selections
  const [datePreset, setDatePreset] = useState<"7d" | "14d" | "30d" | "month" | "custom">("7d");
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  
  // Tab preset states
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "economy" | "gamification" | "risk" | "drilldown">("overview");

  // Raw fetched datasets
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletTransactionModel[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequestModel[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadgeModel[]>([]);
  const [purchases, setPurchases] = useState<PurchaseModel[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [wallets, setWallets] = useState<WalletModel[]>([]);
  const [cosmetics, setCosmetics] = useState<any[]>([]);
  const [rewardRules, setRewardRules] = useState<any>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Drilldown states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // Pre-calculated options
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  
  // Load Date presets helper
  useEffect(() => {
    const today = new Date();
    if (datePreset === "7d") {
      setStartDate(format(subDays(today, 6), "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    } else if (datePreset === "14d") {
      setStartDate(format(subDays(today, 13), "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    } else if (datePreset === "30d") {
      setStartDate(format(subDays(today, 29), "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    } else if (datePreset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(format(firstDay, "yyyy-MM-dd"));
      setEndDate(format(today, "yyyy-MM-dd"));
    }
  }, [datePreset]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      
      const schoolId = adminProfile?.school_id;
      if (!schoolId) {
        toast.error("No school assigned to your admin profile.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const startIso = new Date(startDate).toISOString();
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      const endIso = endOfDay.toISOString();

      // Parallel data fetching for maximum performance
      const [
        studentsRes,
        streaksRes,
        logsRes,
        txsRes,
        payoutsRes,
        badgesRes,
        purchasesRes,
        classesRes,
        walletsRes,
        cosmeticsRes,
        rulesRes,
        assignmentsRes
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("school_id", schoolId).eq("role", "student"),
        supabase.from("streaks").select("*, profiles!inner(school_id)").eq("profiles.school_id", schoolId),
        supabase.from("attendance_logs").select("*, profiles!inner(school_id, full_name), classes(name, grade_level)").eq("profiles.school_id", schoolId).gte("attendance_date", startDate).lte("attendance_date", endDate),
        supabase.from("wallet_transactions").select("*, profiles!inner(school_id)").eq("profiles.school_id", schoolId).gte("created_at", startIso).lte("created_at", endIso),
        supabase.from("payout_requests").select("*, profiles!inner(school_id)").eq("profiles.school_id", schoolId).gte("created_at", startIso).lte("created_at", endIso),
        supabase.from("user_badges").select("*, profiles!inner(school_id), badges(*)").eq("profiles.school_id", schoolId).gte("unlocked_at", startIso).lte("unlocked_at", endIso),
        supabase.from("purchases").select("*, shop_items(*), profiles!inner(school_id)").eq("profiles.school_id", schoolId).gte("purchased_at", startIso).lte("purchased_at", endIso),
        supabase.from("classes").select("*").eq("school_id", schoolId),
        supabase.from("wallets").select("*, profiles!inner(school_id)").eq("profiles.school_id", schoolId),
        supabase.from("cosmetics").select("id, name, type"),
        supabase.from("reward_rules").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase.from("enrollments").select("*, classes!inner(school_id)").eq("classes.school_id", schoolId)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (classesRes.error) throw classesRes.error;

      // Map streaks, classes and grade levels to students in memory
      const streaksMap = new Map(streaksRes.data?.map(s => [s.student_id, s]) || []);
      const classMap = new Map(classesRes.data?.map(c => [c.id, c]) || []);
      
      const enrollMap = new Map<string, { class_id: string; class_name: string; grade_level: string }>();
      assignmentsRes.data?.forEach(e => {
        const cls = classMap.get(e.class_id);
        if (cls) {
          enrollMap.set(e.student_id, {
            class_id: cls.id,
            class_name: cls.name,
            grade_level: cls.grade_level
          });
        }
      });

      const processedStudents: StudentProfile[] = (studentsRes.data || []).map(student => {
        const streakRecord = streaksMap.get(student.id);
        const enrollment = enrollMap.get(student.id);
        return {
          ...student,
          streaks: streakRecord ? {
            current_streak: streakRecord.current_streak,
            longest_streak: streakRecord.longest_streak,
            shield_count: streakRecord.shield_count,
            shield_used_dates: streakRecord.shield_used_dates || [],
            last_attendance_date: streakRecord.last_attendance_date
          } : undefined,
          class_id: enrollment?.class_id,
          class_name: enrollment?.class_name,
          grade_level: enrollment?.grade_level
        };
      });

      setStudents(processedStudents);
      setLogs(logsRes.data || []);
      setWalletTxs((txsRes.data || []) as WalletTransactionModel[]);
      setPayouts((payoutsRes.data || []) as PayoutRequestModel[]);
      setUserBadges((badgesRes.data || []) as UserBadgeModel[]);
      setPurchases((purchasesRes.data || []) as PurchaseModel[]);
      setClasses(classesRes.data || []);
      setWallets((walletsRes.data || []) as WalletModel[]);
      setCosmetics(cosmeticsRes.data || []);
      setRewardRules(rulesRes.data || null);

      // Collect available grades for filtering
      const grades = Array.from(new Set((classesRes.data || []).map(c => c.grade_level))).sort();
      setAvailableGrades(grades);

    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load dashboard statistics: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  if (!isClient) return null;

  // -------------------------------------------------------------
  // DATA FILTERING & SEGMENTATION (React Memory Computed)
  // -------------------------------------------------------------
  
  // Filter students based on Grade & Class selectors
  const filteredStudents = students.filter(student => {
    if (selectedGrade !== "ALL" && student.grade_level !== selectedGrade) return false;
    if (selectedClassId !== "ALL" && student.class_id !== selectedClassId) return false;
    return true;
  });

  const studentIdsSet = new Set(filteredStudents.map(s => s.id));

  // Filter logs, transactions, and payouts based on filtered students
  const filteredLogs = logs.filter(l => studentIdsSet.has(l.student_id));
  const filteredWalletTxs = walletTxs.filter(t => studentIdsSet.has(t.user_id));
  const filteredPayouts = payouts.filter(p => studentIdsSet.has(p.user_id));
  const filteredUserBadges = userBadges.filter(b => studentIdsSet.has(b.user_id));
  const filteredPurchases = purchases.filter(p => studentIdsSet.has(p.user_id));

  // Format currency helpers
  const formatRp = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatCoins = (val: number) => {
    return `${val.toLocaleString()} 🪙`;
  };

  const isExcused = (log: any) => {
    const note = ((log.admin_note || "") + " " + (log.teacher_note_summary || "")).toLowerCase();
    return note.includes("excuse") || note.includes("sakit") || note.includes("izin") || note.includes("dispensation") || note.includes("dispensasi");
  };

  // -------------------------------------------------------------
  // METRIC CALCULATIONS
  // -------------------------------------------------------------
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const totalStudentsCount = filteredStudents.length;

  // Daily Attendance Rates (7d / 30d)
  const calcAttendanceRate = (daysCount: number) => {
    const cutoffDate = format(subDays(new Date(), daysCount - 1), "yyyy-MM-dd");
    const rangeLogs = filteredLogs.filter(l => l.attendance_date >= cutoffDate && l.attendance_date <= todayStr);
    const uniqueDates = Array.from(new Set(rangeLogs.map(l => l.attendance_date)));
    const schoolDays = uniqueDates.filter(d => {
      const day = new Date(d).getDay();
      return day !== 0 && day !== 6; // Mon-Fri
    });
    if (schoolDays.length === 0 || totalStudentsCount === 0) return 0;
    const approved = rangeLogs.filter(l => l.status === "approved" && schoolDays.includes(l.attendance_date)).length;
    return Math.min(100, Math.round((approved / (totalStudentsCount * schoolDays.length)) * 100));
  };

  const avgRate7d = calcAttendanceRate(7);
  const avgRate30d = calcAttendanceRate(30);

  // Streak health
  const totalStreakVal = filteredStudents.reduce((sum, s) => sum + (s.streaks?.current_streak || 0), 0);
  const avgStreakLength = totalStudentsCount > 0 ? (totalStreakVal / totalStudentsCount).toFixed(1) : "0.0";
  const pctStreak3 = totalStudentsCount > 0 ? Math.round((filteredStudents.filter(s => (s.streaks?.current_streak || 0) >= 3).length / totalStudentsCount) * 100) : 0;
  const pctStreak7 = totalStudentsCount > 0 ? Math.round((filteredStudents.filter(s => (s.streaks?.current_streak || 0) >= 7).length / totalStudentsCount) * 100) : 0;
  const pctStreak30 = totalStudentsCount > 0 ? Math.round((filteredStudents.filter(s => (s.streaks?.current_streak || 0) >= 30).length / totalStudentsCount) * 100) : 0;

  // Economy & Payout KPIs
  const coinsToday = filteredWalletTxs.filter(t => t.currency_type === "COIN" && format(new Date(t.created_at), "yyyy-MM-dd") === todayStr);
  const coinsEarnedToday = coinsToday.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const coinsSpentToday = Math.abs(coinsToday.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));

  const rupiahToday = filteredWalletTxs.filter(t => t.currency_type === "RUPIAH" && format(new Date(t.created_at), "yyyy-MM-dd") === todayStr);
  const rupiahIssuedToday = rupiahToday.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  const pendingWithdrawalCount = filteredPayouts.filter(p => p.state === "REQUESTED").length;
  const paidWithdrawalCount = filteredPayouts.filter(p => p.state === "PAID").length;

  // XP Today
  const logsToday = filteredLogs.filter(l => l.attendance_date === todayStr && l.status === "approved");
  const xpEarnedToday = logsToday.reduce((sum, l) => sum + 100 + (l.before_early_cutoff ? 50 : 0), 0);

  // Class-specific breakdown list
  const activeClasses = classes.filter(c => {
    if (selectedGrade !== "ALL" && c.grade_level !== selectedGrade) return false;
    if (selectedClassId !== "ALL" && c.id !== selectedClassId) return false;
    return true;
  });

  // Calculate unique school days in active range for trends
  const startObj = new Date(startDate);
  const endObj = new Date(endDate);
  const daysDiff = differenceInDays(endObj, startObj) + 1;
  const dateRangeList = Array.from({ length: daysDiff }, (_, i) => {
    const d = addDays(startObj, i);
    return format(d, "yyyy-MM-dd");
  });

  // -------------------------------------------------------------
  // CHART TIMELINES AGGREGATION
  // -------------------------------------------------------------
  const attendanceTrendData = dateRangeList.map(dateStr => {
    const dayLogs = filteredLogs.filter(l => l.attendance_date === dateStr);
    const dayTxs = filteredWalletTxs.filter(t => format(new Date(t.created_at), "yyyy-MM-dd") === dateStr);
    
    const approved = dayLogs.filter(l => l.status === "approved").length;
    const present = dayLogs.filter(l => l.status === "approved" && l.within_time_window).length;
    const late = dayLogs.filter(l => l.status === "approved" && !l.within_time_window).length;
    const rejected = dayLogs.filter(l => l.status === "rejected").length;
    const excused = dayLogs.filter(l => l.status === "rejected" && isExcused(l)).length;
    const flagged = dayLogs.filter(l => l.teacher_flag_status !== null || l.fraud_flags?.length > 0).length;

    // Financial Cashflows
    const coinsIssued = dayTxs.filter(t => t.currency_type === "COIN" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const coinsSpent = Math.abs(dayTxs.filter(t => t.currency_type === "COIN" && t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const rupiahIssued = dayTxs.filter(t => t.currency_type === "RUPIAH" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    
    // Day Name
    const label = format(new Date(dateStr), "dd MMM");

    return {
      date: dateStr,
      label,
      approved,
      present,
      late,
      rejected,
      excused,
      flagged,
      coinsIssued,
      coinsSpent,
      rupiahIssued,
      rate: totalStudentsCount > 0 ? Math.min(100, Math.round((approved / totalStudentsCount) * 100)) : 0
    };
  });

  // Level Distribution
  const levelBands = [
    { name: "Lvl 1 - 5", count: filteredStudents.filter(s => s.level >= 1 && s.level <= 5).length },
    { name: "Lvl 6 - 10", count: filteredStudents.filter(s => s.level >= 6 && s.level <= 10).length },
    { name: "Lvl 11 - 20", count: filteredStudents.filter(s => s.level >= 11 && s.level <= 20).length },
    { name: "Lvl 21+", count: filteredStudents.filter(s => s.level >= 21).length }
  ];

  // Coin balances distribution
  const coinDistribution = [
    { name: "0 Coins", count: filteredStudents.filter(s => s.coins === 0).length },
    { name: "1 - 100", count: filteredStudents.filter(s => s.coins > 0 && s.coins <= 100).length },
    { name: "101 - 500", count: filteredStudents.filter(s => s.coins > 100 && s.coins <= 500).length },
    { name: "501 - 2000", count: filteredStudents.filter(s => s.coins > 500 && s.coins <= 2000).length },
    { name: "2001+", count: filteredStudents.filter(s => s.coins > 2000).length }
  ].filter(c => c.count > 0);

  // Badge unlock rarity distribution
  const badgeRarities = [
    { name: "Common", count: filteredUserBadges.filter(b => b.badges?.rarity === "common").length },
    { name: "Rare", count: filteredUserBadges.filter(b => b.badges?.rarity === "rare").length },
    { name: "Epic", count: filteredUserBadges.filter(b => b.badges?.rarity === "epic").length },
    { name: "Legendary", count: filteredUserBadges.filter(b => b.badges?.rarity === "legendary").length }
  ].filter(r => r.count > 0);

  // Top shop items sold
  const shopSalesMap = new Map<string, { name: string; count: number; value: number }>();
  filteredPurchases.forEach(p => {
    if (!p.shop_item_id) return;
    const name = p.shop_items?.name || "Streak Shield";
    const existing = shopSalesMap.get(p.shop_item_id) || { name, count: 0, value: 0 };
    shopSalesMap.set(p.shop_item_id, {
      name,
      count: existing.count + 1,
      value: existing.value + p.price_paid
    });
  });
  const topShopItems = Array.from(shopSalesMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Anomaly & Risk Patterns
  // 1. Weak GPS cases (accuracy > 100m)
  const weakGPSCount = filteredLogs.filter(l => l.accuracy_m > 100).length;
  // 2. Geofence violation bypass (outside radius but marked approved? or just submitted)
  const geofenceBreaches = filteredLogs.filter(l => !l.within_radius).length;
  // 3. Repeated device IDs sharing logins (potential helper sign-ins)
  const deviceIDMap = new Map<string, string[]>(); // device -> list of student names
  filteredLogs.forEach(l => {
    if (!l.device_info) return;
    const names = deviceIDMap.get(l.device_info) || [];
    const studentName = l.profiles?.full_name || "Unknown Student";
    if (!names.includes(studentName)) {
      names.push(studentName);
    }
    deviceIDMap.set(l.device_info, names);
  });
  
  const duplicatedDevices = Array.from(deviceIDMap.entries())
    .filter(([dev, names]) => names.length > 1 && dev !== "web" && dev !== "unknown")
    .map(([device, names]) => ({ device, names, count: names.length }));

  // 4. Dormant students (no approved check-ins in the selected range, or who haven't checked in for 7+ days)
  const dormantStudents = filteredStudents.filter(student => {
    const studentLogs = filteredLogs.filter(l => l.student_id === student.id && l.status === "approved");
    if (studentLogs.length > 0) return false;
    
    // Check if the student's last check-in date was prior to 7 days ago
    if (!student.streaks?.last_attendance_date) return true;
    const daysSince = differenceInDays(new Date(), new Date(student.streaks.last_attendance_date));
    return daysSince >= 7;
  }).map(s => {
    const daysSince = s.streaks?.last_attendance_date 
      ? differenceInDays(new Date(), new Date(s.streaks.last_attendance_date)) 
      : 99;
    return { ...s, daysInactive: daysSince };
  }).sort((a, b) => b.daysInactive - a.daysInactive);

  // 5. Coin earning spikes: students who earned more than 500 coins in this period
  const coinSpikeEarners = filteredStudents.map(student => {
    const earned = filteredWalletTxs
      .filter(t => t.user_id === student.id && t.currency_type === "COIN" && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    return { student, earned };
  }).filter(e => e.earned > 250) // threshold e.g. 250 coins
    .sort((a, b) => b.earned - a.earned);

  // -------------------------------------------------------------
  // CSV EXPORT GENERATION FUNCTIONS
  // -------------------------------------------------------------
  const exportAttendanceCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No attendance logs available to export.");
      return;
    }
    const headers = [
      "Student Name", "Grade", "Class", "Date", "Submitted At", 
      "Distance (meters)", "Accuracy (meters)", "Within Radius", 
      "On Time", "Early Cutoff Met", "Status", "Fraud Flags", "Teacher Note"
    ];
    const rows = filteredLogs.map(l => [
      l.profiles?.full_name || "Unknown",
      l.classes?.grade_level || "-",
      l.classes?.name || "-",
      l.attendance_date,
      l.submitted_at ? format(new Date(l.submitted_at), "HH:mm:ss") : "-",
      l.distance_m ? Math.round(l.distance_m) : "0",
      l.accuracy_m ? Math.round(l.accuracy_m) : "0",
      l.within_radius ? "YES" : "NO",
      l.within_time_window ? "YES" : "NO",
      l.before_early_cutoff ? "YES" : "NO",
      l.status,
      (l.fraud_flags || []).join("; "),
      l.teacher_note_summary || l.admin_note || ""
    ]);

    triggerDownload("attendance_ledger", headers, rows);
  };

  const exportEconomyCSV = () => {
    if (filteredWalletTxs.length === 0) {
      toast.error("No transactions available to export.");
      return;
    }
    const headers = [
      "Transaction ID", "Student Name", "Currency Type", "Amount", 
      "State", "Event Type", "Daily Cap Applied", "Note", "Timestamp"
    ];
    const rows = filteredWalletTxs.map(t => {
      const student = students.find(s => s.id === t.user_id);
      return [
        t.id,
        student?.full_name || "Unknown",
        t.currency_type,
        t.amount,
        t.state,
        t.event_type,
        t.daily_cap_applied ? "YES" : "NO",
        t.note || "",
        format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss")
      ];
    });

    triggerDownload("economy_ledger", headers, rows);
  };

  const exportBadgesCSV = () => {
    if (filteredUserBadges.length === 0) {
      toast.error("No badges data available to export.");
      return;
    }
    const headers = ["Student Name", "Badge Name", "Family", "Rarity", "Description", "Unlocked At"];
    const rows = filteredUserBadges.map(b => {
      const student = students.find(s => s.id === b.user_id);
      return [
        student?.full_name || "Unknown",
        b.badges?.name || "Unknown Badge",
        b.badges?.family || "-",
        b.badges?.rarity || "-",
        b.badges?.description || "",
        format(new Date(b.unlocked_at), "yyyy-MM-dd HH:mm:ss")
      ];
    });

    triggerDownload("badges_ledger", headers, rows);
  };

  const exportPayoutsCSV = () => {
    if (filteredPayouts.length === 0) {
      toast.error("No withdrawal requests available to export.");
      return;
    }
    const headers = ["Request ID", "Student Name", "Amount (Rupiah)", "Destination", "State", "Requested At", "Processed At"];
    const rows = filteredPayouts.map(p => {
      const student = students.find(s => s.id === p.user_id);
      return [
        p.id,
        student?.full_name || "Unknown",
        p.amount,
        p.destination,
        p.state,
        format(new Date(p.created_at), "yyyy-MM-dd HH:mm:ss"),
        p.processed_at ? format(new Date(p.processed_at), "yyyy-MM-dd HH:mm:ss") : "-"
      ];
    });

    triggerDownload("withdrawals_ledger", headers, rows);
  };

  const triggerDownload = (name: string, headers: string[], rows: any[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(h => `"${h}"`).join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${name}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report generated and download initiated!");
  };

  // -------------------------------------------------------------
  // STUDENTS DRILL DOWN PANEL FILTERING
  // -------------------------------------------------------------
  const drilldownList = filteredStudents.filter(s => 
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* -------------------------------------------------------------
          HEADER & ADMINISTRATIVE FILTER BAR
          ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-500">
            <BarChart3 className="h-5 w-5" /> Analytics & Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Observe attendance, streak health, Rupiah/Coin economies, and behavioral risk anomalies.
          </p>
        </div>

        {/* Global filter container */}
        <div className="flex flex-wrap items-center gap-2.5 bg-card/60 p-2.5 rounded-2xl border border-border/80 shadow-md">
          {/* Preset Select */}
          <select 
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as any)}
            className="px-2.5 py-1.5 bg-background border border-border text-xs rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="14d">Last 14 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Date pickers (enabled if custom) */}
          <div className="flex items-center gap-1">
            <input 
              type="date"
              value={startDate}
              disabled={datePreset !== "custom"}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-background border border-border text-xs rounded-lg disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input 
              type="date"
              value={endDate}
              disabled={datePreset !== "custom"}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-background border border-border text-xs rounded-lg disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="h-4 w-px bg-border/60" />

          {/* Grade filter */}
          <select
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value);
              setSelectedClassId("ALL"); // Reset class filter
            }}
            className="px-2.5 py-1.5 bg-background border border-border text-xs rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">All Grades</option>
            {availableGrades.map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>

          {/* Class filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border text-xs rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">All Classes</option>
            {classes
              .filter(c => selectedGrade === "ALL" || c.grade_level === selectedGrade)
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            }
          </select>

          <button 
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-1.5 bg-background hover:bg-muted text-muted-foreground rounded-lg transition-colors border border-border"
            title="Refresh statistics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-500" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground animate-pulse font-medium">Aggregating organization metrics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* -------------------------------------------------------------
              TABS VIEW PRESETS
              ------------------------------------------------------------- */}
          <div className="flex border-b border-border overflow-x-auto hide-scrollbar whitespace-nowrap gap-1">
            <button 
              onClick={() => setActiveTab("overview")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "overview" 
                  ? "border-cyan-500 text-cyan-500 bg-cyan-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Overview
            </button>
            <button 
              onClick={() => setActiveTab("attendance")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "attendance" 
                  ? "border-emerald-500 text-emerald-500 bg-emerald-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Attendance & Habit
            </button>
            <button 
              onClick={() => setActiveTab("economy")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "economy" 
                  ? "border-indigo-500 text-indigo-500 bg-indigo-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="h-3.5 w-3.5" /> Economy & Rewards
            </button>
            <button 
              onClick={() => setActiveTab("gamification")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "gamification" 
                  ? "border-purple-500 text-purple-500 bg-purple-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> Gamification
            </button>
            <button 
              onClick={() => setActiveTab("risk")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "risk" 
                  ? "border-rose-500 text-rose-500 bg-rose-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Behavioral Risk
            </button>
            <button 
              onClick={() => setActiveTab("drilldown")} 
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "drilldown" 
                  ? "border-teal-500 text-teal-500 bg-teal-500/[0.03]" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Student Drill-down
            </button>
          </div>

          {/* -------------------------------------------------------------
              TAB CONTENT: OVERVIEW (Aggregated KPIs)
              ------------------------------------------------------------- */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Primary KPIs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Students Card */}
                <div className="glass-card rounded-2xl p-5 border border-border/80 hover:border-cyan-500/20 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Enrolled</span>
                    <Users className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-foreground">{totalStudentsCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Students in selected classes</p>
                  </div>
                </div>

                {/* Attendance rate card */}
                <div className="glass-card rounded-2xl p-5 border border-border/80 hover:border-emerald-500/20 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Attendance Rate (7d / 30d)</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-foreground">{avgRate7d}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      7d average vs <span className="font-semibold text-emerald-500">{avgRate30d}%</span> in 30d
                    </p>
                  </div>
                </div>

                {/* Today's XP economy */}
                <div className="glass-card rounded-2xl p-5 border border-border/80 hover:border-purple-500/20 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Daily XP / Coins Today</span>
                    <Trophy className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-foreground">+{xpEarnedToday.toLocaleString()} XP</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Earned: <span className="font-bold text-amber-500">+{coinsEarnedToday}</span>, Spent: <span className="font-bold text-rose-400">-{coinsSpentToday}</span> 🪙
                    </p>
                  </div>
                </div>

                {/* Rupiah flow card */}
                <div className="glass-card rounded-2xl p-5 border border-border/80 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Rupiah Flow Today</span>
                    <Landmark className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-foreground">{formatRp(rupiahIssuedToday)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pending: <span className="font-bold text-indigo-400">{pendingWithdrawalCount}</span>, Paid: <span className="font-semibold">{paidWithdrawalCount}</span> payouts
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-KPI Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/60">
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Streak Health</span>
                  <p className="text-lg font-black text-foreground">{avgStreakLength} days average</p>
                  <p className="text-[10px] text-muted-foreground">
                    Students streak split: 3d+ ({pctStreak3}%), 7d+ ({pctStreak7}%), 30d+ ({pctStreak30}%)
                  </p>
                </div>
                <div className="flex flex-col gap-1 border-t md:border-t-0 md:border-x border-border/50 px-0 md:px-4 py-2 md:py-0 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Active Geofencing Bypass</span>
                  <p className="text-lg font-black text-foreground">{geofenceBreaches} out-of-radius flags</p>
                  <p className="text-[10px] text-muted-foreground">
                    Weak GPS accuracy (&gt;100m) cases: {weakGPSCount} occurrences
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Streak Saver Usage</span>
                  <p className="text-lg font-black text-foreground">
                    {filteredStudents.reduce((acc, s) => acc + (s.streaks?.shield_used_dates?.length || 0), 0)} Shields Used
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Current shields held in inventory: {filteredStudents.reduce((acc, s) => acc + (s.streaks?.shield_count || 0), 0)} shields
                  </p>
                </div>
              </div>

              {/* Core Charts Area */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Attendance Volume & Rates */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between h-[360px]">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="font-bold text-sm text-foreground">Daily Attendance Rates & Status</h2>
                      <p className="text-[10px] text-muted-foreground">Timeline of check-in rates and approval statuses</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attendanceTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="rate" name="Present Rate (%)" stroke={COLORS.emerald} fillOpacity={1} fill="url(#rateGrad)" strokeWidth={2} />
                        <Line type="monotone" dataKey="flagged" name="Flagged Logs" stroke={COLORS.amber} strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="rejected" name="Rejected Logs" stroke={COLORS.rose} strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Economy Cashflows */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between h-[360px]">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="font-bold text-sm text-foreground">Coin Earning & Spending Flow</h2>
                      <p className="text-[10px] text-muted-foreground">Daily economy issuance and store consumption</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Bar dataKey="coinsIssued" name="Coins Earned" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="coinsSpent" name="Coins Spent" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* -------------------------------------------------------------
              TAB CONTENT: ATTENDANCE & HABIT
              ------------------------------------------------------------- */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-foreground">Class Performance Summary</h2>
                  <p className="text-[10px] text-muted-foreground">Aggregated attendance rates and saver metrics by class</p>
                </div>
                <button 
                  onClick={exportAttendanceCSV}
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 shadow-md shadow-emerald-500/10"
                >
                  <Download className="h-3.5 w-3.5" /> Export Attendance Ledger
                </button>
              </div>

              {/* Class stats table */}
              <div className="glass-card rounded-2xl border border-border/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                        <th className="p-3">Class Name</th>
                        <th className="p-3">Grade</th>
                        <th className="p-3">Students Enrolled</th>
                        <th className="p-3">Present Status Count</th>
                        <th className="p-3">Late Status Count</th>
                        <th className="p-3">Rejected Count</th>
                        <th className="p-3">Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {activeClasses.map(c => {
                        const classStudents = filteredStudents.filter(s => s.class_id === c.id);
                        const classLogs = filteredLogs.filter(l => l.class_id === c.id);
                        
                        const presentCount = classLogs.filter(l => l.status === "approved" && l.within_time_window).length;
                        const lateCount = classLogs.filter(l => l.status === "approved" && !l.within_time_window).length;
                        const rejectedCount = classLogs.filter(l => l.status === "rejected").length;
                        
                        const uniqueDates = Array.from(new Set(classLogs.map(l => l.attendance_date))).length || 1;
                        const potential = classStudents.length * uniqueDates;
                        const rate = potential > 0 ? Math.round(((presentCount + lateCount) / potential) * 100) : 0;

                        return (
                          <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-bold text-foreground">{c.name}</td>
                            <td className="p-3">Grade {c.grade_level}</td>
                            <td className="p-3 font-semibold">{classStudents.length}</td>
                            <td className="p-3 text-emerald-500 font-medium">✓ {presentCount}</td>
                            <td className="p-3 text-amber-500 font-medium">◷ {lateCount}</td>
                            <td className="p-3 text-rose-500 font-medium">✗ {rejectedCount}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-muted h-2 rounded-full overflow-hidden shrink-0">
                                  <div 
                                    className={`h-full rounded-full ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`} 
                                    style={{ width: `${rate}%` }} 
                                  />
                                </div>
                                <span className="font-bold text-foreground">{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {activeClasses.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">No classes found matching filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Habit Metrics & Accuracy Report */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* GPS and Radius Accuracy Analysis */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[320px] flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">GPS Location Drift & Verification</h3>
                    <p className="text-[10px] text-muted-foreground">Comparison of check-in accuracy vs geofence distances (meters)</p>
                  </div>
                  
                  {/* Timeline Chart */}
                  <div className="flex-1 w-full min-h-[200px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={attendanceTrendData.filter(d => d.approved > 0)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                        
                        <Line type="monotone" dataKey="approved" name="Approved Check-ins" stroke={COLORS.indigo} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="present" name="Early Check-ins" stroke={COLORS.emerald} strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="late" name="Late Check-ins" stroke={COLORS.amber} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Streak Saver Card */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Streak Saver & Shield Analytics</h3>
                    <p className="text-[10px] text-muted-foreground">Streak preservation patterns and fallback saves</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-center">
                      <Shield className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                      <p className="text-2xl font-black text-foreground">
                        {filteredStudents.reduce((acc, s) => acc + (s.streaks?.shield_count || 0), 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Shields Currently Held</p>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-center">
                      <Flame className="h-5 w-5 text-rose-500 mx-auto mb-1" />
                      <p className="text-2xl font-black text-foreground">
                        {filteredStudents.reduce((acc, s) => acc + (s.streaks?.shield_used_dates?.length || 0), 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Saves Triggered (All Time)</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs border-t border-border/50 pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Students with active Shields:</span>
                      <span className="font-semibold text-foreground">
                        {filteredStudents.filter(s => (s.streaks?.shield_count || 0) > 0).length} students ({
                          totalStudentsCount > 0 ? Math.round((filteredStudents.filter(s => (s.streaks?.shield_count || 0) > 0).length / totalStudentsCount) * 100) : 0
                        }%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Longest Streak in school:</span>
                      <span className="font-bold text-rose-500">
                        {filteredStudents.reduce((max, s) => Math.max(max, s.streaks?.longest_streak || 0), 0)} days
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* -------------------------------------------------------------
              TAB CONTENT: ECONOMY & REWARDS
              ------------------------------------------------------------- */}
          {activeTab === "economy" && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-foreground">Coin & Rupiah Reward Flows</h2>
                  <p className="text-[10px] text-muted-foreground">Earning ledgers and withdrawal health</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={exportEconomyCSV}
                    className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 shadow-md shadow-indigo-500/10"
                  >
                    <Download className="h-3.5 w-3.5" /> Export Transaction Ledger
                  </button>
                  <button 
                    onClick={exportPayoutsCSV}
                    className="flex items-center gap-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 shadow-md shadow-cyan-500/10"
                  >
                    <Download className="h-3.5 w-3.5" /> Export Withdrawals
                  </button>
                </div>
              </div>

              {/* Economic KPI Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card rounded-2xl p-5 border border-border/80 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Rupiah Issued (Approved)</span>
                  <p className="text-2xl font-black text-foreground mt-1">
                    {formatRp(filteredWalletTxs.filter(t => t.currency_type === "RUPIAH" && t.amount > 0).reduce((sum, t) => sum + t.amount, 0))}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Sum of cash-rewards granted in range</p>
                </div>
                
                <div className="glass-card rounded-2xl p-5 border border-border/80 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Coins Issued vs Spent</span>
                  <p className="text-2xl font-black text-foreground mt-1">
                    +{filteredWalletTxs.filter(t => t.currency_type === "COIN" && t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toLocaleString()} 🪙
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Store purchases: <span className="font-bold text-rose-500">-{filteredWalletTxs.filter(t => t.currency_type === "COIN" && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString()}</span> coins
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-5 border border-border/80 text-center sm:text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Ready to Withdraw</span>
                  <p className="text-2xl font-black text-emerald-500 mt-1">
                    {wallets.filter(w => w.currency_type === "RUPIAH" && w.balance_available >= (rewardRules?.min_withdrawal_amount || 10000)).length} Students
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Wallet balance &gt;= {formatRp(rewardRules?.min_withdrawal_amount || 10000)} threshold
                  </p>
                </div>
              </div>

              {/* Economy sub charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Shop item distribution */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between h-[300px]">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Top-Selling Shop Items</h3>
                    <p className="text-[10px] text-muted-foreground">Most popular items purchased using earned Coins</p>
                  </div>
                  <div className="flex-1 mt-4 overflow-y-auto space-y-3 pr-1 hide-scrollbar">
                    {topShopItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/40 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-amber-50/10 text-amber-500 flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-foreground">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{item.count} sold</p>
                          <p className="text-[10px] text-muted-foreground">{item.value.toLocaleString()} coins total</p>
                        </div>
                      </div>
                    ))}
                    {topShopItems.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-10">No items purchased in this date range.</p>
                    )}
                  </div>
                </div>

                {/* 2. Coin balance brackets */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between h-[300px]">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Coin Balance Segments</h3>
                    <p className="text-[10px] text-muted-foreground">Classification of students by current coin holdings</p>
                  </div>
                  <div className="flex-1 w-full min-h-[160px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={coinDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {coinDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-[9px] font-bold text-muted-foreground">
                    {coinDistribution.map((entry, idx) => (
                      <span key={entry.name} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        {entry.name} ({entry.count})
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. Payout channel stats */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between h-[300px]">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Withdrawal States & Methods</h3>
                    <p className="text-[10px] text-muted-foreground">Active payout requests by state</p>
                  </div>
                  <div className="space-y-3 mt-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-500 flex items-center gap-1.5">
                        <HelpCircle className="h-4 w-4" /> Pending Approval
                      </span>
                      <span className="font-bold text-foreground">{filteredPayouts.filter(p => p.state === "REQUESTED").length} requests</span>
                    </div>

                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4" /> Paid Out (Released)
                      </span>
                      <span className="font-bold text-foreground">{filteredPayouts.filter(p => p.state === "PAID").length} requests</span>
                    </div>

                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-semibold text-rose-500 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> Rejected Payouts
                      </span>
                      <span className="font-bold text-foreground">{filteredPayouts.filter(p => p.state === "REJECTED").length} requests</span>
                    </div>

                    <div className="text-center text-[10px] text-muted-foreground border-t border-border/50 pt-3">
                      Minimum required threshold for payout: <span className="font-bold">{formatRp(rewardRules?.min_withdrawal_amount || 10000)}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* -------------------------------------------------------------
              TAB CONTENT: GAMIFICATION
              ------------------------------------------------------------- */}
          {activeTab === "gamification" && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-foreground">XP Progression & Level Banding</h2>
                  <p className="text-[10px] text-muted-foreground">Gamified engagement and unlock timelines</p>
                </div>
                <button 
                  onClick={exportBadgesCSV}
                  className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 shadow-md shadow-purple-500/10"
                >
                  <Download className="h-3.5 w-3.5" /> Export Badge Log
                </button>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Level bands distribution */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[320px] flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Student Level Bands</h3>
                    <p className="text-[10px] text-muted-foreground">Distribution of student accounts across level milestones</p>
                  </div>
                  <div className="flex-1 mt-4 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={levelBands} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '11px' }} />
                        <Bar dataKey="count" name="Students" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Badge rarities unlocked */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[320px] flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Badge Unlock Breakdown (Rarity)</h3>
                    <p className="text-[10px] text-muted-foreground">Total badges earned in this range grouped by rarity tier</p>
                  </div>
                  <div className="flex-1 w-full min-h-[160px] relative mt-4">
                    {badgeRarities.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-20">No badges unlocked during this range.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={badgeRarities}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="count"
                          >
                            {badgeRarities.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] font-bold text-muted-foreground">
                    {badgeRarities.map((entry, idx) => (
                      <span key={entry.name} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        {entry.name} ({entry.count})
                      </span>
                    ))}
                  </div>
                </div>

              </div>

              {/* Title distribution & equipped cosmetics */}
              <div className="glass-card rounded-2xl p-5 border border-border/80">
                <h3 className="font-bold text-sm text-foreground mb-4">Top Equipped Titles</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {cosmetics.filter(c => c.type === "title").slice(0, 5).map(title => {
                    const activeCount = filteredStudents.filter(s => s.title_id === title.id).length;
                    return (
                      <div key={title.id} className="p-3 bg-muted/40 border border-border/60 rounded-xl text-center">
                        <Award className="h-5 w-5 text-indigo-400 mx-auto mb-1" />
                        <p className="text-xs font-bold text-foreground truncate">{title.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{activeCount} equipped</p>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* -------------------------------------------------------------
              TAB CONTENT: BEHAVIORAL RISK & ANOMALIES
              ------------------------------------------------------------- */}
          {activeTab === "risk" && (
            <div className="space-y-6">
              
              <div>
                <h2 className="font-bold text-sm text-foreground">Risk & Verification Anomaly Detector</h2>
                <p className="text-[10px] text-muted-foreground">Identifies weak signals, geofencing bypasses, duplicated device tokens, or dormant accounts</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Duplicated Devices */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[360px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-foreground">Duplicated Login Devices</h3>
                      <span className="bg-rose-500/10 text-rose-500 text-[9px] px-2 py-0.5 rounded-full font-bold">HIGH RISK</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Device tokens containing multi-student logins (potential sharing)</p>
                  </div>
                  
                  <div className="flex-1 mt-4 overflow-y-auto space-y-2.5 pr-1 hide-scrollbar">
                    {duplicatedDevices.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-muted/40 border border-border/60 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between font-semibold text-foreground">
                          <span className="truncate max-w-[150px]">{item.device}</span>
                          <span className="text-rose-500">{item.count} Students</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.names.map(name => (
                            <span key={name} className="px-1.5 py-0.5 bg-background border border-border/60 rounded text-[9px] text-muted-foreground">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {duplicatedDevices.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-20">No duplicated devices identified.</p>
                    )}
                  </div>
                </div>

                {/* 2. Coin Earning Spikes */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[360px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-foreground">XP/Coin Earning Spikes</h3>
                      <span className="bg-amber-500/10 text-amber-500 text-[9px] px-2 py-0.5 rounded-full font-bold">REVIEW</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Students with unusually high coin growth (&gt;250 coins in range)</p>
                  </div>

                  <div className="flex-1 mt-4 overflow-y-auto space-y-2.5 pr-1 hide-scrollbar">
                    {coinSpikeEarners.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border/60 rounded-xl text-xs">
                        <div>
                          <p className="font-bold text-foreground">{item.student.full_name}</p>
                          <p className="text-[9px] text-muted-foreground">{item.student.class_name || "No Class"}</p>
                        </div>
                        <span className="font-black text-amber-500">+{item.earned} Coins</span>
                      </div>
                    ))}
                    {coinSpikeEarners.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-20">No unusual earning spikes detected.</p>
                    )}
                  </div>
                </div>

                {/* 3. Geofence & Location Drift */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 h-[360px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-foreground">Location Verification Drift</h3>
                      <span className="bg-cyan-500/10 text-cyan-500 text-[9px] px-2 py-0.5 rounded-full font-bold">DRIFT</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Geofence distances and weak GPS statistics</p>
                  </div>

                  <div className="space-y-3.5 mt-4">
                    <div className="p-3 bg-muted/30 border border-border/40 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">Out of Geofence Check-ins</p>
                        <p className="text-[9px] text-muted-foreground">Exceeded school geofence boundary</p>
                      </div>
                      <span className="font-bold text-rose-500">{geofenceBreaches} cases</span>
                    </div>

                    <div className="p-3 bg-muted/30 border border-border/40 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">Weak GPS Signal Warnings</p>
                        <p className="text-[9px] text-muted-foreground">Accuracy drift greater than 100 meters</p>
                      </div>
                      <span className="font-bold text-amber-500">{weakGPSCount} cases</span>
                    </div>

                    <div className="p-3 bg-muted/30 border border-border/40 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">Total Flagged Escalations</p>
                        <p className="text-[9px] text-muted-foreground">Pending administrative review</p>
                      </div>
                      <span className="font-bold text-indigo-500">
                        {filteredLogs.filter(l => l.status === "pending_admin_review" || l.status === "pending_teacher_view").length} cases
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Dormant Students List */}
              <div className="glass-card rounded-2xl p-5 border border-border/80">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Inactive / Dormant Students</h3>
                    <p className="text-[10px] text-muted-foreground">Students who have not checked in for 7+ consecutive school days</p>
                  </div>
                  <span className="text-xs bg-muted border border-border px-2.5 py-1 rounded-lg text-muted-foreground font-bold">
                    {dormantStudents.length} Dormant Accounts
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground font-bold text-[9px] tracking-wider uppercase">
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Grade</th>
                        <th className="p-2.5">Class</th>
                        <th className="p-2.5">Last Check-in Date</th>
                        <th className="p-2.5">Days Inactive</th>
                        <th className="p-2.5">Current Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {dormantStudents.map(student => (
                        <tr key={student.id} className="hover:bg-muted/20">
                          <td className="p-2.5 font-bold text-foreground">{student.full_name}</td>
                          <td className="p-2.5">Grade {student.grade_level || "-"}</td>
                          <td className="p-2.5">{student.class_name || "-"}</td>
                          <td className="p-2.5">{student.streaks?.last_attendance_date || "Never"}</td>
                          <td className="p-2.5 text-rose-500 font-bold">{student.daysInactive} days</td>
                          <td className="p-2.5 text-muted-foreground">{student.streaks?.current_streak || 0} days</td>
                        </tr>
                      ))}
                      {dormantStudents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">All student accounts are active. Excellent work!</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* -------------------------------------------------------------
              TAB CONTENT: STUDENT DRILL-DOWN PANEL
              ------------------------------------------------------------- */}
          {activeTab === "drilldown" && (
            <div className="space-y-6">
              
              {/* Search layout */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text"
                    placeholder="Search students by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-card border border-border text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="text-xs font-semibold text-muted-foreground self-center">
                  Showing {drilldownList.length} of {filteredStudents.length} students
                </div>
              </div>

              {/* Split Screen Drill-down */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Students list */}
                <div className="glass-card rounded-2xl border border-border/80 h-[500px] flex flex-col justify-between overflow-hidden">
                  <div className="bg-muted/40 p-3 border-b border-border font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Student Roster
                  </div>
                  
                  <div className="flex-1 overflow-y-auto divide-y divide-border/45 pr-1 hide-scrollbar">
                    {drilldownList.map(student => (
                      <button
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`w-full p-3 text-left transition-colors flex items-center justify-between ${
                          selectedStudent?.id === student.id 
                            ? "bg-teal-500/[0.08]" 
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`font-bold text-xs truncate ${selectedStudent?.id === student.id ? "text-teal-500" : "text-foreground"}`}>
                            {student.full_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {student.class_name || "No Class"} · Lvl {student.level}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selectedStudent?.id === student.id ? "text-teal-500 translate-x-1" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                    {drilldownList.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-20">No matching students.</p>
                    )}
                  </div>
                </div>

                {/* Selected student detail portfolio */}
                <div className="lg:col-span-2 space-y-6">
                  {selectedStudent ? (
                    <div className="space-y-6 animate-fade-in">
                      
                      {/* Hero Summary Badge */}
                      <div className="glass-card rounded-2xl p-5 border border-teal-500/20 shadow-lg shadow-teal-500/[0.01] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-lg shrink-0">
                            {selectedStudent.full_name[0]}
                          </div>
                          <div>
                            <h3 className="font-black text-base text-foreground">{selectedStudent.full_name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {selectedStudent.class_name ? `${selectedStudent.class_name} (Grade ${selectedStudent.grade_level})` : "No Class Assigned"} · {selectedStudent.email || "No Email"}
                            </p>
                          </div>
                        </div>

                        {/* Summary Badges */}
                        <div className="flex flex-wrap gap-2.5 sm:self-center">
                          <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 font-bold text-xs">
                            Lvl {selectedStudent.level}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-xs flex items-center gap-1">
                            {formatCoins(selectedStudent.coins)}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-xs flex items-center gap-1">
                            <Flame className="h-3.5 w-3.5" /> {selectedStudent.streaks?.current_streak || 0} days
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-bold text-xs">
                            {formatRp(wallets.find(w => w.user_id === selectedStudent.id && w.currency_type === "RUPIAH")?.balance_available || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Portfolios splits */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* 1. Transaction Ledger */}
                        <div className="glass-card rounded-2xl border border-border/80 h-[340px] flex flex-col justify-between overflow-hidden">
                          <div className="bg-muted/40 p-3 border-b border-border font-bold text-[10px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                            <span>Ledger Transactions</span>
                            <span className="text-[9px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground font-semibold">Coins & Rupiah</span>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto divide-y divide-border/45 pr-1 hide-scrollbar">
                            {filteredWalletTxs.filter(t => t.user_id === selectedStudent.id).map(tx => (
                              <div key={tx.id} className="p-3 text-xs flex justify-between hover:bg-muted/10 transition-colors">
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold text-foreground truncate">{tx.note || "Adjustment reward"}</p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    {format(new Date(tx.created_at), "yyyy-MM-dd HH:mm")} · {tx.event_type}
                                  </p>
                                </div>
                                <span className={`font-bold shrink-0 self-center ${tx.amount < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                                  {tx.amount > 0 ? "+" : ""}{tx.currency_type === "COIN" ? formatCoins(tx.amount) : formatRp(tx.amount)}
                                </span>
                              </div>
                            ))}
                            {filteredWalletTxs.filter(t => t.user_id === selectedStudent.id).length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-20">No financial transactions recorded.</p>
                            )}
                          </div>
                        </div>

                        {/* 2. Check-in Timeline */}
                        <div className="glass-card rounded-2xl border border-border/80 h-[340px] flex flex-col justify-between overflow-hidden">
                          <div className="bg-muted/40 p-3 border-b border-border font-bold text-[10px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                            <span>Check-in logs timeline</span>
                            <span className="text-[9px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground font-semibold">Last 30d</span>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto divide-y divide-border/45 pr-1 hide-scrollbar">
                            {filteredLogs.filter(l => l.student_id === selectedStudent.id).map(log => (
                              <div key={log.id} className="p-3 text-xs flex items-center justify-between hover:bg-muted/10 transition-colors">
                                <div>
                                  <p className="font-semibold text-foreground">{log.attendance_date}</p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    Distance: {Math.round(log.distance_m)}m · {log.submitted_at ? format(new Date(log.submitted_at), "HH:mm:ss") : "No Time"}
                                  </p>
                                </div>
                                
                                <div className="text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    log.status === "approved" 
                                      ? "bg-emerald-500/10 text-emerald-500" 
                                      : log.status === "rejected" 
                                        ? "bg-rose-500/10 text-rose-500" 
                                        : "bg-amber-500/10 text-amber-500"
                                  }`}>
                                    {log.status === "approved" ? "Approved" : log.status === "rejected" ? "Rejected" : "Flagged"}
                                  </span>
                                  {log.fraud_flags && log.fraud_flags.length > 0 && (
                                    <p className="text-[9px] text-rose-500 mt-1 font-semibold truncate max-w-[100px]">
                                      {log.fraud_flags.join(", ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {filteredLogs.filter(l => l.student_id === selectedStudent.id).length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-20">No check-in logs submitted in range.</p>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="glass-card rounded-2xl border border-dashed border-border/80 p-24 text-center">
                      <User className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
                      <h4 className="font-bold text-sm text-foreground">No Student Selected</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                        Search and select a student from the side roster to inspect their attendance, wallet, or achievements.
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </>
      )}

    </div>
  );
}
