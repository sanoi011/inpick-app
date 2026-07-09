"use client";

/**
 * 게시물/댓글 ⋯ 메뉴 — 신고 + 사용자 차단 (Apple Guideline 1.2 UGC 안전장치)
 *
 * - 신고: 사유 선택 → POST /api/community/reports → 운영팀 24시간 내 검토·조치 안내
 * - 차단: 확인 → POST /api/community/blocks → 피드에서 즉시 제거(onBlocked) + 운영팀 자동 통지
 * - 본인 콘텐츠에는 렌더하지 않음. 오버레이는 body 포털(조상 transform으로 fixed 깨짐 방지).
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Flag, Loader2, MoreHorizontal, UserX, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const REPORT_REASONS = [
  "스팸·광고",
  "욕설·비방·혐오 표현",
  "음란물 등 부적절한 콘텐츠",
  "개인정보 노출",
  "기타",
] as const;

type View = "closed" | "menu" | "report" | "reported" | "block" | "blocked";

export default function PostModerationMenu({
  targetType,
  targetId,
  authorId,
  authorName,
  onBlocked,
  className,
}: {
  targetType: "post" | "comment";
  targetId: string;
  authorId: string | null;
  authorName?: string;
  onBlocked?: (blockedAuthorId: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("closed");
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 본인 글엔 신고/차단 메뉴 없음
  if (user && authorId && user.id === authorId) return null;

  const requireLogin = () => {
    if (user) return false;
    window.location.href = "/auth?redirect=/community";
    return true;
  };

  const submitReport = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, detail: detail.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error === "UNAUTHENTICATED" ? "로그인이 필요합니다" : "신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setView("reported");
      setDetail("");
    } finally {
      setBusy(false);
    }
  };

  const submitBlock = async () => {
    if (busy || !authorId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/community/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId: authorId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error === "UNAUTHENTICATED" ? "로그인이 필요합니다" : "차단에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setView("blocked");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (view === "blocked" && authorId) onBlocked?.(authorId);
    setView("closed");
    setError(null);
  };

  const overlay =
    view === "closed" ? null : (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center" onClick={close}>
        <div
          className="w-full max-w-sm rounded-t-3xl bg-white p-5 sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {view === "menu" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-zinc-900">게시물 관리</h3>
                <button type="button" onClick={close} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!requireLogin()) setView("report");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3.5 text-left text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                >
                  <Flag className="h-[18px] w-[18px] text-amber-500" />
                  {targetType === "comment" ? "댓글 신고하기" : "게시물 신고하기"}
                </button>
                {authorId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireLogin()) setView("block");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3.5 text-left text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                  >
                    <UserX className="h-[18px] w-[18px] text-rose-500" />
                    {authorName ? `${authorName}님 차단하기` : "이 사용자 차단하기"}
                  </button>
                )}
              </div>
            </>
          )}

          {view === "report" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-zinc-900">신고 사유를 선택해주세요</h3>
                <button type="button" onClick={close} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition ${
                      reason === r ? "border-primary-400 bg-primary-50/60 text-primary-700" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-[#F73B20]"
                    />
                    {r}
                  </label>
                ))}
              </div>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="상세 내용 (선택)"
                className="mt-2.5 w-full resize-none rounded-xl bg-zinc-50 p-3 text-sm text-zinc-900 outline-none ring-primary-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
              {error && <p className="mt-2 text-xs font-bold text-rose-500">{error}</p>}
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary-500 py-3 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                신고 접수
              </button>
            </>
          )}

          {view === "reported" && (
            <div className="py-2 text-center">
              <Flag className="mx-auto h-8 w-8 text-amber-500" />
              <h3 className="mt-2 text-base font-black text-zinc-900">신고가 접수되었습니다</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                운영팀이 <strong className="text-zinc-700">24시간 이내</strong>에 검토하여 위반 콘텐츠 삭제 및
                작성자 제재 조치를 취합니다.
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-4 w-full rounded-full bg-zinc-900 py-3 text-sm font-black text-white hover:bg-zinc-700"
              >
                확인
              </button>
            </div>
          )}

          {view === "block" && (
            <div className="py-2 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
              <h3 className="mt-2 text-base font-black text-zinc-900">
                {authorName ? `${authorName}님을 차단할까요?` : "이 사용자를 차단할까요?"}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                차단하면 이 사용자의 게시물과 댓글이 <strong className="text-zinc-700">즉시 보이지 않게</strong> 되고,
                운영팀에도 자동으로 접수되어 부적절 행위 여부를 검토합니다.
              </p>
              {error && <p className="mt-2 text-xs font-bold text-rose-500">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-full border border-zinc-300 py-3 text-sm font-black text-zinc-600 hover:bg-zinc-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void submitBlock()}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-500 py-3 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  차단하기
                </button>
              </div>
            </div>
          )}

          {view === "blocked" && (
            <div className="py-2 text-center">
              <UserX className="mx-auto h-8 w-8 text-rose-500" />
              <h3 className="mt-2 text-base font-black text-zinc-900">차단했습니다</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                이 사용자의 콘텐츠가 더 이상 표시되지 않습니다.
                <br />
                차단 해제는 고객센터로 문의해주세요.
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-4 w-full rounded-full bg-zinc-900 py-3 text-sm font-black text-white hover:bg-zinc-700"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <>
      <button
        type="button"
        aria-label="게시물 신고·차단 메뉴"
        onClick={() => setView("menu")}
        className={
          className ??
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
        }
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {typeof document !== "undefined" && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
