export type Locale = "en" | "id";

export const defaultLocale: Locale = "en";

// All translatable strings used in the student experience
export interface Messages {
  // Check-in page
  checkin: {
    title: string;
    subtitle: string;
    requirementsMet: string; // "2 of 4 requirements met"
    requirements: {
      insideArea: string;
      selfieCaptured: string;
      gpsAccuracy: string;
      timeWindow: string;
    };
    location: {
      title: string;
      loading: string;
      inRadius: string;
      outsideRadius: string; // "You are {distance} outside the school area."
      weakAccuracy: string;
      permissionDenied: string;
      fromSchool: string;
      accuracy: string;
      refresh: string;
      radius: string;
    };
    selfie: {
      title: string;
      subtitle: string;
      required: string;
      captured: string;
      uploading: string;
      failed: string;
      permissionDenied: string;
      take: string;
      retake: string;
      usePhoto: string;
    };
    time: {
      title: string;
      currentTime: string;
      window: string;
      windowClosed: string;
      earlyBonus: string;
      earlyBonusDesc: string; // "Check in before {time} for +{amount} bonus."
      projectedReward: string;
    };
    submit: {
      button: string;
      submitting: string;
      success: string;
      successDesc: string;
      viewHistory: string;
      alreadyDone: string;
      alreadyDoneDesc: string;
      backToDashboard: string;
    };
    errors: {
      outsideRadius: string;
      noSelfie: string;
      weakGps: string;
      windowClosed: string;
      submissionFailed: string;
    };
  };
  // Student dashboard
  dashboard: {
    greeting: {
      morning: string;
      afternoon: string;
      evening: string;
    };
    overview: string;
    checkInNow: string;
    checkInDesc: string;
    submitted: string;
    submittedDesc: string;
    approved: string;
    approvedDesc: string;
    rejected: string;
    rejectedDesc: string;
    streak: string;
    bestStreak: string;
    totalApproved: string;
    days: string;
    wallet: string;
    viewAll: string;
    available: string;
    availableHelp: string;
    pending: string;
    pendingHelp: string;
    held: string;
    heldHelp: string;
    progress: string;
    nextAt: string;
    badges: string;
    earnBadges: string;
    history: string;
    withdraw: string;
  };
  // Wallet
  wallet: {
    title: string;
    availableHelp: string;
    pendingHelp: string;
    heldHelp: string;
    transactions: string;
    withdrawTab: string;
    requestWithdrawal: string;
    minWeekly: string;
    noBalance: string;
    noBalanceDesc: string;
    enterAmount: string;
    minAmount: string; // "Minimum withdrawal is {amount}. You have {current}."
    cooldown: string; // "You can withdraw again in {days} days."
    insufficientBalance: string;
    requestButton: string;
    requesting: string;
    requestSuccess: string;
    requestSuccessDesc: string;
    withdrawalHistory: string;
    noTransactions: string;
    noTransactionsDesc: string;
  };
  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    back: string;
    save: string;
    cancel: string;
    confirm: string;
    noData: string;
  };
  // Teacher
  teacher: {
    dashboardTitle: string;
    dashboardDesc: string;
    students: string;
    pending: string;
    flagged: string;
    myClasses: string;
    noClasses: string;
    noClassesDesc: string;
    classGrade: string;
    studentsCount: string;
    presentToday: string;
    classDetailSub: string;
    backToDashboard: string;
    noteSuccess: string;
    flagSuccess: string;
    noSubmissions: string;
    noSubmissionsDesc: string;
    inRadius: string;
    outRadius: string;
    onTime: string;
    late: string;
    yourNote: string;
    addNotePlaceholder: string;
    send: string;
    flag: string;
    myStudents: string;
    myStudentsDesc: string;
    searchPlaceholder: string;
    noStudents: string;
    noStudentsDesc: string;
    totalCheckins: string;
    lastSeen: string;
    never: string;
    attendanceHistory: string;
    attendanceRate: string;
    total: string;
  };
  // Admin
  admin: {
    dashboardTitle: string;
    dashboardDesc: string;
    pendingReview: string;
    flaggedToday: string;
    approvedToday: string;
    rejectedToday: string;
    pendingPayouts: string;
    totalHeld: string;
    todaysRate: string;
    weeklyRewards: string;
    quickActions: string;
    verifyAttendance: string;
    processWithdrawals: string;
    addNewUser: string;
    viewReports: string;
    recentVerification: string;
    viewAuditLog: string;
    noRecentActivity: string;
    approvedAction: string;
    rejectedAction: string;
  };
}
