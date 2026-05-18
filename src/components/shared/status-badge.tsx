import { cn } from "@/lib/utils";
import type { AttendanceStatus, WithdrawalStatus } from "@/lib/types/database";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_teacher_view: {
    label: "Pending Review",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  pending_admin_review: {
    label: "Awaiting Approval",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  flagged: {
    label: "Flagged",
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AttendanceStatus | WithdrawalStatus | "flagged";
  className?: string;
}) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
