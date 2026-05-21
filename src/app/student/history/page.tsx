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

interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string | null;
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

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    
    async function load() {
      setLoading(true);
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const [attendanceRes, holidaysRes] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("*")
          .eq("student_id", profile!.id)
          .gte("attendance_date", startStr)
          .lte("attendance_date", endStr),
        supabase
          .from("holiday_calendar")
          .select("*")
          .gte("date", startStr)
          .lte("date", endStr)
      ]);

      const attLogs = (attendanceRes.data || []) as AttendanceLog[];
      setLogs(attLogs);
      setHolidays((holidaysRes.data || []) as Holiday[]);
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

  // Month-specific stats
  const stats = {
    approved: logs.filter(l => l.status === "approved").length,
    pending: logs.filter(l => l.status.startsWith("pending_")).length,
    rejected: logs.filter(l => l.status === "rejected").length,
  };

  // Get selected day info
  const selectedLog = logs.find(log => log.attendance_date === selectedDateStr);
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

                  let cellClass = "bg-muted/20 border-border/30 hover:border-border/60 hover:bg-muted/30 text-foreground/90";
                  let dotColor = null;

                  if (holiday) {
                    cellClass = "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/40";
                    dotColor = "bg-sky-500";
                  } else if (log) {
                    const activeMatch = matchesFilter(log.status);

                    if (activeMatch) {
                      if (log.status === 'approved') {
                        cellClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 font-semibold";
                        dotColor = "bg-emerald-500";
                      } else if (log.status === 'rejected') {
                        cellClass = "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 font-semibold";
                        dotColor = "bg-rose-500";
                      } else {
                        // Pending statuses: pending_teacher_view / pending_admin_review
                        cellClass = "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 font-semibold";
                        dotColor = "bg-amber-500";
                      }
                    } else {
                      // Log exists but does not match active filter -> render dimmed
                      cellClass = "bg-muted/10 border-border/10 text-muted-foreground/30 hover:bg-muted/15 hover:border-border/20";
                      dotColor = "bg-muted-foreground/30";
                    }
                  }

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={cn(
                        "aspect-square p-2 border rounded-2xl transition-all duration-200 flex flex-col justify-between items-start cursor-pointer group relative overflow-hidden",
                        isSelected 
                          ? "ring-2 ring-primary border-primary scale-102 bg-primary/5 shadow-md shadow-primary/5 z-10" 
                          : "hover:scale-102 hover:shadow-sm",
                        isToday && !isSelected && "ring-1 ring-muted-foreground/40",
                        cellClass
                      )}
                    >
                      <span className={cn(
                        "text-xs font-semibold select-none", 
                        isToday && "underline decoration-2 underline-offset-4 font-bold"
                      )}>
                        {format(day, "d")}
                      </span>

                      {dotColor && (
                        <span className={cn(
                          "absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover:scale-125",
                          dotColor
                        )} />
                      )}
                    </button>
                  );
                })}
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

                {selectedLog.before_early_cutoff && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                    <span className="text-sm">🌅</span>
                    <span className="font-semibold">{t.history.early}</span>
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
            <div className="space-y-4 py-4 text-center">
              <div className="inline-flex p-3 bg-sky-500/10 text-sky-500 rounded-full">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 px-2">
                <h4 className="font-bold text-sm text-sky-600 dark:text-sky-400">
                  {selectedHoliday.name}
                </h4>
                {selectedHoliday.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedHoliday.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8 text-center">
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
