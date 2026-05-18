import { CheckCircle2, AlertCircle, XCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type RequirementStatus = "complete" | "warning" | "blocked" | "pending";

interface RequirementItemProps {
  label: string;
  detail?: string;
  status: RequirementStatus;
  className?: string;
}

export function RequirementItem({ label, detail, status, className }: RequirementItemProps) {
  const config = {
    complete: { icon: CheckCircle2, iconClass: "text-success", textClass: "text-foreground" },
    warning: { icon: AlertCircle, iconClass: "text-warning", textClass: "text-foreground" },
    blocked: { icon: XCircle, iconClass: "text-destructive", textClass: "text-destructive" },
    pending: { icon: Circle, iconClass: "text-muted-foreground opacity-50", textClass: "text-muted-foreground" },
  };

  const { icon: Icon, iconClass, textClass } = config[status];

  return (
    <div className={cn("flex items-start gap-3 p-2 transition-colors", className)}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconClass)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-tight", textClass)}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{detail}</p>}
      </div>
    </div>
  );
}
