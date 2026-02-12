"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "@/components/ui/Toast";
import {
  CONSUMER_NOTIFICATION_PRIORITY_COLORS,
} from "@/types/consumer-notification";
import type { ConsumerNotification } from "@/types/consumer-notification";

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ConsumerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/consumer/notifications?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const nots = (data.notifications || []) as ConsumerNotification[];
        setNotifications(nots.slice(0, 5));
        setUnreadCount(nots.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  }, [user]);

  useRealtimeSubscription({
    table: "consumer_notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    event: "INSERT",
    enabled: !!user,
    onInsert: (payload) => {
      const n = payload as Record<string, unknown>;
      toast({
        type: n.priority === "HIGH" ? "warning" : "info",
        title: (n.title as string) || "새 알림",
        message: (n.message as string) || "",
      });
      const newNoti: ConsumerNotification = {
        id: (n.id as string) || "",
        userId: (n.user_id as string) || "",
        type: (n.type as ConsumerNotification["type"]) || "SYSTEM",
        title: (n.title as string) || "",
        message: (n.message as string) || "",
        priority: (n.priority as ConsumerNotification["priority"]) || "MEDIUM",
        isRead: false,
        link: (n.link as string) || undefined,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNoti, ...prev].slice(0, 5));
      setUnreadCount((c) => c + 1);
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await fetch("/api/consumer/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, userId: user.id }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="알림"
      >
        <Bell className="w-4.5 h-4.5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">알림</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Check className="w-3 h-3" /> 모두 읽음
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              새 알림이 없습니다
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/notifications"}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 border-l-4 ${
                    CONSUMER_NOTIFICATION_PRIORITY_COLORS[n.priority]
                  } ${!n.isRead ? "bg-blue-50/30" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-xs text-blue-600 font-medium hover:bg-gray-50 border-t border-gray-100"
          >
            전체 보기
          </Link>
        </div>
      )}
    </div>
  );
}
