"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users, AlertTriangle, Activity, Shield, Eye, EyeOff } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

type Member = {
  id: string;
  email: string;
  provider: string;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  hasProfile: boolean;
  profileStatus: string | null;
  profileName: string | null;
  profilePhone: string | null;
  recoveryEnabled: boolean | null;
};

type Case = {
  id: string;
  user_id: string | null;
  case_type: string;
  severity: string;
  status: string;
  email_hash: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type AuditEvent = {
  id: string;
  user_id: string | null;
  event_name: string;
  provider: string | null;
  result: string;
  error_code: string | null;
  created_at: string;
};

type Summary = {
  total: number;
  self_signup: number;
  oauth: number;
  profile_orphan_auth: number;
  email_unconfirmed: number;
  open_cases: number;
};

type Stats = {
  recovery24h_total: number;
  recovery24h_success: number;
  recovery24h_failure: number;
  recovery24h_blocked: number;
};

function maskEmail(email: string | null | undefined): string {
  if (!email) return "-";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + "*".repeat(local.length - 2) : local;
  return `${masked}@${domain}`;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export default function AdminMembersPage() {
  const { authChecked } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "self" | "oauth" | "orphan" | "cases" | "audits">("summary");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [showPii, setShowPii] = useState(false);

  const adminAuth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members", { headers: adminAuth() });
      if (!res.ok) {
        toast({ type: "error", title: "조회 실패", message: "관리자 권한 확인" });
        return;
      }
      const data = await res.json();
      setSummary(data.summary);
      setStats(data.stats);
      setMembers(data.members ?? []);
      setCases(data.cases ?? []);
      setAudits(data.recentAudits ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  async function recoverProfile(userId: string) {
    const res = await fetch("/api/admin/members/recover", {
      method: "POST",
      headers: adminAuth(),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      toast({ type: "success", title: "복구 완료", message: data.message });
      await load();
    } else {
      toast({ type: "error", title: "복구 불가", message: data.message || data.error || "실패" });
    }
  }

  async function resolveCase(caseId: string, status: "resolved" | "dismissed") {
    const res = await fetch(`/api/admin/members/cases/${caseId}`, {
      method: "PATCH",
      headers: adminAuth(),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast({ type: "success", title: `${status === "resolved" ? "해결" : "기각"} 처리됨` });
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ type: "error", title: "실패", message: data.hint || data.error });
    }
  }

  if (!authChecked || loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const selfMembers = members.filter((m) => m.provider === "email");
  const oauthMembers = members.filter((m) => m.provider !== "email");
  const orphanMembers = members.filter((m) => !m.hasProfile);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원관리 (정합성·감사)</h1>
          <p className="mt-1 text-sm text-gray-500">자체회원 / OAuth회원 / 프로필 누락 / 복구 로그 / Reconciliation 통합 관리</p>
        </div>
        <button
          onClick={() => setShowPii(!showPii)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
        >
          {showPii ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPii ? "PII 가리기" : "PII 표시"}
        </button>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <SummaryCard icon={Users} label="전체 회원" value={summary.total} color="gray" />
          <SummaryCard icon={Users} label="자체회원" value={summary.self_signup} color="blue" />
          <SummaryCard icon={Users} label="OAuth회원" value={summary.oauth} color="emerald" />
          <SummaryCard icon={AlertTriangle} label="프로필 누락" value={summary.profile_orphan_auth} color="amber" />
          <SummaryCard icon={AlertTriangle} label="이메일 미인증" value={summary.email_unconfirmed} color="orange" />
          <SummaryCard icon={Shield} label="처리 대기 케이스" value={summary.open_cases} color="red" />
        </div>
      )}

      {/* 복구 24h 통계 */}
      {stats && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Activity className="w-4 h-4" /> 비밀번호 복구 24시간 통계</h3>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>총 시도: <span className="font-semibold">{stats.recovery24h_total}</span></div>
            <div className="text-green-700">성공: <span className="font-semibold">{stats.recovery24h_success}</span></div>
            <div className="text-amber-700">실패: <span className="font-semibold">{stats.recovery24h_failure}</span></div>
            <div className="text-red-700">차단: <span className="font-semibold">{stats.recovery24h_blocked}</span></div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 flex-wrap">
        {[
          { key: "summary", label: "요약" },
          { key: "self", label: `자체회원 ${selfMembers.length}` },
          { key: "oauth", label: `OAuth ${oauthMembers.length}` },
          { key: "orphan", label: `프로필 누락 ${orphanMembers.length}` },
          { key: "cases", label: `Cases ${cases.length}` },
          { key: "audits", label: `Audit ${audits.length}` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              tab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {(tab === "self" || tab === "oauth" || tab === "orphan") && (
        <MemberTable
          members={tab === "self" ? selfMembers : tab === "oauth" ? oauthMembers : orphanMembers}
          showPii={showPii}
          onRecover={tab === "orphan" ? recoverProfile : undefined}
        />
      )}

      {tab === "cases" && (
        <CasesTable cases={cases} showPii={showPii} onResolve={resolveCase} />
      )}

      {tab === "audits" && (
        <AuditsTable audits={audits} />
      )}

      {tab === "summary" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <p>각 탭에서 회원 유형별로 상세 데이터를 확인할 수 있습니다.</p>
          <ul className="mt-3 list-disc list-inside space-y-1 text-gray-500">
            <li>자체회원 — 이메일 가입자 (provider=email)</li>
            <li>OAuth — Google/Naver/Kakao/Apple 가입자</li>
            <li>프로필 누락 — auth.users 있으나 consumer_profiles 없음 (복구 대상)</li>
            <li>Cases — 정합성 이슈 처리 대기 (resolve/dismiss)</li>
            <li>Audit — 회원가입/로그인/복구 최근 100건</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  const colorClass: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colorClass[color]} text-[10px]`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

function MemberTable({ members, showPii, onRecover }: { members: Member[]; showPii: boolean; onRecover?: (userId: string) => void }) {
  const [recovering, setRecovering] = useState<string | null>(null);
  const colCount = onRecover ? 8 : 7;
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이름</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">휴대폰</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Provider</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">인증/프로필</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">마지막 로그인</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">가입일</th>
            {onRecover && <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">복구</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {members.length === 0 ? (
            <tr><td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-400">데이터 없음</td></tr>
          ) : members.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-600">{showPii ? m.email : maskEmail(m.email)}</td>
              <td className="px-4 py-3 text-sm">{m.profileName || <span className="text-gray-300">-</span>}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{showPii ? m.profilePhone || "-" : maskPhone(m.profilePhone)}</td>
              <td className="px-4 py-3 text-xs"><span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">{m.provider}</span></td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px]">
                  <span className={`px-1 py-0.5 rounded ${m.emailConfirmed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{m.emailConfirmed ? "✓이메일" : "이메일미인증"}</span>
                  <span className={`px-1 py-0.5 rounded ${m.hasProfile ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{m.hasProfile ? "✓프로필" : "프로필없음"}</span>
                  {m.recoveryEnabled === false && <span className="px-1 py-0.5 rounded bg-red-100 text-red-700">복구차단</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-right text-gray-500 whitespace-nowrap">{m.lastSignInAt ? new Date(m.lastSignInAt).toLocaleDateString("ko-KR") : "-"}</td>
              <td className="px-4 py-3 text-xs text-right text-gray-400 whitespace-nowrap">{new Date(m.createdAt).toLocaleDateString("ko-KR")}</td>
              {onRecover && (
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={async () => { setRecovering(m.id); try { await onRecover(m.id); } finally { setRecovering(null); } }}
                    disabled={recovering === m.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {recovering === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    프로필 복구
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CasesTable({ cases, showPii, onResolve }: { cases: Case[]; showPii: boolean; onResolve: (id: string, status: "resolved" | "dismissed") => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시각</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Case Type</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">심각도</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">User ID</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">세부</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">처리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cases.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">처리 대기 케이스 없음 ✓</td></tr>
          ) : cases.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(c.created_at).toLocaleString("ko-KR")}</td>
              <td className="px-4 py-3 text-xs font-mono">{c.case_type}</td>
              <td className="px-4 py-3 text-xs">
                <span className={`px-1.5 py-0.5 rounded ${c.severity === "critical" ? "bg-red-100 text-red-700" : c.severity === "high" ? "bg-orange-100 text-orange-700" : c.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{c.severity}</span>
              </td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{c.user_id ? (showPii ? c.user_id : c.user_id.slice(0, 8) + "...") : "-"}</td>
              <td className="px-4 py-3 text-xs text-gray-600 max-w-md truncate">{JSON.stringify(c.details).slice(0, 100)}</td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => onResolve(c.id, "resolved")} className="text-xs text-green-600 hover:underline">해결</button>
                  <button onClick={() => onResolve(c.id, "dismissed")} className="text-xs text-gray-500 hover:underline">기각</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditsTable({ audits }: { audits: AuditEvent[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시각</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이벤트</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Provider</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">결과</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">에러 코드</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {audits.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">audit 이벤트 없음</td></tr>
          ) : audits.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(a.created_at).toLocaleString("ko-KR")}</td>
              <td className="px-4 py-3 text-xs font-mono">{a.event_name}</td>
              <td className="px-4 py-3 text-xs">{a.provider || "-"}</td>
              <td className="px-4 py-3 text-xs">
                <span className={`px-1.5 py-0.5 rounded ${a.result === "success" ? "bg-green-100 text-green-700" : a.result === "blocked" ? "bg-red-100 text-red-700" : a.result === "failure" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{a.result}</span>
              </td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{a.error_code || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
