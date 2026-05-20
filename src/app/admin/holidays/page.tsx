"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, AlertCircle, Pencil, X } from "lucide-react";
import type { HolidayCalendar } from "@/lib/types/database";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminHolidaysPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [holidays, setHolidays] = useState<HolidayCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  // Form State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"national" | "school" | "exam">("national");
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"national" | "school" | "exam">("national");
  const [editIds, setEditIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEdit = (group: any) => {
    setEditName(group.name);
    setEditType(group.type as any);
    setEditIds(group.ids);
    setShowEditModal(true);
  };

  const handleEditHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || editIds.length === 0 || !editName) return;
    
    setSavingEdit(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from("holiday_calendar")
      .update({
        name: editName,
        type: editType
      })
      .in("id", editIds);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Holiday updated successfully!");
      setShowEditModal(false);
      fetchHolidays(schoolId);
    }
    setSavingEdit(false);
  };

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // Get admin's school
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      let sId = profile?.school_id;
      if (!sId) {
        const { data: school } = await supabase.from("schools").select("id").limit(1).single();
        sId = school?.id;
      }

      if (sId) {
        setSchoolId(sId);
        fetchHolidays(sId);
      } else {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function fetchHolidays(sId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("holiday_calendar")
      .select("*")
      .eq("school_id", sId)
      .order("date", { ascending: true });
    
    if (data) setHolidays(data as HolidayCalendar[]);
    setLoading(false);
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !startDate || !name) return;
    
    setAdding(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    // Prepare inserts
    const inserts = [];
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    // Loop through dates
    let current = new Date(start);
    while (current <= end) {
      inserts.push({
        school_id: schoolId,
        date: current.toISOString().split('T')[0],
        name,
        type,
        created_by: user?.id
      });
      current.setDate(current.getDate() + 1);
    }

    const { error } = await supabase
      .from("holiday_calendar")
      .insert(inserts);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(inserts.length > 1 ? t.adminHolidays.successAddMultiple : t.adminHolidays.successAddSingle);
      setStartDate("");
      setEndDate("");
      setName("");
      fetchHolidays(schoolId);
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t.adminHolidays.confirmDelete)) return;
    
    const supabase = createClient();
    const { error } = await supabase.from("holiday_calendar").delete().eq("id", id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.adminHolidays.successDelete);
      setHolidays(prev => prev.filter(h => h.id !== id));
    }
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold">{t.adminHolidays.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.adminHolidays.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Holiday Form */}
        <div className="md:col-span-1 space-y-4">
          <div className="card rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {t.adminHolidays.addHoliday}
            </h2>
            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.startDate}</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.endDate}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Leave blank for single day"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t.adminHolidays.endDateDesc}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.holidayName}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t.adminHolidays.namePlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.type}</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="national">{t.adminHolidays.typeNational}</option>
                  <option value="school">{t.adminHolidays.typeSchool}</option>
                  <option value="exam">{t.adminHolidays.typeExam}</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={adding}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : t.adminHolidays.saveHoliday}
              </button>
            </form>
          </div>

          <div className="bg-info/10 border border-info/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm text-info/90">
              <strong>{t.adminHolidays.streakProtection}:</strong> {t.adminHolidays.streakProtectionDesc}
            </div>
          </div>
        </div>

        {/* Holidays List */}
        <div className="md:col-span-2">
          <div className="card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4.5 w-4.5 text-primary" />
                {t.adminHolidays.upcomingPastHolidays}
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
                {interpolate(t.adminHolidays.configured, { count: holidays.length })}
              </span>
            </div>
            
            {(() => {
              // Group consecutive holidays
              const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
              const groups: { name: string; type: string; startDate: string; endDate: string; ids: string[] }[] = [];
              
              sorted.forEach(h => {
                const lastGroup = groups[groups.length - 1];
                if (lastGroup && lastGroup.name === h.name && lastGroup.type === h.type) {
                  const lastEndDate = new Date(lastGroup.endDate);
                  const currentDate = new Date(h.date);
                  const diffDays = Math.ceil(Math.abs(currentDate.getTime() - lastEndDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (diffDays <= 1) {
                    lastGroup.endDate = h.date;
                    lastGroup.ids.push(h.id);
                    return;
                  }
                }
                groups.push({
                  name: h.name,
                  type: h.type,
                  startDate: h.date,
                  endDate: h.date,
                  ids: [h.id]
                });
              });

              if (groups.length === 0) {
                return (
                  <div className="p-12 text-center">
                    <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t.adminHolidays.noHolidays}</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-border">
                  {groups.map((group, idx) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const today = new Date(todayStr);
                    const start = new Date(group.startDate);
                    const end = new Date(group.endDate);
                    
                    const status = end < today ? 'past' : (start <= today && today <= end) ? 'active' : 'upcoming';

                    return (
                      <div key={idx} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${status === 'past' ? 'opacity-60' : ''}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">{group.name}</h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              status === 'past' ? 'bg-muted text-muted-foreground' :
                              status === 'active' ? 'bg-success/10 text-success' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {status === 'past' ? t.adminHolidays.statusPast : status === 'active' ? t.adminHolidays.statusActive : t.adminHolidays.statusUpcoming}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-medium">
                              {group.startDate === group.endDate ? (
                                format(new Date(group.startDate), "EEEE, MMM d, yyyy")
                              ) : (
                                `${format(new Date(group.startDate), "MMM d")} - ${format(new Date(group.endDate), "MMM d, yyyy")}`
                              )}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              group.type === 'national' ? 'bg-red-500/10 text-red-500' :
                              group.type === 'exam' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {group.type}
                            </span>
                            {group.ids.length > 1 && (
                              <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                {interpolate(t.adminHolidays.daysCount, { count: group.ids.length })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(group)}
                            className="p-2 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            title="Edit holiday name/type"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(interpolate(t.adminHolidays.confirmDeleteRange, { name: group.name }))) return;
                              const supabase = createClient();
                              const { error } = await supabase.from("holiday_calendar").delete().in("id", group.ids);
                              if (error) {
                                toast.error(error.message);
                              } else {
                                toast.success(t.adminHolidays.successDeleteRange);
                                setHolidays(prev => prev.filter(h => !group.ids.includes(h.id)));
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title={t.adminHolidays.removeHolidayRange}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Edit Holiday Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Edit Holiday Group
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleEditHoliday} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Holiday Name</label>
                <input 
                  required
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Holiday Type</label>
                <select
                  required
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="national">{t.adminHolidays.typeNational}</option>
                  <option value="school">{t.adminHolidays.typeSchool}</option>
                  <option value="exam">{t.adminHolidays.typeExam}</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingEdit}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
