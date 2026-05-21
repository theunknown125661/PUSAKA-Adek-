"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification, NotificationCategory } from "@/lib/types/database";

interface UseNotificationsOptions {
  /** Auto-subscribe to realtime updates. Default: true */
  realtime?: boolean;
  /** Maximum number of notifications to fetch. Default: 50 */
  limit?: number;
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Fetch/refresh notifications list */
  refresh: () => Promise<void>;
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Filter notifications by category */
  filterByCategory: (category: NotificationCategory | "all") => void;
  /** Current active filter */
  activeFilter: NotificationCategory | "all";
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { realtime = true, limit = 50 } = options;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | "all">("all");
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[useNotifications] Error fetching notifications:", error);
    }

    const typed = (data || []) as AppNotification[];
    setAllNotifications(typed);

    // Fetch the true exact unread count from the database
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);

    if (countError) {
      console.error("[useNotifications] Error fetching true unread count:", countError);
    }

    setUnreadCount(count || 0);
    return typed;
  }, [limit]);

  // Refresh everything
  const refresh = useCallback(async () => {
    setLoading(true);
    const fetched = await fetchNotifications();
    // Apply current filter
    if (activeFilter === "all") {
      setNotifications(fetched);
    } else {
      setNotifications(fetched.filter((n) => n.category === activeFilter));
    }
    setLoading(false);
  }, [fetchNotifications, activeFilter]);

  // Mark single as read
  const markAsRead = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("[useNotifications] Error marking notification as read:", error);
      }

      // Optimistic local update
      setAllNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Broadcast to all other hook instances on this page (e.g. the bell and the inbox)
      window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { type: "read", id } }));
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("is_read", false);

    if (error) {
      console.error("[useNotifications] Error marking all notifications as read:", error);
    }

    // Optimistic local update
    setAllNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    // Broadcast to all other hook instances on this page
    window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { type: "read-all" } }));
  }, []);

  // Filter by category
  const filterByCategory = useCallback(
    (category: NotificationCategory | "all") => {
      setActiveFilter(category);
      if (category === "all") {
        setNotifications(allNotifications);
      } else {
        setNotifications(allNotifications.filter((n) => n.category === category));
      }
    },
    [allNotifications]
  );

  // Initial fetch + get user ID for realtime
  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();
      if (error) {
        console.error("[useNotifications] Error fetching authenticated user:", error);
      }
      if (user) {
        setUserId(user.id);
      }
      await refresh();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep activeFilter in a ref to avoid re-subscribing on filter change
  const activeFilterRef = useRef(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // Cross-instance sync via window event:
  // When one hook instance marks notifications read (optimistic), all other
  // instances on the same page (e.g. bell in header vs. inbox page) apply the
  // same change so the dot disappears/appears without a page refresh.
  useEffect(() => {
    function handleExternalUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { type: string; id?: string } | undefined;
      if (!detail) return;

      if (detail.type === "read" && detail.id) {
        const readAt = new Date().toISOString();
        setAllNotifications((prev) =>
          prev.map((n) => (n.id === detail.id ? { ...n, is_read: true, read_at: readAt } : n))
        );
        setNotifications((prev) =>
          prev.map((n) => (n.id === detail.id ? { ...n, is_read: true, read_at: readAt } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else if (detail.type === "read-all") {
        const readAt = new Date().toISOString();
        setAllNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: readAt }))
        );
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: readAt }))
        );
        setUnreadCount(0);
      }
    }

    window.addEventListener("notifications-updated", handleExternalUpdate);
    return () => {
      window.removeEventListener("notifications-updated", handleExternalUpdate);
    };
  }, []);

  // Realtime subscription — listen to both INSERT (new notifications arriving)
  // and UPDATE (is_read toggled by server-side actions or other sessions).
  useEffect(() => {
    if (!realtime || !userId) return;

    const supabase = createClient();
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channelName = `notifications-realtime-${userId}-${uniqueId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as AppNotification;
          setAllNotifications((prev) => [newNotification, ...prev]);
          setNotifications((prev) => {
            const currentFilter = activeFilterRef.current;
            if (currentFilter === "all" || newNotification.category === currentFilter) {
              return [newNotification, ...prev];
            }
            return prev;
          });
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        // UPDATE covers: server-side mark-as-read, another browser tab, or any
        // Supabase function that flips is_read without going through this client.
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setAllNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
          // Re-fetch exact count from DB rather than guessing the delta
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .then(({ count }) => {
              setUnreadCount(count || 0);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, userId]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
    filterByCategory,
    activeFilter,
  };
}
