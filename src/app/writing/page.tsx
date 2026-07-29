"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTH_SESSION_RESTORE_TIMEOUT_MS, withAuthTimeout } from "@/lib/auth/resilience";
import { HankwonIapBridge } from "@/components/writing/HankwonIapBridge";

const DEFAULT_WRITING_APP_URL =
  process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:3020"
    : "https://inpick-hankwon.vercel.app";

type BridgeState = "connecting" | "ready" | "error";

export default function WritingPage() {
  const supabase = useMemo(() => createClient(), []);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [bridgeState, setBridgeState] = useState<BridgeState>("connecting");
  const writingAppUrl = process.env.NEXT_PUBLIC_WRITING_APP_URL || DEFAULT_WRITING_APP_URL;
  const writingOrigin = useMemo(() => new URL(writingAppUrl).origin, [writingAppUrl]);
  const targetWindow = useCallback(() => frameRef.current?.contentWindow || null, []);

  const sendSession = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await withAuthTimeout(
        supabase.auth.getSession(),
        AUTH_SESSION_RESTORE_TIMEOUT_MS,
        "writing-session-bridge",
      );
      if (!session?.access_token || !session.refresh_token) {
        window.location.replace("/auth?type=consumer&returnUrl=%2Fwriting&source=protected_route");
        return;
      }
      frameRef.current?.contentWindow?.postMessage(
        {
          type: "inpick-auth:session",
          version: 1,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            token_type: session.token_type,
          },
        },
        writingOrigin,
      );
    } catch {
      setBridgeState("error");
    }
  }, [supabase, writingOrigin]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== writingOrigin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "hankwon:ready") {
        void sendSession();
        return;
      }
      if (event.data?.type === "hankwon:authenticated") {
        setBridgeState("ready");
        return;
      }
      if (event.data?.type === "hankwon:navigate") {
        const href = typeof event.data.href === "string" ? event.data.href : "/";
        if (href === "/" || href === "/mypage" || href.startsWith("/mypage/")) {
          window.location.assign(href);
        }
      }
    };
    window.addEventListener("message", onMessage);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void sendSession();
    });
    return () => {
      window.removeEventListener("message", onMessage);
      subscription.unsubscribe();
    };
  }, [sendSession, supabase, writingOrigin]);

  return (
    <main className="relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#fbfaf6]">
      {bridgeState !== "ready" && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#fbfaf6]" aria-live="polite">
          <div className="text-center">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-[#2d6cff]" />
            <p className="mt-4 text-sm font-medium text-black/55">
              {bridgeState === "error" ? "한권 연결을 다시 확인하고 있습니다." : "내 서재를 연결하고 있습니다."}
            </p>
            {bridgeState === "error" && (
              <button type="button" onClick={() => { setBridgeState("connecting"); void sendSession(); }} className="mt-4 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white">
                다시 연결
              </button>
            )}
          </div>
        </div>
      )}
      <iframe
        ref={frameRef}
        src={writingAppUrl}
        title="한권 AI 글쓰기"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
        onLoad={() => void sendSession()}
      />
      <HankwonIapBridge targetWindow={targetWindow} targetOrigin={writingOrigin} />
    </main>
  );
}
