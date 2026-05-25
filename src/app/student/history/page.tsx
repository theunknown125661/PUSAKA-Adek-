"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatTime, formatDistance } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { 
  History, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info 
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import type { AttendanceLog } from "@/lib/types/database";
import { HolidayTag } from "@/components/shared/holiday-tag";

interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string | null;
  color_hex?: string | null;
  tag_id?: string | null;
}

export default function AttendanceHistoryPage() {
  const { profile } = useUserRole();
  const { t, locale, isClient } = useTranslation();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [rewardRules, setRewardRules] = useState<{ attendance_start_time: string; attendance_end_time: string; economy_config?: any } | null>(null);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [tags, setTags] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    
    async function load() {
      setLoading(true);
      
      // Fetch school enrollment to get school_id
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(school_id)")
        .eq("student_id", profile!.id)
        .limit(1)
        .maybeSingle();

      let schoolId = null;
      let classId = null;
      if (enr) {
        schoolId = (enr.classes as any)?.school_id;
        classId = enr.class_id;
      }

      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const [attendanceRes, holidaysRes, rulesRes, policyRes, tagsRes] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("*")
          .eq("student_id", profile!.id)
          .gte("attendance_date", startStr)
          .lte("attendance_date", endStr),
        schoolId 
          ? supabase
              .from("holiday_calendar")
              .select("*")
              .eq("school_id", schoolId)
              .gte("date", startStr)
              .lte("date", endStr)
          : supabase
              .from("holiday_calendar")
              .select("*")
              .gte("date", startStr)
              .lte("date", endStr),
        schoolId 
          ? supabase
              .from("reward_rules")
              .select("attendance_start_time, attendance_end_time, economy_config")
              .eq("school_id", schoolId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        schoolId
          ? supabase
              .from("attendance_policies")
              .select("*")
              .eq("is_active", true)
              .eq("school_id", schoolId)
              .or(`class_id.eq.${classId || '00000000-0000-0000-0000-000000000000'},class_id.is.null`)
              .order("priority", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("holiday_tags").select("*")
      ]);

      const attLogs = (attendanceRes.data || []) as AttendanceLog[];
      setLogs(attLogs);
      setHolidays((holidaysRes.data || []) as Holiday[]);
      if (tagsRes && tagsRes.data) {
        setTags(tagsRes.data);
      }
      if (rulesRes && rulesRes.data) {
        setRewardRules(rulesRes.data);
      }
      if (policyRes && policyRes.data) {
        setActivePolicy(policyRes.data);
      }
      setLoading(false);

      // Auto-select a date inside the month
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const hasToday = attLogs.some(log => log.attendance_date === todayStr);
      
      // Check if currentMonth represents the current actual calendar month
      const isCurrentActualMonth = 
        currentMonth.getMonth() === new Date().getMonth() && 
        currentMonth.getFullYear() === new Date().getFullYear();

      if (isCurrentActualMonth && hasToday) {
        setSelectedDateStr(todayStr);
      } else if (attLogs.length > 0) {
        // Sort and select the most recent log
        const sorted = [...attLogs].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
        setSelectedDateStr(sorted[0].attendance_date);
      } else {
        setSelectedDateStr(isCurrentActualMonth ? todayStr : format(start, "yyyy-MM-dd"));
      }
    }
    
    load();
  }, [profile, currentMonth]);

  if (!isClient) return null;

  function nextMonth() {
    setCurrentMonth(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  }

  function prevMonth() {
    setCurrentMonth(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  }

  // Calendar calculations
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startDayOfWeek = getDay(start); // 0 (Sun) to 6 (Sat)

  const dayNames = [
    t.adminCalendar.days.sun,
    t.adminCalendar.days.mon,
    t.adminCalendar.days.tue,
    t.adminCalendar.days.wed,
    t.adminCalendar.days.thu,
    t.adminCalendar.days.fri,
    t.adminCalendar.days.sat
  ];

  const filters = [
    { value: "all", label: t.history.filters.all },
    { value: "pending_teacher_view", label: t.history.filters.pending },
    { value: "approved", label: t.history.filters.approved },
    { value: "rejected", label: t.history.filters.rejected },
  ];

  const matchesFilter = (logStatus: string) => {
    if (filter === "all") return true;
    if (filter === "pending_teacher_view") return logStatus.startsWith("pending_");
    return logStatus === filter;
  };

  // Month-specific stats (counting absences as rejected/absent)
  const getMonthlyStats = () => {
    let absentCount = 0;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const nowTime = new Date();
    const timeStr = `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;

    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const log = logs.find(a => a.attendance_date === dateStr);
      const holiday = holidays.find(h => h.date === dateStr);
      const activeDays = activePolicy?.active_days || rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
      const isWeekend = !activeDays.includes(day.getDay());
      const endTime = activePolicy ? (activePolicy.absent_after_at || activePolicy.late_end_at) : rewardRules?.attendance_end_time;

      let hasDatePassed = false;
      if (dateStr < todayStr) {
        hasDatePassed = true;
      } else if (dateStr === todayStr && endTime) {
        if (timeStr > endTime) {
          hasDatePassed = true;
        }
      }

      if (!log && !holiday && !isWeekend && hasDatePassed) {
        absentCount++;
      }
    });

    return {
      approved: logs.filter(l => l.status === "approved").length,
      pending: logs.filter(l => l.status.startsWith("pending_")).length,
      rejected: logs.filter(l => l.status === "rejected").length + absentCount,
    };
  };

  const stats = getMonthlyStats();

  // Get selected day info (including holiday or absence check)
  const getSelectedDateStatus = () => {
    if (!selectedDateStr) return { isHoliday: false, isAbsent: false, log: null };
    const log = logs.find(l => l.attendance_date === selectedDateStr);
    if (log) return { isHoliday: false, isAbsent: false, log };
    const holiday = holidays.find(h => h.date === selectedDateStr);
    if (holiday) return { isHoliday: true, isAbsent: false, holiday };

    const dateObj = new Date(selectedDateStr);
    const activeDays = activePolicy?.active_days || rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
    const isWeekend = !activeDays.includes(dateObj.getDay());
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const endTime = activePolicy ? (activePolicy.absent_after_at || activePolicy.late_end_at) : rewardRules?.attendance_end_time;
    let hasDatePassed = false;
    if (selectedDateStr < todayStr) {
      hasDatePassed = true;
    } else if (selectedDateStr === todayStr && endTime) {
      const nowTime = new Date();
      const timeStr = `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;
      if (timeStr > endTime) {
        hasDatePassed = true;
      }
    }

    const isAbsent = !isWeekend && hasDatePassed;
    return { isHoliday: false, isAbsent, log: null, isWeekend };
  };

  const { isHoliday: isSelHoliday, isAbsent: isSelAbsent, log: selectedLog, isWeekend: isSelWeekend } = getSelectedDateStatus();
  const selectedHoliday = holidays.find(h => h.date === selectedDateStr);
  const isSelectedDateToday = selectedDateStr === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> 
          {t.history.title}
        </h1>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 flex flex-col justify-between space-y-1.5 transition-all duration-300 hover:shadow-md border-border/30 hover:border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium hidden sm:inline">{t.history.filters.approved}</span>
          </div>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</span>
        </div>
        <div className="glass rounded-2xl p-4 flex flex-col justify-between space-y-1.5 transition-all duration-300 hover:shadow-md border-border/30 hover:border-amber-500/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium hidden sm:inline">{t.history.filters.pending}</span>
          </div>
          <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</span>
        </div>
        <div className="glass rounded-2xl p-4 flex flex-col justify-between space-y-1.5 transition-all duration-300 hover:shadow-md border-border/30 hover:border-rose-500/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5 text-rose-500" />
            <span className="font-medium hidden sm:inline">{t.history.filters.rejected}</span>
          </div>
          <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{stats.rejected}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button 
            key={f.value} 
            onClick={() => setFilter(f.value)} 
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 active:scale-95",
              filter === f.value 
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Calendar View */}
        <div className="md:col-span-2 glass rounded-3xl p-6 border-border/40 space-y-6 flex flex-col justify-between">
          
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-base capitalize">
                {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(currentMonth)}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={prevMonth} 
                className="p-2 hover:bg-muted/80 active:scale-90 rounded-xl border border-border/30 transition-all duration-200 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={nextMonth} 
                className="p-2 hover:bg-muted/80 active:scale-90 rounded-xl border border-border/30 transition-all duration-200 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[280px]">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Day Name Headers */}
              <div className="grid grid-cols-7 gap-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1 select-none">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-2">
                
                {/* Empty starting cell padding */}
                {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="aspect-square bg-muted/5 rounded-xl border border-dashed border-border/10 opacity-30" />
                ))}

                {/* Actual Month Days */}
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const log = logs.find(a => a.attendance_date === dateStr);
                  const holiday = holidays.find(h => h.date === dateStr);
                  const isSelected = selectedDateStr === dateStr;
                  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

                  const activeDays = activePolicy?.active_days || rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
                  const isWeekend = !activeDays.includes(day.getDay());
                  const todayStr = format(new Date(), "yyyy-MM-dd");
                  const endTime = activePolicy ? (activePolicy.absent_after_at || activePolicy.late_end_at) : rewardRules?.attendance_end_time;
                  
                  let hasDatePassed = false;
                  if (dateStr < todayStr) {
                    hasDatePassed = true;
                  } else if (dateStr === todayStr && endTime) {
                    const nowTime = new Date();
                    const timeStr = `${String(nowTime.getHours()).padStart(2, "0")}:${String(nowTime.getMinutes()).padStart(2, "0")}`;
                    if (timeStr > endTime) {
                      hasDatePassed = true;
                    }
                  }

                  const isAbsent = !log && !holiday && !isWeekend && hasDatePassed;

                  let cellClass = "bg-muted/20 border-border/30 hover:border-border/60 hover:bg-muted/30 text-foreground/90";
                  let dotColor = null;
                  let cellStyle: React.CSSProperties = {};
                  let dotStyle: React.CSSProperties = {};

                  if (holiday) {
                    const color = holiday?.color_hex || "#3b82f6";
                    cellClass = "hover:scale-[1.03] transition-all font-semibold";
                    cellStyle = {
                      backgroundColor: `${color}15`,
                      borderColor: `${color}35`,
                      color: color
                    };
                    dotColor = "custom";
                    dotStyle = { backgroundColor: color };
                  } else if (isWeekend) {
                    cellClass = "hover:scale-[1.03] transition-all font-semibold";
                    cellStyle = {
                      backgroundColor: "#64748b15",
                      borderColor: "#64748b35",
                      color: "#64748b"
                    };
                    dotColor = "custom";
                    dotStyle = { backgroundColor: "#64748b" };
                  } else if (log) {
                    const activeMatch = matchesFilter(log.status);

                    if (activeMatch) {
                      if (log.status === 'approved') {
                        // Use the new arrival_status if it exists, fallback to old logic
                        const arrivalStatus = log.arrival_status || 
                          (log.before_early_cutoff ? 'early' : 
                          (log.within_time_window === false ? 'late' : 'normal'));
                          
                        if (arrivalStatus === 'early') {
                          cellClass = "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/40 font-semibold";
                          dotColor = "bg-purple-500";
                        } else if (arrivalStatus === 'normal') {
                          cellClass = "bg-success/10 border-success/20 text-success hover:bg-success/20 hover:border-success/40 font-semibold";
                          dotColor = "bg-success";
                        } else if (arrivalStatus === 'late') {
                          cellClass = "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/40 font-semibold";
                          dotColor = "bg-amber-500";
                        } else if (arrivalStatus === 'absent') {
                          cellClass = "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20 hover:border-destructive/40 font-semibold";
                          dotColor = "bg-destructive";
                        }
                      } else if (log.status === 'rejected') {
                        cellClass = "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 font-semibold";
                        dotColor = "bg-rose-500";
                      } else {
                        // Pending statuses: pending_teacher_view / pending_admin_review
                        cellClass = "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/40 font-semibold";
                        dotColor = "bg-yellow-500";
                      }
                    } else {
                      // Log exists but does not match active filter -> render dimmed
                      cellClass = "bg-muted/10 border-border/10 text-muted-foreground/30 hover:bg-muted/15 hover:border-border/20";
                      dotColor = "bg-muted-foreground/30";
                    }
                  } else if (isAbsent) {
                    const activeMatch = (filter === "all" || filter === "rejected");
                    if (activeMatch) {
                      cellClass = "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 font-semibold";
                      dotColor = "bg-rose-500";
                    } else {
                      cellClass = "bg-muted/10 border-border/10 text-muted-foreground/30 hover:bg-muted/15 hover:border-border/20";
                      dotColor = "bg-muted-foreground/30";
                    }
                  }

                   return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={cn(
                        "aspect-square p-2 border rounded-2xl transition-all duration-200 flex flex-col justify-between items-start cursor-pointer group relative overflow-visible",
                        isSelected 
                          ? "ring-2 ring-primary border-primary scale-[1.03] bg-primary/5 shadow-md shadow-primary/5 z-20" 
                          : "hover:scale-[1.03] hover:shadow-md hover:z-20",
                        isToday && !isSelected && "ring-1 ring-muted-foreground/40",
                        cellClass
                      )}
                      style={cellStyle}
                    >
                      <span className={cn(
                        "text-xs font-semibold select-none", 
                        isToday && "underline decoration-2 underline-offset-4 font-bold"
                      )}>
                        {format(day, "d")}
                      </span>

                      {holiday && holiday.tag_id && (() => {
                        const tag = tags.find(t => t.id === holiday.tag_id);
                        if (!tag) return null;
                        return (
                          <div className="mt-auto pt-1 pointer-events-none overflow-hidden w-full flex">
                            <HolidayTag 
                              name={tag.name} 
                              colorHex={tag.color_hex}
                              className="text-[8px] px-1 py-0 truncate max-w-full"
                            />
                          </div>
                        );
                      })()}

                      {dotColor && (
                        <span 
                          className={cn(
                            "absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover:scale-125",
                            dotColor === "custom" ? "" : dotColor
                          )}
                          style={dotStyle}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4 border-t border-border/20 text-[10px] sm:text-xs select-none font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/25" />
                  <span className="text-muted-foreground">Early</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success shadow-sm shadow-success/25" />
                  <span className="text-muted-foreground">Normal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/25" />
                  <span className="text-muted-foreground">{t.adminCalendar.late}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/25" />
                  <span className="text-muted-foreground">{t.history.filters.pending}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/25" />
                  <span className="text-muted-foreground">{t.history.filters.rejected} / Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/25" />
                  <span className="text-muted-foreground">{t.adminCalendar.holidayClosure}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500 shadow-sm shadow-slate-500/25" />
                  <span className="text-muted-foreground">Weekend</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Day Detail Panel */}
        <div className="md:col-span-1 glass rounded-3xl p-6 border-border/40 space-y-5 h-fit md:sticky md:top-6">
          <div className="border-b border-border/30 pb-3">
            <h3 className="text-sm font-bold text-foreground">
              {formatDate(selectedDateStr || new Date())}
            </h3>
            {isSelectedDateToday && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold mt-1 inline-block">
                Today
              </span>
            )}
          </div>

          {selectedLog ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                <StatusBadge status={selectedLog.status} />
              </div>

              <div className="space-y-2">
                <div className="bg-muted/30 border border-border/20 rounded-2xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t.history.submitted}</span>
                    <span className="font-semibold text-foreground">{formatTime(selectedLog.submitted_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-semibold text-foreground">{formatDistance(selectedLog.distance_m)} {t.history.fromSchool}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Radius Check</span>
                    <span className={cn("font-semibold", selectedLog.within_radius ? "text-emerald-500" : "text-amber-500")}>
                      {selectedLog.within_radius ? t.history.inRadius : t.history.outRadius}
                    </span>
                  </div>
                </div>

                {/* Arrival Status Panels */}
                {(selectedLog.arrival_status === 'early' || (!selectedLog.arrival_status && selectedLog.before_early_cutoff)) && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl text-xs bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                    <span className="text-sm">🌟</span>
                    <span className="font-semibold">{t.history.early}</span>
                  </div>
                )}
                {(selectedLog.arrival_status === 'normal' || (!selectedLog.arrival_status && selectedLog.status === 'approved' && selectedLog.within_time_window !== false && !selectedLog.before_early_cutoff)) && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl text-xs bg-success/10 border border-success/20 text-success">
                    <span className="text-sm">✓</span>
                    <span className="font-semibold">{t.history.onTime}</span>
                  </div>
                )}
                {(selectedLog.arrival_status === 'late' || (!selectedLog.arrival_status && selectedLog.status === 'approved' && selectedLog.within_time_window === false)) && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-2xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⏰</span>
                      <span className="font-semibold">{t.history.late}</span>
                    </div>
                    {selectedLog.penalty_applied && (
                      <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                        Penalty: -{selectedLog.penalty_value} {selectedLog.penalty_type?.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedLog.proof_image_url && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Proof Selfie</span>
                  <div className="relative aspect-square w-full max-h-44 overflow-hidden rounded-2xl border border-border/40 bg-muted">
                    <img 
                      src={selectedLog.proof_image_url} 
                      alt="Selfie proof" 
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                    />
                  </div>
                </div>
              )}

              {selectedLog.admin_note && (
                <div className="bg-muted/40 border border-border/25 rounded-2xl p-3.5 text-xs space-y-1">
                  <span className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider block">
                    {t.history.adminNote}
                  </span>
                  <p className="text-foreground leading-relaxed">{selectedLog.admin_note}</p>
                </div>
              )}

              {selectedLog.teacher_note_summary && (
                <div className="bg-muted/40 border border-border/25 rounded-2xl p-3.5 text-xs space-y-1">
                  <span className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider block">
                    {t.history.teacherNote}
                  </span>
                  <p className="text-foreground leading-relaxed">{selectedLog.teacher_note_summary}</p>
                </div>
              )}
            </div>
          ) : selectedHoliday ? (
            <div className="space-y-4 py-4 text-center animate-fade-in">
              <div 
                className="inline-flex p-3 rounded-full"
                style={{
                  backgroundColor: `${selectedHoliday.color_hex || "#3b82f6"}15`,
                  color: selectedHoliday.color_hex || "#3b82f6"
                }}
              >
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 px-2">
                <h4 
                  className="font-bold text-sm"
                  style={{ color: selectedHoliday.color_hex || "#3b82f6" }}
                >
                  {selectedHoliday.name}
                </h4>
                {selectedHoliday.tag_id && (() => {
                  const tag = tags.find(t => t.id === selectedHoliday.tag_id);
                  if (!tag) return null;
                  return (
                    <div className="flex justify-center mt-1">
                      <HolidayTag name={tag.name} colorHex={tag.color_hex} />
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  {selectedHoliday.description || "School is closed today. Streak protection is active."}
                </p>
              </div>
            </div>
          ) : isSelWeekend ? (
            <div className="space-y-4 py-4 text-center animate-fade-in">
              <div className="inline-flex p-3 rounded-full bg-slate-500/10 text-slate-500">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 px-2">
                <h4 className="font-bold text-sm text-slate-600 dark:text-slate-400">
                  Weekend
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Not an active school day.
                </p>
              </div>
            </div>
          ) : isSelAbsent ? (
            <div className="space-y-4 py-8 text-center animate-fade-in">
              <div className="inline-flex p-3 bg-rose-500/10 text-rose-500 rounded-full">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 px-2">
                <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400">
                  Absent
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You did not log attendance before the check-in window closed.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center animate-fade-in">
              <div className="inline-flex p-3 bg-muted/40 text-muted-foreground rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-[200px] mx-auto">
                <h4 className="font-bold text-sm text-foreground">
                  {t.history.empty}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.history.emptyDesc}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
