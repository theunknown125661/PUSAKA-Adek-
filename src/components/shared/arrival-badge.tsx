import React from "react";
import { cn } from "@/lib/utils";
import type { ArrivalStatus, AttendanceLog } from "@/lib/types/database";
import { Clock, Zap, AlertTriangle, XCircle } from "lucide-react";

export function getArrivalStatus(log: Partial<AttendanceLog>): ArrivalStatus {
  if (log.arrival_status) return log.arrival_status;
  
  if (log.before_early_cutoff) return "early";
  if (log.within_time_window === true) return "normal";
  if (log.within_time_window === false && log.status !== 'rejected') return "late";
  if (log.status === 'rejected') return "absent";
  
  // default fallback
  return "normal";
}

export function ArrivalBadge({
  status,
  log,
  className,
  showIcon = false
}: {
  status?: ArrivalStatus | null;
  log?: Partial<AttendanceLog>;
  className?: string;
  showIcon?: boolean;
}) {
  const resolvedStatus = status || (log ? getArrivalStatus(log) : "normal");

  const config = {
    early: { 
      label: "Early", 
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      icon: Zap
    },
    normal: { 
      label: "On Time", 
      className: "bg-success/10 text-success border border-success/20",
      icon: Clock
    },
    late: { 
      label: "Late", 
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20",
      icon: AlertTriangle
    },
    absent: { 
      label: "Absent", 
      className: "bg-destructive/10 text-destructive border border-destructive/20",
      icon: XCircle
    },
  };

  const current = config[resolvedStatus as ArrivalStatus] || config.normal;
  const Icon = current.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
        current.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {current.label}
    </span>
  );
}
