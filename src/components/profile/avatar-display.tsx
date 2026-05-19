"use client";

import { useMemo } from "react";
import type { AvatarMode } from "@/lib/types/database";

interface AvatarDisplayProps {
  fullName: string;
  avatarUrl?: string | null;
  avatarMode?: AvatarMode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  frameColor?: string | null;
  className?: string;
}

const sizeMap = {
  xs: "h-8 w-8 text-[11px]",
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-base",
  lg: "h-20 w-20 text-xl",
  xl: "h-28 w-28 text-3xl",
};

const frameSizeMap = {
  xs: "ring-[1.5px]",
  sm: "ring-2",
  md: "ring-[2.5px]",
  lg: "ring-[3px]",
  xl: "ring-4",
};

/** Deterministic color from a string (name). */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AvatarDisplay({
  fullName,
  avatarUrl,
  avatarMode = "initials",
  size = "md",
  frameColor,
  className = "",
}: AvatarDisplayProps) {
  const initials = useMemo(() => getInitials(fullName), [fullName]);
  const bgColor = useMemo(() => hashColor(fullName), [fullName]);
  const showPhoto = avatarMode === "upload" && avatarUrl;

  return (
    <div
      className={`relative rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold select-none ${sizeMap[size]} ${frameColor ? `${frameSizeMap[size]} ring-offset-2 ring-offset-background` : ""} ${className}`}
      style={{
        backgroundColor: showPhoto ? "transparent" : bgColor,
        color: showPhoto ? undefined : "#fff",
        ...(frameColor ? { boxShadow: `0 0 0 ${size === "xs" ? "1.5px" : size === "sm" ? "2px" : size === "md" ? "2.5px" : size === "lg" ? "3px" : "4px"} ${frameColor}` } : {}),
      }}
    >
      {showPhoto ? (
        <img
          src={avatarUrl!}
          alt={fullName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export { hashColor, getInitials };
