"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import PostListItem from "@/components/community/PostListItem";
import type { CommunityPostV2, CommunityBoardV2 } from "@/types/community-v2";

export default function BoardPage({ params }: { params: { slug: string } }) {
  const [posts, setPosts] = useState<CommunityPostV2[]>([]);
  const [board, setBoard] = useState<CommunityBoardV2 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/community/boards").then((r) => r.json()),
      fetch(`/api/community/posts?boardSlug=${params.slug}&page=1&limit=30`).then((r) => r.json()),
    ])
      .then(([boardsRes, postsRes]) => {
        const found = (boardsRes.boards ?? []).find((b: CommunityBoardV2) => b.slug === params.slug);
        setBoard(found ?? null);
        setPosts(postsRes.posts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  return (
    <CommunityShell>
      <div className="space-y-4">
        {board && (
          <div className="rounded-xl border border-[#E5E2DD] bg-white px-5 py-4">
            <h1 className="text-lg font-bold text-[#202123]">{board.name}</h1>
            {board.description && (
              <p className="mt-1 text-sm text-[#6B6B6B]">{board.description}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#9A9A9A]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E2DD] bg-white px-4 py-12 text-center text-sm text-[#6B6B6B]">
            아직 이 게시판에 글이 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <PostListItem key={p.id} post={p} boardName={board?.name} />
            ))}
          </div>
        )}
      </div>
    </CommunityShell>
  );
}
