"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface SubscriptionConfig {
  table: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  enabled?: boolean;
}

/**
 * Supabase Realtime 테이블 변경 구독 훅
 * 30초 폴링 대체용
 */
export function useRealtimeSubscription(config: SubscriptionConfig) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (config.enabled === false) return;

    const supabase = createClient();
    const channelName = `${config.table}-${config.filter || "all"}-${Date.now()}`;

    const pgFilter = config.filter || undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        {
          event: config.event || "*",
          schema: "public",
          table: config.table,
          ...(pgFilter ? { filter: pgFilter } : {}),
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (payload.eventType === "INSERT" && config.onInsert) {
            config.onInsert(payload.new);
          } else if (payload.eventType === "UPDATE" && config.onUpdate) {
            config.onUpdate(payload.new);
          } else if (payload.eventType === "DELETE" && config.onDelete) {
            config.onDelete(payload.old);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [config.table, config.filter, config.event, config.enabled]);
}
