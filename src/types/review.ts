/**
 * 서비스별 리뷰(후기) 타입 — 아정당(ajd.co.kr) 스타일 후기 카드.
 */

export type ReviewServiceType = "full_interior" | "partial" | "material_preview";

export interface ServiceReview {
  id: string;
  serviceType: ReviewServiceType;
  rating: number;
  title: string | null;
  content: string;
  authorName: string | null; // 표시용 (마스킹된 값)
  region: string | null;
  photos: string[];
  createdAt: string;
}

export interface ReviewServiceMeta {
  key: ReviewServiceType;
  label: string;
  href: string;
  tagColor: string; // tailwind 클래스
}

export const REVIEW_SERVICES: ReviewServiceMeta[] = [
  { key: "full_interior", label: "전체 인테리어", href: "/workflow", tagColor: "bg-primary-500/10 text-primary-600" },
  { key: "partial", label: "부분 인테리어", href: "/partial-install", tagColor: "bg-emerald-500/10 text-emerald-600" },
  { key: "material_preview", label: "자재 미리보기", href: "/material-preview", tagColor: "bg-violet-500/10 text-violet-600" },
];

export function reviewServiceLabel(t: ReviewServiceType): string {
  return REVIEW_SERVICES.find((s) => s.key === t)?.label ?? t;
}

/** 닉네임/이름 마스킹: 김민수 → 김민*, par123 → par***  (아정당 스타일) */
export function maskName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "익명";
  if (n.length <= 1) return n + "**";
  if (n.length === 2) return n[0] + "*";
  return n.slice(0, Math.min(3, n.length - 1)) + "*".repeat(Math.max(2, n.length - 3));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapDbReview(r: any): ServiceReview {
  return {
    id: r.id,
    serviceType: r.service_type,
    rating: r.rating ?? 5,
    title: r.title ?? null,
    content: r.content ?? "",
    authorName: maskName(r.author_name),
    region: r.region ?? null,
    photos: Array.isArray(r.photos) ? r.photos : [],
    createdAt: r.created_at,
  };
}
