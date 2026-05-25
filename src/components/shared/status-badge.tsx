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
    className: "text-warning",
    icon: Clock,
  },
  pending_admin_review: {
    label: "Awaiting Approval",
    className: "text-info",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "text-success",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "text-destructive",
    icon: XCircle,
  },
  flagged: {
    label: "Flagged",
    className: "text-destructive",
    icon: ShieldAlert,
  },
  // Wallet/Withdrawal
  pending: {
    label: "Pending",
    className: "text-warning",
    icon: Clock,
  },
  available: {
    label: "Available",
    className: "text-success",
    icon: Wallet,
  },
  held: {
    label: "Held",
    className: "text-info",
    icon: Lock,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "text-muted-foreground",
    icon: Check,
  },
  token_issued: {
    label: "Pass Ready",
    className: "text-primary",
    icon: Wallet,
  },
  redeemed: {
    label: "Redeemed",
    className: "text-emerald-500",
    icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    className: "text-muted-foreground",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    className: "text-rose-500",
    icon: XCircle,
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
        "inline-flex items-center gap-1.5 text-[10px] font-bold transition-colors uppercase tracking-wider",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}
