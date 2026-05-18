import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed bg-muted/30 animate-fade-in", className)}>
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground ring-4 ring-background">
        <Icon className="h-8 w-8 opacity-60" />
      </div>
      <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mt-1.5 leading-snug">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
