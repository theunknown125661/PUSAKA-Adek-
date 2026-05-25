import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalYYYYMMDD } from "@/lib/utils/format";
import { type AttendancePolicy, classifyCheckin, type ArrivalStatus } from "@/lib/utils/attendance-engine";

export interface CheckinState {
  loading: boolean;
  enrollment: { school_id: string; class_id: string } | null;
  rewardRules: any | null;
  activePolicy: AttendancePolicy | null;
  
  // Holiday and Weekend State
  isHoliday: boolean;
  holidayConfig: { name: string; description?: string; color_hex?: string; hide_checkin?: boolean } | null;
  weekHolidays: any[];
  isWeekend: boolean;
  
  // Checking Logic
  canCheckIn: boolean;
  status: ArrivalStatus | "weekend" | "holiday" | "before_open" | "after_absent";
  timePhase: string; // Friendly text like "Early Window", "Late Window", "Closed"
}

export function useCheckinState(userId: string | undefined): CheckinState {
  const [state, setState] = useState<CheckinState>({
    loading: true,
    enrollment: null,
    rewardRules: null,
    activePolicy: null,
    isHoliday: false,
    holidayConfig: null,
    weekHolidays: [],
    isWeekend: false,
    canCheckIn: false,
    status: "invalid",
    timePhase: "Checking...",
  });

  useEffect(() => {
    if (!userId) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    const loadState = async () => {
      const supabase = createClient();
      const today = toLocalYYYYMMDD();
      const now = new Date();
      
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday of this week
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      const mondayStr = toLocalYYYYMMDD(monday);
      const sunday = new Date(now.getFullYear(), now.getMonth(), diff + 6);
      const sundayStr = toLocalYYYYMMDD(sunday);

      // 1. Get Enrollment
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(school_id)")
        .eq("student_id", userId)
        .limit(1)
        .maybeSingle();

      if (!enr || !enr.classes) {
        setState(s => ({ ...s, loading: false }));
        return;
      }
      
      const schoolId = (enr.classes as any).school_id;
      const classId = enr.class_id;

      // 2. Fetch all school/class related configurations in parallel
      // For holidays, we want to match exact class_id OR null class_id (school-wide)
      const [rulesRes, policyRes, holidayRes, weekHolidaysRes] = await Promise.all([
        supabase.from("reward_rules").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase.from("attendance_policies")
          .select("*")
          .eq("is_active", true)
          .eq("school_id", schoolId)
          .or(`class_id.eq.${classId || '00000000-0000-0000-0000-000000000000'},class_id.is.null`)
          .limit(1)
          .maybeSingle(),
        supabase.from("holiday_calendar")
          .select("*")
          .eq("school_id", schoolId)
          .eq("date", today)
          // Sort so that class-specific holidays take precedence over school-wide ones, then take the first
          .order("class_id", { ascending: false, nullsFirst: false })
          .limit(1),
        supabase.from("holiday_calendar")
          .select("date, name, color_hex")
          .eq("school_id", schoolId)
          .gte("date", mondayStr)
          .lte("date", sundayStr)
      ]);

      const rules = rulesRes.data;
      const policy = policyRes.data as AttendancePolicy;
      const holiday = holidayRes.data?.[0]; // Get the first match (class-specific if exists, else school-wide)
      const weekHolidays = weekHolidaysRes.data || [];

      let isWeekend = false;
      if (rules && rules.economy_config?.active_days) {
        const todayDay = now.getDay();
        if (!rules.economy_config.active_days.includes(todayDay)) {
          isWeekend = true;
        }
      }

      let isHoliday = false;
      let holidayConfig = null;
      if (holiday && holiday.hide_checkin !== false) {
        isHoliday = true;
        holidayConfig = holiday;
      }

      // Determine Check-in State based on Time Policy
      let canCheckIn = false;
      let arrivalStatus: any = "invalid";
      let timePhase = "Closed";

      if (isWeekend) {
        arrivalStatus = "weekend";
        timePhase = "Weekend / Rest Day";
      } else if (isHoliday) {
        arrivalStatus = "holiday";
        timePhase = "Holiday / School Closed";
      } else if (policy) {
        const classification = classifyCheckin(now, policy);
        arrivalStatus = classification.status;
        
        if (arrivalStatus === "invalid") {
          // If invalid, it might be before it opens
          timePhase = "Not Open Yet";
        } else if (arrivalStatus === "absent") {
          timePhase = "Check-in Closed (Absent)";
        } else {
          canCheckIn = true;
          if (arrivalStatus === "early") timePhase = "Early Window";
          else if (arrivalStatus === "normal") timePhase = "Normal Window";
          else if (arrivalStatus === "late") timePhase = "Late Window";
        }
      } else {
        // Fallback to legacy reward rules if no policy exists
        if (rules && rules.attendance_start_time && rules.attendance_end_time) {
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          if (timeStr < rules.attendance_start_time) {
            arrivalStatus = "before_open";
            timePhase = "Not Open Yet";
          } else if (timeStr > rules.attendance_end_time) {
            arrivalStatus = "absent";
            timePhase = "Check-in Closed";
          } else {
            canCheckIn = true;
            arrivalStatus = "normal";
            timePhase = "Open";
          }
        }
      }

      setState({
        loading: false,
        enrollment: { school_id: schoolId, class_id: classId },
        rewardRules: rules,
        activePolicy: policy,
        isHoliday,
        holidayConfig,
        weekHolidays,
        isWeekend,
        canCheckIn,
        status: arrivalStatus,
        timePhase
      });
    };

    loadState();
    
    // Set up a minute-by-minute refresh so the time windows naturally switch
    const interval = setInterval(loadState, 60000);
    return () => clearInterval(interval);

  }, [userId]);

  return state;
}
