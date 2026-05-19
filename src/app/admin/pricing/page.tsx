"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Hexagon, FileText, Zap, History, Edit3, X, AlertTriangle, Eye, EyeOff, Star } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

type Product = {
  id: string;
  productId: string;
  productType: string;
  displayName: string;
  description: string | null;
  amountKrw: number;
  tokenAmount: number;
  bonusTokenAmount: number;
  totalTokenAmount: number | null;
  effectiveUnitPriceKrw: number | null;
  isActive: boolean;
  isVisible: boolean;
  isPopular: boolean;
  sortOrder: number;
  adminNote: string | null;
};

type ConsumptionRule = {
  id: string;
  ruleKey: string;
  displayName: string;
  tokenCost: number;
  isActive: boolean;
  memo: string | null;
};

type ActiveVersion = {
  id: string;
  versionName: string;
  baseTokenUnitPriceKrw: number;
  signupBonusTokens: number;
  imageGenerationTokenCost: number;
  pdfSinglePriceKrw: number;
  publishedAt: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  reason: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminPricingPage() {
  const { authChecked } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"products" | "rules" | "audit">("products");
  const [activeVer, setActiveVer] = useState<ActiveVersion | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<ConsumptionRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // 모달 상태
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editRule, setEditRule] = useState<ConsumptionRule | null>(null);
  const [editBase, setEditBase] = useState(false);

  const adminAuth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing", { headers: adminAuth() });
      if (!res.ok) {
        toast({ type: "error", title: "조회 실패", message: "관리자 권한 확인" });
        return;
      }
      const data = await res.json();
      setActiveVer(data.activePricingVersion);
      setProducts(data.products ?? []);
      setRules(data.consumptionRules ?? []);
      setAuditLogs(data.auditLogs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">가격 정책</h1>
          <p className="mt-1 text-sm text-gray-500">토큰 단가 · 패키지 · PDF · 사용 규칙 — 가격 변경은 새 결제부터만 적용</p>
        </div>
      </div>

      {/* 상단 요약 카드 — active pricing version */}
      {activeVer && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">활성 가격 버전</p>
              <p className="text-lg font-bold text-gray-900">{activeVer.versionName}</p>
              {activeVer.publishedAt && (
                <p className="text-xs text-gray-400 mt-0.5">배포: {new Date(activeVer.publishedAt).toLocaleString("ko-KR")}</p>
              )}
            </div>
            <button onClick={() => setEditBase(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800">
              <Edit3 className="w-4 h-4" /> 기준값 수정
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">기준 토큰 단가</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{activeVer.baseTokenUnitPriceKrw.toLocaleString()}원</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">이미지 1장 소모</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">{activeVer.imageGenerationTokenCost}토큰</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">회원가입 보너스</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{activeVer.signupBonusTokens}토큰</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500">PDF 발급권</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{activeVer.pdfSinglePriceKrw.toLocaleString()}원</p>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: "products", label: "상품 가격", icon: Hexagon },
          { key: "rules", label: "사용 규칙", icon: Zap },
          { key: "audit", label: "변경 이력", icon: History },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* 상품 탭 */}
      {tab === "products" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">코드</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">유형</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">표시명</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">판매가</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">토큰</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">보너스</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">실질단가</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.productId}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.productType}</td>
                  <td className="px-4 py-3 font-medium">{p.displayName}</td>
                  <td className="px-4 py-3 text-right font-semibold">{p.amountKrw.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.tokenAmount > 0 ? p.tokenAmount : "-"}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{p.bonusTokenAmount > 0 ? `+${p.bonusTokenAmount}` : "-"}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {p.effectiveUnitPriceKrw ? `${p.effectiveUnitPriceKrw.toLocaleString()}원/T` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                        {p.isActive ? "active" : "off"}
                      </span>
                      {p.isVisible ? <Eye className="w-3 h-3 text-gray-400" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                      {p.isPopular && <Star className="w-3 h-3 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditProduct(p)} className="text-blue-600 hover:underline text-xs">수정</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사용 규칙 탭 */}
      {tab === "rules" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">규칙 키</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">설명</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">소모 토큰</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">활성</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">메모</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.ruleKey}</td>
                  <td className="px-4 py-3">{r.displayName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{r.tokenCost}토큰</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                      {r.isActive ? "active" : "off"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.memo || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setEditRule(r)} className="text-blue-600 hover:underline text-xs">수정</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 변경 이력 탭 */}
      {tab === "audit" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">변경 이력 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시각</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">액션</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">대상</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-2 text-xs font-mono">{log.action}</td>
                    <td className="px-4 py-2 text-xs">{log.target_type}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{log.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 모달들 */}
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); void load(); }}
        />
      )}
      {editRule && (
        <EditRuleModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={() => { setEditRule(null); void load(); }}
        />
      )}
      {editBase && activeVer && (
        <EditBaseModal
          activeVer={activeVer}
          onClose={() => setEditBase(false)}
          onSaved={() => { setEditBase(false); void load(); }}
        />
      )}
    </div>
  );
}

// ─── 상품 수정 모달 ─────────────────────────────────
function EditProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(product.displayName);
  const [amountKrw, setAmountKrw] = useState(product.amountKrw);
  const [tokenAmount, setTokenAmount] = useState(product.tokenAmount);
  const [bonusTokenAmount, setBonusTokenAmount] = useState(product.bonusTokenAmount);
  const [isPopular, setIsPopular] = useState(product.isPopular);
  const [isVisible, setIsVisible] = useState(product.isVisible);
  const [isActive, setIsActive] = useState(product.isActive);
  const [sortOrder, setSortOrder] = useState(product.sortOrder);
  const [changeReason, setChangeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const total = (tokenAmount || 0) + (bonusTokenAmount || 0);
  const unitPrice = total > 0 ? Math.round(amountKrw / total) : 0;

  const save = async () => {
    if (!changeReason.trim()) {
      toast({ type: "error", title: "사유 필요", message: "변경 사유를 입력하세요" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing/products/${product.productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}` },
        body: JSON.stringify({
          displayName, amountKrw, tokenAmount, bonusTokenAmount,
          isPopular, isVisible, isActive, sortOrder, changeReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ type: "success", title: "저장 완료", message: product.productId });
        onSaved();
      } else {
        toast({ type: "error", title: "실패", message: data.hint || data.error });
      }
    } finally {
      setBusy(false);
    }
  };

  const isTokenPack = product.productType === "token_pack" || product.productType === "ai_credit_pack";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{product.productId}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{product.productType}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">표시명</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">판매가 (원)</label>
              <input type="number" min={100} value={amountKrw} onChange={(e) => setAmountKrw(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">정렬 순서</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          {isTokenPack && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">기본 토큰</label>
                <input type="number" min={0} value={tokenAmount} onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">보너스 토큰</label>
                <input type="number" min={0} value={bonusTokenAmount} onChange={(e) => setBonusTokenAmount(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          )}
          {isTokenPack && total > 0 && (
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
              총 지급: <span className="font-bold">{total}토큰</span> · 실질 단가: <span className="font-bold">{unitPrice.toLocaleString()}원/T</span>
            </div>
          )}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> 활성</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} /> 노출</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} /> 인기</label>
          </div>
          <div>
            <label className="text-xs text-gray-600">변경 사유 (필수)</label>
            <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} placeholder="예: 가격 인상 (2026-Q3 정책)" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 mt-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>가격 변경은 새 checkout부터 적용. 기존 결제/토큰/PDF 발급권은 영향 없음.</span>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 border rounded-lg text-sm">취소</button>
          <button onClick={save} disabled={busy || !changeReason.trim()} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm disabled:bg-gray-300 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 사용 규칙 수정 모달 ────────────────────────────
function EditRuleModal({ rule, onClose, onSaved }: { rule: ConsumptionRule; onClose: () => void; onSaved: () => void }) {
  const [tokenCost, setTokenCost] = useState(rule.tokenCost);
  const [isActive, setIsActive] = useState(rule.isActive);
  const [memo, setMemo] = useState(rule.memo || "");
  const [changeReason, setChangeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!changeReason.trim()) {
      toast({ type: "error", title: "사유 필요", message: "변경 사유 입력" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing/consumption-rules/${rule.ruleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}` },
        body: JSON.stringify({ tokenCost, isActive, memo, changeReason }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ type: "success", title: "저장 완료", message: rule.ruleKey });
        onSaved();
      } else {
        toast({ type: "error", title: "실패", message: data.hint || data.error });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">사용 규칙 수정</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{rule.ruleKey}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">소모 토큰</label>
            <input type="number" min={0} value={tokenCost} onChange={(e) => setTokenCost(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> 활성</label>
          <div>
            <label className="text-xs text-gray-600">메모</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">변경 사유 (필수)</label>
            <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 border rounded-lg text-sm">취소</button>
          <button onClick={save} disabled={busy || !changeReason.trim()} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm disabled:bg-gray-300 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 기준값 수정 모달 ───────────────────────────────
function EditBaseModal({ activeVer, onClose, onSaved }: { activeVer: ActiveVersion; onClose: () => void; onSaved: () => void }) {
  const [base, setBase] = useState(activeVer.baseTokenUnitPriceKrw);
  const [signupBonus, setSignupBonus] = useState(activeVer.signupBonusTokens);
  const [imgCost, setImgCost] = useState(activeVer.imageGenerationTokenCost);
  const [pdfPrice, setPdfPrice] = useState(activeVer.pdfSinglePriceKrw);
  const [applyMode, setApplyMode] = useState<"base_only" | "auto_recalculate_packages">("base_only");
  const [changeReason, setChangeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!changeReason.trim()) {
      toast({ type: "error", title: "사유 필요", message: "변경 사유 입력" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pricing/base", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}` },
        body: JSON.stringify({
          baseTokenUnitPriceKrw: base,
          signupBonusTokens: signupBonus,
          imageGenerationTokenCost: imgCost,
          pdfSinglePriceKrw: pdfPrice,
          applyMode,
          changeReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ type: "success", title: "저장 완료", message: data.packagesRecalculated > 0 ? `패키지 ${data.packagesRecalculated}개 재계산` : "" });
        onSaved();
      } else {
        toast({ type: "error", title: "실패", message: data.hint || data.error });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold">기준 가격 수정</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">기준 토큰 단가 (원)</label>
            <input type="number" min={1} value={base} onChange={(e) => setBase(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">회원가입 보너스 토큰</label>
            <input type="number" min={0} value={signupBonus} onChange={(e) => setSignupBonus(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">이미지 1장 소모 토큰</label>
            <input type="number" min={0} value={imgCost} onChange={(e) => setImgCost(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">PDF 발급권 가격 (원)</label>
            <input type="number" min={0} value={pdfPrice} onChange={(e) => setPdfPrice(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">반영 방식</label>
            <select value={applyMode} onChange={(e) => setApplyMode(e.target.value as typeof applyMode)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="base_only">기준 단가만 변경 (패키지 가격 그대로)</option>
              <option value="auto_recalculate_packages">패키지 자동 재계산 (token_amount × 기준단가)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">변경 사유 (필수)</label>
            <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 mt-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>새 가격은 새 checkout부터만 적용. 과거 결제/토큰/PDF 영향 없음.</span>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 border rounded-lg text-sm">취소</button>
          <button onClick={save} disabled={busy || !changeReason.trim()} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm disabled:bg-gray-300 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}저장
          </button>
        </div>
      </div>
    </div>
  );
}
