"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Clock3, Loader2, RotateCcw, Search, ShieldCheck, TestTube2, UserRound } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

type Plan = "free" | "pro" | "max";
type PlanStatus = {
  plan: Plan;
  active: boolean;
  productId: string | null;
  expiresAt: string | null;
  source: "free" | "app_store" | "admin";
};
type HankwonUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  hankwon: PlanStatus | null;
};
type GrantHistory = {
  id: string;
  plan: "pro" | "max";
  starts_at: string;
  expires_at: string | null;
  reason: string;
  test_account: boolean;
  granted_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
};
type StoreHistory = {
  id: string;
  plan: "pro" | "max";
  product_id: string;
  status: string;
  environment: string;
  purchased_at: string;
  expires_at: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  HANKWON_ADMIN_NOT_CONFIGURED: "한권 관리용 서버 연결값이 아직 설정되지 않았습니다.",
  UNAUTHORIZED: "관리자 인증이 만료되었습니다. 다시 로그인해주세요.",
  INPICK_USER_NOT_FOUND: "인픽에서 해당 사용자를 찾을 수 없습니다.",
  PLAN_GRANT_ACTION_FAILED: "한권 플랜 변경을 처리하지 못했습니다.",
};

function authHeaders(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
  };
}

function dateLabel(value: string | null) {
  if (!value) return "만료 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function planBadge(status: PlanStatus | null) {
  if (!status || !status.active || status.plan === "free") return { label: "FREE", style: "bg-black/[0.05] text-black/50" };
  if (status.plan === "max") return { label: "MAX", style: "bg-violet-50 text-violet-700" };
  return { label: "PRO", style: "bg-blue-50 text-blue-700" };
}

export default function HankwonAdminPage() {
  const { authChecked } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<HankwonUser[]>([]);
  const [selected, setSelected] = useState<HankwonUser | null>(null);
  const [history, setHistory] = useState<{ grants: GrantHistory[]; subscriptions: StoreHistory[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<"pro" | "max">("pro");
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("테스트 계정 운영");
  const [testAccount, setTestAccount] = useState(true);

  const request = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const response = await fetch(input, init);
    const result = await response.json().catch(() => ({ error: "INVALID_RESPONSE" }));
    if (!response.ok) throw new Error(result.error || "REQUEST_FAILED");
    return result;
  }, []);

  const loadUsers = useCallback(async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const result = await request(`/api/admin/hankwon-plans?search=${encodeURIComponent(search)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      setUsers(result.users || []);
      setSelected((current) => current ? (result.users || []).find((item: HankwonUser) => item.id === current.id) || current : null);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(ERROR_MESSAGES[code] || `계정 목록을 불러오지 못했습니다. (${code})`);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadHistory = useCallback(async (user: HankwonUser) => {
    setSelected(user);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const result = await request("/api/admin/hankwon-plans", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ action: "history", userId: user.id }),
      });
      setHistory({ grants: result.grants || [], subscriptions: result.subscriptions || [] });
      if (result.status) {
        setSelected((current) => current ? { ...current, hankwon: result.status } : current);
      }
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      toast({ type: "error", title: "이력 조회 실패", message: ERROR_MESSAGES[code] || code });
    } finally {
      setHistoryLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (authChecked) void loadUsers();
  }, [authChecked, loadUsers]);

  const expiresAt = useMemo(() => {
    if (duration === "none") return null;
    const days = Number(duration);
    if (!Number.isFinite(days) || days <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }, [duration]);

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await loadUsers(query);
  }

  async function grantPlan() {
    if (!selected || !reason.trim()) return;
    setSaving(true);
    try {
      await request("/api/admin/hankwon-plans", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ action: "grant", userId: selected.id, plan, expiresAt, reason: reason.trim(), testAccount }),
      });
      toast({ type: "success", title: `${plan.toUpperCase()} 권한 부여 완료`, message: `${selected.email || selected.id} 계정에 즉시 반영했습니다.` });
      await Promise.all([loadUsers(query), loadHistory(selected)]);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      toast({ type: "error", title: "권한 부여 실패", message: ERROR_MESSAGES[code] || code });
    } finally {
      setSaving(false);
    }
  }

  async function revokePlan() {
    if (!selected || !reason.trim()) return;
    if (!window.confirm("관리자가 부여한 한권 권한을 회수할까요? App Store에서 결제한 권한은 유지됩니다.")) return;
    setSaving(true);
    try {
      await request("/api/admin/hankwon-plans", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ action: "revoke", userId: selected.id, reason: reason.trim() }),
      });
      toast({ type: "success", title: "수동 권한 회수 완료", message: "결제 권한은 변경하지 않았습니다." });
      await Promise.all([loadUsers(query), loadHistory(selected)]);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      toast({ type: "error", title: "권한 회수 실패", message: ERROR_MESSAGES[code] || code });
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-black/30" /></div>;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[28px] border border-black/[0.07] bg-white">
        <div className="flex flex-col gap-5 border-b border-black/[0.06] px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Unus Liber operations</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em]">한권 플랜 관리</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-black/48">인픽 통합 계정에 테스트·고객지원용 Pro/Max 권한을 직접 부여합니다. 모든 변경은 한권 DB에 감사 이력으로 남습니다.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> 결제 권한과 수동 권한 분리
          </div>
        </div>

        <form onSubmit={submitSearch} className="flex flex-col gap-3 p-5 sm:flex-row sm:p-7">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/28" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이메일, 이름 또는 사용자 UUID 검색" className="h-12 w-full rounded-2xl border border-black/10 bg-[#fafaf8] pl-11 pr-4 text-[13px] outline-none transition focus:border-blue-400 focus:bg-white" />
          </label>
          <button type="submit" disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-black px-6 text-[13px] font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 계정 찾기
          </button>
        </form>
      </section>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
        <section className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
            <div><h2 className="text-[15px] font-bold">인픽 사용자</h2><p className="mt-1 text-[11px] text-black/38">최근 가입 계정 또는 검색 결과 최대 30개</p></div>
            <button type="button" onClick={() => void loadUsers(query)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/45" aria-label="새로고침"><RotateCcw className="h-4 w-4" /></button>
          </div>
          <div className="divide-y divide-black/[0.05]">
            {!loading && users.length === 0 && <div className="px-5 py-16 text-center text-[13px] text-black/35"><UserRound className="mx-auto mb-3 h-8 w-8" />검색된 계정이 없습니다.</div>}
            {users.map((user) => {
              const badge = planBadge(user.hankwon);
              const active = selected?.id === user.id;
              return (
                <button key={user.id} type="button" onClick={() => void loadHistory(user)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-left transition ${active ? "bg-blue-50/60" : "hover:bg-black/[0.02]"}`}>
                  <span className="min-w-0">
                    <strong className="block truncate text-[13px]">{user.name || "이름 미등록"}</strong>
                    <span className="mt-1 block truncate text-[12px] text-black/46">{user.email || user.id}</span>
                    <code className="mt-1 block truncate text-[9px] text-black/25">{user.id}</code>
                  </span>
                  <span className="text-right">
                    <b className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${badge.style}`}>{badge.label}</b>
                    <small className="mt-2 block text-[10px] text-black/35">{user.hankwon?.source === "admin" ? "운영자 부여" : user.hankwon?.source === "app_store" ? "App Store" : "기본"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-6">
          {!selected ? (
            <div className="grid min-h-[420px] place-items-center text-center"><div><BookOpen className="mx-auto h-9 w-9 text-black/18" /><h2 className="mt-4 text-[15px] font-bold">관리할 계정을 선택하세요</h2><p className="mt-2 text-[12px] text-black/40">현재 플랜과 변경 이력을 확인할 수 있습니다.</p></div></div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/30">Selected account</p><h2 className="mt-2 truncate text-lg font-bold">{selected.name || "이름 미등록"}</h2><p className="mt-1 truncate text-[12px] text-black/45">{selected.email}</p></div>
                <div className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-right"><span className="text-[9px] font-semibold text-black/35">현재 플랜</span><strong className="mt-1 block text-xl">{(selected.hankwon?.plan || "free").toUpperCase()}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${plan === "pro" ? "border-blue-400 bg-blue-50/60" : "border-black/10"}`}><input type="radio" className="sr-only" checked={plan === "pro"} onChange={() => setPlan("pro")} /><span className="text-[11px] font-bold text-blue-700">PRO</span><strong className="mt-2 block text-[14px]">월 1권 · 500쪽</strong></label>
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${plan === "max" ? "border-violet-400 bg-violet-50/60" : "border-black/10"}`}><input type="radio" className="sr-only" checked={plan === "max"} onChange={() => setPlan("max")} /><span className="text-[11px] font-bold text-violet-700">MAX</span><strong className="mt-2 block text-[14px]">전문가 · 무제한</strong></label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-black/55">사용 기간<select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-[12px]"><option value="7">7일</option><option value="30">30일</option><option value="90">90일</option><option value="365">1년</option><option value="none">만료 없음</option></select></label>
                <label className="flex items-end"><span className="flex h-11 w-full items-center gap-2 rounded-xl bg-[#f7f7f5] px-3 text-[11px] text-black/48"><Clock3 className="h-4 w-4" />{expiresAt ? dateLabel(expiresAt) : "직접 회수 전까지"}</span></label>
              </div>

              <label className="block text-[11px] font-semibold text-black/55">부여·회수 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-3 text-[12px] outline-none focus:border-blue-400" /></label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-[12px] text-amber-900"><input type="checkbox" checked={testAccount} onChange={(event) => setTestAccount(event.target.checked)} className="h-4 w-4 accent-amber-600" /><TestTube2 className="h-4 w-4" />테스트 계정으로 표시</label>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <button type="button" onClick={() => void grantPlan()} disabled={saving || !reason.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 text-[13px] font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{plan.toUpperCase()} 권한 부여</button>
                <button type="button" onClick={() => void revokePlan()} disabled={saving || !reason.trim()} className="h-12 rounded-xl border border-red-200 px-4 text-[12px] font-semibold text-red-600 disabled:opacity-40">수동 권한 회수</button>
              </div>

              <div className="border-t border-black/[0.07] pt-5">
                <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold">권한 이력</h3>{historyLoading && <Loader2 className="h-4 w-4 animate-spin text-black/30" />}</div>
                <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {history && history.grants.length === 0 && history.subscriptions.length === 0 && <p className="rounded-xl bg-[#f7f7f5] px-4 py-6 text-center text-[11px] text-black/38">아직 유료 권한 이력이 없습니다.</p>}
                  {history?.grants.map((grant) => <article key={grant.id} className="rounded-xl border border-black/[0.07] p-3"><div className="flex items-center justify-between"><b className="text-[11px]">운영자 · {grant.plan.toUpperCase()}</b><span className={`text-[9px] font-bold ${grant.revoked_at ? "text-black/35" : "text-emerald-600"}`}>{grant.revoked_at ? "회수됨" : "활성"}</span></div><p className="mt-2 text-[11px] text-black/55">{grant.reason}</p><small className="mt-2 block text-[9px] text-black/30">{dateLabel(grant.created_at)} · {grant.expires_at ? `${dateLabel(grant.expires_at)} 만료` : "만료 없음"}{grant.test_account ? " · 테스트" : ""}</small>{grant.revoke_reason && <small className="mt-1 block text-[9px] text-red-500">회수: {grant.revoke_reason}</small>}</article>)}
                  {history?.subscriptions.map((subscription) => <article key={subscription.id} className="rounded-xl border border-black/[0.07] p-3"><div className="flex items-center justify-between"><b className="text-[11px]">App Store · {subscription.plan.toUpperCase()}</b><span className="text-[9px] font-bold text-blue-600">{subscription.status}</span></div><p className="mt-2 text-[10px] text-black/45">{subscription.product_id}</p><small className="mt-2 block text-[9px] text-black/30">{subscription.environment} · {dateLabel(subscription.expires_at)}까지</small></article>)}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
