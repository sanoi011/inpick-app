"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Loader2,
  Search,
  Save,
  Check,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

interface Item {
  id: string;
  name: string;
  spec: string;
  price: number;
  unit: string;
  catalogId: string;
  roomType: string;
  category: string;
  part: string;
}

const ROOM_FILTERS = [
  { v: "", label: "전체" },
  { v: "LIVING", label: "거실" },
  { v: "MASTER", label: "안방" },
  { v: "BEDROOM", label: "침실" },
  { v: "KITCHEN", label: "주방" },
  { v: "BATHROOM", label: "욕실" },
  { v: "ENTRANCE", label: "현관" },
  { v: "BALCONY", label: "발코니" },
  { v: "DRESS", label: "드레스룸" },
];

export default function AdminMaterialsPage() {
  const { authChecked } = useAdminAuth();
  const [crawling, setCrawling] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roomType, setRoomType] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Item>>({});
  const [saving, setSaving] = useState(false);

  const adminToken =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";

  const loadItems = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roomType) params.set("roomType", roomType);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/materials?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load fail");
      setItems(data.items || []);
    } catch (err) {
      toast({
        type: "error",
        title: "자재 목록 불러오기 실패",
        message: err instanceof Error ? err.message : "다시 시도해주세요",
      });
    } finally {
      setLoading(false);
    }
  }, [adminToken, roomType, search]);

  useEffect(() => {
    if (authChecked) void loadItems();
  }, [authChecked, loadItems]);

  async function runCrawler(type: string) {
    setCrawling(type);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ type }),
      });
      toast({ type: "success", title: "크롤러 실행 시작", message: type });
    } catch {
      toast({ type: "error", title: "오류", message: "크롤러 실행 실패" });
    } finally {
      setCrawling(null);
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setDraft({ ...item });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/materials`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id,
          name: draft.name,
          spec: draft.spec,
          price: typeof draft.price === "number" ? draft.price : Number(draft.price),
          unit: draft.unit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save fail");
      toast({ type: "success", title: "저장 완료" });
      setEditingId(null);
      setDraft({});
      await loadItems();
    } catch (err) {
      toast({
        type: "error",
        title: "저장 실패",
        message: err instanceof Error ? err.message : "다시 시도해주세요",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">자재 / 단가 관리</h2>

      {/* 단가 카드 (크롤러) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <Package className="w-8 h-8 text-blue-600 mb-3" />
          <p className="font-semibold text-gray-900">자재 단가</p>
          <p className="text-sm text-gray-500 mt-1">한국물가협회 | 매월 갱신</p>
          <button
            onClick={() => runCrawler("material")}
            disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {crawling === "material" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <DollarSign className="w-8 h-8 text-green-600 mb-3" />
          <p className="font-semibold text-gray-900">노임 단가</p>
          <p className="text-sm text-gray-500 mt-1">대한건설협회 | 반기별 갱신</p>
          <button
            onClick={() => runCrawler("labor")}
            disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {crawling === "labor" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
          <p className="font-semibold text-gray-900">간접비율</p>
          <p className="text-sm text-gray-500 mt-1">조달청 | 연간 갱신</p>
          <button
            onClick={() => runCrawler("overhead")}
            disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {crawling === "overhead" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
      </div>

      {/* 전체 크롤링 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">전체 단가 갱신</h3>
          <button
            onClick={() => runCrawler("all")}
            disabled={!!crawling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {crawling === "all" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            전체 크롤링 실행
          </button>
        </div>
        <p className="text-sm text-gray-500">
          자재 단가(한국물가협회) + 노임 단가(대한건설협회) + 간접비율(조달청)을 한 번에
          갱신합니다.
        </p>
      </div>

      {/* ── 자재 카탈로그 게시판 (편집 가능) ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">자재 카탈로그 DB</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              인라인 편집 — 단가·이름·규격·단위 즉시 수정 가능 ({items.length}건)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadItems();
                }}
                placeholder="자재명·규격 검색"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              {ROOM_FILTERS.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              새로고침
            </button>
          </div>
        </div>

        {loading && items.length === 0 && (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">자재 목록 로드 중…</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">조회된 자재가 없습니다</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[0.7rem] font-bold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2.5 w-32">방·카테고리</th>
                  <th className="px-3 py-2.5">자재명</th>
                  <th className="px-3 py-2.5">규격</th>
                  <th className="px-3 py-2.5 text-right w-32">단가 (원)</th>
                  <th className="px-3 py-2.5 w-20">단위</th>
                  <th className="px-3 py-2.5 w-24">조작</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const editing = editingId === it.id;
                  return (
                    <tr
                      key={it.id}
                      className={`border-t border-gray-100 transition-colors ${
                        editing ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2 align-middle">
                        <div className="text-[0.7rem] font-bold text-blue-600 uppercase">
                          {it.roomType}
                        </div>
                        <div className="text-[0.7rem] text-gray-500">
                          {it.category} · {it.part}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {editing ? (
                          <input
                            type="text"
                            value={draft.name ?? ""}
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-200 text-sm"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">
                            {it.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-600">
                        {editing ? (
                          <input
                            type="text"
                            value={draft.spec ?? ""}
                            onChange={(e) =>
                              setDraft({ ...draft, spec: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-200 text-sm"
                          />
                        ) : (
                          it.spec || <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle text-right tabular">
                        {editing ? (
                          <input
                            type="number"
                            value={draft.price ?? 0}
                            onChange={(e) =>
                              setDraft({ ...draft, price: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-200 text-sm text-right tabular"
                          />
                        ) : (
                          <span className="font-bold text-gray-900">
                            ₩ {it.price.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle text-gray-600">
                        {editing ? (
                          <input
                            type="text"
                            value={draft.unit ?? ""}
                            onChange={(e) =>
                              setDraft({ ...draft, unit: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-200 text-sm"
                          />
                        ) : (
                          it.unit
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {editing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveEdit(it.id)}
                              disabled={saving}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              title="저장"
                            >
                              {saving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                              title="취소"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(it)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Save className="w-3 h-3" />
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API 빠른 확인 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2">API 빠른 확인</h3>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/api/materials"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
          >
            <Package className="w-4 h-4" /> 전체
          </Link>
          <Link
            href="/api/materials?roomType=LIVING"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
          >
            거실
          </Link>
          <Link
            href="/api/materials?roomType=BATHROOM"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
          >
            욕실
          </Link>
        </div>
      </div>
    </div>
  );
}
