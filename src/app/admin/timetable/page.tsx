"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { 
  Calendar, Clock, Users, Plus, Pencil, Trash2, X, Check, Loader2, Search, Filter, ShieldAlert,
  ChevronLeft, ChevronRight, Lock, Unlock
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Class, School, Subject, Profile, SchoolPeriod, ClassScheduleSession } from "@/lib/types/database";

import { PeriodConfigurationTab } from "./period-tab";
import { TimetableBuilderTab } from "./timetable-tab";
import { SelectionMonitorTab } from "./monitor-tab";

type TabState = "periods" | "timetable" | "monitor";

export default function TimetableAdminPage() {
  const { t, isClient } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<TabState>("periods");
  const [loading, setLoading] = useState(true);
  
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  
  // Data State
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  
  // We will build these out individually
  
  const loadBaseData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch user profile to get school scope if needed
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: schoolData } = await supabase.from("schools").select("*").eq("is_active", true);
    if (schoolData && schoolData.length > 0) {
      setSchools(schoolData as School[]);
      setSelectedSchoolId(schoolData[0].id);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary" />
            Timetable & Scheduling
          </h1>
          <p className="text-muted-foreground text-xs font-semibold">
            Manage school periods, class schedules, and student subject selections.
          </p>
        </div>

        {schools.length > 0 && (
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/40 p-1.5 rounded-2xl border border-border/50 max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab("periods")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "periods" 
              ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Clock className="h-4 w-4" /> Period Configuration
        </button>
        <button
          onClick={() => setActiveTab("timetable")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "timetable" 
              ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Calendar className="h-4 w-4" /> Class Timetable Builder
        </button>
        <button
          onClick={() => setActiveTab("monitor")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === "monitor" 
              ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          <Users className="h-4 w-4" /> Student Selection Monitor
        </button>
      </div>

      {/* Content Area */}
      <div className="glass rounded-2xl p-6 border border-border/50 min-h-[500px]">
        {activeTab === "periods" && (
          <PeriodConfigurationTab schoolId={selectedSchoolId} />
        )}
        {activeTab === "timetable" && (
          <TimetableBuilderTab schoolId={selectedSchoolId} />
        )}
        {activeTab === "monitor" && (
          <SelectionMonitorTab schoolId={selectedSchoolId} />
        )}
      </div>
    </div>
  );
}


