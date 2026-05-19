"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CreditCard, AlertTriangle, Activity, Smartphone, Package, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

type Overview = {
  today_total_krw: number;
  today_count: number;
  today_paid: number;
  today_failed: number;
  open_cases: number;
  unprocessed_events: number;
};

type Provider = {
  provider: string;
  mode: string;
  enabled: boolean;
  display_name: string;
  supports_web: boolean;
  supports_ios: boolean;
  supports_android: boolean;
  health_status: string;
  last_webhook_at: string | null;
  last_successful_payment_at: string | null;
};

type Product = {
  code: string;
  product_type: string;
  product_kind: string | null;
  name_ko: string;
  amount_krw: number;
  app_store_product_id: string | null;
  google_play_product_id: string | null;
  sale_channels: Record<string, boolean>;
  policy_risk_level: string;
  is_active: boolean;
  is_visible: boolean | null;
};

type PaymentIntent = {
  id: string;
  user_id: string;
  order_id: string;
  channel: string | null;
  platform: string | null;
  provider: string;
  product_type: string;
  amount_krw: number;
  status: string;
  created_at: string;
};

type AppPurchase = {
  id: string;
  platform: string;
  user_id: string | null;
  internal_product_id: string | null;
  app_product_id: string;
  transaction_id: string | null;
  purchase_token: string | null;
  verification_status: string;
  entitlement_status: string;
  created_at: string;
};

type PolicyWarning = {
  severity: string;
  message: string;
  productId?: string;
};

export default function AdminPaymentCenterPage() {
  const { authChecked } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "providers" | "mapping" | "intents" | "appPurchases" | "policy">("overview");
  const [data, setData] = useState<{
    overview: Overview | null;
    providers: Provider[];
    products: Product[];
    paymentIntents: PaymentIntent[];
    appPurchases: AppPurchase[];
    policyWarnings: PolicyWarning[];
  }>({ overview: null, providers: [], products: [], paymentIntents: [], appPurchases: [], policyWarnings: [] });

  const adminAuth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-center", { headers: adminAuth() });
      if (!res.ok) {
        toast({ type: "error", title: "조회 실패" });
        return;
      }
      const d = await res.json();
      setData({
        overview: d.overview,
        providers: d.providers ?? [],
        products: d.products ?? [],
        paymentIntents: d.paymentIntents ?? [],
        appPurchases: d.appPurchases ?? [],
        policyWarnings: d.policyWarnings ?? [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  if (!authChecked || loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">결제 센트럴타워</h1>
        <p className="mt-1 text-sm text-gray-500">웹/iOS/Android 결제 통합 관제 — Toss · App Store · Google Play · Mock</p>
      </div>

      {/* Overview 카드 */}
      {data.overview && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card icon={CreditCard} label="24h 결제 금액" value={`${(data.overview.today_total_krw / 1000).toLocaleString()}K원`} color="green" />
          <Card icon={Activity} label="24h 결제 시도" value={data.overview.today_count.toString()} color="blue" />
          <Card icon={CreditCard} label="24h 성공" value={data.overview.today_paid.toString()} color="emerald" />
          <Card icon={AlertTriangle} label="24h 실패" value={data.overview.today_failed.toString()} color="red" />
          <Card icon={ShieldCheck} label="처리 대기 케이스" value={data.overview.open_cases.toString()} color="amber" />
          <Card icon={Activity} label="미처리 이벤트" value={data.overview.unprocessed_events.toString()} color="orange" />
        </div>
      )}

      {/* Policy Warnings */}
      {data.policyWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> 정책 경고 ({data.policyWarnings.length}건)
          </h3>
          <ul className="space-y-1 text-xs text-amber-800">
            {data.policyWarnings.slice(0, 5).map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${w.severity === "high" ? "bg-red-100 text-red-700" : w.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{w.severity}</span>
                <span>{w.message}</span>
              </li>
            ))}
            {data.policyWarnings.length > 5 && <li className="text-amber-600">...외 {data.policyWarnings.length - 5}건 (Policy 탭에서 확인)</li>}
          </ul>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 flex-wrap">
        {[
          { key: "overview", label: "개요" },
          { key: "providers", label: `Provider ${data.providers.length}` },
          { key: "mapping", label: `상품 매핑 ${data.products.length}` },
          { key: "intents", label: `Payment Intents ${data.paymentIntents.length}` },
          { key: "appPurchases", label: `App Purchases ${data.appPurchases.length}` },
          { key: "policy", label: `Policy Guard ${data.policyWarnings.length}` },
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

      {tab === "overview" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <p className="mb-3">웹/iOS/Android 결제 통합 관제 화면입니다.</p>
          <ul className="list-disc list-inside space-y-1 text-gray-500">
            <li><b>Provider</b> — Toss/PortOne/App Store/Play Billing 상태</li>
            <li><b>상품 매핑</b> — 웹 상품 ↔ 앱마켓 productId 연결 + 정책 위험도</li>
            <li><b>Payment Intents</b> — 최근 7일 결제 시도</li>
            <li><b>App Purchases</b> — 앱마켓 transaction 검증 결과</li>
            <li><b>Policy Guard</b> — 상품/채널 정책 경고</li>
          </ul>
        </div>
      )}

      {tab === "providers" && <ProviderTable providers={data.providers} />}
      {tab === "mapping" && <MappingTable products={data.products} />}
      {tab === "intents" && <IntentTable intents={data.paymentIntents} />}
      {tab === "appPurchases" && <AppPurchaseTable purchases={data.appPurchases} />}
      {tab === "policy" && <PolicyTable warnings={data.policyWarnings} />}
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: { icon: typeof CreditCard; label: string; value: string; color: string }) {
  const c: Record<string, string> = {
    green: "bg-green-50 text-green-700", blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${c[color]} text-[10px]`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

function ProviderTable({ providers }: { providers: Provider[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200"><tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Provider</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">모드</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">활성</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">지원 플랫폼</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">건강</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">마지막 webhook</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {providers.map((p) => (
            <tr key={`${p.provider}-${p.mode}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium">{p.display_name}</td>
              <td className="px-4 py-3 text-xs font-mono">{p.mode}</td>
              <td className="px-4 py-3 text-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.enabled ? "ON" : "off"}</span>
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="flex items-center justify-center gap-1">
                  {p.supports_web && <span className="px-1 py-0.5 rounded bg-blue-100 text-blue-700">Web</span>}
                  {p.supports_ios && <span className="px-1 py-0.5 rounded bg-gray-200 text-gray-700">iOS</span>}
                  {p.supports_android && <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">Android</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-center"><span className={`px-1.5 py-0.5 rounded ${p.health_status === "healthy" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.health_status}</span></td>
              <td className="px-4 py-3 text-xs text-right text-gray-500">{p.last_webhook_at ? new Date(p.last_webhook_at).toLocaleString("ko-KR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MappingTable({ products }: { products: Product[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200"><tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Code</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Kind</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">가격</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">iOS productId</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Android productId</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">정책</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => (
            <tr key={p.code} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs font-mono">{p.code}</td>
              <td className="px-4 py-3 text-xs">{p.product_kind || "-"}</td>
              <td className="px-4 py-3 text-sm text-right font-semibold">{p.amount_krw.toLocaleString()}원</td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.app_store_product_id || "-"}</td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.google_play_product_id || "-"}</td>
              <td className="px-4 py-3 text-xs text-center"><span className={`px-1.5 py-0.5 rounded ${p.policy_risk_level === "offline_pg_safe" ? "bg-green-100 text-green-700" : p.policy_risk_level === "app_market_review_required" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{p.policy_risk_level}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntentTable({ intents }: { intents: PaymentIntent[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200"><tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시각</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Order ID</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Channel</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Provider</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">금액</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {intents.map((i) => (
            <tr key={i.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(i.created_at).toLocaleString("ko-KR")}</td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{i.order_id.slice(-12)}</td>
              <td className="px-4 py-3 text-xs">{i.channel || (i.platform ? `${i.platform}_native` : "web")}</td>
              <td className="px-4 py-3 text-xs">{i.provider}</td>
              <td className="px-4 py-3 text-sm text-right">{i.amount_krw.toLocaleString()}원</td>
              <td className="px-4 py-3 text-xs text-center"><span className={`px-1.5 py-0.5 rounded ${i.status === "provisioned" || i.status === "paid" ? "bg-green-100 text-green-700" : i.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{i.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppPurchaseTable({ purchases }: { purchases: AppPurchase[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200"><tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시각</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Platform</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Internal Product</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">App Product</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">검증</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">권한</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {purchases.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">앱 구매 transaction 없음 (앱 출시 후 데이터 표시)</td></tr>
          ) : purchases.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(p.created_at).toLocaleString("ko-KR")}</td>
              <td className="px-4 py-3 text-xs"><span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">{p.platform}</span></td>
              <td className="px-4 py-3 text-xs font-mono">{p.internal_product_id || "-"}</td>
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.app_product_id}</td>
              <td className="px-4 py-3 text-xs text-center"><span className={`px-1.5 py-0.5 rounded ${p.verification_status === "verified" ? "bg-green-100 text-green-700" : p.verification_status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{p.verification_status}</span></td>
              <td className="px-4 py-3 text-xs text-center"><span className={`px-1.5 py-0.5 rounded ${p.entitlement_status === "granted" ? "bg-green-100 text-green-700" : p.entitlement_status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{p.entitlement_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyTable({ warnings }: { warnings: PolicyWarning[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {warnings.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">정책 경고 없음 ✓</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {warnings.map((w, i) => (
            <li key={i} className="p-4 flex items-start gap-3 hover:bg-gray-50">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${w.severity === "high" ? "bg-red-100 text-red-700" : w.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{w.severity}</span>
              <div>
                <p className="text-sm text-gray-900">{w.message}</p>
                {w.productId && <p className="text-xs text-gray-500 font-mono mt-0.5">{w.productId}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
