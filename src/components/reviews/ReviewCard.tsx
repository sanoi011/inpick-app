"use client";

import { Star, User } from "lucide-react";
import { REVIEW_SERVICES, type ServiceReview } from "@/types/review";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"}`}
        />
      ))}
    </span>
  );
}

export default function ReviewCard({ review }: { review: ServiceReview }) {
  const svc = REVIEW_SERVICES.find((s) => s.key === review.serviceType);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${svc?.tagColor ?? "bg-zinc-100 text-zinc-600"}`}>
          {svc?.label ?? review.serviceType}
        </span>
        <Stars rating={review.rating} />
      </div>

      {review.title && (
        <p className="mb-1.5 text-[15px] font-bold text-zinc-900">{review.title}</p>
      )}
      <p className="flex-1 whitespace-pre-line text-[14px] leading-relaxed text-zinc-700">
        “{review.content}”
      </p>

      <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <User className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-800">{review.authorName}님</p>
          {review.region && <p className="text-[11px] text-zinc-400">{review.region}</p>}
        </div>
      </div>
    </div>
  );
}
