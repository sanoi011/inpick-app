"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "@/components/ui/Toast";
import { SkeletonLine } from "@/components/ui/Skeleton";
import {
  CONSUMER_NOTIFICATION_PRIORITY_COLORS,
  CONSUMER_NOTIFICATION_TYPE_LABELS,
  CONSUMER_NOTIFICATION_TYPE_FILTER,
} from "@/types/consumer-notification";
import type { ConsumerNotification } from "@/types/consumer-notification";

const FILTER_TABS = ["전체", "미읽음", "입찰", "계약", "결제", "시스템"];

function SkeletonNotification() {
  return (
    <div className="px-5 py-4 flex items-start gap-3 border-l-4 border-l-gray-200">
      <div className="flex-1 space-y-2">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-64" />
        <SkeletonLine className="h-2.5 w-16" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<ConsumerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState("전체");

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/consumer/notifications?userId=${user.id}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setError(true);
      toast({ type: "error", title: "알림 로드 실패" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth?returnUrl=/notifications");
      return;
    }
    loadNotifications();
  }, [user, authLoading, router, loadNotifications]);

  useRealtimeSubscription({
    table: "consumer_notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    event: "INSERT",
    enabled: !!user,
    onInsert: (payload) => {
      const n = payload as Record<string, unknown>;
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
      setNotifications((prev) => [newNoti, ...prev]);
      toast({ type: "info", title: newNoti.title, message: newNoti.message });
    },
  });

  const handleMarkAllRead = async () => {
    if (!user) return;
    await fetch("/api/consumer/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, userId: user.id }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (id: string) => {
    await fetch("/api/consumer/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === "전체") return true;
    if (activeFilter === "미읽음") return !n.isRead;
    const types = CONSUMER_NOTIFICATION_TYPE_FILTER[activeFilter];
    return types ? types.includes(n.type) : true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <a href="/" className="text-xl font-bold text-blue-600">INPICK</a>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">알림</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800"
            >
              <Check className="w-3.5 h-3.5" /> 모두 읽음
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab}
              {tab === "미읽음" && unreadCount > 0 && (
                <span className="ml-1">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-8">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonNotification key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">알림을 불러오지 못했습니다</p>
            <button
              onClick={loadNotifications}
              className="flex items-center gap-1 mx-auto text-sm text-blue-600 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 재시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {activeFilter === "전체" ? "알림이 없습니다" : `${activeFilter} 알림이 없습니다`}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
            {filtered.map((n) => (
              <Link
                key={n.id}
                href={n.link || "#"}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={`px-5 py-4 flex items-start gap-3 hover:bg-gray-50 border-l-4 transition-colors ${
                  CONSUMER_NOTIFICATION_PRIORITY_COLORS[n.priority]
                } ${!n.isRead ? "bg-blue-50/30" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                      {CONSUMER_NOTIFICATION_TYPE_LABELS[n.type]}
                    </span>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className={`text-sm ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 mt-2 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
