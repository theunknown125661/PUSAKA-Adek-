"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Calendar, Clock, Loader2, CalendarDays, List, MapPin, User, BookOpen, X
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { SchoolPeriod, ClassScheduleSession, StudentSchedulePreference } from "@/lib/types/database";

const DAYS = [
  { value: 0, label: "Monday", short: "Mon" },
  { value: 1, label: "Tuesday", short: "Tue" },
  { value: 2, label: "Wednesday", short: "Wed" },
  { value: 3, label: "Thursday", short: "Thu" },
  { value: 4, label: "Friday", short: "Fri" },
  { value: 5, label: "Saturday", short: "Sat" },
];

export function ScheduleComponent({ 
  schoolId, 
  classId,
  onSubjectsChange
}: { 
  schoolId: string; 
  classId: string;
  onSubjectsChange?: (subjects: any[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [sessions, setSessions] = useState<ClassScheduleSession[]>([]);
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<StudentSchedulePreference | null>(null);
  
  const [view, setView] = useState<"weekly" | "daily">("daily");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() - 1 < 0 ? 0 : new Date().getDay() - 1);
  const [selectedSession, setSelectedSession] = useState<ClassScheduleSession | null>(null);

  useEffect(() => {
    if (selectedDay > 5 || selectedDay < 0) setSelectedDay(0);
  }, [selectedDay]);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: prefData } = await supabase.from("student_schedule_preferences").select("*").eq("student_id", user.id).maybeSingle();
    if (prefData) {
      setPrefs(prefData as StudentSchedulePreference);
      if (prefData.default_view) setView(prefData.default_view as "weekly" | "daily");
    }
    
    const { data: cSubData } = await supabase.from("class_subjects").select("*").eq("class_id", classId);
    const requiredSubjectIds = (cSubData || []).filter(cs => cs.is_required).map(cs => cs.subject_id);
    
    const { data: sSubData } = await supabase.from("student_subjects").select("class_subjects(subject_id)").eq("student_id", user.id).eq("selection_status", "approved");
    const electiveSubjectIds = (sSubData || []).map(ss => (ss.class_subjects as any)?.subject_id).filter(Boolean);
    
    const validSubjectIds = [...requiredSubjectIds, ...electiveSubjectIds];
    setMySubjects(validSubjectIds);
    
    const { data: perData } = await supabase.from("school_periods").select("*").eq("school_id", schoolId).order("period_order");
    if (perData) setPeriods(perData as SchoolPeriod[]);
    
    const { data: sessData } = await supabase.from("class_schedule_sessions").select("*, subjects(*), profiles(*)").eq("class_id", classId);
    if (sessData) {
      const typedSessions = sessData as ClassScheduleSession[];
      setSessions(typedSessions);
      
      if (onSubjectsChange) {
        // Extract unique subjects that the user is taking
        const myValidSessions = typedSessions.filter(s => validSubjectIds.includes(s.subject_id));
        const uniqueSubjectsMap = new Map<string, any>();
        myValidSessions.forEach(s => {
          if (s.subjects && !uniqueSubjectsMap.has(s.subject_id)) {
            uniqueSubjectsMap.set(s.subject_id, {
              subject: s.subjects.name,
              color: s.subjects.color_code,
              teacher: s.profiles?.full_name || "TBA"
            });
          }
        });
        onSubjectsChange(Array.from(uniqueSubjectsMap.values()));
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (schoolId && classId) {
      loadData();
    }
  }, [schoolId, classId]);

  const toggleView = async (newView: "weekly" | "daily") => {
    setView(newView);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (prefs) {
        await supabase.from("student_schedule_preferences").update({ default_view: newView }).eq("id", prefs.id);
      } else {
        const { data } = await supabase.from("student_schedule_preferences").insert({
          student_id: user.id,
          default_view: newView
        }).select().single();
        if (data) setPrefs(data as StudentSchedulePreference);
      }
    }
  };

  const mySessions = sessions.filter(s => mySubjects.includes(s.subject_id));
  const periodOrders = Array.from(new Set(periods.map(p => p.period_order))).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-sm">My Timetable</h2>
            <p className="text-xs text-muted-foreground">Interactive weekly & daily views</p>
          </div>
        </div>

        <div className="flex bg-muted/40 p-1.5 rounded-2xl border border-border/50 self-start sm:self-auto">
          <button
            onClick={() => toggleView("daily")}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              view === "daily" 
                ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Daily
          </button>
          <button
            onClick={() => toggleView("weekly")}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              view === "weekly" 
                ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Weekly
          </button>
        </div>
      </div>

      {periods.length === 0 ? (
        <EmptyState icon={Clock} title="Schedule Not Published" description="Your school has not configured the timetable yet." />
      ) : (
        <>
          {view === "weekly" ? (
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[700px] border border-border/50 rounded-2xl overflow-hidden bg-card">
                <div className="flex border-b border-border/50 bg-muted/30">
                  <div className="w-20 shrink-0 border-r border-border/50 p-2 font-bold text-[10px] text-muted-foreground text-center flex items-center justify-center">Time</div>
                  {DAYS.map(day => (
                    <div key={day.value} className="flex-1 min-w-[100px] p-2 font-bold text-xs text-center border-r border-border/50 last:border-0">
                      {day.label}
                    </div>
                  ))}
                </div>
                
                {periodOrders.map(order => {
                  const rowPeriods = periods.filter(p => p.period_order === order);
                  if (rowPeriods.length === 0) return null;
                  const repPeriod = rowPeriods[0];
                  
                  return (
                    <div key={`row-${order}`} className="flex border-b border-border/50 last:border-0 group">
                      <div className="w-20 shrink-0 border-r border-border/50 p-2 flex flex-col items-center justify-center bg-muted/10 group-hover:bg-muted/30 transition-colors">
                        <span className="text-[10px] text-muted-foreground font-mono">{repPeriod.start_time.substring(0, 5)}</span>
                      </div>
                      
                      {DAYS.map(day => {
                        const dayPeriod = periods.find(p => p.day_index === day.value && p.period_order === order);
                        if (!dayPeriod) return <div key={`${day.value}-${order}`} className="flex-1 min-w-[100px] bg-muted/5 border-r border-border/50 last:border-0 p-1" />;
                        
                        if (dayPeriod.is_break) {
                          return (
                            <div key={`${day.value}-${order}`} className="flex-1 min-w-[100px] bg-amber-500/5 border-r border-border/50 last:border-0 p-1.5 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest text-center">{dayPeriod.label}</span>
                            </div>
                          );
                        }
                        
                        const session = mySessions.find(s => s.period_id === dayPeriod.id);
                        
                        return (
                          <div key={`${day.value}-${order}`} className="flex-1 min-w-[100px] border-r border-border/50 last:border-0 p-1 transition-all">
                            {session ? (
                              <div 
                                onClick={() => setSelectedSession(session)}
                                className="h-full w-full rounded-xl p-1.5 cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/50 transition-all flex flex-col justify-between"
                                style={{ backgroundColor: session.subjects?.color_code ? `${session.subjects.color_code}15` : 'var(--muted)', borderLeft: `3px solid ${session.subjects?.color_code || 'var(--border)'}` }}
                              >
                                <div>
                                  <p className="text-[10px] font-black leading-tight text-foreground line-clamp-2">{session.subjects?.name || 'Unknown'}</p>
                                  {session.room_name && <p className="text-[8px] font-semibold text-muted-foreground mt-0.5 truncate">{session.room_name}</p>}
                                </div>
                              </div>
                            ) : (
                              <div className="h-full w-full rounded-xl flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground opacity-40">Free</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
                {DAYS.map(day => (
                  <button
                    key={day.value}
                    onClick={() => setSelectedDay(day.value)}
                    className={`flex-1 min-w-[60px] px-2 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                      selectedDay === day.value
                        ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "bg-card border border-border/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-bold">{day.short}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {periodOrders.map((order) => {
                  const dayPeriod = periods.find(p => p.day_index === selectedDay && p.period_order === order);
                  if (!dayPeriod) return null;
                  
                  const session = mySessions.find(s => s.period_id === dayPeriod.id);
                  const isBreak = dayPeriod.is_break;
                  
                  if (!session && !isBreak) return null;

                  return (
                    <div key={dayPeriod.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border-[3px] border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"
                        style={session?.subjects?.color_code ? { backgroundColor: session.subjects.color_code, color: 'white' } : (isBreak ? { backgroundColor: 'var(--amber-500)', color: 'white' } : {})}
                      >
                        {isBreak ? <Clock className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                      </div>
                      
                      <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] glass rounded-2xl p-3 border border-border/50 shadow-sm transition-all hover:shadow-md cursor-pointer"
                        onClick={() => session && setSelectedSession(session)}
                        style={session?.subjects?.color_code ? { borderLeft: `3px solid ${session.subjects.color_code}` } : (isBreak ? { borderLeft: `3px solid var(--amber-500)` } : {})}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                            {dayPeriod.start_time.substring(0, 5)} - {dayPeriod.end_time.substring(0, 5)}
                          </span>
                          {isBreak && <span className="text-[9px] uppercase font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md">Break</span>}
                        </div>
                        
                        <h3 className="text-sm font-black text-foreground">
                          {isBreak ? dayPeriod.label : session?.subjects?.name}
                        </h3>
                        
                        {session && (
                          <div className="mt-2 flex flex-wrap gap-2.5">
                            {session.profiles && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <User className="h-3 w-3" />
                                {session.profiles.full_name}
                              </div>
                            )}
                            {session.room_name && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {session.room_name}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/85 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-in-up">
            <div 
              className="h-24 p-6 flex flex-col justify-end relative"
              style={{ backgroundColor: selectedSession.subjects?.color_code || 'var(--primary)' }}
            >
              <button 
                onClick={() => setSelectedSession(null)} 
                className="absolute top-4 right-4 h-8 w-8 bg-black/20 text-white rounded-full flex items-center justify-center hover:bg-black/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="text-xl font-black text-white">{selectedSession.subjects?.name}</h2>
              <p className="text-white/80 text-sm font-medium">{selectedSession.subjects?.code}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold">{DAYS.find(d => d.value === selectedSession.school_periods?.day_index)?.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSession.school_periods?.start_time.substring(0, 5)} - {selectedSession.school_periods?.end_time.substring(0, 5)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Teacher</p>
                  <p className="text-sm font-bold flex items-center gap-2 truncate">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selectedSession.profiles?.full_name || "TBA"}
                  </p>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Location</p>
                  <p className="text-sm font-bold flex items-center gap-2 truncate">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selectedSession.room_name || "TBA"}
                  </p>
                </div>
              </div>
              
              {selectedSession.subjects?.description && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">Subject Description</p>
                  <p className="text-sm text-foreground/90 leading-relaxed bg-muted/10 p-4 rounded-2xl border border-border/30">
                    {selectedSession.subjects.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
