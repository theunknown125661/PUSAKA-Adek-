"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ArrowRight, X } from "lucide-react";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { AppNotification, NotificationCategory } from "@/lib/types/database";
import type { Messages } from "@/lib/i18n/types";
import {
  CheckCircle2, XCircle, Flame, Trophy, Coins, Star,
  Wallet, ClipboardCheck, AlertTriangle, ShoppingBag, Zap,
} from "lucide-react";

// ── Icon + color mapping per notification type ─────────────────────────────

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  attendance_approved:  { icon: CheckCircle2,   color: "text-emerald-600 dark:text-emerald-500", bg: "bg-emerald-500/10" },
  attendance_rejected:  { icon: XCircle,        color: "text-rose-600 dark:text-rose-500",       bg: "bg-rose-500/10" },
  streak_milestone:     { icon: Flame,          color: "text-orange-600 dark:text-orange-500",   bg: "bg-orange-500/10" },
  streak_protected:     { icon: Flame,          color: "text-amber-600 dark:text-amber-500",     bg: "bg-amber-500/10" },
  badge_unlocked:       { icon: Trophy,         color: "text-amber-600 dark:text-amber-500",     bg: "bg-amber-500/10" },
  quest_completed:      { icon: Zap,            color: "text-purple-600 dark:text-purple-500",   bg: "bg-purple-500/10" },
  coins_earned:         { icon: Coins,          color: "text-amber-600 dark:text-amber-500",     bg: "bg-amber-500/10" },
  level_up:             { icon: Star,           color: "text-indigo-600 dark:text-indigo-500",   bg: "bg-indigo-500/10" },
  withdrawal_approved:  { icon: Wallet,         color: "text-emerald-600 dark:text-emerald-500", bg: "bg-emerald-500/10" },
  withdrawal_rejected:  { icon: Wallet,         color: "text-rose-600 dark:text-rose-500",       bg: "bg-rose-500/10" },
  shop_purchase:        { icon: ShoppingBag,    color: "text-blue-600 dark:text-blue-500",       bg: "bg-blue-500/10" },
  pending_reviews:      { icon: ClipboardCheck, color: "text-amber-600 dark:text-amber-500",     bg: "bg-amber-500/10" },
  flagged_submission:   { icon: AlertTriangle,  color: "text-orange-600 dark:text-orange-500",   bg: "bg-orange-500/10" },
  pending_withdrawals:  { icon: Wallet,         color: "text-blue-600 dark:text-blue-500",       bg: "bg-blue-500/10" },
  attendance_anomaly:   { icon: AlertTriangle,  color: "text-rose-600 dark:text-rose-500",       bg: "bg-rose-500/10" },
};

const defaultConfig = { icon: Bell, color: "text-muted-foreground", bg: "bg-muted/40" };

// ── Time-ago helper ────────────────────────────────────────────────────────

function timeAgo(
  dateStr: string,
  tn: Messages["notifications"],
  interpolate: (s: string, v: Record<string, string | number>) => string
): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (m < 1)  return tn.justNow;
  if (m < 60) return interpolate(tn.minutesAgo, { count: m });
  if (h < 24) return interpolate(tn.hoursAgo,   { count: h });
  if (d === 1) return tn.yesterday;
  return interpolate(tn.daysAgo, { count: d });
}

// ── Filter chips ───────────────────────────────────────────────────────────

type FilterLabelKey = "filterAll" | "filterRewards" | "filterAttendance" | "filterWallet" | "filterAlerts";

const filterCategories: { key: NotificationCategory | "all"; labelKey: FilterLabelKey }[] = [
  { key: "all",           labelKey: "filterAll" },
  { key: "reward",        labelKey: "filterRewards" },
  { key: "transactional", labelKey: "filterAttendance" },
  { key: "reminder",      labelKey: "filterWallet" },
  { key: "alert",         labelKey: "filterAlerts" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  size?: "sm" | "md";
}

// ── Component ──────────────────────────────────────────────────────────────

export function NotificationBell({ size = "md" }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    filterByCategory,
    activeFilter,
    refresh,
  } = useNotifications({ realtime: true, limit: 20 });

  const { role } = useUserRole();
  const { t, interpolate } = useTranslation();

  const href = role ? `/${role}/notifications` : "/student/notifications";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Refresh when panel opens
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize    = size === "sm" ? "h-4 w-4"  : "h-4.5 w-4.5";

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className={`${sizeClasses} rounded-full bg-muted/40 border border-border/40 flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-all relative active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className={iconSize} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-background" />
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[380px] max-h-[560px] flex flex-col bg-card border border-border shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-2xl z-50 animate-in slide-in-from-top-2 fade-in duration-200 overflow-hidden"
          role="dialog"
          aria-label="Notifications panel"
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-black text-sm text-foreground">
                {t.notifications.title}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-[10px] hover:bg-primary/20 active:scale-95 transition-all border border-primary/20"
                  title={t.notifications.markAllRead}
                >
                  <CheckCheck className="h-3 w-3" />
                  <span>{t.notifications.markAllRead}</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                aria-label={t.notifications.title}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Filter chips ────────────────────────────────────────── */}
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-none shrink-0 border-b border-border/30">
            {filterCategories.map((f) => (
              <button
                key={f.key}
                onClick={() => filterByCategory(f.key)}
                className={`px-3 py-1 rounded-xl text-[10px] font-extrabold whitespace-nowrap transition-all border shrink-0 ${
                  activeFilter === f.key
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.notifications[f.labelKey]}
              </button>
            ))}
          </div>

          {/* ── Notification list ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {t.notifications.noNotifications}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {t.notifications.noNotificationsDesc}
                </p>
              </div>
            ) : (
              notifications.map((notif: AppNotification) => {
                const config = typeConfig[notif.type] || defaultConfig;
                const IconComp = config.icon;
                const timeStr = timeAgo(notif.created_at, t.notifications, interpolate);
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.is_read) markAsRead(notif.id);
                    }}
                  >
                    {notif.action_url ? (
                      <Link
                        href={notif.action_url}
                        onClick={() => setOpen(false)}
                        className="block"
                      >
                        <NotifRow
                          notif={notif}
                          config={config}
                          IconComp={IconComp}
                          timeStr={timeStr}
                        />
                      </Link>
                    ) : (
                      <NotifRow
                        notif={notif}
                        config={config}
                        IconComp={IconComp}
                        timeStr={timeStr}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border/40 px-4 py-2.5">
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[11px] font-bold text-primary hover:bg-primary/5 transition-colors"
            >
              {t.notifications.viewAll}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compact notification row for the popup ─────────────────────────────────

function NotifRow({
  notif,
  config,
  IconComp,
  timeStr,
}: {
  notif: AppNotification;
  config: { color: string; bg: string };
  IconComp: React.ComponentType<{ className?: string }>;
  timeStr: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${
        notif.is_read
          ? "opacity-60 hover:opacity-80 hover:bg-muted/30"
          : "hover:bg-muted/50"
      }`}
    >
      {/* Icon */}
      <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <IconComp className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className={`text-xs leading-snug line-clamp-1 ${notif.is_read ? "font-medium text-foreground/70" : "font-bold text-foreground"}`}>
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1 animate-pulse" />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">
          {notif.message}
        </p>
        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mt-1">
          {timeStr}
        </p>
      </div>
    </div>
  );
}
