"use client";

/**
 * /admin/community — 게시판 / 게시글 / 신고 통합 관리 페이지
 */
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Loader2, Plus, Pin, EyeOff, Trash2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import type { CommunityBoardV2, CommunityPostV2 } from "@/types/community-v2";

type Tab = "boards" | "posts" | "reports";

export default function AdminCommunityPage() {
  const { authChecked } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("boards");

  const auth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
  });

  if (!authChecked) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl space-y-4">
      <h1 className="text-2xl font-bold text-white">커뮤니티 관리</h1>

      <div className="flex gap-1 border-b border-gray-700">
        {(["boards", "posts", "reports"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "border-b-2 border-red-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "boards" ? "게시판" : t === "posts" ? "게시글" : "신고"}
          </button>
        ))}
      </div>

      {tab === "boards" && <BoardsPanel auth={auth} />}
      {tab === "posts" && <PostsPanel auth={auth} />}
      {tab === "reports" && <ReportsPanel auth={auth} />}
    </div>
  );
}

function BoardsPanel({ auth }: { auth: () => HeadersInit }) {
  const [boards, setBoards] = useState<CommunityBoardV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    fetch("/api/admin/community/boards", { headers: auth() })
      .then((r) => r.json())
      .then((d) => {
        setBoards(d.boards ?? []);
        setLoading(false);
      });
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!newSlug.trim() || !newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/community/boards", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ slug: newSlug.trim(), name: newName.trim() }),
    });
    setCreating(false);
    if (res.ok) {
      setNewSlug("");
      setNewName("");
      reload();
      toast({ type: "success", title: "추가 완료", message: "게시판이 생성되었습니다" });
    } else {
      toast({ type: "error", title: "오류", message: "생성 실패" });
    }
  };

  const toggle = async (board: CommunityBoardV2, field: keyof CommunityBoardV2, value: boolean) => {
    await fetch(`/api/admin/community/boards/${board.id}`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ [field]: value }),
    });
    reload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
        <p className="mb-2 text-xs text-gray-400">새 게시판 추가</p>
        <div className="flex gap-2">
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug (예: tips)"
            className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="이름"
            className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={create}
            disabled={creating || !newSlug.trim() || !newName.trim()}
            className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400">
              <th className="px-2 py-2 text-left">순서</th>
              <th className="px-2 py-2 text-left">slug</th>
              <th className="px-2 py-2 text-left">이름</th>
              <th className="px-2 py-2 text-left">type</th>
              <th className="px-2 py-2 text-center">활성</th>
              <th className="px-2 py-2 text-center">글쓰기</th>
              <th className="px-2 py-2 text-center">댓글</th>
              <th className="px-2 py-2 text-center">사업자 응답</th>
              <th className="px-2 py-2 text-center">승인 필요</th>
            </tr>
          </thead>
          <tbody>
            {boards.map((b) => (
              <tr key={b.id} className="border-b border-gray-800">
                <td className="px-2 py-1.5 text-gray-300">{b.sortOrder}</td>
                <td className="px-2 py-1.5 font-mono text-xs text-gray-300">{b.slug}</td>
                <td className="px-2 py-1.5 font-semibold text-white">{b.name}</td>
                <td className="px-2 py-1.5 text-xs text-gray-300">{b.boardType}</td>
                <CellCheckbox value={b.isActive} onChange={(v) => toggle(b, "isActive", v)} />
                <CellCheckbox value={b.allowUserPosts} onChange={(v) => toggle(b, "allowUserPosts", v)} />
                <CellCheckbox value={b.allowComments} onChange={(v) => toggle(b, "allowComments", v)} />
                <CellCheckbox value={b.allowContractorReplies} onChange={(v) => toggle(b, "allowContractorReplies", v)} />
                <CellCheckbox value={b.requireAdminApproval} onChange={(v) => toggle(b, "requireAdminApproval", v)} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CellCheckbox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <td className="px-2 py-1.5 text-center">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </td>
  );
}

function PostsPanel({ auth }: { auth: () => HeadersInit }) {
  const [posts, setPosts] = useState<CommunityPostV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("published");

  const reload = () => {
    setLoading(true);
    fetch(`/api/admin/community/posts?status=${status}&limit=50`, { headers: auth() })
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.posts ?? []);
        setLoading(false);
      });
  };

  useEffect(reload, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderate = async (postId: string, action: "hide" | "delete" | "restore" | "pin" | "unpin") => {
    await fetch("/api/admin/community/posts", {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ postId, action }),
    });
    reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {["published", "pending_review", "hidden", "deleted"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              status === s ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : posts.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-10">게시글이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {posts.map((p) => (
            <div key={p.id} className="rounded border border-gray-700 bg-gray-900 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.authorRole} · {p.postType} · 조회 {p.viewCount} · 댓글 {p.commentCount} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => moderate(p.id, p.isPinned ? "unpin" : "pin")}
                    className="rounded p-1.5 text-xs hover:bg-gray-800"
                    title="고정"
                  >
                    <Pin className={`h-3.5 w-3.5 ${p.isPinned ? "text-amber-400" : "text-gray-400"}`} />
                  </button>
                  {p.isDeleted || status === "hidden" ? (
                    <button
                      onClick={() => moderate(p.id, "restore")}
                      className="rounded p-1.5 text-xs hover:bg-gray-800"
                      title="복구"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => moderate(p.id, "hide")}
                        className="rounded p-1.5 text-xs hover:bg-gray-800"
                        title="숨김"
                      >
                        <EyeOff className="h-3.5 w-3.5 text-amber-400" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("삭제하시겠습니까?")) moderate(p.id, "delete");
                        }}
                        className="rounded p-1.5 text-xs hover:bg-gray-800"
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
}

function ReportsPanel({ auth }: { auth: () => HeadersInit }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch("/api/admin/community/reports?status=open", { headers: auth() })
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports ?? []);
        setLoading(false);
      });
  };

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async (reportId: string, action: "resolve" | "dismiss") => {
    await fetch("/api/admin/community/reports", {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ reportId, action }),
    });
    reload();
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded border border-gray-700 bg-gray-900 p-10 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <p className="text-sm text-gray-400">처리 대기 신고가 없습니다.</p>
        </div>
      ) : (
        reports.map((r) => (
          <div key={r.id} className="rounded border border-gray-700 bg-gray-900 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {r.target_type} · {r.reason}
                </p>
                {r.detail && <p className="text-xs text-gray-400 mt-0.5">{r.detail}</p>}
                <p className="text-[0.65rem] text-gray-500 mt-1">
                  {new Date(r.created_at).toLocaleString("ko-KR")} · target {r.target_id.slice(0, 8)}…
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handle(r.id, "resolve")}
                  className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  처리
                </button>
                <button
                  onClick={() => handle(r.id, "dismiss")}
                  className="rounded bg-gray-700 px-2.5 py-1 text-xs text-gray-300"
                >
                  무시
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
