"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { HolidayTag as HolidayTagUI } from "@/components/shared/holiday-tag";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Pencil, 
  X, 
  Check, 
  Tag, 
  CalendarDays,
  ShieldAlert,
  Clock,
  EyeOff,
  Megaphone,
  Eye,
  Sliders,
  Settings,
  Pipette
} from "lucide-react";
import type { HolidayCalendar, HolidayRule, HolidayTag, RecurrenceType } from "@/lib/types/database";
import { toast } from "sonner";
import { format, parseISO, addMonths, isBefore, addDays, getDay, getDate, getMonth } from "date-fns";

const PRESET_COLORS = [
  "#FF9F1C", // orange
  "#2EC4B6", // teal
  "#FFBF69", // yellow
  "#895100", // brown/gold
  "#FF99C8", // pink
  "#6366f1", // indigo
  "#ec4899", // bright pink
  "#3b82f6", // blue
  "#10b981", // emerald
];

export default function AdminHolidaysPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [rules, setRules] = useState<HolidayRule[]>([]);
  const [tags, setTags] = useState<HolidayTag[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Filter state
  const [filterActiveTab, setFilterActiveTab] = useState<"all" | "active" | "inactive">("all");
  const [filterTagId, setFilterTagId] = useState<string>("all");

  // Rule Form / Modal State
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<HolidayRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("one_time");
  const [ruleColor, setRuleColor] = useState("#6366f1");
  const [ruleTagId, setRuleTagId] = useState("");
  const [ruleClassId, setRuleClassId] = useState("");
  const [newTagInlineName, setNewTagInlineName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [academicYearEnd, setAcademicYearEnd] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Recurrence dynamic values
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]); // 0 (Sun) - 6 (Sat)
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [yearlyMonth, setYearlyMonth] = useState<number>(1); // 1-12
  const [yearlyDay, setYearlyDay] = useState<number>(1);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [newCustomDate, setNewCustomDate] = useState("");

  // Behavior rules
  const [pauseStreaks, setPauseStreaks] = useState(true);
  const [pauseAttendance, setPauseAttendance] = useState(true);
  const [hideCheckin, setHideCheckin] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
      let sId = profile?.school_id;
      if (!sId) {
        const { data: school } = await supabase.from("schools").select("id").limit(1).single();
        sId = school?.id;
      }

      if (sId) {
        setSchoolId(sId);
        await Promise.all([
          fetchRules(sId),
          fetchTags(sId),
          fetchClasses(sId)
        ]);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Fetch functions
  const fetchRules = async (sId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("holiday_rules")
      .select("*, holiday_tags(*)")
      .eq("school_id", sId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setRules(data as HolidayRule[]);
    }
  };

  const fetchTags = async (sId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("holiday_tags")
      .select("*")
      .or(`school_id.eq.${sId},school_id.is.null`)
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setTags(data as HolidayTag[]);
    }
  };

  const fetchClasses = async (sId: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("classes").select("id, name").eq("school_id", sId).order("name");
    if (data) setClasses(data);
  };

  // Open rules modal for Create/Edit
  const handleOpenRuleModal = (rule: HolidayRule | null = null) => {
    setEditingRule(rule);
    if (rule) {
      setRuleName(rule.name);
      setRuleDescription(rule.description || "");
      setRecurrenceType(rule.recurrence_type);
      setRuleColor(rule.color_hex);
      setRuleTagId(rule.tag_id || "");
      setRuleClassId(rule.class_id || "");
      setNewTagInlineName("");
      setStartDate(rule.start_date);
      setEndDate(rule.end_date || "");
      setIsActive(rule.is_active);
      
      setPauseStreaks(rule.pause_streaks);
      setPauseAttendance(rule.pause_attendance);
      setHideCheckin(rule.hide_checkin);
      setShowBanner(rule.show_banner);

      // Parse recurrence details
      const val = rule.recurrence_value || {};
      if (rule.recurrence_type === "weekly") {
        const dow = val.day_of_week !== undefined ? [Number(val.day_of_week)] : [];
        setSelectedDaysOfWeek(dow);
      } else if (rule.recurrence_type === "monthly") {
        setDayOfMonth(val.day_of_month || 1);
      } else if (rule.recurrence_type === "yearly") {
        setYearlyMonth(val.month || 1);
        setYearlyDay(val.day || 1);
      } else if (rule.recurrence_type === "custom") {
        setCustomDates(val.dates || []);
      }
    } else {
      // Defaults
      setRuleName("");
      setRuleDescription("");
      setRecurrenceType("one_time");
      setRuleColor("#6366f1");
      setRuleTagId(tags.find(t => t.name === "National Holiday")?.id || tags[0]?.id || "");
      setRuleClassId("");
      setNewTagInlineName("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setAcademicYearEnd("");
      setIsActive(true);
      
      setPauseStreaks(true);
      setPauseAttendance(true);
      setHideCheckin(false);
      setShowBanner(true);

      setSelectedDaysOfWeek([]);
      setDayOfMonth(1);
      setYearlyMonth(1);
      setYearlyDay(1);
      setCustomDates([]);
    }
    setShowRuleModal(true);
  };


  // Rule Save Form Handler
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || !ruleName.trim()) return;

    setSavingRule(true);
    const supabase = createClient();

    // Prepare recurrence values
    let recurrenceValue: Record<string, any> | null = null;
    if (recurrenceType === "weekly") {
      recurrenceValue = { day_of_week: selectedDaysOfWeek[0] !== undefined ? selectedDaysOfWeek[0] : 1 };
    } else if (recurrenceType === "monthly") {
      recurrenceValue = { day_of_month: dayOfMonth };
    } else if (recurrenceType === "yearly") {
      recurrenceValue = { month: yearlyMonth, day: yearlyDay };
    } else if (recurrenceType === "custom") {
      recurrenceValue = { dates: customDates };
    }

    // Process inline tag creation if requested
    let finalTagId = ruleTagId;
    const isCustomSelected = tags.find(t => t.id === ruleTagId)?.name === "Custom";
    if (isCustomSelected && newTagInlineName.trim()) {
      const { data: tagData, error: tagError } = await supabase
        .from("holiday_tags")
        .insert({
          school_id: schoolId,
          name: newTagInlineName.trim(),
          color_hex: ruleColor,
          is_preset: false,
          is_active: true
        })
        .select()
        .single();
        
      if (!tagError && tagData) {
        finalTagId = tagData.id;
      } else {
        toast.error("Failed to create custom tag");
      }
    }

    const payload = {
      school_id: schoolId,
      class_id: ruleClassId || null,
      name: ruleName.trim(),
      description: ruleDescription.trim() || null,
      recurrence_type: recurrenceType,
      recurrence_value: recurrenceValue,
      tag_id: finalTagId || null,
      color_hex: "#3b82f6", // Default color for holidays
      start_date: startDate,
      end_date: recurrenceType === "one_time" ? (endDate || startDate) : (academicYearEnd || null),
      is_active: isActive,
      pause_streaks: pauseStreaks,
      pause_attendance: pauseAttendance,
      hide_checkin: hideCheckin,
      show_banner: showBanner,
      created_by: userId
    };

    let error;
    let ruleIdForGen = editingRule?.id;

    if (editingRule) {
      const { error: err } = await supabase
        .from("holiday_rules")
        .update(payload)
        .eq("id", editingRule.id);
      error = err;
    } else {
      const { data, error: err } = await supabase
        .from("holiday_rules")
        .insert(payload)
        .select()
        .single();
      error = err;
      if (data) ruleIdForGen = data.id;
    }

    if (error) {
      toast.error(error.message);
    } else {
      // Manual trigger to call PL/pgSQL function generate_holiday_dates just to be absolutely sure RLS/Triggers sync correctly
      if (ruleIdForGen && isActive) {
        await supabase.rpc("generate_holiday_dates", { 
          rule_id: ruleIdForGen,
          generation_end: academicYearEnd ? academicYearEnd : null
        });
      }
      
      toast.success(editingRule ? t.adminHolidays.successUpdateRule : t.adminHolidays.successAddRule);
      setShowRuleModal(false);
      fetchRules(schoolId);
    }
    setSavingRule(false);
  };

  // Toggle active status
  const handleToggleActive = async (rule: HolidayRule) => {
    const supabase = createClient();
    const newActive = !rule.is_active;
    
    const { error } = await supabase
      .from("holiday_rules")
      .update({ is_active: newActive })
      .eq("id", rule.id);

    if (error) {
      toast.error(error.message);
    } else {
      if (newActive) {
        // Regenerate dates
        await supabase.rpc("generate_holiday_dates", { rule_id: rule.id });
      } else {
        // Delete calendar dates linked to rule
        await supabase.from("holiday_calendar").delete().eq("rule_id", rule.id);
      }
      toast.success(newActive ? "Holiday rule activated" : "Holiday rule deactivated");
      if (schoolId) fetchRules(schoolId);
    }
  };

  // Delete Rule Handler
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm(t.adminHolidays.confirmDelete)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("holiday_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.adminHolidays.successDeleteRule);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    }
  };

  // Custom Dates Handlers
  const handleAddCustomDate = () => {
    if (!newCustomDate) return;
    if (customDates.includes(newCustomDate)) {
      toast.error("Date already added");
      return;
    }
    setCustomDates(prev => [...prev, newCustomDate].sort());
    setNewCustomDate("");
  };

  const handleRemoveCustomDate = (dateToRemove: string) => {
    setCustomDates(prev => prev.filter(d => d !== dateToRemove));
  };

  // Generate JS dates preview for next 3 months
  const getDatesPreview = () => {
    const dates: Date[] = [];
    const limit = academicYearEnd ? new Date(academicYearEnd) : addMonths(new Date(startDate), 3);
    const start = new Date(startDate);

    if (recurrenceType === "one_time") {
      const end = endDate ? new Date(endDate) : start;
      let curr = new Date(start);
      while (curr <= end) {
        dates.push(new Date(curr));
        curr = addDays(curr, 1);
      }
    } else if (recurrenceType === "weekly") {
      const dow = selectedDaysOfWeek[0] !== undefined ? selectedDaysOfWeek[0] : 1;
      let curr = new Date(start);
      while (curr <= limit && dates.length < 15) {
        if (getDay(curr) === dow) {
          dates.push(new Date(curr));
        }
        curr = addDays(curr, 1);
      }
    } else if (recurrenceType === "monthly") {
      let curr = new Date(start);
      while (curr <= limit && dates.length < 15) {
        if (getDate(curr) === dayOfMonth) {
          dates.push(new Date(curr));
        }
        curr = addDays(curr, 1);
      }
    } else if (recurrenceType === "yearly") {
      const startYear = start.getFullYear();
      for (let y = startYear; y <= startYear + 2; y++) {
        try {
          const d = new Date(y, yearlyMonth - 1, yearlyDay);
          if (d >= start && d <= limit) {
            dates.push(d);
          }
        } catch (e) {}
      }
    } else if (recurrenceType === "custom") {
      customDates.forEach(ds => {
        const d = new Date(ds);
        if (d >= start && d <= limit) {
          dates.push(d);
        }
      });
    }

    return dates.sort((a, b) => a.getTime() - b.getTime());
  };

  // Get human readable recurrence text
  const getRecurrenceText = (rule: HolidayRule) => {
    const val = rule.recurrence_value || {};
    switch (rule.recurrence_type) {
      case "one_time":
        if (rule.end_date && rule.end_date !== rule.start_date) {
          return `${format(parseISO(rule.start_date), "MMM d")} - ${format(parseISO(rule.end_date), "MMM d, yyyy")}`;
        }
        return format(parseISO(rule.start_date), "EEEE, MMM d, yyyy");
      case "weekly":
        const dow = val.day_of_week !== undefined ? Number(val.day_of_week) : 1;
        const dowNames = [t.adminHolidays.daySun, t.adminHolidays.dayMon, t.adminHolidays.dayTue, t.adminHolidays.dayWed, t.adminHolidays.dayThu, t.adminHolidays.dayFri, t.adminHolidays.daySat];
        return `Weekly on ${dowNames[dow]}`;
      case "monthly":
        return `Day ${val.day_of_month || 1} of every month`;
      case "yearly":
        const m = val.month || 1;
        const d = val.day || 1;
        const months = [
          "", t.adminHolidays.monthJan, t.adminHolidays.monthFeb, t.adminHolidays.monthMar, t.adminHolidays.monthApr,
          t.adminHolidays.monthMay, t.adminHolidays.monthJun, t.adminHolidays.monthJul, t.adminHolidays.monthAug,
          t.adminHolidays.monthSep, t.adminHolidays.monthOct, t.adminHolidays.monthNov, t.adminHolidays.monthDec
        ];
        return `Every ${months[m]} ${d}`;
      case "custom":
        const count = (val.dates || []).length;
        return `${count} custom date${count > 1 ? "s" : ""}`;
      default:
        return rule.recurrence_type;
    }
  };

  // Filtered list
  const filteredRules = rules.filter(r => {
    // 1. Filter by Active tab
    if (filterActiveTab === "active" && !r.is_active) return false;
    if (filterActiveTab === "inactive" && r.is_active) return false;

    // 2. Filter by category tag
    if (filterTagId !== "all" && r.tag_id !== filterTagId) return false;

    return true;
  });

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card/40 backdrop-blur-md p-6 rounded-3xl border border-border/50">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/95 to-muted-foreground bg-clip-text text-transparent flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            {t.adminHolidays.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminHolidays.subtitle}</p>
        </div>
        <button
          onClick={() => handleOpenRuleModal(null)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-bold text-sm hover:shadow-lg hover:shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          {t.adminHolidays.addHoliday}
        </button>
      </div>

      <div>
        
        {/* Left Column: Holiday Rules List */}
        <div className="w-full space-y-6">
          <div className="card rounded-3xl border border-border/40 overflow-hidden shadow-xl shadow-foreground/[0.02]">
            
            {/* Filtering bar */}
            <div className="p-5 border-b border-border/50 bg-muted/20 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              {/* Active Tabs */}
              <div className="flex bg-muted/60 p-1 rounded-xl border border-border/30">
                <button
                  onClick={() => setFilterActiveTab("all")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterActiveTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterActiveTab("active")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterActiveTab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.adminHolidays.statusActive}
                </button>
                <button
                  onClick={() => setFilterActiveTab("inactive")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterActiveTab === "inactive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.adminHolidays.statusInactive}
                </button>
              </div>

              {/* Tag selector filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Filter Tag:</span>
                <select
                  value={filterTagId}
                  onChange={e => setFilterTagId(e.target.value)}
                  className="w-full md:w-48 px-3 py-1.5 rounded-xl bg-card border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
            {filteredRules.length === 0 ? (
              <div className="p-16 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm font-medium">{t.adminHolidays.noRules}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 bg-card/20">
                {filteredRules.map((rule) => {
                  const tag = tags.find(t => t.id === rule.tag_id);
                  return (
                    <div 
                      key={rule.id} 
                      className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors ${
                        !rule.is_active ? "opacity-60" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          {/* Color Badge indicator */}
                          <span 
                            className="w-3.5 h-3.5 rounded-full ring-2 ring-background shrink-0" 
                            style={{ backgroundColor: rule.color_hex }}
                          />
                          <h3 className="font-bold text-sm tracking-tight text-foreground">{rule.name}</h3>
                          
                          {/* Tag Badge */}
                          {tag && (
                            <HolidayTagUI 
                              name={tag.name} 
                              colorHex={tag.color_hex} 
                            />
                          )}

                          {/* Recurrence Type Badge */}
                          <span className="text-[10px] bg-muted/80 text-muted-foreground font-semibold px-2 py-0.5 rounded-lg capitalize border border-border/30">
                            {rule.recurrence_type === "one_time" ? "one-time" : rule.recurrence_type}
                          </span>

                          {/* Scope Badge */}
                          {!rule.class_id ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                              School
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              Class
                            </span>
                          )}
                        </div>

                        {rule.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 pl-6 max-w-lg">
                            {rule.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground/80 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                            {getRecurrenceText(rule)}
                          </span>
                          
                          <span className="w-1.5 h-1.5 rounded-full bg-border/80" />
                          
                          <span className="text-muted-foreground/70">
                            Start: {format(parseISO(rule.start_date), "MMM d, yyyy")}
                          </span>

                          {rule.end_date && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-border/80" />
                              <span className="text-muted-foreground/70">
                                End: {format(parseISO(rule.end_date), "MMM d, yyyy")}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Behavior indicators */}
                        <div className="flex gap-2 pl-6 pt-1">
                          {rule.pause_streaks && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Streak Frozen
                            </span>
                          )}
                          {rule.pause_attendance && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-500 font-bold px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                              <Sliders className="w-3 h-3" /> Exclude Attendance
                            </span>
                          )}
                          {rule.hide_checkin && (
                            <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" /> Hide Check-in
                            </span>
                          )}
                          {rule.show_banner && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                              <Megaphone className="w-3 h-3" /> Show Banner
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center pl-6 sm:pl-0 border-t border-border/20 sm:border-0 pt-3 sm:pt-0 shrink-0">
                        {/* Toggle active switch */}
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                            rule.is_active ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform duration-250 ${
                              rule.is_active ? "translate-x-5.5" : "translate-x-1"
                            }`}
                          />
                        </button>
                        
                        {/* Edit */}
                        <button
                          onClick={() => handleOpenRuleModal(rule)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-border/30"
                          title="Edit Holiday Aturan"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all border border-border/30"
                          title="Hapus Aturan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OVERLAY MODAL: CREATE OR EDIT HOLIDAY RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-card border-2 border-border/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-full sm:max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border/60 flex justify-between items-center bg-muted/20 shrink-0">
              <h2 className="font-extrabold text-lg flex items-center gap-2.5 tracking-tight">
                {editingRule ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingRule ? t.adminHolidays.editHoliday : t.adminHolidays.addHoliday}
              </h2>
              <button 
                onClick={() => setShowRuleModal(false)} 
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSaveRule} className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Name */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.holidayName}</label>
                  <input 
                    required
                    type="text" 
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder={t.adminHolidays.namePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
                  />
                </div>

                {/* Scope Class */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Scope (Optional)</label>
                  <select 
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={ruleClassId} 
                    onChange={(e) => setRuleClassId(e.target.value)}
                  >
                    <option value="">Whole School</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Tag */}
                <div className="flex flex-col gap-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{t.adminHolidays.tagLabel}</label>
                  <select
                    value={ruleTagId}
                    onChange={e => setRuleTagId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  
                  {tags.find(t => t.id === ruleTagId)?.name === "Custom" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 mt-1">
                      <input 
                        type="text"
                        autoFocus
                        required
                        value={newTagInlineName}
                        onChange={e => setNewTagInlineName(e.target.value)}
                        placeholder="Type custom tag name..."
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-primary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      />
                      
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Custom Tag Color</label>
                        <div className="flex flex-wrap gap-2 bg-muted/20 border border-border/40 p-3 rounded-2xl">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setRuleColor(color)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {ruleColor === color && (
                                <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                              )}
                            </button>
                          ))}
                          {/* Custom Hex selector */}
                          <div className="relative w-7 h-7 rounded-full border border-border/50 flex items-center justify-center bg-card hover:bg-muted transition-colors group overflow-hidden">
                            <Pipette className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                            <input
                              type="color"
                              value={ruleColor}
                              onChange={e => setRuleColor(e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -ml-2 -mt-2"
                              title="Custom color hex"
                            />
                          </div>
                          <div className="ml-auto flex items-center gap-2 pl-3 border-l border-border/50">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg border border-border/30 font-mono select-all">
                              {ruleColor.toUpperCase()}
                            </span>
                            <span 
                              className="w-5 h-5 rounded-md shadow-sm border border-white/20" 
                              style={{ backgroundColor: ruleColor }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.description}</label>
                <textarea
                  value={ruleDescription}
                  onChange={e => setRuleDescription(e.target.value)}
                  placeholder={t.adminHolidays.descriptionPlaceholder}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* 3. Recurrence Type - premium segmented button group */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.recurrenceType}</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/60">
                  {(["one_time", "weekly", "monthly", "yearly", "custom"] as RecurrenceType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRecurrenceType(type)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight transition-all uppercase ${
                        recurrenceType === type 
                          ? "bg-card text-foreground shadow border border-border/20" 
                          : "text-muted-foreground hover:text-foreground hover:bg-card/25"
                      }`}
                    >
                      {type === "one_time" ? "One-time" : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Dynamic Recurrence Selection fields */}
              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.startDate}</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* End Date (for one_time) */}
                  {recurrenceType === "one_time" && (
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.endDate}</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Leave blank for single day"
                      />
                    </div>
                  )}

                  {/* Academic Year End Date (for recurring) */}
                  {recurrenceType !== "one_time" && (
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.endAcademicYear}</label>
                      <input
                        type="date"
                        required
                        value={academicYearEnd}
                        onChange={e => setAcademicYearEnd(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{t.adminHolidays.endAcademicYearDesc}</p>
                    </div>
                  )}
                </div>

                {/* WEEKLY PICKER */}
                {recurrenceType === "weekly" && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t.adminHolidays.dayOfWeek}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: t.adminHolidays.daySun, val: 0 },
                        { label: t.adminHolidays.dayMon, val: 1 },
                        { label: t.adminHolidays.dayTue, val: 2 },
                        { label: t.adminHolidays.dayWed, val: 3 },
                        { label: t.adminHolidays.dayThu, val: 4 },
                        { label: t.adminHolidays.dayFri, val: 5 },
                        { label: t.adminHolidays.daySat, val: 6 },
                      ].map(d => {
                        const isSel = selectedDaysOfWeek.includes(d.val);
                        return (
                          <button
                            key={d.val}
                            type="button"
                            onClick={() => setSelectedDaysOfWeek([d.val])} // single day choice for weekly rule
                            className={`w-11 h-11 rounded-xl text-xs font-bold border transition-all ${
                              isSel 
                                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MONTHLY PICKER */}
                {recurrenceType === "monthly" && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.dayOfMonth}</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={e => setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                      className="w-full md:w-32 px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* YEARLY PICKER */}
                {recurrenceType === "yearly" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.monthOfYear}</label>
                      <select
                        value={yearlyMonth}
                        onChange={e => setYearlyMonth(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[
                          { name: t.adminHolidays.monthJan, v: 1 },
                          { name: t.adminHolidays.monthFeb, v: 2 },
                          { name: t.adminHolidays.monthMar, v: 3 },
                          { name: t.adminHolidays.monthApr, v: 4 },
                          { name: t.adminHolidays.monthMay, v: 5 },
                          { name: t.adminHolidays.monthJun, v: 6 },
                          { name: t.adminHolidays.monthJul, v: 7 },
                          { name: t.adminHolidays.monthAug, v: 8 },
                          { name: t.adminHolidays.monthSep, v: 9 },
                          { name: t.adminHolidays.monthOct, v: 10 },
                          { name: t.adminHolidays.monthNov, v: 11 },
                          { name: t.adminHolidays.monthDec, v: 12 },
                        ].map(m => (
                          <option key={m.v} value={m.v}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.dayOfMonth}</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={31}
                        value={yearlyDay}
                        onChange={e => setYearlyDay(Math.max(1, Math.min(31, Number(e.target.value))))}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {/* CUSTOM PICKER */}
                {recurrenceType === "custom" && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.adminHolidays.customDates}</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newCustomDate}
                        onChange={e => setNewCustomDate(e.target.value)}
                        className="px-3.5 py-2 rounded-2xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomDate}
                        className="px-4 py-2 rounded-2xl bg-muted text-foreground border border-border/50 text-xs font-bold hover:bg-muted/75 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.adminHolidays.addCustomDate}
                      </button>
                    </div>

                    {/* Display current custom dates */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {customDates.map(d => (
                        <span 
                          key={d} 
                          className="bg-card text-foreground font-semibold text-xs px-2.5 py-1 rounded-full border border-border/60 flex items-center gap-1.5 shadow-sm"
                        >
                          {format(new Date(d), "MMM d, yyyy")}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDate(d)}
                            className="text-muted-foreground hover:text-destructive transition-colors rounded-full"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </span>
                      ))}
                      {customDates.length === 0 && (
                        <span className="text-xs text-muted-foreground/60 italic">No dates added yet</span>
                      )}
                    </div>
                  </div>
                )}
              </div>


              {/* 6. Behavior Rules */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t.adminHolidays.behaviorRules}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Toggles */}
                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-card border border-border/40 hover:bg-muted/15 transition-all">
                    <div className="space-y-0.5 max-w-[80%]">
                      <span className="text-xs font-bold text-foreground block">{t.adminHolidays.pauseStreaks}</span>
                      <span className="text-[10px] text-muted-foreground block">{t.adminHolidays.pauseStreaksDesc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPauseStreaks(!pauseStreaks)}
                      className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                        pauseStreaks ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${pauseStreaks ? "translate-x-5.5" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-card border border-border/40 hover:bg-muted/15 transition-all">
                    <div className="space-y-0.5 max-w-[80%]">
                      <span className="text-xs font-bold text-foreground block">{t.adminHolidays.pauseAttendance}</span>
                      <span className="text-[10px] text-muted-foreground block">{t.adminHolidays.pauseAttendanceDesc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPauseAttendance(!pauseAttendance)}
                      className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                        pauseAttendance ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${pauseAttendance ? "translate-x-5.5" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-card border border-border/40 hover:bg-muted/15 transition-all">
                    <div className="space-y-0.5 max-w-[80%]">
                      <span className="text-xs font-bold text-foreground block">{t.adminHolidays.hideCheckin}</span>
                      <span className="text-[10px] text-muted-foreground block">{t.adminHolidays.hideCheckinDesc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHideCheckin(!hideCheckin)}
                      className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                        hideCheckin ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${hideCheckin ? "translate-x-5.5" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-card border border-border/40 hover:bg-muted/15 transition-all">
                    <div className="space-y-0.5 max-w-[80%]">
                      <span className="text-xs font-bold text-foreground block">{t.adminHolidays.showBanner}</span>
                      <span className="text-[10px] text-muted-foreground block">{t.adminHolidays.showBannerDesc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBanner(!showBanner)}
                      className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                        showBanner ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${showBanner ? "translate-x-5.5" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 7. Generated Dates Preview Panel */}
              <div className="p-4.5 bg-muted/40 border border-border/50 rounded-2xl space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  {t.adminHolidays.calendarPreview}
                </span>
                
                <div className="flex flex-wrap gap-2.5 pt-1.5">
                  {getDatesPreview().slice(0, 10).map((d, index) => (
                    <span 
                      key={index} 
                      className="bg-card text-foreground border border-border/40 font-semibold text-xs px-2.5 py-1.5 rounded-xl shadow-sm hover:scale-[1.02] transition-transform cursor-default"
                      style={{ borderLeft: `4px solid ${ruleColor}` }}
                    >
                      {format(d, "EEE, MMM d, yyyy")}
                    </span>
                  ))}
                  {getDatesPreview().length === 0 && (
                    <span className="text-xs text-muted-foreground/60 italic font-medium">Please enter valid start/end/repeat values to preview dates</span>
                  )}
                  {getDatesPreview().length > 10 && (
                    <span className="bg-card text-muted-foreground/80 border border-border/30 font-semibold text-xs px-2.5 py-1.5 rounded-xl self-center">
                      + {getDatesPreview().length - 10} more dates...
                    </span>
                  )}
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/40 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-foreground block">Enable Rule</span>
                  <span className="text-[10px] text-muted-foreground block">Enable this rule to generate holiday calendar entries</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-5.5 w-10.5 items-center rounded-full transition-colors focus:outline-none ${
                    isActive ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${isActive ? "translate-x-5.5" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3.5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-muted border border-border/60 hover:bg-muted/70 text-foreground font-bold text-sm transition-all"
                >
                  {t.adminHolidays.cancel}
                </button>
                <button 
                  type="submit" 
                  disabled={savingRule || !ruleName.trim() || (recurrenceType === "custom" && customDates.length === 0)}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 text-white font-bold text-sm hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all"
                >
                  {savingRule ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : t.adminHolidays.saveRule}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
