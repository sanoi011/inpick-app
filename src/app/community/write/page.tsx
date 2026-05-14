"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import type { CommunityBoardV2 } from "@/types/community-v2";

export default function WritePage() {
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
      <WriteContent />
    </Suspense>
  );
}

function WriteContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialBoard = sp?.get("board") ?? "general";
  const { user, loading } = useAuth();
  const [boards, setBoards] = useState<CommunityBoardV2[]>([]);
  const [boardSlug, setBoardSlug] = useState(initialBoard);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/community/boards")
      .then((r) => r.json())
      .then((d) => setBoards((d.boards ?? []).filter((b: CommunityBoardV2) => b.allowUserPosts)));
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      toast({ type: "warning", title: "로그인 필요", message: "글쓰기는 로그인 후 가능합니다." });
      router.replace("/auth?redirect=/community/write");
    }
  }, [loading, user, router]);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ type: "warning", title: "필수 입력", message: "제목과 내용을 입력해주세요." });
      return;
    }
    setSubmitting(true);
    const tagsArr = tags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
    const res = await fetch("/api/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardSlug, title, content, tags: tagsArr }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok && data.postId) {
      if (data.privacyRemoved > 0) {
        toast({
          type: "info",
          title: "개인정보 자동 마스킹",
          message: `${data.privacyRemoved}건의 개인정보가 자동 가려졌습니다.`,
        });
      }
      router.replace(`/community/posts/${data.postId}`);
    } else {
      toast({ type: "error", title: "오류", message: data.hint || "작성 실패" });
    }
  };

  return (
    <CommunityShell>
      <div className="space-y-3 rounded-xl border border-[#E5E2DD] bg-white p-5">
        <h1 className="text-lg font-bold text-[#202123]">새 글 쓰기</h1>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">게시판</label>
          <select
            value={boardSlug}
            onChange={(e) => setBoardSlug(e.target.value)}
            className="w-full rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] focus:border-[#202123] focus:outline-none"
          >
            {boards.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="제목을 입력하세요"
            className="w-full rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] placeholder:text-[#9A9A9A] focus:border-[#202123] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder="내용을 입력하세요. 전화번호·이메일·정확한 주소는 자동으로 가려집니다."
            className="w-full resize-none rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] placeholder:text-[#9A9A9A] focus:border-[#202123] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">태그</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="쉼표 또는 공백으로 구분 (예: 32평, 강마루, 거실)"
            className="w-full rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] placeholder:text-[#9A9A9A] focus:border-[#202123] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-3 py-2 text-sm text-[#6B6B6B] hover:bg-[#F0EFEC]"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#202123] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            게시하기
          </button>
        </div>
      </div>
    </CommunityShell>
  );
}
