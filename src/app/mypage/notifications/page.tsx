"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "@/components/ui/Toast";
import { SkeletonLine } from "@/components/ui/Skeleton";
import {
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

export default function MyPageNotifications() {
  const { user } = useAuth();
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

  useEffect(() => { if (user) loadNotifications(); }, [user, loadNotifications]);

  useRealtimeSubscription({
    table: "consumer_notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    event: "INSERT",
    enabled: !!user,
    onInsert: (payload) => {
      const n = payload as Record<string, unknown>;
      const newNoti: ConsumerNotification = {
        id: (n.id as string) || "", userId: (n.user_id as string) || "",
        type: (n.type as ConsumerNotification["type"]) || "SYSTEM",
        title: (n.title as string) || "", message: (n.message as string) || "",
        priority: (n.priority as ConsumerNotification["priority"]) || "MEDIUM",
        isRead: false, link: (n.link as string) || undefined,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNoti, ...prev]);
      toast({ type: "info", title: newNoti.title, message: newNoti.message });
    },
  });

  const handleMarkAllRead = async () => {
    if (!user) return;
    await fetch("/api/consumer/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, userId: user.id }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (id: string) => {
    await fetch("/api/consumer/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === "전체") return true;
    if (activeFilter === "미읽음") return !n.isRead;
    const types = CONSUMER_NOTIFICATION_TYPE_FILTER[activeFilter];
    return types ? types.includes(n.type) : true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const timeAgo = (dateStr: string) => {
    const createdAt = new Date(dateStr).getTime();
    if (!Number.isFinite(createdAt)) return "최근";
    const diff = Date.now() - createdAt;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div><p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">NOTIFICATIONS</p><h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[36px]">알림</h1></div>
          {unreadCount > 0 && (
            <span className="mb-2 min-w-[22px] rounded-full bg-[#0d0d0d] px-1.5 py-0.5 text-center text-xs font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="mb-2 flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium text-black/60 hover:text-black">
            <Check className="w-3.5 h-3.5" /> 모두 읽음
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab} onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === tab ? "bg-[#0d0d0d] text-white" : "bg-white border border-black/[0.07] text-black/55 hover:bg-black/[0.04]"
            }`}
          >
            {tab}{tab === "미읽음" && unreadCount > 0 && <span className="ml-1">({unreadCount})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="divide-y divide-black/[0.05] overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonNotification key={i} />)}
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-8 text-center">
          <p className="mb-3 text-sm text-black/45">알림을 불러오지 못했습니다</p>
          <button onClick={loadNotifications} className="mx-auto flex items-center gap-1 text-sm font-medium"><RefreshCw className="w-3.5 h-3.5" /> 재시도</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-black/18" strokeWidth={1.5} />
          <p className="text-sm text-black/45">{activeFilter === "전체" ? "알림이 없습니다" : `${activeFilter} 알림이 없습니다`}</p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.05] overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          {filtered.map((n) => (
            <Link key={n.id} href={n.link || "#"} onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={`flex items-start gap-3 border-l-2 px-5 py-4 transition-colors hover:bg-black/[0.025] ${!n.isRead ? "border-l-[#0d0d0d] bg-[#f7f7f5]" : "border-l-transparent"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="rounded bg-[#efefec] px-1.5 py-0.5 text-xs font-medium text-black/48">{CONSUMER_NOTIFICATION_TYPE_LABELS[n.type]}</span>
                  {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-[#0d0d0d]" />}
                </div>
                <p className={`text-sm ${!n.isRead ? "font-semibold" : "text-black/65"}`}>{n.title}</p>
                {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-black/45">{n.message}</p>}
                <p className="mt-1 text-xs text-black/32">{timeAgo(n.createdAt)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 mt-2 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
