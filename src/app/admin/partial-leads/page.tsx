"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RotateCcw, Wrench, MapPin, CheckCircle2, ExternalLink, Star } from "lucide-react";

type Suggestion = {
  id: string;
  companyName: string;
  region: string | null;
  type: string | null;
  rating: number | null;
  reviews: number | null;
  isVerified: boolean;
  trades: string[];
};

type Lead = {
  id: string;
  surface: string | null;
  materialQuery: string | null;
  productTitle: string | null;
  productPrice: number | null;
  productLink: string | null;
  region: string | null;
  contact: string | null;
  note: string | null;
  estimateTotal: number | null;
  status: string;
  createdAt: string;
  suggestions: Suggestion[];
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: "신규", cls: "bg-blue-100 text-blue-700" },
  contacted: { label: "연락함", cls: "bg-amber-100 text-amber-700" },
  matched: { label: "매칭됨", cls: "bg-emerald-100 text-emerald-700" },
  closed: { label: "종료", cls: "bg-zinc-200 text-zinc-600" },
};
const STATUS_FLOW = ["new", "contacted", "matched", "closed"];

function adminAuth(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : ""}`,
  };
}

export default function AdminPartialLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [authErr, setAuthErr] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAuthErr(false);
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/partial-leads${qs}`, { headers: adminAuth() });
      if (res.status === 401) {
        setAuthErr(true);
        return;
      }
      const data = await res.json();
      setLeads(data.leads ?? []);
      setCounts(data.counts ?? {});
    } catch {
      setMsg("불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/partial-leads", {
        method: "PATCH",
        headers: adminAuth(),
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const d = await res.json();
        setMsg(d?.error ?? "상태 변경 실패");
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch {
      setMsg("네트워크 오류");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">부분시공 설치 리드</h1>
          <p className="mt-1 text-sm text-zinc-500">
            사용자의 부분 자재 설치 요청입니다. 지역 기반으로 자동 매칭된 사업자에게 연결하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-600 hover:border-primary-400"
        >
          <RotateCcw className="h-4 w-4" /> 새로고침
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {["all", ...STATUS_FLOW].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`inline-flex items-center gap-1 border px-3 py-1.5 text-sm font-bold ${
              filter === s ? "border-primary-500 bg-primary-500 text-white" : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {s === "all" ? "전체" : STATUS_META[s]?.label ?? s}
            {s !== "all" && counts[s] != null && (
              <span className={`ml-0.5 text-[11px] ${filter === s ? "text-white/70" : "text-zinc-400"}`}>{counts[s]}</span>
            )}
          </button>
        ))}
      </div>

      {authErr ? (
        <div className="mt-8 border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          관리자 인증이 필요합니다.{" "}
          <Link href="/admin/login" className="font-bold text-primary-600 underline">
            관리자 로그인
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-8 border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-400">
          설치 리드가 없습니다.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {leads.map((l) => {
            const meta = STATUS_META[l.status] ?? { label: l.status, cls: "bg-zinc-100 text-zinc-600" };
            return (
              <div key={l.id} className="border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-black ${meta.cls}`}>{meta.label}</span>
                      <span className="inline-flex items-center gap-1 text-sm font-black text-zinc-900">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                        {l.region || "지역 미기재"}
                      </span>
                      <span className="text-xs text-zinc-400">{new Date(l.createdAt).toLocaleString("ko-KR")}</span>
                    </div>
                    <p className="mt-1.5 font-bold text-zinc-800">
                      {l.materialQuery || l.productTitle || "자재 미상"}
                      {l.estimateTotal ? (
                        <span className="ml-2 text-primary-600">예상 {l.estimateTotal.toLocaleString()}원</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[13px] text-zinc-500">
                      연락처: {l.contact || "(로그인 사용자)"} {l.note ? ` · 요청: ${l.note}` : ""}
                    </p>
                    {l.productLink && (
                      <a
                        href={l.productLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-primary-600"
                      >
                        선택 상품 보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_FLOW.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(l.id, s)}
                        disabled={l.status === s}
                        className={`border px-2 py-1 text-[11px] font-bold ${
                          l.status === s
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-zinc-200 text-zinc-500 hover:border-primary-300"
                        }`}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 자동매칭 사업자 후보 */}
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="flex items-center gap-1 text-[12px] font-bold text-zinc-500">
                    <Wrench className="h-3.5 w-3.5" /> 지역 매칭 사업자 {l.suggestions.length}곳
                  </p>
                  {l.suggestions.length === 0 ? (
                    <p className="mt-1 text-[12px] text-zinc-400">해당 지역의 등록 사업자가 없습니다. (수동 연락 필요)</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {l.suggestions.map((s) => (
                        <div key={s.id} className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px]">
                          <span className="font-black text-zinc-800">{s.companyName}</span>
                          {s.isVerified && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />검증
                            </span>
                          )}
                          <span className="ml-1 text-zinc-400">{s.region}</span>
                          {typeof s.rating === "number" && s.rating > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                              <Star className="h-3 w-3" />{s.rating.toFixed(1)}
                            </span>
                          )}
                          {s.trades.length > 0 && (
                            <span className="ml-1 text-zinc-400">· {s.trades.slice(0, 3).join("/")}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="mt-4 text-sm font-bold text-rose-600">{msg}</p>}
    </div>
  );
}
