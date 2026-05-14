"use client";

/**
 * /community — 커뮤니티 홈 (최신 게시글 + 검색)
 * 가이드: inpick-community-naver-cafe-style-dev-plan-20260514.md
 *
 * 기존 mock-based 페이지는 v2 DB 기반으로 전면 교체.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import PostListItem from "@/components/community/PostListItem";
import { Loader2 } from "lucide-react";
import type { CommunityPostV2 } from "@/types/community-v2";

export default function CommunityHomePage() {
  return (
    <Suspense
      fallback={
        <CommunityShell>
          <div className="flex items-center justify-center py-20 text-[#9A9A9A]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </CommunityShell>
      }
    >
      <CommunityHomeContent />
    </Suspense>
  );
}

function CommunityHomeContent() {
  const sp = useSearchParams();
  const q = sp?.get("q") ?? "";
  const [posts, setPosts] = useState<CommunityPostV2[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", limit: "20" });
    if (q) params.set("q", q);
    fetch(`/api/community/posts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.posts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [q]);

  return (
    <CommunityShell>
      <div className="space-y-4">
        {q && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white px-4 py-2.5 text-sm text-[#3F3F46]">
            검색: <span className="font-semibold text-[#202123]">&ldquo;{q}&rdquo;</span> · {posts.length}건
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#9A9A9A]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E2DD] bg-white px-4 py-12 text-center text-sm text-[#6B6B6B]">
            아직 게시글이 없습니다. 첫 번째 글을 남겨주세요.
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <PostListItem key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </CommunityShell>
  );
}
