"use client";

import Link from "next/link";
import { MessageCircle, Eye, FileText, Pin } from "lucide-react";
import type { CommunityPostV2 } from "@/types/community-v2";

interface Props {
  post: CommunityPostV2;
  boardName?: string;
}

export default function PostListItem({ post, boardName }: Props) {
  return (
    <Link
      href={`/community/posts/${post.id}`}
      className="block rounded-xl border border-[#E5E2DD] bg-white px-4 py-3.5 transition hover:border-[#D5D2CD]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] text-[#6B6B6B]">
            {post.isPinned && <Pin className="h-3 w-3 text-[#202123]" />}
            {boardName && <span className="rounded bg-[#F0EFEC] px-1.5 py-0.5">{boardName}</span>}
            {post.postType === "estimate_share" && (
              <span className="rounded bg-[#FFF4E5] px-1.5 py-0.5 text-[#8B5A00]">견적 공유</span>
            )}
            {post.postType === "design_share" && (
              <span className="rounded bg-[#E8F0FF] px-1.5 py-0.5 text-[#1F4FA1]">디자인 공유</span>
            )}
            {post.convertedRfqAt && (
              <span className="rounded bg-[#E5F4E8] px-1.5 py-0.5 text-[#1F6B2A]">RFQ 진행</span>
            )}
          </div>

          <h3 className="line-clamp-1 text-[0.95rem] font-semibold text-[#202123]">
            {post.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[0.8rem] leading-relaxed text-[#6B6B6B]">
            {post.content.slice(0, 200)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-[#9A9A9A]">
            {post.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[#6B6B6B]">
                #{tag}
              </span>
            ))}
            <span className="text-[#D5D2CD]">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {post.viewCount}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {post.commentCount}
            </span>
            {post.quoteOfferCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#8B5A00]">
                <FileText className="h-3 w-3" />
                견적 {post.quoteOfferCount}
              </span>
            )}
            <span className="text-[#D5D2CD]">·</span>
            <span>{formatRelative(post.createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
