"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Send, Eye, MessageCircle, FileText, Trash2 } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import PostModerationMenu from "@/components/community/PostModerationMenu";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import type {
  CommunityPostV2,
  CommunityCommentV2,
  CommunityQuoteOfferV2,
} from "@/types/community-v2";

interface Snapshot {
  redacted_project?: {
    regionLabel: string | null;
    buildingType: string | null;
    areaLabel: string | null;
    areaM2: number | null;
    expansionLabel: string | null;
    rooms: string[];
    scope: string[];
  };
  redacted_design_outputs?: Array<{ id: string; imageUrl: string; targetLabel: string | null }>;
  redacted_estimate_summary?: {
    totalAmount: number | null;
    totalAmountRangeLabel: string | null;
    precisionLevel: string | null;
    lineCount: number;
    tradeCount: number;
  };
  redacted_trade_groups?: Array<{
    tradeCode: string;
    tradeName: string;
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
    total: number | null;
  }>;
  privacy_report?: { removedFields: string[]; autoScanPassed: boolean };
}

export default function PostDetailPage({ params }: { params: { postId: string } }) {
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPostV2 | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [photoAttachments, setPhotoAttachments] = useState<Array<{ url: string }>>([]);
  const [comments, setComments] = useState<CommunityCommentV2[]>([]);
  const [offers, setOffers] = useState<CommunityQuoteOfferV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/community/posts/${params.postId}`).then((r) => r.json()),
      fetch(`/api/community/posts/${params.postId}/comments`).then((r) => r.json()),
      fetch(`/api/community/posts/${params.postId}/quote-offers`).then((r) => r.json()),
    ])
      .then(([postRes, comRes, offRes]) => {
        setPost(postRes.post ?? null);
        setSnapshot(postRes.snapshot ?? null);
        setPhotoAttachments(
          ((postRes.attachments ?? []) as Array<{ attachment_type: string; url: string }>)
            .filter((a) => a.attachment_type === "image" && a.url)
            .map((a) => ({ url: a.url })),
        );
        setComments(comRes.comments ?? []);
        setOffers(offRes.offers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.postId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const submitComment = async () => {
    if (!user) {
      toast({ type: "warning", title: "로그인 필요", message: "로그인 후 댓글을 남길 수 있습니다" });
      return;
    }
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/community/posts/${params.postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText }),
    });
    setSubmitting(false);
    if (res.ok) {
      setCommentText("");
      reload();
    } else {
      toast({ type: "error", title: "오류", message: "댓글 작성 실패" });
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/community/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) reload();
  };

  if (loading) {
    return (
      <CommunityShell>
        <div className="flex items-center justify-center py-20 text-[#9A9A9A]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </CommunityShell>
    );
  }
  if (!post) {
    return (
      <CommunityShell>
        <div className="rounded-xl border border-[#E5E2DD] bg-white px-4 py-12 text-center text-sm text-[#6B6B6B]">
          게시글을 찾을 수 없습니다. <Link href="/community" className="underline">목록으로</Link>
        </div>
      </CommunityShell>
    );
  }

  return (
    <CommunityShell>
      <article className="space-y-4">
        {/* 헤더 */}
        <div className="relative rounded-xl border border-[#E5E2DD] bg-white p-5">
          {/* 신고·차단 메뉴 (Apple 1.2) — 차단 시 피드로 복귀 */}
          <div className="absolute right-3 top-3">
            <PostModerationMenu
              targetType="post"
              targetId={post.id}
              authorId={post.authorId}
              onBlocked={() => {
                window.location.href = "/community";
              }}
            />
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-10 text-[0.7rem] text-[#6B6B6B]">
            {post.postType === "estimate_share" && (
              <span className="rounded bg-[#FFF4E5] px-1.5 py-0.5 text-[#8B5A00]">견적 공유</span>
            )}
            {post.postType === "design_share" && (
              <span className="rounded bg-[#E8F0FF] px-1.5 py-0.5 text-[#1F4FA1]">디자인 공유</span>
            )}
            {post.tags.slice(0, 5).map((t) => (
              <span key={t} className="text-[#6B6B6B]">#{t}</span>
            ))}
          </div>
          <h1 className="text-xl font-bold text-[#202123]">{post.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-[0.75rem] text-[#9A9A9A]">
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {post.viewCount}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {post.commentCount}
            </span>
            {post.quoteOfferCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#8B5A00]">
                <FileText className="h-3 w-3" /> 견적 {post.quoteOfferCount}
              </span>
            )}
            <span>·</span>
            <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
          </div>
        </div>

        {/* 업로드 사진 (community_attachments type=image) */}
        {photoAttachments.length > 0 && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white p-4">
            <div className={`grid gap-2 ${photoAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"}`}>
              {photoAttachments.map((a, i) => (
                <div
                  key={`${a.url}-${i}`}
                  className={`relative overflow-hidden rounded-lg bg-[#F0EFEC] ${photoAttachments.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 디자인 이미지 (snapshot) */}
        {snapshot?.redacted_design_outputs && snapshot.redacted_design_outputs.length > 0 && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white p-4">
            <div className="grid gap-2 md:grid-cols-3">
              {snapshot.redacted_design_outputs.slice(0, 6).map((d) => (
                <div key={d.id} className="relative aspect-square overflow-hidden rounded-lg bg-[#F0EFEC]">
                  <Image
                    src={d.imageUrl}
                    alt={d.targetLabel ?? "디자인"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 견적 요약 (snapshot) */}
        {snapshot?.redacted_estimate_summary && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-[#202123]">견적 요약</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCell label="지역" value={snapshot.redacted_project?.regionLabel ?? "—"} />
              <SummaryCell label="면적" value={snapshot.redacted_project?.areaLabel ?? "—"} />
              <SummaryCell
                label="견적 범위"
                value={snapshot.redacted_estimate_summary.totalAmountRangeLabel ?? "비공개"}
              />
              <SummaryCell
                label="정밀도"
                value={(snapshot.redacted_estimate_summary.precisionLevel ?? "—").split("_")[0]}
              />
            </div>

            {snapshot.redacted_trade_groups && snapshot.redacted_trade_groups.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E2DD]">
                <table className="w-full text-xs">
                  <thead className="bg-[#F0EFEC] text-[#3F3F46]">
                    <tr>
                      <th className="px-3 py-2 text-left">공종</th>
                      <th className="px-3 py-2 text-right">건수</th>
                      <th className="px-3 py-2 text-right">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.redacted_trade_groups.map((t) => (
                      <tr key={t.tradeCode} className="border-t border-[#E5E2DD]">
                        <td className="px-3 py-2 text-[#202123]">
                          {t.tradeCode}. {t.tradeName}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#6B6B6B]">
                          {(t as { lineCount?: number }).lineCount ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#202123]">
                          {t.total != null ? `${Math.round(t.total).toLocaleString("ko-KR")}원` : "비공개"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {snapshot.privacy_report && (
              <p className="mt-3 text-[0.65rem] text-[#9A9A9A]">
                개인정보 {snapshot.privacy_report.removedFields.length}건 자동 제거됨 · 자동 검사{" "}
                {snapshot.privacy_report.autoScanPassed ? "통과" : "검토 필요"}
              </p>
            )}
          </div>
        )}

        {/* 본문 */}
        <div className="rounded-xl border border-[#E5E2DD] bg-white p-5">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[0.9rem] leading-relaxed text-[#202123]">
            {post.content}
          </div>
        </div>

        {/* 사업자 견적 제안 */}
        {offers.length > 0 && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-[#202123]">
              사업자 견적 제안 ({offers.length})
            </h2>
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o.id} className="rounded-lg border border-[#E5E2DD] bg-[#FAF9F7] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[0.7rem]">
                    <span className="rounded bg-[#E5F4E8] px-1.5 py-0.5 font-semibold text-[#1F6B2A]">
                      검증 사업자
                    </span>
                    <span className="text-[#6B6B6B]">
                      {new Date(o.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-[#202123]">{o.message}</p>
                  {(o.amountMin != null || o.amountMax != null || o.amountFixed != null) && (
                    <p className="text-[0.8rem] font-semibold text-[#202123]">
                      {o.amountFixed != null
                        ? `${Math.round(o.amountFixed).toLocaleString("ko-KR")}원`
                        : `${Math.round(o.amountMin ?? 0).toLocaleString("ko-KR")} ~ ${Math.round(o.amountMax ?? 0).toLocaleString("ko-KR")}원`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 댓글 */}
        <div className="rounded-xl border border-[#E5E2DD] bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-[#202123]">댓글 {comments.length}</h2>
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-[#9A9A9A]">첫 번째 댓글을 남겨주세요.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="border-b border-[#F0EFEC] pb-3 last:border-0">
                  <div className="mb-1 flex items-center gap-2 text-[0.7rem] text-[#6B6B6B]">
                    <span className="font-semibold text-[#3F3F46]">
                      {c.authorRole === "admin" ? "관리자" : c.authorRole === "verified_contractor" ? "검증 사업자" : "회원"}
                    </span>
                    <span>·</span>
                    <span>{new Date(c.createdAt).toLocaleDateString("ko-KR")}</span>
                    {user?.id === c.authorId ? (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="ml-auto inline-flex items-center gap-0.5 text-[#9A9A9A] hover:text-[#C0392B]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : (
                      <PostModerationMenu
                        targetType="comment"
                        targetId={c.id}
                        authorId={c.authorId}
                        onBlocked={() => reload()}
                        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[#9A9A9A] hover:bg-zinc-100 hover:text-zinc-600"
                      />
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[#202123]">{c.content}</p>
                </div>
              ))
            )}
          </div>

          {/* 작성 폼 */}
          <div className="mt-4 flex items-end gap-2 border-t border-[#F0EFEC] pt-4">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? "댓글을 남겨주세요…" : "로그인 후 댓글을 남길 수 있습니다."}
              disabled={!user || submitting}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] placeholder:text-[#9A9A9A] focus:border-[#202123] focus:outline-none disabled:bg-[#F7F7F5]"
            />
            <button
              onClick={submitComment}
              disabled={!user || submitting || !commentText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#202123] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              등록
            </button>
          </div>
        </div>
      </article>
    </CommunityShell>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F7F7F5] px-3 py-2">
      <p className="text-[0.65rem] text-[#9A9A9A]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#202123]">{value}</p>
    </div>
  );
}
