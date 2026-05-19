"use client";

import AvatarDisplay from "./avatar-display";
import type { AvatarMode } from "@/lib/types/database";

interface ProfileHeaderCardProps {
  fullName: string;
  avatarUrl?: string | null;
  avatarMode?: AvatarMode;
  title?: string | null;
  bio?: string | null;
  frameColor?: string | null;
  streakCount?: number;
  className?: string;
  compact?: boolean;
}

export default function ProfileHeaderCard({
  fullName,
  avatarUrl,
  avatarMode = "initials",
  title,
  bio,
  frameColor,
  streakCount,
  className = "",
  compact = false,
}: ProfileHeaderCardProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <AvatarDisplay
        fullName={fullName}
        avatarUrl={avatarUrl}
        avatarMode={avatarMode}
        size={compact ? "sm" : "lg"}
        frameColor={frameColor}
      />
      <div className="min-w-0 flex-1">
        <h2 className={`font-bold truncate ${compact ? "text-sm" : "text-lg"}`}>
          {fullName}
        </h2>
        {title && (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary mt-1`}>
            {title}
          </span>
        )}
        {!compact && bio && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{bio}</p>
        )}
        {streakCount !== undefined && streakCount > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs">🔥</span>
            <span className="text-xs font-bold text-amber-500">{streakCount} day streak</span>
          </div>
        )}
      </div>
    </div>
  );
}
