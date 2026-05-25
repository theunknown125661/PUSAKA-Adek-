import { parse, isAfter, isBefore, isEqual, differenceInMinutes, addMinutes } from "date-fns";

export type ArrivalStatus = "early" | "normal" | "late" | "absent" | "invalid";

export interface AttendancePolicy {
  id?: string;
  checkin_open_at: string;
  early_start_at: string;
  early_end_at: string;
  normal_start_at: string;
  normal_end_at: string;
  late_start_at: string;
  late_end_at: string;
  absent_after_at: string;
  late_enabled: boolean;
  late_grace_minutes: number;
  late_penalty_type: string | null;
  late_penalty_value: number | null;
}

export interface CheckinClassification {
  status: ArrivalStatus;
  minutes_delta_from_start: number;
  penalty_applied: boolean;
  penalty_type: string | null;
  penalty_value: number | null;
}

/**
 * Parses a "HH:mm" time string into a Date object for today.
 */
function parseTime(timeStr: string): Date {
  // We use a dummy date because we only care about time comparison
  return parse(timeStr, "HH:mm:ss", new Date());
}

/**
 * Checks if target is between start and end (inclusive)
 */
function isBetween(target: Date, start: Date, end: Date): boolean {
  return (isEqual(target, start) || isAfter(target, start)) && 
         (isEqual(target, end) || isBefore(target, end));
}

/**
 * Evaluates a check-in time against the provided policy rules.
 * @param checkinTime The current Date object of the check-in.
 * @param policy The active attendance policy.
 */
export function classifyCheckin(checkinTime: Date, policy: AttendancePolicy): CheckinClassification {
  
  // Create comparable dates for today using the policy's time strings
  // Note: Assuming policy times are formatted as HH:mm:ss or HH:mm from Postgres
  const normalize = (t: string) => t.length === 5 ? `${t}:00` : t;
  
  const checkinOpen = parseTime(normalize(policy.checkin_open_at));
  const earlyStart = parseTime(normalize(policy.early_start_at));
  const earlyEnd = parseTime(normalize(policy.early_end_at));
  const normalStart = parseTime(normalize(policy.normal_start_at));
  const normalEnd = parseTime(normalize(policy.normal_end_at));
  const lateStart = parseTime(normalize(policy.late_start_at));
  const lateEnd = parseTime(normalize(policy.late_end_at));
  const absentAfter = parseTime(normalize(policy.absent_after_at));

  // Extract just the time part of the checkin for pure time comparison
  const timeOnlyStr = `${String(checkinTime.getHours()).padStart(2, '0')}:${String(checkinTime.getMinutes()).padStart(2, '0')}:${String(checkinTime.getSeconds()).padStart(2, '0')}`;
  const checkinTimeNormalized = parseTime(timeOnlyStr);

  // Default empty penalty
  const noPenalty = {
    penalty_applied: false,
    penalty_type: null,
    penalty_value: null,
  };

  // 0. Before Check-in Opens
  if (isBefore(checkinTimeNormalized, checkinOpen)) {
    return {
      status: "invalid",
      minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart),
      ...noPenalty
    };
  }

  // 1. Early Window
  if (isBetween(checkinTimeNormalized, earlyStart, earlyEnd)) {
    return {
      status: "early",
      minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart), // will be negative
      ...noPenalty
    };
  }

  // 2. Normal Window
  if (isBetween(checkinTimeNormalized, normalStart, normalEnd)) {
    return {
      status: "normal",
      minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart), // could be >= 0
      ...noPenalty
    };
  }

  // 3. Late Window
  const lateStartWithGrace = addMinutes(lateStart, policy.late_grace_minutes || 0);
  
  if (policy.late_enabled && isBetween(checkinTimeNormalized, lateStart, lateEnd)) {
    
    // If within grace period, we treat it as Normal
    if (isBefore(checkinTimeNormalized, lateStartWithGrace)) {
      return {
        status: "normal", // Forgiven by grace period
        minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart),
        ...noPenalty
      };
    }

    return {
      status: "late",
      minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart),
      penalty_applied: !!policy.late_penalty_type && policy.late_penalty_type !== "none",
      penalty_type: policy.late_penalty_type,
      penalty_value: policy.late_penalty_value
    };
  }

  // 4. Absent Cutoff
  if (isAfter(checkinTimeNormalized, absentAfter) || isEqual(checkinTimeNormalized, absentAfter)) {
    return {
      status: "absent",
      minutes_delta_from_start: differenceInMinutes(checkinTimeNormalized, normalStart),
      ...noPenalty
    };
  }

  // Fallback if none match (should ideally not happen if ranges are contiguous)
  return { 
    status: "invalid", 
    minutes_delta_from_start: 0,
    ...noPenalty 
  };
}
