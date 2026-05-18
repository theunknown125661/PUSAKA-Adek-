import React from "react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonState = "idle" | "loading" | "success" | "error" | "blocked";

interface StatefulButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state?: ButtonState;
  label: string;
  loadingLabel?: string;
  blockedReason?: string;
  icon?: React.ElementType;
  variant?: "primary" | "secondary" | "destructive";
}

export function StatefulButton({
  state = "idle",
  label,
  loadingLabel = "Loading...",
  blockedReason,
  icon: Icon,
  variant = "primary",
  className,
  disabled,
  ...props
}: StatefulButtonProps) {
  const isBlocked = state === "blocked";
  const isLoading = state === "loading";
  const isSuccess = state === "success";

  const baseStyles = "relative flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 overflow-hidden";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
    secondary: "bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98]",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
  };

  const blockedStyles = "bg-muted text-muted-foreground opacity-80 cursor-not-allowed hover:bg-muted active:scale-100";
  const successStyles = "bg-success text-success-foreground active:scale-100";

  return (
    <div className="w-full flex flex-col gap-1.5">
      <button
        className={cn(
          baseStyles,
          isSuccess ? successStyles : isBlocked ? blockedStyles : variants[variant],
          (isLoading || disabled) && "opacity-70 cursor-not-allowed active:scale-100 hover:bg-current",
          className
        )}
        disabled={isLoading || isSuccess || disabled} // NOTE: intentionally NOT disabling when blocked so click can show validation errors
        {...props}
      >
        <span className={cn("flex items-center gap-2", isLoading && "opacity-0")}>
          {isSuccess ? (
            <>
              <Check className="h-4 w-4 animate-scale-in" />
              <span>Success</span>
            </>
          ) : (
            <>
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span>{label}</span>
            </>
          )}
        </span>

        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 animate-fade-in">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{loadingLabel}</span>
          </span>
        )}
      </button>

      {isBlocked && blockedReason && (
        <p className="text-xs text-destructive text-center font-medium animate-slide-up">
          {blockedReason}
        </p>
      )}
    </div>
  );
}
