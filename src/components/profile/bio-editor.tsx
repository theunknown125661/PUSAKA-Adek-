"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Simple built-in profanity word list (Indonesian + English basics)
const BLOCKED_WORDS = [
  "bangsat", "bajingan", "kampret", "bego", "tolol", "goblok", "anjing",
  "brengsek", "setan", "iblis", "bodoh", "idiot", "kontol", "memek",
  "fuck", "shit", "ass", "bitch", "damn", "bastard", "dick", "crap",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => lower.includes(word));
}

interface BioEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}

export default function BioEditor({
  value,
  onChange,
  maxLength = 160,
  placeholder = "Write a short bio about yourself...",
}: BioEditorProps) {
  const [profanityWarning, setProfanityWarning] = useState(false);

  useEffect(() => {
    if (value) {
      setProfanityWarning(containsProfanity(value));
    } else {
      setProfanityWarning(false);
    }
  }, [value]);

  const remaining = maxLength - value.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength + 10} // Allow slight overflow for UX, validate on save
        rows={3}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-muted border text-sm resize-none focus:outline-none focus:ring-2 transition-shadow ${
          isOverLimit || profanityWarning
            ? "border-destructive/50 focus:ring-destructive/30"
            : "border-border focus:ring-primary/50"
        }`}
      />

      <div className="flex items-center justify-between px-1">
        {profanityWarning ? (
          <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Please remove inappropriate words from your bio.
          </div>
        ) : (
          <div />
        )}

        <span
          className={`text-xs font-bold tabular-nums ${
            isOverLimit
              ? "text-destructive"
              : remaining <= 20
              ? "text-amber-500"
              : "text-muted-foreground"
          }`}
        >
          {remaining}
        </span>
      </div>
    </div>
  );
}

export { containsProfanity };
