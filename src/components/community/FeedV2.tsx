"use client";

/**
 * 커뮤니티 v2 피드 — 인스타/X 스타일 단일 컬럼.
 *
 * 목적 정의(2026-07-04):
 *   ① 자랑 — 내 집·AI 디자인 공유 (프로젝트 카드 첨부가 핵심 차별점)
 *   ② 피드백 받기 — 좋아요·댓글로 결정 지원
 *   ③ 서비스 피드백 — 전용 탭, 팀이 직접 읽고 답변
 *
 * 데이터: GET/POST /api/community/posts (+upload, my-projects, like)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bug,
  Camera,
  Heart,
  Hexagon,
  Lightbulb,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { AttachableProject } from "@/app/api/community/my-projects/route";

/* ── 타입 ── */
interface FeedAttachment {
  type: string;
  url: string;
  thumbnailUrl: string | null;
}
interface FeedAuthor {
  displayName: string;
  avatarUrl: string | null;
}
interface FeedEstimateSummary {
  totalAmount?: number | null;
  totalAmountRangeLabel?: string | null;
}
interface FeedPost {
  id: string;
  title: string;
  content: string;
  tags: string[];
  postType: string;
  isPinned: boolean;
  isNotice: boolean;
  regionLabel: string | null;
  areaLabel: string | null;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  createdAt: string;
  attachments: FeedAttachment[];
  author: FeedAuthor;
  likedByMe: boolean;
  estimateSummary: FeedEstimateSummary | null;
}

type FeedTab = "home" | "feedback";

const FEEDBACK_CATEGORIES = [
  { key: "제안", icon: Lightbulb, ph: "이런 기능이 있으면 좋겠어요…" },
  { key: "버그", icon: Bug, ph: "어디서 어떤 문제가 있었는지 알려주세요…" },
  { key: "질문", icon: MessageCircle, ph: "궁금한 점을 물어보세요…" },
] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function formatWon(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

/* ── 이미지 그리드 (1장 풀폭 / 2장 2열 / 3장+ 2열+더보기) ── */
function ImageGrid({ images }: { images: FeedAttachment[] }) {
  const [expanded, setExpanded] = useState(false);
  if (images.length === 0) return null;
  const shown = expanded ? images : images.slice(0, 4);
  const rest = images.length - 4;
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-2xl ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {shown.map((img, i) => (
        <div key={`${img.url}-${i}`} className={`relative bg-zinc-100 ${images.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.thumbnailUrl || img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          {!expanded && i === 3 && rest > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-black text-white"
            >
              +{rest}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── 프로젝트 자랑 카드 (AI 디자인 + 견적 요약) ── */
function ProjectCardView({
  images,
  summary,
  regionLabel,
  areaLabel,
}: {
  images: FeedAttachment[];
  summary: FeedEstimateSummary | null;
  regionLabel: string | null;
  areaLabel: string | null;
}) {
  const total = summary?.totalAmount;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50/40 to-white">
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <Sparkles className="h-3.5 w-3.5 text-primary-500" />
        <span className="text-[0.7rem] font-black tracking-wide text-primary-600">INPICK AI 인테리어 프로젝트</span>
      </div>
      {images.length > 0 && (
        <div className="mt-2 flex gap-1 overflow-x-auto px-4 pb-1">
          {images.slice(0, 6).map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${img.url}-${i}`}
              src={img.thumbnailUrl || img.url}
              alt=""
              loading="lazy"
              className="h-32 w-32 shrink-0 rounded-xl object-cover bg-zinc-100"
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {typeof total === "number" && total > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-2.5 py-1 text-[0.7rem] font-black text-white">
            AI 견적 {formatWon(total)}
          </span>
        )}
        {regionLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-bold text-zinc-600 border border-zinc-200">
            <MapPin className="h-3 w-3" /> {regionLabel}
          </span>
        )}
        {areaLabel && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-bold text-zinc-600 border border-zinc-200">
            {areaLabel}
          </span>
        )}
        <Link
          href="/workflow"
          className="ml-auto inline-flex items-center gap-1 text-[0.7rem] font-black text-primary-600 hover:text-primary-700"
        >
          나도 만들어보기 <Sparkles className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ── 포스트 카드 ── */
function PostCard({ post, onLike }: { post: FeedPost; onLike: (p: FeedPost) => void }) {
  const [clamped, setClamped] = useState(true);
  const photos = post.attachments.filter((a) => a.type === "image");
  const designs = post.attachments.filter((a) => a.type === "design_output");
  const hasProjectCard = designs.length > 0 || post.estimateSummary != null;
  const body = post.content === post.title ? post.content : post.content;
  const long = body.length > 220;

  const share = async () => {
    const url = `${window.location.origin}/community/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: post.title });
      else {
        await navigator.clipboard.writeText(url);
        alert("링크가 복사되었습니다");
      }
    } catch {
      /* 사용자 취소 */
    }
  };

  return (
    <article className="border-b border-zinc-100 bg-white px-4 py-5 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-700">
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            post.author.displayName.slice(0, 1)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-zinc-900">{post.author.displayName}</span>
            {post.isNotice && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-black text-amber-700">공지</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[0.7rem] text-zinc-400">
            <span>{timeAgo(post.createdAt)}</span>
            {post.regionLabel && !hasProjectCard && (
              <>
                <span>·</span>
                <span>{post.regionLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <Link href={`/community/posts/${post.id}`} className="block">
        <p className={`mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 ${clamped && long ? "line-clamp-5" : ""}`}>
          {body}
        </p>
      </Link>
      {long && clamped && (
        <button type="button" onClick={() => setClamped(false)} className="mt-1 text-sm font-bold text-zinc-400 hover:text-zinc-600">
          더 보기
        </button>
      )}

      {/* 미디어 */}
      <ImageGrid images={photos} />
      {hasProjectCard && (
        <ProjectCardView images={designs} summary={post.estimateSummary} regionLabel={post.regionLabel} areaLabel={post.areaLabel} />
      )}

      {/* 태그 */}
      {post.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-[0.75rem] font-bold text-primary-500">#{t}</span>
          ))}
        </div>
      )}

      {/* 액션바 */}
      <div className="mt-3 flex items-center gap-5 border-t border-zinc-50 pt-2.5">
        <button
          type="button"
          onClick={() => onLike(post)}
          className={`inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold transition ${
            post.likedByMe ? "text-rose-500" : "text-zinc-400 hover:text-rose-400"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${post.likedByMe ? "fill-rose-500" : ""}`} />
          {post.likeCount > 0 ? post.likeCount : "좋아요"}
        </button>
        <Link
          href={`/community/posts/${post.id}`}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-primary-500"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          {post.commentCount > 0 ? post.commentCount : "댓글"}
        </Link>
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-primary-500"
        >
          <Link2 className="h-[18px] w-[18px]" />
          공유
        </button>
        <span className="ml-auto text-[0.7rem] text-zinc-300">조회 {post.viewCount}</span>
      </div>
    </article>
  );
}

/* ── 내 프로젝트 피커 모달 ── */
function ProjectPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (p: AttachableProject) => void;
}) {
  const [projects, setProjects] = useState<AttachableProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProjects(null);
    setError(null);
    fetch("/api/community/my-projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error === "UNAUTHENTICATED" ? "로그인이 필요합니다" : "프로젝트를 불러오지 못했어요");
        else setProjects(d.projects ?? []);
      })
      .catch(() => setError("네트워크 오류"));
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-zinc-900">내 프로젝트 자랑하기</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">AI 디자인을 만든 프로젝트를 선택하면 게시글에 카드로 첨부돼요.</p>

        {error ? (
          <p className="py-10 text-center text-sm text-zinc-400">{error}</p>
        ) : projects == null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-zinc-500">아직 자랑할 프로젝트가 없어요</p>
            <Link href="/workflow" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-sm font-black text-white">
              <Sparkles className="h-4 w-4" /> AI 인테리어 시작하기
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {projects.map((p) => (
              <li key={p.projectId}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    onClose();
                  }}
                  className="w-full rounded-2xl border border-zinc-200 p-3 text-left transition hover:border-primary-400 hover:bg-primary-50/30"
                >
                  <div className="flex gap-1 overflow-hidden rounded-xl">
                    {(p.images.length > 0 ? p.images : p.floorPlanImageUrl ? [{ url: p.floorPlanImageUrl, label: "도면" }] : [])
                      .slice(0, 3)
                      .map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={img.url} alt="" className="h-20 flex-1 bg-zinc-100 object-cover" />
                      ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-zinc-800">{p.title}</span>
                    {p.estimateTotal != null && (
                      <span className="shrink-0 text-xs font-black text-primary-600">{formatWon(p.estimateTotal)}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── 메인 피드 ── */
export default function FeedV2() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>("home");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 컴포저
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<AttachableProject | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fbCat, setFbCat] = useState<(typeof FEEDBACK_CATEGORIES)[number]["key"]>("제안");
  const fileRef = useRef<HTMLInputElement>(null);
  const feedSeq = useRef(0);

  const loadFeed = useCallback(
    async (targetTab: FeedTab, targetPage: number, append: boolean) => {
      const seq = ++feedSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params =
          targetTab === "home"
            ? `scope=home&page=${targetPage}&limit=10`
            : `boardSlug=service-feedback&page=${targetPage}&limit=10`;
        const res = await fetch(`/api/community/posts?${params}`, { cache: "no-store" });
        const d = await res.json();
        if (seq !== feedSeq.current) return;
        const list = (d.posts ?? []) as FeedPost[];
        setPosts((prev) => (append ? [...prev, ...list.filter((p) => !prev.some((x) => x.id === p.id))] : list));
        setHasMore(!!d.hasMore);
        setPage(targetPage);
      } catch {
        if (!append && seq === feedSeq.current) setPosts([]);
      } finally {
        if (seq === feedSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadFeed(tab, 1, false);
  }, [tab, loadFeed]);

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 4 - images.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/community/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (res.ok && d.url) setImages((prev) => (prev.length < 4 ? [...prev, d.url] : prev));
        else if (d.error === "UNAUTHENTICATED") {
          setNotice("사진 첨부는 로그인 후 가능해요");
          break;
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!content.trim() || posting) return;
    if (!user) {
      window.location.href = "/auth?redirect=/community";
      return;
    }
    setPosting(true);
    setNotice(null);
    try {
      const isFeedback = tab === "feedback";
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardSlug: isFeedback ? "service-feedback" : "design-share",
          content: content.trim(),
          imageUrls: images,
          attachProjectId: attached?.projectId,
          tags: isFeedback ? [fbCat] : [],
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNotice(d.hint || d.error || "게시에 실패했어요");
        return;
      }
      setContent("");
      setImages([]);
      setAttached(null);
      if (d.status === "pending_review") setNotice("게시글이 접수됐어요 — 검토 후 공개됩니다");
      await loadFeed(tab, 1, false);
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: FeedPost) => {
    if (!user) {
      window.location.href = "/auth?redirect=/community";
      return;
    }
    // 옵티미스틱
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)) }
          : p,
      ),
    );
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByMe: d.liked, likeCount: d.likeCount } : p)));
    } catch {
      // 롤백
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }
            : p,
        ),
      );
      setNotice("좋아요 기능 준비 중이에요 — 곧 열릴게요!");
    }
  };

  const activeFb = FEEDBACK_CATEGORIES.find((c) => c.key === fbCat)!;

  return (
    <div className="mx-auto w-full max-w-xl px-0 pb-24 sm:px-4">
      {/* 탭 — 헤더(72px) 아래 sticky */}
      <div
        className="sticky z-30 -mx-0 border-b border-zinc-200 bg-[#F7F7F5]/95 backdrop-blur sm:mx-0"
        style={{ top: "calc(72px + env(safe-area-inset-top))" }}
      >
        <div className="flex">
          {(
            [
              { key: "home", label: "홈", icon: Sparkles },
              { key: "feedback", label: "서비스 피드백", icon: MessagesSquare },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-black transition ${
                tab === key ? "border-b-2 border-primary-500 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 컴포저 */}
      <div className="mt-3 bg-white px-4 py-4 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm">
        {tab === "feedback" && (
          <div className="mb-2.5 flex gap-1.5">
            {FEEDBACK_CATEGORIES.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFbCat(key)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black transition ${
                  fbCat === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                <Icon className="h-3 w-3" /> {key}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={
            tab === "home"
              ? user
                ? "우리 집 자랑해보세요! AI 디자인, 시공 전후, 인테리어 고민…"
                : "로그인하고 우리 집을 자랑해보세요"
              : activeFb.ph
          }
          className="w-full resize-none rounded-xl bg-zinc-50 p-3 text-[15px] leading-relaxed text-zinc-900 outline-none ring-primary-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
        />

        {/* 첨부 미리보기 */}
        {images.length > 0 && (
          <div className="mt-2 flex gap-2">
            {images.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-xl bg-zinc-100 object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attached && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/50 px-3 py-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary-500" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-primary-800">
              {attached.title}
              {attached.estimateTotal != null && ` · ${formatWon(attached.estimateTotal)}`}
            </span>
            <button type="button" onClick={() => setAttached(null)} className="shrink-0 text-primary-400 hover:text-primary-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && <p className="mt-2 text-xs font-bold text-amber-600">{notice}</p>}

        <div className="mt-2.5 flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => (user ? fileRef.current?.click() : (window.location.href = "/auth?redirect=/community"))}
            disabled={uploading || images.length >= 4}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            사진
          </button>
          {tab === "home" && (
            <button
              type="button"
              onClick={() => (user ? setPickerOpen(true) : (window.location.href = "/auth?redirect=/community"))}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-primary-600 transition hover:bg-primary-50"
            >
              <Hexagon className="h-4 w-4" />
              내 프로젝트
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={posting || !content.trim()}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-500 px-5 text-sm font-black text-white shadow-cta transition hover:bg-primary-600 disabled:opacity-40 disabled:shadow-none"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            게시
          </button>
        </div>
      </div>

      {/* 피드 */}
      {tab === "feedback" && (
        <p className="mt-3 px-4 text-center text-[0.75rem] text-zinc-400 sm:px-0">
          남겨주신 제안·버그는 인픽 팀이 직접 읽고 답변드려요 🙏
        </p>
      )}
      <div className="mt-3 space-y-0 sm:space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white px-4 py-20 text-center sm:rounded-2xl sm:border sm:border-zinc-200">
            <p className="text-sm font-bold text-zinc-500">
              {tab === "home" ? "첫 번째 자랑의 주인공이 되어보세요!" : "첫 피드백을 남겨주세요 — 팀이 기다리고 있어요"}
            </p>
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onLike={toggleLike} />)
        )}
      </div>

      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadFeed(tab, page + 1, true)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-black text-zinc-600 hover:border-primary-400 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            더 보기
          </button>
        </div>
      )}

      <ProjectPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setAttached} />
    </div>
  );
}
