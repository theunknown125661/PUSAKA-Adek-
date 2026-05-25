"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Search, User, Loader2, X } from "lucide-react";
import { HolidayTag } from "@/components/shared/holiday-tag";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from "date-fns";
import { toast } from "sonner";

export default function AdminStudentCalendarPage() {
  const { t, isClient } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  const [selectedFilterSchoolId, setSelectedFilterSchoolId] = useState<string>("all");
  const [selectedFilterClassId, setSelectedFilterClassId] = useState<string>("all");
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [rewardRules, setRewardRules] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedDateInfo, setSelectedDateInfo] = useState<{
    dateStr: string;
    day: Date;
    att: any;
    hol: any;
    tag: any;
    isAbsent?: boolean;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let sId = null;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
        sId = profile?.school_id;
        if (!sId) {
          const { data: school } = await supabase.from("schools").select("id").limit(1).single();
          sId = school?.id;
        }
        setSchoolId(sId || null);
        if (sId) {
          setSelectedFilterSchoolId(sId);
        }
      }
      fetchStudents(sId);
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchAttendanceAndHolidays();
    }
  }, [selectedStudentId, currentMonth, schoolId]);

  async function fetchStudents(initialSchoolId?: string | null) {
    const supabase = createClient();
    
    const [schoolsRes, classesRes, studentsRes] = await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      supabase.from("classes").select("id, name, school_id").order("name"),
      supabase
        .from("profiles")
        .select(`id, full_name, email, school_id, enrollments(class_id)`)
        .eq("role", "student")
        .order("full_name")
    ]);
    
    if (schoolsRes.data) setSchools(schoolsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
    
    if (studentsRes.data) {
      setStudents(studentsRes.data);
      // Determine initial filters
      let sId = initialSchoolId || "all";
      let filtered = studentsRes.data;
      
      if (sId !== "all") {
        filtered = filtered.filter((s: any) => s.school_id === sId || s.enrollments?.[0]?.class_id && classesRes.data?.find((c:any) => c.id === s.enrollments[0].class_id)?.school_id === sId);
      }
      
      if (filtered.length > 0) {
        setSelectedStudentId(filtered[0].id);
      }
    }
    setLoadingStudents(false);
  }

  // Filtered lists
  const filteredClasses = classes.filter(c => selectedFilterSchoolId === "all" || c.school_id === selectedFilterSchoolId);
  
  const filteredStudents = students.filter(s => {
    let match = true;
    if (selectedFilterSchoolId !== "all") {
      const studentSchool = s.school_id || (s.enrollments?.[0]?.class_id && classes.find(c => c.id === s.enrollments[0].class_id)?.school_id);
      if (studentSchool !== selectedFilterSchoolId) match = false;
    }
    if (selectedFilterClassId !== "all") {
      if (s.enrollments?.[0]?.class_id !== selectedFilterClassId) match = false;
    }
    return match;
  });

  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.find(s => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    } else if (filteredStudents.length === 0) {
      setSelectedStudentId("");
    }
  }, [selectedFilterSchoolId, selectedFilterClassId, students]);

  async function fetchAttendanceAndHolidays() {
    setLoadingData(true);
    const supabase = createClient();
    
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    const [attendanceRes, holidaysRes, tagsRes, rulesRes] = await Promise.all([
      supabase
        .from("attendance_logs")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("attendance_date", format(start, "yyyy-MM-dd"))
        .lte("attendance_date", format(end, "yyyy-MM-dd")),
      schoolId
        ? supabase
            .from("holiday_calendar")
            .select("*")
            .eq("school_id", schoolId)
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd"))
        : supabase
            .from("holiday_calendar")
            .select("*")
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd")),
        schoolId
          ? supabase.from("holiday_tags").select("*").eq("school_id", schoolId)
          : supabase.from("holiday_tags").select("*"),
        schoolId
          ? supabase.from("reward_rules").select("economy_config").eq("school_id", schoolId).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      if (attendanceRes.data) setAttendance(attendanceRes.data);
      if (holidaysRes.data) setHolidays(holidaysRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      if (rulesRes && rulesRes.data) setRewardRules(rulesRes.data);
    
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
          <div className="card rounded-2xl p-5 space-y-4">
            
            {/* School Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">School</label>
              <div className="relative">
                <select
                  value={selectedFilterSchoolId}
                  onChange={e => {
                    setSelectedFilterSchoolId(e.target.value);
                    setSelectedFilterClassId("all");
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="all">All Schools</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Class</label>
              <div className="relative">
                <select
                  value={selectedFilterClassId}
                  onChange={e => setSelectedFilterClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="all">All Classes</option>
                  {filteredClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Student Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminCalendar.selectStudent}</label>
              <div className="relative">
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  {filteredStudents.length === 0 && <option value="" disabled>No students found</option>}
                  {filteredStudents.map(student => (
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
          </div>

          {/* Legend */}
          <div className="card rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm mb-2">{t.adminCalendar.legend}</h3>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-[10px]">E</div>
              <span>{t.adminCalendar.early}</span>
            </div>
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
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded-md bg-slate-500/20 border-2 border-slate-500 flex items-center justify-center text-slate-500 font-bold text-[10px]">W</div>
              <span>Weekend</span>
            </div>
          </div>
          
          {/* Date Details Card */}
          {selectedDateInfo && (
            <div className="card rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center border-b border-border/50 pb-3">
                <h3 className="font-semibold text-sm">Date Details</h3>
                <span className="text-xs font-medium text-muted-foreground">{format(selectedDateInfo.day, "MMM d, yyyy")}</span>
              </div>
              
              <div className="flex flex-col gap-3">
                {selectedDateInfo.hol && (
                  <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
                    <div className="flex flex-col gap-1 mb-1 overflow-hidden">
                      <h4 className="font-bold text-sm tracking-tight text-foreground truncate" title={selectedDateInfo.hol.name}>
                        {selectedDateInfo.hol.name}
                      </h4>
                      {selectedDateInfo.tag && (
                        <HolidayTag 
                          name={selectedDateInfo.tag.name} 
                          colorHex={selectedDateInfo.tag.color_hex} 
                          className="text-[8px] sm:text-[9px] px-1.5 py-0"
                        />
                      )}
                    </div>
                    
                    {selectedDateInfo.hol.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {selectedDateInfo.hol.description}
                      </p>
                    )}
                    
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-border/50 text-foreground">
                      {selectedDateInfo.hol.type && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Type</span>
                          <span className="font-bold capitalize">{selectedDateInfo.hol.type.replace('_', ' ')}</span>
                        </div>
                      )}
                      {(selectedDateInfo.hol.pause_attendance || selectedDateInfo.hol.pause_streaks || selectedDateInfo.hol.hide_checkin) && (
                        <>
                          {selectedDateInfo.hol.pause_attendance && (
                             <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">Attendance</span>
                              <span className="font-bold">Paused</span>
                            </div>
                          )}
                          {selectedDateInfo.hol.pause_streaks && (
                             <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">Streaks</span>
                              <span className="font-bold">Frozen</span>
                            </div>
                          )}
                          {selectedDateInfo.hol.hide_checkin && (
                             <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground font-medium">Student Check-in</span>
                              <span className="font-bold">Hidden</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {(() => {
                  if (!selectedDateInfo.att) return null;
                  
                  let attTextClass = "text-foreground";
                  
                  if (selectedDateInfo.att.status === 'approved') {
                    if (selectedDateInfo.att.before_early_cutoff) {
                      attTextClass = "text-purple-600 dark:text-purple-400";
                    } else if (selectedDateInfo.att.within_time_window === false) {
                      attTextClass = "text-amber-600 dark:text-amber-500";
                    } else {
                      attTextClass = "text-success";
                    }
                  } else if (selectedDateInfo.att.status === 'rejected') {
                    attTextClass = "text-destructive";
                  } else if (selectedDateInfo.att.status.startsWith('pending_')) {
                    attTextClass = "text-yellow-600 dark:text-yellow-400";
                  }

                  return (
                  <div className="rounded-xl border bg-muted/10 p-3 space-y-3">
                    {selectedDateInfo.att.proof_image_url && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border/50 shadow-sm mb-2">
                        <img 
                          src={selectedDateInfo.att.proof_image_url} 
                          alt="Selfie" 
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <span className={`font-bold uppercase tracking-wider text-[10px] ${attTextClass}`}>
                          {selectedDateInfo.att.status.replace('pending_', 'Pending ').replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Time</span>
                        <span className="text-xs font-medium">{format(parseISO(selectedDateInfo.att.submitted_at), "HH:mm")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Timing</span>
                        <span className="font-semibold text-foreground">
                          {(selectedDateInfo.att.arrival_status === 'early' || (!selectedDateInfo.att.arrival_status && selectedDateInfo.att.before_early_cutoff)) ? 'Early' : 
                           (selectedDateInfo.att.arrival_status === 'normal' || (!selectedDateInfo.att.arrival_status && selectedDateInfo.att.within_time_window)) ? 'On Time' : 
                           'Late'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Distance</span>
                        <span className="text-xs font-medium">
                          {selectedDateInfo.att.distance_m != null ? `${Math.round(selectedDateInfo.att.distance_m)}m` : '-'}
                        </span>
                      </div>
                      
                      {selectedDateInfo.att.device_info && (
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">Device</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={selectedDateInfo.att.device_info}>
                            {selectedDateInfo.att.device_info}
                          </span>
                        </div>
                      )}
                      
                      {(selectedDateInfo.att.fraud_flags && selectedDateInfo.att.fraud_flags.length > 0) && (
                        <div className="pt-2 border-t border-border/50">
                          <span className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1.5 block">Flags</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedDateInfo.att.fraud_flags.map((flag: string, idx: number) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded-sm border border-destructive/20 truncate max-w-full">
                                {flag.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}

                {(() => {
                  if (selectedDateInfo.att || selectedDateInfo.hol) return null;
                  const activeDays = rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
                  const isWeekend = !activeDays.includes(selectedDateInfo.day.getDay());

                  if (isWeekend) {
                    return (
                      <div className="rounded-xl border bg-slate-500/10 border-slate-500/20 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-slate-500/20 flex items-center justify-center text-slate-600 font-bold text-xs">W</div>
                          <h4 className="font-bold text-sm text-foreground">Weekend</h4>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8">Not an active school day.</p>
                      </div>
                    );
                  }

                  if (selectedDateInfo.isAbsent) {
                    return (
                      <div className="rounded-xl border bg-destructive/10 border-destructive/20 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-destructive/20 flex items-center justify-center text-destructive font-bold text-xs">A</div>
                          <h4 className="font-bold text-sm text-foreground">Absent</h4>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8">Did not check in during the allowed window.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="text-xs text-center text-muted-foreground bg-muted/20 rounded-xl p-4 border border-dashed">
                      No data for this date.
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
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
                  const hol = holidays.find(h => h.date === dateStr);
                  const tag = hol ? tags.find(t => t.id === hol.tag_id) : null;
                  const isHoliday = !!hol;
                  
                  const activeDays = rewardRules?.economy_config?.active_days || [1, 2, 3, 4, 5];
                  const isWeekend = !activeDays.includes(day.getDay());
                  
                  let bgClass = "bg-muted/30 hover:bg-muted/50";
                  let borderClass = "border-transparent";
                  let textClass = "text-foreground";
                  let marker = "";
                  let cellStyle: React.CSSProperties = {};
                  let isAbsent = false;

                  if (isHoliday && hol) {
                    const color = hol?.color_hex || "#3b82f6";
                    bgClass = "";
                    borderClass = "border-transparent";
                    textClass = "font-bold";
                    cellStyle = {
                      backgroundColor: `${color}15`,
                      borderColor: `${color}35`,
                      color: color
                    };
                    marker = "H";
                  } else if (isWeekend) {
                    bgClass = "bg-slate-500/10 hover:bg-slate-500/20";
                    borderClass = "border-slate-500/20";
                    textClass = "text-slate-500 font-bold";
                    marker = "W";
                  } else if (att) {
                    if (att.status === 'approved') {
                      const arrivalStatus = att.arrival_status || 
                        (att.before_early_cutoff ? 'early' : 
                        (att.within_time_window === false ? 'late' : 'normal'));
                      
                      if (arrivalStatus === 'early') {
                        bgClass = "bg-purple-500/10 hover:bg-purple-500/20";
                        borderClass = "border-purple-500/20";
                        textClass = "text-purple-600 dark:text-purple-400 font-bold";
                        marker = "E";
                      } else if (arrivalStatus === 'late') {
                        bgClass = "bg-amber-500/10 hover:bg-amber-500/20";
                        borderClass = "border-amber-500/20";
                        textClass = "text-amber-500 font-bold";
                        marker = "L";
                      } else {
                        bgClass = "bg-success/10 hover:bg-success/20";
                        borderClass = "border-success/20";
                        textClass = "text-success font-bold";
                        marker = "P";
                      }
                    } else if (att.status === 'rejected') {
                      bgClass = "bg-destructive/10 hover:bg-destructive/20";
                      borderClass = "border-destructive/20";
                      textClass = "text-destructive font-bold";
                      marker = "A";
                    } else if (att.status.startsWith('pending_')) {
                      bgClass = "bg-yellow-500/10 hover:bg-yellow-500/20";
                      borderClass = "border-yellow-500/20";
                      textClass = "text-yellow-600 dark:text-yellow-400 font-bold";
                      marker = "?";
                    }
                  } else {
                    // Check if it's absent
                    const today = new Date();
                    const isToday = dateStr === format(today, "yyyy-MM-dd");
                    const isFuture = day > today;
                    
                    let hasDatePassed = false;
                    if (isFuture) {
                      hasDatePassed = false;
                    } else if (isToday) {
                      const endTime = rewardRules?.economy_config?.attendance_end_time;
                      if (endTime) {
                        const nowStr = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
                        if (nowStr > endTime) hasDatePassed = true;
                      }
                    } else {
                      hasDatePassed = true;
                    }

                    if (hasDatePassed && !isWeekend && !isHoliday) {
                      bgClass = "bg-destructive/10 hover:bg-destructive/20";
                      borderClass = "border-destructive/20";
                      textClass = "text-destructive font-bold";
                      marker = "A";
                      isAbsent = true;
                    }
                  }

                  return (
                    <div 
                      key={dateStr} 
                      onClick={() => setSelectedDateInfo({ dateStr, day, att, hol, tag, isAbsent })}
                      className={`group hover:z-20 aspect-square p-1.5 sm:p-2 border-2 rounded-2xl transition-all duration-200 hover:scale-[1.03] hover:shadow-md flex flex-col relative overflow-visible cursor-pointer ${bgClass} ${borderClass}`}
                      style={cellStyle}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-sm ${textClass} z-10 leading-none`}>{format(day, "d")}</span>
                        {marker && (
                          <span className={`text-[10px] sm:text-xs font-bold z-10 leading-none ${textClass}`}>{marker}</span>
                        )}
                      </div>
                      
                      {tag && (
                        <div className="mt-auto pt-1 pointer-events-none overflow-hidden w-full flex">
                          <HolidayTag 
                            name={tag.name} 
                            colorHex={tag.color_hex}
                            className="text-[8px] sm:text-[9px] px-1.5 py-0"
                          />
                        </div>
                      )}

                      {/* Tooltip */}
                      {(att || hol || isWeekend || isAbsent) && (
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max max-w-[220px] bg-card text-card-foreground border border-border shadow-2xl text-left p-3 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none flex flex-col gap-2.5">
                          {hol ? (
                            <div className={`flex flex-col gap-1.5 ${att ? 'pb-2 border-b border-border/50' : ''}`}>
                              <span className="font-bold truncate text-sm text-foreground">
                                {hol.name}
                              </span>
                              {tag && (
                                <HolidayTag 
                                  name={tag.name} 
                                  colorHex={tag.color_hex} 
                                />
                              )}
                            </div>
                          ) : isWeekend ? (
                            <div className={`flex flex-col gap-1.5 ${att ? 'pb-2 border-b border-border/50' : ''}`}>
                              <span className="font-bold truncate text-sm text-foreground">
                                Weekend
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Not an active school day
                              </span>
                            </div>
                          ) : isAbsent ? (
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold truncate text-sm text-destructive">
                                Absent
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Did not check in
                              </span>
                            </div>
                          ) : null}
                          {att && (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-xs text-muted-foreground font-medium">Status</span>
                                <span className="font-bold uppercase text-[10px] tracking-wider">{att.status.replace('pending_', 'Pending ').replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-xs text-muted-foreground font-medium">Time</span>
                                <span className="font-bold text-xs">{format(parseISO(att.submitted_at), "HH:mm")}</span>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[6px] border-transparent border-t-border" />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px] border-[6px] border-transparent border-t-card" />
                        </div>
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
