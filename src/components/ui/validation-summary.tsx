import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidationError {
  id: string; // The DOM id of the element to scroll to
  message: string;
}

interface ValidationSummaryProps {
  errors: ValidationError[];
  className?: string;
}

export function ValidationSummary({ errors, className }: ValidationSummaryProps) {
  if (!errors || errors.length === 0) return null;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Optional: add a brief highlight effect
      el.classList.add("ring-2", "ring-destructive", "ring-offset-2", "transition-all");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-destructive", "ring-offset-2", "transition-all");
      }, 1500);
    }
  };

  return (
    <div className={cn("bg-destructive/10 border border-destructive/20 rounded-xl overflow-hidden animate-slide-up", className)}>
      <div className="flex items-center gap-2 px-4 py-3 bg-destructive/5 border-b border-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <h4 className="text-sm font-semibold text-destructive">
          Please fix {errors.length} issue{errors.length > 1 ? "s" : ""} to continue:
        </h4>
      </div>
      <ul className="py-2">
        {errors.map((error, idx) => (
          <li key={idx}>
            <button
              onClick={() => scrollTo(error.id)}
              className="w-full flex items-center justify-between text-left px-4 py-2 text-sm text-foreground hover:bg-destructive/5 transition-colors active:bg-destructive/10 group"
            >
              <span className="font-medium">{error.message}</span>
              <ChevronRight className="h-4 w-4 text-destructive/50 group-hover:text-destructive transition-colors shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
