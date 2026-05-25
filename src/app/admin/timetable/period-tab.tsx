"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Clock, Plus, Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { SchoolPeriod } from "@/lib/types/database";

const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

export function PeriodConfigurationTab({ schoolId }: { schoolId: string }) {
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  
  const [showModal, setShowModal] = useState<"add" | "edit" | "none">("none");
  const [selectedPeriod, setSelectedPeriod] = useState<SchoolPeriod | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    day_index: 0,
    period_order: 1,
    label: "",
    start_time: "07:00",
    end_time: "07:45",
    is_break: false,
  });

  const loadPeriods = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("school_periods")
      .select("*")
      .eq("school_id", schoolId)
      .order("day_index")
      .order("period_order");
      
    if (data) setPeriods(data as SchoolPeriod[]);
    setLoading(false);
  };

  useEffect(() => {
    if (schoolId) loadPeriods();
  }, [schoolId]);

  const openAdd = () => {
    // Auto-calculate next period order for the selected day
    const dayPeriods = periods.filter(p => p.day_index === selectedDay);
    const nextOrder = dayPeriods.length > 0 ? Math.max(...dayPeriods.map(p => p.period_order)) + 1 : 1;
    let nextStart = "07:00";
    if (dayPeriods.length > 0) {
      // Simplistic fallback to the end time of the last period
      const lastPeriod = dayPeriods.reduce((prev, current) => (prev.period_order > current.period_order) ? prev : current);
      // slice to get HH:mm instead of HH:mm:ss if it comes from db that way
      nextStart = lastPeriod.end_time.substring(0, 5); 
    }

    setForm({
      day_index: selectedDay,
      period_order: nextOrder,
      label: `Period ${nextOrder}`,
      start_time: nextStart,
      end_time: "08:00",
      is_break: false,
    });
    setShowModal("add");
  };

  const openEdit = (p: SchoolPeriod) => {
    setSelectedPeriod(p);
    setForm({
      day_index: p.day_index,
      period_order: p.period_order,
      label: p.label,
      start_time: p.start_time.substring(0, 5),
      end_time: p.end_time.substring(0, 5),
      is_break: p.is_break,
    });
    setShowModal("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();

    if (showModal === "add") {
      const { error } = await supabase.from("school_periods").insert({
        school_id: schoolId,
        ...form
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Period added");
        setShowModal("none");
        loadPeriods();
      }
    } else if (showModal === "edit" && selectedPeriod) {
      const { error } = await supabase.from("school_periods").update({
        ...form
      }).eq("id", selectedPeriod.id);
      
      if (error) toast.error(error.message);
      else {
        toast.success("Period updated");
        setShowModal("none");
        loadPeriods();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this period? This will also remove any scheduled sessions for this period.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("school_periods").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Period deleted");
      loadPeriods();
    }
  };

  const dayPeriods = periods.filter(p => p.day_index === selectedDay);

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold">Bell Schedule (Periods)</h2>
          <p className="text-sm text-muted-foreground">Define the daily periods and breaks for this school.</p>
        </div>
        <button 
          onClick={openAdd}
          className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Period
        </button>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DAYS.map(day => (
          <button
            key={day.value}
            onClick={() => setSelectedDay(day.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              selectedDay === day.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* Period List */}
      {dayPeriods.length === 0 ? (
        <EmptyState icon={Clock} title={`No periods on ${DAYS[selectedDay].label}`} description="Add your first period to start building the bell schedule for this day." />
      ) : (
        <div className="space-y-3">
          {dayPeriods.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4">
                <div className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl ${p.is_break ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                  <span className="text-xs font-black">{p.period_order}</span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    {p.label}
                    {p.is_break && <span className="text-[10px] uppercase bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded font-bold">Break</span>}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {p.start_time.substring(0, 5)} — {p.end_time.substring(0, 5)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(p)} className="p-2 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-muted-foreground hover:text-rose-500 bg-muted hover:bg-rose-500/10 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> {showModal === "add" ? "Add Period" : "Edit Period"}
              </h3>
              <button onClick={() => setShowModal("none")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Day</label>
                  <select 
                    value={form.day_index}
                    onChange={e => setForm(prev => ({ ...prev, day_index: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                  >
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Order Index</label>
                  <input 
                    type="number" min={1} required
                    value={form.period_order}
                    onChange={e => setForm(prev => ({ ...prev, period_order: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Label / Name</label>
                <input 
                  type="text" required placeholder="e.g. Period 1, Lunch Break"
                  value={form.label}
                  onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Start Time</label>
                  <input 
                    type="time" required
                    value={form.start_time}
                    onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">End Time</label>
                  <input 
                    type="time" required
                    value={form.end_time}
                    onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                <input 
                  type="checkbox" id="is_break"
                  checked={form.is_break}
                  onChange={e => setForm(prev => ({ ...prev, is_break: e.target.checked }))}
                  className="rounded text-amber-500 focus:ring-amber-500/20"
                />
                <label htmlFor="is_break" className="text-xs font-bold text-amber-600 cursor-pointer">
                  This is a break/recess (no classes)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowModal("none")} className="px-4 py-2 rounded-xl bg-muted text-xs font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
