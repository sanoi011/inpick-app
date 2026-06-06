"use client";

import { useState } from "react";
import { X, Star, Loader2 } from "lucide-react";
import { REVIEW_SERVICES, type ReviewServiceType, type ServiceReview } from "@/types/review";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultService?: ReviewServiceType;
  onCreated?: (review: ServiceReview) => void;
}

export default function ReviewWriteModal({ open, onClose, defaultService, onCreated }: Props) {
  const [serviceType, setServiceType] = useState<ReviewServiceType>(defaultService ?? "full_interior");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    if (content.trim().length < 5) {
      setError("후기 내용을 5자 이상 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/service-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType, rating, content: content.trim(), region: region.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("로그인 후 후기를 남길 수 있습니다.");
        } else {
          setError(data.error ?? "후기 등록에 실패했습니다.");
        }
        setLoading(false);
        return;
      }
      onCreated?.(data.review);
      setContent("");
      setRegion("");
      setRating(5);
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">후기 작성</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 서비스 선택 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-zinc-500">어떤 서비스 후기인가요?</label>
          <div className="grid grid-cols-3 gap-2">
            {REVIEW_SERVICES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setServiceType(s.key)}
                className={`rounded-xl border px-2 py-2.5 text-[12px] font-semibold transition ${
                  serviceType === s.key
                    ? "border-primary-500 bg-primary-500/5 text-primary-600"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 별점 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-zinc-500">별점</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n}점`}
              >
                <Star
                  className={`h-7 w-7 transition ${
                    n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 내용 */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold text-zinc-500">후기 내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="이용 경험을 솔직하게 남겨주세요."
            className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {/* 지역(선택) */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-zinc-500">지역 (선택)</label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="예: 대전 유성구"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {error && <p className="mb-3 text-[13px] font-medium text-red-500">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          후기 등록
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          작성자 이름은 자동으로 일부만 표시(마스킹)됩니다.
        </p>
      </div>
    </div>
  );
}
