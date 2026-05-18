import { cn } from "@/lib/utils";
import type { AttendanceStatus, WithdrawalStatus } from "@/lib/types/database";
import { CheckCircle2, AlertCircle, XCircle, Clock, ShieldAlert, Wallet, Lock, Check } from "lucide-react";
import React from "react";

type ExtendedStatus = AttendanceStatus | WithdrawalStatus | "flagged" | "available" | "held" | "withdrawn";

interface StatusConfig {
  label: string;
  className: string;
  icon: React.ElementType;
}

const statusConfig: Record<ExtendedStatus, StatusConfig> = {
  // Attendance
  pending_teacher_view: {
    label: "Pending Review",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: Clock,
  },
  pending_admin_review: {
    label: "Awaiting Approval",
    className: "bg-info/10 text-info border-info/20",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
  flagged: {
    label: "Flagged",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: ShieldAlert,
  },
  // Wallet/Withdrawal
  pending: {
    label: "Pending",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: Clock,
  },
  available: {
    label: "Available",
    className: "bg-success/10 text-success border-success/20",
    icon: Wallet,
  },
  held: {
    label: "Held",
    className: "bg-info/10 text-info border-info/20",
    icon: Lock,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted text-muted-foreground border-border",
    icon: Check,
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ExtendedStatus;
  className?: string;
}) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors shadow-sm",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}
