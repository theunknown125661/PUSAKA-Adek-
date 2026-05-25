import React from "react";
import { cn } from "@/lib/utils";

interface HolidayTagProps {
  name: string;
  colorHex?: string;
  className?: string;
}

export function HolidayTag({ name, colorHex = "#3b82f6", className }: HolidayTagProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap w-fit max-w-full overflow-hidden text-ellipsis",
        className
      )}
      style={{ 
        backgroundColor: `color-mix(in srgb, ${colorHex} 15%, transparent)`,
        color: colorHex 
      }}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}
