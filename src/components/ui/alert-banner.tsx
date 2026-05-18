import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type AlertVariant = "info" | "warning" | "error" | "success";

interface AlertBannerProps {
  variant: AlertVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const variantConfig: Record<AlertVariant, { icon: React.ElementType; className: string }> = {
  info: {
    icon: Info,
    className: "bg-info/10 text-info border-info/20",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  error: {
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  success: {
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20",
  },
};

export function AlertBanner({ variant, title, description, action, className }: AlertBannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", config.className, className)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold leading-tight">{title}</h4>
        {description && <p className="text-sm opacity-90 mt-1 leading-snug">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
