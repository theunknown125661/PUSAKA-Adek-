"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import type { AppNotification, NotificationCategory } from "@/lib/types/database";
import {
  Bell, CheckCircle2, XCircle, Flame, Trophy, Coins, Star,
  Wallet, ClipboardCheck, AlertTriangle, ShoppingBag, Zap,
  CheckCheck
} from "lucide-react";

// ── Icon + color mapping per notification type ────────────────────

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

// ── Time ago helper ──────────────────────────────────────────────

function timeAgo(dateStr: string, t: { justNow: string; minutesAgo: string; hoursAgo: string; yesterday: string; daysAgo: string }, interpolate: (s: string, v: Record<string, string | number>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t.justNow;
  if (diffMin < 60) return interpolate(t.minutesAgo, { count: diffMin });
  if (diffHrs < 24) return interpolate(t.hoursAgo, { count: diffHrs });
  if (diffDays === 1) return t.yesterday;
  return interpolate(t.daysAgo, { count: diffDays });
}

// ── Filter chips ─────────────────────────────────────────────────

type FilterLabelKey = "filterAll" | "filterRewards" | "filterAttendance" | "filterWallet" | "filterAlerts";

const filterCategories: { key: NotificationCategory | "all"; labelKey: FilterLabelKey }[] = [
  { key: "all", labelKey: "filterAll" },
  { key: "reward", labelKey: "filterRewards" },
  { key: "transactional", labelKey: "filterAttendance" },
  { key: "reminder", labelKey: "filterWallet" },
  { key: "alert", labelKey: "filterAlerts" },
];

// ── Main Component ───────────────────────────────────────────────

export function NotificationInbox() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    filterByCategory,
    activeFilter,
    refresh,
  } = useNotifications({ realtime: true, limit: 50 });

  const { t, interpolate } = useTranslation();

  // Refresh on mount
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-md lg:max-w-3xl mx-auto px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            {t.notifications.title}
          </h1>
          {unreadCount > 0 && (
            <p className="text-xs font-bold text-muted-foreground">
              {interpolate(t.notifications.unreadCount, { count: unreadCount })}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 active:scale-[0.98] transition-all border border-primary/20"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t.notifications.markAllRead}
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterCategories.map((f) => (
          <button
            key={f.key}
            onClick={() => filterByCategory(f.key)}
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all border shrink-0 ${
              activeFilter === f.key
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.notifications[f.labelKey]}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t.notifications.noNotifications}
          description={t.notifications.noNotificationsDesc}
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif: AppNotification) => {
            const config = typeConfig[notif.type] || defaultConfig;
            const IconComponent = config.icon;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) markAsRead(notif.id);
                }}
                className="block"
              >
                {notif.action_url ? (
                  <Link href={notif.action_url} className="block">
                    <NotificationCard
                      notif={notif}
                      config={config}
                      IconComponent={IconComponent}
                      timeAgoStr={timeAgo(notif.created_at, t.notifications, interpolate)}
                    />
                  </Link>
                ) : (
                  <NotificationCard
                    notif={notif}
                    config={config}
                    IconComponent={IconComponent}
                    timeAgoStr={timeAgo(notif.created_at, t.notifications, interpolate)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Individual Notification Card ─────────────────────────────────

function NotificationCard({
  notif,
  config,
  IconComponent,
  timeAgoStr,
}: {
  notif: AppNotification;
  config: { color: string; bg: string };
  IconComponent: React.ComponentType<{ className?: string }>;
  timeAgoStr: string;
}) {
  return (
    <div
      className={`card rounded-[24px] p-4 border shadow-sm flex items-start gap-4 transition-all cursor-pointer group ${
        notif.is_read
          ? "bg-card/60 border-border/20 opacity-70"
          : "bg-card border-border/40 hover:border-primary/20 hover:shadow-md"
      }`}
    >
      {/* Icon */}
      <div className={`h-10 w-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
        <IconComponent className={`h-5 w-5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm leading-tight truncate ${notif.is_read ? "font-semibold text-foreground/70" : "font-black text-foreground"}`}>
            {notif.title}
          </h3>
          {!notif.is_read && (
            <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-1 animate-pulse" />
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {timeAgoStr}
        </p>
      </div>
    </div>
  );
}
