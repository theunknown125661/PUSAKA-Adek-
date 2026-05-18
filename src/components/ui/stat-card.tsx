import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  colorClass?: string;
  bgClass?: string;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  colorClass = "text-primary",
  bgClass = "bg-primary/10",
  href,
  className,
}: StatCardProps) {
  const content = (
    <div className={cn("card rounded-2xl p-4 flex flex-col justify-between transition-all duration-200", href && "hover:border-primary/40 hover:shadow-md cursor-pointer active:scale-[0.98]", className)}>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-4 shrink-0", bgClass)}>
        <Icon className={cn("h-5 w-5", colorClass)} />
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-bold truncate leading-none">{value}</p>
          {trend && (
            <span className={cn("text-xs font-semibold mb-0.5", trendUp ? "text-success" : "text-destructive")}>
              {trendUp ? "↑" : "↓"} {trend}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 truncate font-medium uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
