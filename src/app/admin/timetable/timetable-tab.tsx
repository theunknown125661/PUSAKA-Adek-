"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Plus, Loader2, X, Check, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Class, SchoolPeriod, ClassScheduleSession, Subject, Profile } from "@/lib/types/database";

const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
];

export function TimetableBuilderTab({ schoolId }: { schoolId: string }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [sessions, setSessions] = useState<ClassScheduleSession[]>([]);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Drawer/Modal State
  const [showDrawer, setShowDrawer] = useState(false);
  const [activeCell, setActiveCell] = useState<{ day: number, period: SchoolPeriod } | null>(null);
  const [activeSession, setActiveSession] = useState<ClassScheduleSession | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject_id: "",
    teacher_id: "",
    room_name: "",
  });

  const loadBaseData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch classes for this school
    const { data: clsData } = await supabase.from("classes").select("*").eq("school_id", schoolId).order("grade_level").order("name");
    if (clsData && clsData.length > 0) {
      setClasses(clsData as Class[]);
      setSelectedClassId(clsData[0].id);
    } else {
      setClasses([]);
      setSelectedClassId("");
    }
    
    // Fetch periods for this school
    const { data: perData } = await supabase.from("school_periods").select("*").eq("school_id", schoolId).order("period_order");
    if (perData) setPeriods(perData as SchoolPeriod[]);
    
    // Fetch subjects (from class_subjects or global subjects - let's fetch global subjects for now, or preferably subjects assigned to this class)
    // To keep it simple, we fetch all subjects for the school
    const { data: subData } = await supabase.from("subjects").select("*").eq("school_id", schoolId);
    if (subData) setSubjects(subData as Subject[]);
    
    // Fetch teachers
    const { data: teacherData } = await supabase.from("profiles").select("*").eq("school_id", schoolId).eq("role", "teacher");
    if (teacherData) setTeachers(teacherData as Profile[]);
    
    setLoading(false);
  };

  const loadSessions = async () => {
    if (!selectedClassId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("class_schedule_sessions")
      .select("*, subjects(*), profiles(*), school_periods(*)")
      .eq("class_id", selectedClassId);
      
    if (data) setSessions(data as ClassScheduleSession[]);
  };

  useEffect(() => {
    if (schoolId) loadBaseData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) loadSessions();
  }, [selectedClassId]);

  const openAddSession = (day: number, period: SchoolPeriod) => {
    setActiveCell({ day, period });
    setActiveSession(null);
    setForm({ subject_id: "", teacher_id: "", room_name: "" });
    setShowDrawer(true);
  };

  const openEditSession = (session: ClassScheduleSession, day: number, period: SchoolPeriod) => {
    setActiveCell({ day, period });
    setActiveSession(session);
    setForm({
      subject_id: session.subject_id,
      teacher_id: session.teacher_id || "",
      room_name: session.room_name || "",
    });
    setShowDrawer(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell || !selectedClassId) return;
    
    setSaving(true);
    const supabase = createClient();
    
    if (activeSession) {
      // Edit
      const { error } = await supabase.from("class_schedule_sessions").update({
        subject_id: form.subject_id,
        teacher_id: form.teacher_id || null,
        room_name: form.room_name || null,
      }).eq("id", activeSession.id);
      
      if (error) toast.error(error.message);
      else {
        toast.success("Session updated");
        setShowDrawer(false);
        loadSessions();
      }
    } else {
      // Add
      const { error } = await supabase.from("class_schedule_sessions").insert({
        school_id: schoolId,
        class_id: selectedClassId,
        period_id: activeCell.period.id,
        subject_id: form.subject_id,
        teacher_id: form.teacher_id || null,
        room_name: form.room_name || null,
      });
      
      if (error) toast.error(error.message);
      else {
        toast.success("Session added");
        setShowDrawer(false);
        loadSessions();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!activeSession) return;
    if (!confirm("Delete this session from the timetable?")) return;
    
    const supabase = createClient();
    const { error } = await supabase.from("class_schedule_sessions").delete().eq("id", activeSession.id);
    
    if (error) toast.error(error.message);
    else {
      toast.success("Session removed");
      setShowDrawer(false);
      loadSessions();
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  if (classes.length === 0) {
    return <EmptyState icon={ShieldAlert} title="No classes found" description="You need to create classes before building timetables." />;
  }

  // Get unique period orders to build the rows
  const periodOrders = Array.from(new Set(periods.map(p => p.period_order))).sort((a, b) => a - b);

  return (
    <div className="space-y-6 flex flex-col h-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold">Class Timetable</h2>
          <p className="text-sm text-muted-foreground">Assign subjects and teachers to periods.</p>
        </div>
        
        <select 
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-4 py-2 rounded-xl bg-muted/50 border border-border text-sm font-bold w-full sm:w-auto"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.grade_level} - {c.name}</option>
          ))}
        </select>
      </div>

      {periods.length === 0 ? (
        <EmptyState icon={Calendar} title="No periods configured" description="Configure the bell schedule first in the Periods tab." />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[800px] border border-border/50 rounded-2xl overflow-hidden bg-card">
            {/* Header Row */}
            <div className="flex border-b border-border/50 bg-muted/30">
              <div className="w-24 shrink-0 border-r border-border/50 p-3 font-bold text-xs text-muted-foreground text-center flex items-center justify-center">
                Time
              </div>
              {DAYS.map(day => (
                <div key={day.value} className="flex-1 min-w-[120px] p-3 font-bold text-sm text-center border-r border-border/50 last:border-0">
                  {day.label}
                </div>
              ))}
            </div>
            
            {/* Grid Rows */}
            {periodOrders.map(order => {
              // Find all periods with this order (across all days) to get display info
              const rowPeriods = periods.filter(p => p.period_order === order);
              if (rowPeriods.length === 0) return null;
              
              // Use the first one for generic time display on the Y-axis
              const repPeriod = rowPeriods[0];
              
              return (
                <div key={`row-${order}`} className="flex border-b border-border/50 last:border-0 group">
                  <div className="w-24 shrink-0 border-r border-border/50 p-2 flex flex-col items-center justify-center bg-muted/10 group-hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-black">{repPeriod.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{repPeriod.start_time.substring(0, 5)}</span>
                  </div>
                  
                  {DAYS.map(day => {
                    // Check if there is an actual period defined for this specific day & order
                    const dayPeriod = periods.find(p => p.day_index === day.value && p.period_order === order);
                    
                    if (!dayPeriod) {
                      return <div key={`${day.value}-${order}`} className="flex-1 min-w-[120px] bg-muted/5 border-r border-border/50 last:border-0 p-1" />;
                    }
                    
                    if (dayPeriod.is_break) {
                      return (
                        <div key={`${day.value}-${order}`} className="flex-1 min-w-[120px] bg-amber-500/5 border-r border-border/50 last:border-0 p-2 flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-600/70 uppercase tracking-widest">{dayPeriod.label}</span>
                        </div>
                      );
                    }
                    
                    // Check if there's a session scheduled here
                    const session = sessions.find(s => s.period_id === dayPeriod.id);
                    
                    return (
                      <div 
                        key={`${day.value}-${order}`} 
                        className={`flex-1 min-w-[120px] border-r border-border/50 last:border-0 p-1.5 transition-all ${session ? '' : 'hover:bg-muted/30 cursor-pointer'}`}
                        onClick={() => !session && openAddSession(day.value, dayPeriod)}
                      >
                        {session ? (
                          <div 
                            onClick={() => openEditSession(session, day.value, dayPeriod)}
                            className="h-full w-full rounded-xl p-2 cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/50 transition-all flex flex-col justify-between"
                            style={{ backgroundColor: session.subjects?.color_code ? `${session.subjects.color_code}15` : 'var(--muted)', borderLeft: `3px solid ${session.subjects?.color_code || 'var(--border)'}` }}
                          >
                            <div>
                              <p className="text-xs font-black leading-tight text-foreground line-clamp-2">{session.subjects?.name || 'Unknown'}</p>
                              {session.room_name && <p className="text-[9px] font-semibold text-muted-foreground mt-0.5">{session.room_name}</p>}
                            </div>
                            {session.profiles && (
                              <p className="text-[10px] font-medium text-muted-foreground mt-2 truncate">
                                {session.profiles.full_name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="h-full w-full rounded-xl border border-dashed border-border/60 flex items-center justify-center text-transparent hover:text-muted-foreground transition-colors opacity-0 hover:opacity-100">
                            <Plus className="h-4 w-4" />
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
      )}

      {/* Drawer Overlay */}
      {showDrawer && activeCell && (
        <div className="absolute inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          <div className="relative w-full max-w-sm bg-card border-l border-border shadow-2xl h-full animate-slide-in-right flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="font-bold text-base">{activeSession ? "Edit Session" : "Schedule Session"}</h3>
                <p className="text-xs text-muted-foreground">{DAYS.find(d => d.value === activeCell.day)?.label}, {activeCell.period.label} ({activeCell.period.start_time.substring(0, 5)})</p>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1.5 bg-muted rounded-lg hover:text-foreground text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Subject *</label>
                <select 
                  required
                  value={form.subject_id}
                  onChange={e => setForm(prev => ({ ...prev, subject_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>Select a subject...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Teacher</label>
                <select 
                  value={form.teacher_id}
                  onChange={e => setForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">No teacher assigned</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Room / Location</label>
                <input 
                  type="text" placeholder="e.g. Lab 2, Room 101"
                  value={form.room_name}
                  onChange={e => setForm(prev => ({ ...prev, room_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div className="pt-4 flex flex-col gap-2">
                <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {activeSession ? "Update Session" : "Add to Timetable"}
                </button>
                
                {activeSession && (
                  <button type="button" onClick={handleDelete} className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-600 text-sm font-bold hover:bg-rose-500/20">
                    Remove from Timetable
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
