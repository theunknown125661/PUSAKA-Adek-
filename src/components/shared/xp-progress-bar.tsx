import { calculateLevelAndProgress } from "@/lib/utils/gamification";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface XPProgressBarProps {
  xp: number;
  economyConfig?: any;
  userLevel?: number;
  className?: string;
  showDetails?: boolean;
}

export function XPProgressBar({ xp, economyConfig, userLevel, className, showDetails = true }: XPProgressBarProps) {
  const { 
    level, 
    xpInCurrentLevel, 
    xpForNextLevel, 
    progressPct 
  } = calculateLevelAndProgress(xp || 0, economyConfig, userLevel);

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      {showDetails && (
        <div className="flex justify-between items-end mb-0.5">
          <span className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
            <GraduationCap className="h-3.5 w-3.5" /> Lvl {level}
          </span>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            {xpInCurrentLevel} / {xpForNextLevel} XP
          </span>
        </div>
      )}
      <div className="w-full h-1.5 bg-muted/60 dark:bg-muted/20 rounded-full overflow-hidden border border-border/30 relative shadow-inner">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-purple-600 transition-all duration-1000 ease-out relative animate-shimmer bg-[linear-gradient(90deg,var(--color-primary)_0%,#6366f1_50%,var(--color-primary)_100%)] bg-[length:200%_100%] shadow-[0_0_8px_rgba(99,102,241,0.3)]" 
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
