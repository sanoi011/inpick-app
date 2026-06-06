"use client";

/**
 * /reviews — 서비스별 후기 (아정당 ajd.co.kr 스타일)
 * 전체 / 전체 인테리어 / 부분 인테리어 / 자재 미리보기 탭 + 평균 별점·후기 수 + 카드 그리드
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PenSquare, Star, ArrowRight } from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewWriteModal from "@/components/reviews/ReviewWriteModal";
import { REVIEW_SERVICES, type ReviewServiceType, type ServiceReview } from "@/types/review";

type Tab = "all" | ReviewServiceType;

interface Aggregate {
  total: number;
  avg: number;
  byService: Record<string, { count: number; avg: number }>;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  ...REVIEW_SERVICES.map((s) => ({ key: s.key as Tab, label: s.label })),
];

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-reviews?service=${t}&limit=40`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setAgg(data.aggregate ?? null);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const headerAvg = tab === "all" ? agg?.avg ?? 0 : agg?.byService?.[tab]?.avg ?? 0;
  const headerCount = tab === "all" ? agg?.total ?? 0 : agg?.byService?.[tab]?.count ?? 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:py-10">
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[12px] tracking-[0.16em] text-primary-500">REVIEWS · 실사용 후기</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
            INPICK 서비스 후기
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-bold text-zinc-800">{headerAvg.toFixed(1)}</span>
            <span>· 후기 {headerCount.toLocaleString()}개</span>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          <PenSquare className="h-4 w-4" />
          후기 작성
        </button>
      </div>

      {/* 서비스 탭 */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {t.label}
            {agg && t.key !== "all" && (
              <span className="ml-1.5 text-[11px] opacity-70">{agg.byService?.[t.key]?.count ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-20 text-center text-zinc-400">
          아직 후기가 없습니다. 첫 후기를 남겨주세요.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {/* 서비스 바로가기 */}
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {REVIEW_SERVICES.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-4 transition hover:shadow-md"
          >
            <span className="text-sm font-bold text-zinc-800">{s.label} 시작하기</span>
            <ArrowRight className="h-4 w-4 text-primary-500" />
          </Link>
        ))}
      </div>

      <ReviewWriteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultService={tab === "all" ? "full_interior" : tab}
        onCreated={() => load(tab)}
      />
    </div>
  );
}
