"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2, ChevronLeft, ChevronRight, UserPlus, Coins, Plus, Minus, Download, CheckCircle2, XCircle, FileText, Crown, KeyRound, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

interface ConsumerUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  provider: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  phoneVerified: boolean;
  agreedTermsAt: string | null;
  agreedPrivacyAt: string | null;
  agreedAge14At: string | null;
  agreedMarketingAt: string | null;
  balance: number;
  freeGenerationsUsed: number;
  projectCount: number;
  createdAt: string;
}

interface ContractorUser {
  id: string;
  company_name: string;
  email: string;
  phone: string;
  region: string;
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { authChecked } = useAdminAuth();
  const [tab, setTab] = useState<"consumer" | "contractor">("consumer");
  const [consumers, setConsumers] = useState<ConsumerUser[]>([]);
  const [contractors, setContractors] = useState<ContractorUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // 크레딧 관리 상태
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [grantMode, setGrantMode] = useState<"add" | "subtract">("add");
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantDescription, setGrantDescription] = useState("");
  const [granting, setGranting] = useState(false);

  // pricing v2: PDF 무제한 entitlement 부여 상태 (userId → { has, entitlementId })
  const [pdfUnlimitedMap, setPdfUnlimitedMap] = useState<
    Record<string, { has: boolean; entitlementId?: string }>
  >({});
  const [pdfBusyUserId, setPdfBusyUserId] = useState<string | null>(null);

  // 비밀번호 재설정 (Supabase SMTP 제한 대안)
  const [pwResetUser, setPwResetUser] = useState<{ id: string; email: string } | null>(null);
  const [pwResetNew, setPwResetNew] = useState("");
  const [pwResetBusy, setPwResetBusy] = useState(false);

  // 테스트 계정 생성 상태
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    consumer: { success: boolean; email: string; password: string; userId?: string; credits?: number; error?: string };
    contractor: { success: boolean; email: string; companyName?: string; error?: string };
  } | null>(null);

  const load = useCallback(async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      if (tab === "consumer") setConsumers(data.users || []);
      else setContractors(data.users || []);
      setTotal(data.total || 0);
    } catch { toast({ type: "error", title: "오류", message: "사용자 목록을 불러올 수 없습니다" }); }
    setLoading(false);
  }, [tab, page, search]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  function openGrant(userId: string, mode: "add" | "subtract") {
    setGrantTarget(userId);
    setGrantMode(mode);
    setGrantAmount(mode === "add" ? "100" : "50");
    setGrantDescription(mode === "add" ? "관리자 수동 부여" : "관리자 수동 차감");
  }

  async function handleGrant(userId: string) {
    const rawAmount = parseInt(grantAmount);
    if (!rawAmount || rawAmount <= 0) return;

    const finalAmount = grantMode === "subtract" ? -rawAmount : rawAmount;

    // 차감 시 잔액 초과 검증
    if (grantMode === "subtract") {
      const user = consumers.find((u) => u.id === userId);
      if (user && rawAmount > user.balance) {
        toast({ type: "warning", title: "차감 불가", message: `현재 잔액(${user.balance})보다 많이 차감할 수 없습니다` });
        return;
      }
    }

    setGranting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({
          userId,
          amount: finalAmount,
          type: grantMode === "subtract" ? "REFUND" : "CHARGE",
          description: grantDescription || (grantMode === "add" ? `관리자 수동 부여 (+${rawAmount})` : `관리자 수동 차감 (-${rawAmount})`),
        }),
      });
      if (res.ok) {
        setGrantTarget(null);
        setGrantAmount("100");
        setGrantDescription("");
        load();
      }
    } catch { toast({ type: "error", title: "오류", message: "크레딧 부여에 실패했습니다" }); }
    setGranting(false);
  }

  // pricing v2: PDF 무제한 권한 조회/부여/해제
  const adminAuth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
  });

  async function loadPdfUnlimited(userId: string): Promise<void> {
    try {
      const res = await fetch(`/api/admin/entitlements?userId=${userId}`, { headers: adminAuth() });
      if (!res.ok) return;
      const data = await res.json();
      const active = (data.entitlements ?? []).find(
        (e: { entitlement_type: string; revoked_at: string | null; consumed_at: string | null; id: string }) =>
          e.entitlement_type === "pdf_unlimited" && !e.revoked_at,
      );
      setPdfUnlimitedMap((prev) => ({
        ...prev,
        [userId]: { has: !!active, entitlementId: active?.id },
      }));
    } catch (e) {
      console.warn("[admin/users] load pdf unlimited failed:", e);
    }
  }

  async function togglePdfUnlimited(userId: string) {
    setPdfBusyUserId(userId);
    try {
      const cur = pdfUnlimitedMap[userId];
      if (cur?.has && cur.entitlementId) {
        const res = await fetch(
          `/api/admin/entitlements?entitlementId=${cur.entitlementId}&reason=관리자 해제`,
          { method: "DELETE", headers: adminAuth() },
        );
        if (res.ok) {
          setPdfUnlimitedMap((prev) => ({ ...prev, [userId]: { has: false } }));
          toast({ type: "success", title: "해제 완료", message: "PDF 무제한 권한이 해제되었습니다" });
        } else {
          toast({ type: "error", title: "오류", message: "해제 실패" });
        }
      } else {
        const res = await fetch("/api/admin/entitlements", {
          method: "POST",
          headers: adminAuth(),
          body: JSON.stringify({
            userId,
            type: "pdf_unlimited",
            reason: "관리자 PDF 무제한 부여 (구독시스템 사전 적용)",
          }),
        });
        const data = await res.json();
        if (res.ok && data.entitlementId) {
          setPdfUnlimitedMap((prev) => ({
            ...prev,
            [userId]: { has: true, entitlementId: data.entitlementId },
          }));
          toast({
            type: "success",
            title: data.alreadyGranted ? "이미 부여됨" : "부여 완료",
            message: "PDF 무제한 권한이 부여되었습니다",
          });
        } else {
          toast({ type: "error", title: "오류", message: data.hint || "부여 실패" });
        }
      }
    } catch {
      toast({ type: "error", title: "오류", message: "PDF 권한 처리 실패" });
    } finally {
      setPdfBusyUserId(null);
    }
  }

  async function handleResetPassword() {
    if (!pwResetUser) return;
    if (pwResetNew.length < 8 || !/[A-Za-z]/.test(pwResetNew) || !/\d/.test(pwResetNew)) {
      toast({ type: "error", title: "오류", message: "비밀번호는 영문+숫자 포함 8자 이상" });
      return;
    }
    setPwResetBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${pwResetUser.id}/reset-password`, {
        method: "POST",
        headers: adminAuth(),
        body: JSON.stringify({ newPassword: pwResetNew }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          type: "success",
          title: "비번 재설정 완료",
          message: `${pwResetUser.email} — 새 비밀번호로 로그인 가능합니다`,
        });
        setPwResetUser(null);
        setPwResetNew("");
      } else {
        toast({ type: "error", title: "실패", message: data.error || "재설정 실패" });
      }
    } catch {
      toast({ type: "error", title: "오류", message: "서버 오류" });
    } finally {
      setPwResetBusy(false);
    }
  }

  // 사용자 목록 로딩 후 일괄 PDF 권한 조회
  useEffect(() => {
    if (consumers.length === 0) return;
    consumers.forEach((u) => {
      if (pdfUnlimitedMap[u.id] === undefined) void loadPdfUnlimited(u.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumers]);

  function formatPhone(raw: string): string {
    const d = raw.replace(/[^0-9]/g, "");
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return raw || "-";
  }

  function providerBadge(p: string) {
    const map: Record<string, { label: string; cls: string }> = {
      email: { label: "이메일", cls: "bg-gray-100 text-gray-600" },
      google: { label: "Google", cls: "bg-red-50 text-red-700" },
      kakao: { label: "카카오", cls: "bg-yellow-50 text-yellow-700" },
      naver: { label: "네이버", cls: "bg-green-50 text-green-700" },
      apple: { label: "Apple", cls: "bg-gray-900 text-white" },
    };
    const m = map[p] ?? map.email;
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.cls}`}>{m.label}</span>;
  }

  function exportConsumerCsv() {
    const headers = [
      "ID", "이메일", "이름", "휴대폰", "가입경로", "이메일인증", "휴대폰인증",
      "약관동의시각", "개인정보동의시각", "만14세동의시각", "마케팅동의시각",
      "마지막로그인", "크레딧잔액", "무료사용", "프로젝트수", "가입일",
    ];
    const rows = consumers.map((u) => [
      u.id,
      u.email,
      u.name,
      formatPhone(u.phone),
      u.provider,
      u.emailConfirmedAt ? "Y" : "N",
      u.phoneVerified ? "Y" : "N",
      u.agreedTermsAt || "",
      u.agreedPrivacyAt || "",
      u.agreedAge14At || "",
      u.agreedMarketingAt || "",
      u.lastSignInAt || "",
      String(u.balance),
      `${u.freeGenerationsUsed}/1`,
      String(u.projectCount),
      u.createdAt,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // BOM for Excel 한글 호환
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inpick_consumers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSeedTestAccounts() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/seed-test-accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      setSeedResult(data);
      load();
    } catch {
      setSeedResult({
        consumer: { success: false, email: "test@inpick.kr", password: "test1234!", error: "요청 실패" },
        contractor: { success: false, email: "contractor@inpick.kr", error: "요청 실패" },
      });
    }
    setSeeding(false);
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">사용자 관리</h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500">총 {total}명</p>
          {tab === "consumer" && (
            <button onClick={exportConsumerCsv} disabled={consumers.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <Download className="w-4 h-4" /> CSV 내보내기
            </button>
          )}
          <button onClick={handleSeedTestAccounts} disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            테스트 계정 생성
          </button>
        </div>
      </div>

      {/* 테스트 계정 생성 결과 */}
      {seedResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">테스트 계정 생성 결과</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 text-sm ${seedResult.consumer.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className="font-medium text-gray-900">소비자 테스트 계정</p>
              <p className="text-gray-600">이메일: <span className="font-mono">{seedResult.consumer.email}</span></p>
              <p className="text-gray-600">비밀번호: <span className="font-mono">{seedResult.consumer.password}</span></p>
              {seedResult.consumer.credits && <p className="text-blue-600">크레딧: {seedResult.consumer.credits.toLocaleString()}</p>}
              {seedResult.consumer.error && <p className="text-red-600 text-xs mt-1">{seedResult.consumer.error}</p>}
            </div>
            <div className={`rounded-lg p-3 text-sm ${seedResult.contractor.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className="font-medium text-gray-900">사업자 테스트 계정</p>
              <p className="text-gray-600">이메일: <span className="font-mono">{seedResult.contractor.email}</span></p>
              <p className="text-gray-600">비밀번호: <span className="text-gray-400">(이메일만 입력)</span></p>
              {seedResult.contractor.companyName && <p className="text-gray-600">회사명: {seedResult.contractor.companyName}</p>}
              {seedResult.contractor.error && <p className="text-red-600 text-xs mt-1">{seedResult.contractor.error}</p>}
            </div>
          </div>
          <button onClick={() => setSeedResult(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
        </div>
      )}

      {/* 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setTab("consumer"); setPage(1); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "consumer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            소비자
          </button>
          <button onClick={() => { setTab("contractor"); setPage(1); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "contractor" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            사업자
          </button>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "consumer" ? "이름, 이메일 또는 ID" : "회사명 또는 이메일"}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64" />
          </div>
          <button type="submit" className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg">검색</button>
        </form>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : tab === "consumer" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">휴대폰</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">가입경로</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">인증·약관</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">크레딧</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">프로젝트</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">가입일</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">크레딧 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumers.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />등록된 소비자가 없습니다
                  </td></tr>
                ) : consumers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email || <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name || <span className="text-gray-300">미입력</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{u.phone ? formatPhone(u.phone) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3">{providerBadge(u.provider)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 text-[11px]">
                        <span title="이메일 인증" className={u.emailConfirmedAt ? "text-green-600" : "text-gray-300"}>
                          {u.emailConfirmedAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </span>
                        <span title="필수 약관" className={u.agreedTermsAt && u.agreedPrivacyAt && u.agreedAge14At ? "text-green-600" : "text-gray-300"}>
                          {u.agreedTermsAt && u.agreedPrivacyAt && u.agreedAge14At ? "약관✓" : "약관-"}
                        </span>
                        <span title="마케팅 수신" className={u.agreedMarketingAt ? "text-purple-600" : "text-gray-300"}>
                          {u.agreedMarketingAt ? "광고✓" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      <span className={u.balance > 0 ? "text-blue-600" : "text-gray-400"}>{u.balance.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">{u.projectCount}건</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-3">
                      {grantTarget === u.id ? (
                        <div className="space-y-2">
                          {/* 부여/차감 토글 */}
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setGrantMode("add")}
                              className={`flex items-center gap-0.5 px-2 py-1 text-xs rounded ${grantMode === "add" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                              <Plus className="w-3 h-3" /> 부여
                            </button>
                            <button onClick={() => setGrantMode("subtract")}
                              className={`flex items-center gap-0.5 px-2 py-1 text-xs rounded ${grantMode === "subtract" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                              <Minus className="w-3 h-3" /> 차감
                            </button>
                          </div>
                          {/* 수량 + 사유 */}
                          <div className="flex items-center gap-1">
                            <input value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)}
                              type="number" min="1" max={grantMode === "subtract" ? u.balance : undefined}
                              className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right"
                              placeholder="수량" />
                          </div>
                          <input value={grantDescription} onChange={(e) => setGrantDescription(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                            placeholder="사유 (선택)" />
                          {/* 액션 버튼 */}
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleGrant(u.id)} disabled={granting}
                              className={`px-3 py-1 text-white text-xs rounded disabled:opacity-50 ${grantMode === "add" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}`}>
                              {granting ? <Loader2 className="w-3 h-3 animate-spin" /> : grantMode === "add" ? "부여 확인" : "차감 확인"}
                            </button>
                            <button onClick={() => setGrantTarget(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button onClick={() => openGrant(u.id, "add")}
                            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Coins className="w-3 h-3" /> 부여
                          </button>
                          <button onClick={() => openGrant(u.id, "subtract")}
                            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors">
                            <Minus className="w-3 h-3" /> 차감
                          </button>
                          <button
                            onClick={() => togglePdfUnlimited(u.id)}
                            disabled={pdfBusyUserId === u.id}
                            title="PDF 다운로드 무제한 권한 (구독시스템 사전 적용)"
                            className={`inline-flex items-center gap-0.5 px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 ${
                              pdfUnlimitedMap[u.id]?.has
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "text-amber-600 hover:bg-amber-50"
                            }`}
                          >
                            {pdfBusyUserId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : pdfUnlimitedMap[u.id]?.has ? (
                              <Crown className="w-3 h-3" />
                            ) : (
                              <FileText className="w-3 h-3" />
                            )}
                            {pdfUnlimitedMap[u.id]?.has ? "PDF무제한" : "PDF부여"}
                          </button>
                          <button
                            onClick={() => { setPwResetUser({ id: u.id, email: u.email }); setPwResetNew(""); }}
                            title="비밀번호 직접 재설정 (SMTP 미가용 시 대안)"
                            className="inline-flex items-center gap-0.5 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <KeyRound className="w-3 h-3" /> 비번재설정
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">회사명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">지역</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">평점</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contractors.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />등록된 업체가 없습니다
                </td></tr>
              ) : contractors.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.company_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.region || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">{c.rating?.toFixed(1) || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(c.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 비밀번호 재설정 모달 */}
      {pwResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !pwResetBusy && setPwResetUser(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">비밀번호 직접 재설정</h3>
                <p className="mt-1 text-sm text-gray-500">
                  대상: <span className="font-mono">{pwResetUser.email}</span>
                </p>
              </div>
              <button onClick={() => setPwResetUser(null)} disabled={pwResetBusy} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              SMTP 미설정 시 비번 찾기 메일이 발송되지 않으므로 관리자가 직접 변경합니다. 변경 후 사용자에게 안전한 채널(SMS/대면)로 새 비번을 전달하세요.
            </div>

            <label className="mt-4 block text-sm font-medium text-gray-700">새 비밀번호</label>
            <input
              type="text"
              value={pwResetNew}
              onChange={(e) => setPwResetNew(e.target.value)}
              placeholder="영문+숫자 포함 8자 이상"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">텍스트 표시로 오타 방지. 화면 공유 중에는 주의.</p>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setPwResetUser(null)} disabled={pwResetBusy}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                취소
              </button>
              <button onClick={handleResetPassword} disabled={pwResetBusy || pwResetNew.length < 8}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300">
                {pwResetBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                재설정 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
