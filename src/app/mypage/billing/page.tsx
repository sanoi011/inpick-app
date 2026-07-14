"use client";

/**
 * /mypage/billing — SaaS Customer Portal 스타일 결제·토큰·PDF·생성 작업 통합 화면.
 * 가이드: pricing-saas-flow §4-7
 *
 * ChatGPT 풍 neutral 톤 — bg #F7F7F5, card #FFF, border #E5E2DD, text #202123
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Coins,
  Receipt,
  FileText,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TokenPurchaseDrawer } from "@/components/billing/TokenPurchaseDrawer";

interface BillingData {
  wallet: {
    balance: number;
    paid_balance: number;
    promo_balance: number;
    locked_balance: number;
  };
  userCreditsBalance: number | null;
  payments: Array<{
    id: string;
    order_id: string;
    amount_krw: number;
    status: string;
    provider: string | null;
    created_at: string;
    product:
      | { name_ko: string; code: string; product_type: string }
      | Array<{ name_ko: string; code: string; product_type: string }>
      | null;
  }>;
  ledger: Array<{
    id: string;
    entry_type: string;
    delta: number;
    balance_after: number | null;
    reason_ko: string | null;
    source_type: string;
    created_at: string;
  }>;
  entitlements: Array<{
    id: string;
    entitlement_type: string;
    source: string;
    estimate_id: string | null;
    estimate_version: string | null;
    asset_url: string | null;
    granted_at: string;
    consumed_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
  }>;
  generationJobs: Array<{
    id: string;
    project_id: string;
    target_name: string;
    status: string;
    image_url: string | null;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
    failed_at: string | null;
  }>;
  recoveryCases: Array<{
    id: string;
    case_type: string;
    severity: string;
    status: string;
    description: string;
    created_at: string;
  }>;
}

type Tab = "payments" | "ledger" | "pdf" | "generation" | "recovery";

export default function MyBillingPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("payments");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/mypage/billing")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authLoading, user]);

  const reload = () => {
    fetch("/api/mypage/billing")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => undefined);
  };

  if (!user && !authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="rounded-2xl border border-[#E5E2DD] bg-white p-8 text-center max-w-sm w-full">
          <p className="text-sm text-[#6B6B6B] mb-4">결제 내역은 로그인 후 확인할 수 있습니다.</p>
          <Link href="/auth?redirect=/mypage/billing" className="inline-block rounded-full bg-[#202123] px-5 py-2.5 text-sm font-semibold text-white">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#9A9A9A]" />
      </div>
    );
  }

  // 라이브 잔액(user_credits)이 헤더·차감에 쓰이는 값 — 지갑(token_wallets)과 큰 쪽으로 표시 통일
  const totalAvailable = Math.max(
    data.wallet.balance - data.wallet.locked_balance,
    data.userCreditsBalance ?? 0,
  );

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
        <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">BILLING</p>
            <h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[36px]">결제·토큰 관리</h1>
            <p className="mt-2 text-sm text-black/45">
              토큰 잔액, 결제 내역, 계약견적서 발급권, 이미지 생성 작업을 확인합니다.
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0d0d0d] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
          >
            <Plus className="w-4 h-4" /> 토큰 충전
          </button>
        </div>

        {/* 상단 요약 카드 */}
        <div className="grid gap-3 md:grid-cols-3 mb-6">
          <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
            <div className="flex items-center gap-2 text-[#6B6B6B] text-xs mb-1">
              <Coins className="w-4 h-4" /> 사용 가능 토큰
            </div>
            <p className="text-3xl font-semibold tracking-[-0.045em] text-[#202123]">{totalAvailable.toLocaleString()}</p>
            {data.wallet.locked_balance > 0 && (
              <p className="text-xs text-[#9A9A9A] mt-1">
                예약 중 {data.wallet.locked_balance}개 별도
              </p>
            )}
          </div>
          <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
            <div className="flex items-center gap-2 text-[#6B6B6B] text-xs mb-1">
              <FileText className="w-4 h-4" /> 계약견적서 발급권
            </div>
            <p className="text-3xl font-semibold tracking-[-0.045em] text-[#202123]">
              {
                data.entitlements.filter(
                  (e) =>
                    e.entitlement_type === "estimate_pdf_single" &&
                    !e.consumed_at &&
                    !e.revoked_at,
                ).length
              }
            </p>
            <p className="text-xs text-[#9A9A9A] mt-1">미사용 권한 (재다운로드는 무료)</p>
          </div>
          <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
            <div className="flex items-center gap-2 text-[#6B6B6B] text-xs mb-1">
              <AlertTriangle className="w-4 h-4" /> 복구 필요
            </div>
            <p className="text-3xl font-semibold tracking-[-0.045em] text-[#202123]">
              {data.recoveryCases.length}
            </p>
            <p className="text-xs text-[#9A9A9A] mt-1">관리자 확인 진행 중</p>
          </div>
        </div>

        {/* 복구 케이스 알림 */}
        {data.recoveryCases.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              계정 복구 진행 중인 항목이 있습니다
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {data.recoveryCases.slice(0, 3).map((c) => (
                <li key={c.id}>· {c.description}</li>
              ))}
            </ul>
            <p className="mt-2 text-[0.65rem] text-amber-700">
              대부분 자동 처리됩니다. 24시간 이내 해결되지 않으면 고객센터로 문의해주세요.
            </p>
          </div>
        )}

        {/* 탭 */}
        <div className="mb-3 flex gap-1 overflow-x-auto border-b border-black/[0.07]">
          {([
            { key: "payments", label: "결제 내역", icon: Receipt },
            { key: "ledger", label: "토큰 내역", icon: Coins },
            { key: "pdf", label: "계약견적서", icon: FileText },
            { key: "generation", label: "이미지 생성", icon: ImageIcon },
            { key: "recovery", label: "복구 상태", icon: AlertTriangle },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? "border-b-2 border-[#202123] text-[#202123]"
                  : "text-[#6B6B6B] hover:text-[#202123]"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-4">
          {tab === "payments" && <PaymentsTab payments={data.payments} />}
          {tab === "ledger" && <LedgerTab ledger={data.ledger} />}
          {tab === "pdf" && <EntitlementsTab entitlements={data.entitlements} />}
          {tab === "generation" && <GenerationTab jobs={data.generationJobs} />}
          {tab === "recovery" && <RecoveryTab cases={data.recoveryCases} />}
        </div>
      </div>
      <TokenPurchaseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        reason="manual_topup"
        currentTokens={totalAvailable}
        onProvisioned={() => { reload(); }}
      />
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  app_store: "App Store",
  google_play: "Google Play",
  toss: "토스페이먼츠",
  admin: "관리자 지급",
};

function PaymentsTab({ payments }: { payments: BillingData["payments"] }) {
  if (payments.length === 0) {
    return <EmptyHint text="결제 내역이 없습니다." />;
  }
  return (
    <div className="space-y-1.5">
      {payments.map((p) => {
        const prod = Array.isArray(p.product) ? p.product[0] : p.product;
        return (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#E5E2DD] bg-[#FAFAF8] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#202123]">{prod?.name_ko ?? p.order_id}</p>
              <p className="text-xs text-[#6B6B6B]">
                {new Date(p.created_at).toLocaleString("ko-KR")}
                {p.provider && (
                  <span className="ml-1.5 rounded bg-[#EFEDE8] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#6B6B6B]">
                    {PROVIDER_LABELS[p.provider] ?? p.provider}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[#202123]">{p.amount_krw.toLocaleString()}원</p>
              <StatusBadge status={p.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LedgerTab({ ledger }: { ledger: BillingData["ledger"] }) {
  if (ledger.length === 0) {
    return <EmptyHint text="토큰 이력이 없습니다." />;
  }
  return (
    <div className="space-y-1">
      {ledger.map((l) => (
        <div key={l.id} className="flex items-center justify-between rounded-lg border border-[#E5E2DD] bg-[#FAFAF8] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#202123]">{l.reason_ko ?? l.entry_type}</p>
            <p className="text-[0.65rem] text-[#9A9A9A]">{new Date(l.created_at).toLocaleString("ko-KR")}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${l.delta > 0 ? "text-emerald-700" : "text-[#202123]"}`}>
              {l.delta > 0 ? "+" : ""}
              {l.delta} 토큰
            </p>
            {l.balance_after != null && (
              <p className="text-[0.65rem] text-[#9A9A9A]">잔액 {l.balance_after}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EntitlementsTab({ entitlements }: { entitlements: BillingData["entitlements"] }) {
  const active = entitlements.filter((e) => !e.revoked_at);
  if (active.length === 0) {
    return <EmptyHint text="계약견적서 발급권이 없습니다." />;
  }
  return (
    <div className="space-y-1.5">
      {active.map((e) => {
        const isUnlimited = e.entitlement_type === "pdf_unlimited";
        const isUsed = !!e.consumed_at;
        const canReissue = isUnlimited || (isUsed && !!e.asset_url);
        return (
          <div key={e.id} className="rounded-lg border border-[#E5E2DD] bg-[#FAFAF8] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#202123]">
                  {isUnlimited ? "계약견적서 무제한 권한" : "계약견적서 패키지 발급권"}
                  {e.estimate_version && (
                    <span className="ml-2 text-xs text-[#6B6B6B]">version {e.estimate_version}</span>
                  )}
                </p>
                <p className="text-xs text-[#6B6B6B]">
                  {new Date(e.granted_at).toLocaleString("ko-KR")} 발급
                  {e.source === "admin_grant" && <span className="ml-1 text-amber-700">· 관리자 부여</span>}
                </p>
              </div>
              <div className="text-right">
                {isUnlimited ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> 활성
                  </span>
                ) : canReissue ? (
                  <span className="text-[0.65rem] text-emerald-700">발급 완료 (재다운로드 가능)</span>
                ) : isUsed ? (
                  <span className="text-[0.65rem] text-amber-700">사용됨 (asset 미생성)</span>
                ) : (
                  <span className="text-[0.65rem] text-[#6B6B6B]">미사용</span>
                )}
              </div>
            </div>
            {e.asset_url && (
              <a
                href={e.asset_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-[#202123] underline"
              >
                PDF 다운로드 →
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenerationTab({ jobs }: { jobs: BillingData["generationJobs"] }) {
  if (jobs.length === 0) {
    return <EmptyHint text="이미지 생성 이력이 없습니다." />;
  }
  return (
    <div className="space-y-1.5">
      {jobs.map((j) => (
        <div key={j.id} className="rounded-lg border border-[#E5E2DD] bg-[#FAFAF8] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#202123]">{j.target_name}</p>
              <p className="text-[0.65rem] text-[#9A9A9A]">{new Date(j.created_at).toLocaleString("ko-KR")}</p>
              {j.status === "failed" && j.error_message && (
                <p className="mt-1 text-[0.65rem] text-rose-700">{j.error_message}</p>
              )}
            </div>
            <StatusBadge status={j.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecoveryTab({ cases }: { cases: BillingData["recoveryCases"] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-4 text-center text-sm text-emerald-700">
        <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
        복구 필요 항목 없음
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {cases.map((c) => (
        <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-900">{c.description}</p>
          <p className="text-[0.65rem] text-amber-700 mt-0.5">
            {new Date(c.created_at).toLocaleString("ko-KR")} · 처리 중
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-[#9A9A9A]">{text}</div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    paid: { label: "완료", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    provisioned: { label: "지급 완료", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    confirming: { label: "확인 중", cls: "bg-blue-50 text-blue-700", icon: Loader2 },
    created: { label: "대기", cls: "bg-gray-100 text-gray-600", icon: Clock },
    cancelled: { label: "취소", cls: "bg-gray-100 text-gray-500", icon: XCircle },
    failed: { label: "실패", cls: "bg-rose-50 text-rose-700", icon: XCircle },
    expired: { label: "만료", cls: "bg-gray-100 text-gray-500", icon: Clock },
    completed: { label: "완료", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    generating: { label: "생성 중", cls: "bg-blue-50 text-blue-700", icon: Loader2 },
    token_reserved: { label: "예약 중", cls: "bg-blue-50 text-blue-700", icon: Loader2 },
    reconciliation_required: { label: "확인 중", cls: "bg-amber-50 text-amber-700", icon: AlertTriangle },
  };
  const m = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500", icon: Clock };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${m.cls}`}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}
