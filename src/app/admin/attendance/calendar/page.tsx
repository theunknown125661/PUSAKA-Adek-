"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, User, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from "date-fns";
import { toast } from "sonner";

export default function AdminStudentCalendarPage() {
  const { t, isClient } = useTranslation();
  const [students, setStudents] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchAttendanceAndHolidays();
    }
  }, [selectedStudentId, currentMonth]);

  async function fetchStudents() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name");
    
    if (data) {
      setStudents(data);
      if (data.length > 0) setSelectedStudentId(data[0].id);
    }
    setLoadingStudents(false);
  }

  async function fetchAttendanceAndHolidays() {
    setLoadingData(true);
    const supabase = createClient();
    
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    const [attendanceRes, holidaysRes] = await Promise.all([
      supabase
        .from("attendance_logs")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("attendance_date", format(start, "yyyy-MM-dd"))
        .lte("attendance_date", format(end, "yyyy-MM-dd")),
      supabase
        .from("holiday_calendar")
        .select("*")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"))
    ]);

    if (attendanceRes.data) setAttendance(attendanceRes.data);
    if (holidaysRes.data) setHolidays(holidaysRes.data);
    
    setLoadingData(false);
  }

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

  if (!isClient || loadingStudents) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Calendar Math
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startDayOfWeek = getDay(start); // 0 (Sun) to 6 (Sat)
  
  // Day names header
  const dayNames = [
    t.adminCalendar.days.sun,
    t.adminCalendar.days.mon,
    t.adminCalendar.days.tue,
    t.adminCalendar.days.wed,
    t.adminCalendar.days.thu,
    t.adminCalendar.days.fri,
    t.adminCalendar.days.sat
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          {t.adminCalendar.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t.adminCalendar.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Selector */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card rounded-2xl p-5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.adminCalendar.selectStudent}</label>
            <div className="relative">
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
              >
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.full_name || student.email}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="card rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm mb-2">{t.adminCalendar.legend}</h3>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-success/20 border-2 border-success flex items-center justify-center text-success font-bold text-[10px]">P</div>
              <span>{t.adminCalendar.presentApproved}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-500 font-bold text-[10px]">L</div>
              <span>{t.adminCalendar.late}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-destructive/20 border-2 border-destructive flex items-center justify-center text-destructive font-bold text-[10px]">A</div>
              <span>{t.adminCalendar.absentRejected}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-info/20 border-2 border-info flex items-center justify-center text-info font-bold text-[10px]">H</div>
              <span>{t.adminCalendar.holidayClosure}</span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <div className="card rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{format(currentMonth, "MMMM yyyy")}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-xl border transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-xl border transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {/* Day Names */}
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs font-bold text-muted-foreground py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells for padding */}
                {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="aspect-square bg-muted/10 rounded-xl" />
                ))}

                {/* Calendar Days */}
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const att = attendance.find(a => a.attendance_date === dateStr);
                  const isHoliday = holidays.some(h => h.date === dateStr);
                  
                  let bgClass = "bg-muted/30 hover:bg-muted/50";
                  let borderClass = "border-transparent";
                  let textClass = "text-foreground";
                  let marker = "";

                  if (isHoliday) {
                    bgClass = "bg-info/10 hover:bg-info/20";
                    borderClass = "border-info/20";
                    textClass = "text-info font-bold";
                    marker = "H";
                  } else if (att) {
                    if (att.status === 'approved') {
                      bgClass = "bg-success/10 hover:bg-success/20";
                      borderClass = "border-success/20";
                      textClass = "text-success font-bold";
                      marker = "P";
                    } else if (att.status === 'rejected') {
                      bgClass = "bg-destructive/10 hover:bg-destructive/20";
                      borderClass = "border-destructive/20";
                      textClass = "text-destructive font-bold";
                      marker = "A";
                    } else if (att.status === 'pending') {
                      bgClass = "bg-amber-500/10 hover:bg-amber-500/20";
                      borderClass = "border-amber-500/20";
                      textClass = "text-amber-500 font-bold";
                      marker = "L"; // Assuming pending might be treated as late or needing attention
                    }
                  }

                  return (
                    <div 
                      key={dateStr} 
                      className={`aspect-square p-2 border-2 rounded-xl transition-all flex flex-col justify-between ${bgClass} ${borderClass}`}
                    >
                      <span className={`text-sm ${textClass}`}>{format(day, "d")}</span>
                      {marker && (
                        <span className={`self-end text-xs font-bold ${textClass}`}>{marker}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
