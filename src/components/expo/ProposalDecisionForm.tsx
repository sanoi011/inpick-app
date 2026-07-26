"use client";

import { useState } from "react";
import {
  EXPO_DECISION_COMMENT_MAX,
  EXPO_DECISION_LABELS,
  type ExpoClientDecision,
} from "@/lib/expo/client-decision";

/**
 * 공유 제안 페이지의 고객 결정 폼 — 로그인 없이 토큰으로 기록.
 * 승인은 "제안 검토 승인"이며 시공/계약 확정이 아님을 항상 표기한다.
 */
export default function ProposalDecisionForm({
  token,
  initialDecision,
}: {
  token: string;
  initialDecision: ExpoClientDecision | null;
}) {
  const [decision, setDecision] = useState<ExpoClientDecision | null>(
    initialDecision,
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<
    "approved" | "changes_requested" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(kind: "approved" | "changes_requested") {
    if (submitting) return;
    setError(null);
    if (kind === "changes_requested" && !comment.trim()) {
      setError("변경 요청 내용을 적어 주세요.");
      return;
    }
    setSubmitting(kind);
    try {
      const response = await fetch("/api/expo/proposal-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision: kind, comment }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        decision?: ExpoClientDecision;
      };
      if (response.ok && payload.decision) {
        setDecision(payload.decision);
      } else {
        setError("기록에 실패했습니다 — 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-black">고객 결정</p>
      {decision ? (
        <div
          className={`mt-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
            decision.decision === "approved"
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {EXPO_DECISION_LABELS[decision.decision]}
          {decision.comment && (
            <p className="mt-1 text-xs font-medium text-black/60">
              &ldquo;{decision.comment}&rdquo;
            </p>
          )}
          <p className="mt-1 text-[10px] font-medium text-black/40">
            {new Date(decision.decidedAt).toLocaleString("ko-KR")} · 다시
            선택하면 갱신됩니다
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-black/50">
          이 제안을 검토하셨다면 결정을 남겨 주세요. 승인은 제안 검토 승인이며
          시공·계약 확정이 아닙니다.
        </p>
      )}
      <textarea
        value={comment}
        maxLength={EXPO_DECISION_COMMENT_MAX}
        onChange={(e) => setComment(e.target.value)}
        placeholder="의견 (변경 요청 시 필수)"
        rows={2}
        className="mt-2 w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
      {error && (
        <p role="alert" className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => submit("approved")}
          disabled={submitting !== null}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting === "approved" ? "기록 중…" : "제안 승인"}
        </button>
        <button
          type="button"
          onClick={() => submit("changes_requested")}
          disabled={submitting !== null}
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {submitting === "changes_requested" ? "기록 중…" : "변경 요청"}
        </button>
      </div>
    </div>
  );
}
