/**
 * 사업자 입찰 요율 조정 페이지 (Phase 2 §D-5).
 *
 * 흐름:
 *   1. GET /api/contractor/bids/[bidId]/rates → 현재 저장된 요율
 *   2. 사용자 슬라이더/숫자 입력 변경
 *   3. PUT /api/contractor/bids/[bidId]/rates → 저장 (법정 한도 자동 검증)
 *   4. GET /api/contractor/bids/[bidId]/preview → 실시간 합계 표시
 *
 * 잠금 조건: bid.status !== 'pending' (선정·거절 후 수정 불가)
 */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Save,
  RotateCcw,
  ShieldAlert,
  Info,
  Lock,
} from "lucide-react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import { toast } from "@/components/ui/Toast";
import type { BidIndirectRates } from "@/types/bid-rates";

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;

// 정책 기본값 (UI 표시용 — 실제 저장값은 API 응답)
const POLICY = {
  safetyMin: 0.0311,
  generalMax: 0.06,
  profitMax: 0.25,
};

interface PreviewData {
  directCost: number;
  laborPlusExpense?: number;
  indirectCosts: {
    setupCost: number;
    safetyCost: number;
    generalManagementCost: number;
    profit: number;
    supplyAmount: number;
    vat: number;
    totalAmount: number;
  };
  previewTotal: number;
  bidAmount: number;
}

export default function EditRatesPage() {
  const router = useRouter();
  const params = useParams();
  const bidId = (params?.bidId as string) ?? "";
  const { authChecked, authFetch } = useContractorAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);
  const [bidStatus, setBidStatus] = useState<string>("");
  const [rates, setRates] = useState<BidIndirectRates | null>(null);

  // 편집 중 폼 상태 (저장 전)
  const [form, setForm] = useState({
    elevatorProtection: 350000,
    entranceProtection: 180000,
    scaffolding: 250000,
    wasteDisposal: 480000,
    safetyRate: 0.0311,
    generalManagementRate: 0.05,
    profitRate: 0.10,
    modificationReason: "",
  });

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── 초기 로드 ───
  const loadRates = useCallback(async () => {
    if (!bidId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/contractor/bids/${bidId}/rates`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ type: "error", title: err.error || "요율 조회 실패" });
        setLoading(false);
        return;
      }
      const data = await res.json();
      const r = data.rates as BidIndirectRates;
      setRates(r);
      setEditable(!!data.editable);
      setBidStatus(data.bidStatus || "");
      setForm({
        elevatorProtection: r.setupCosts.elevatorProtection,
        entranceProtection: r.setupCosts.entranceProtection,
        scaffolding: r.setupCosts.scaffolding,
        wasteDisposal: r.setupCosts.wasteDisposal,
        safetyRate: r.rates.safetyRate,
        generalManagementRate: r.rates.generalManagementRate,
        profitRate: r.rates.profitRate,
        modificationReason: r.modificationReason || "",
      });
    } catch (e) {
      console.error(e);
      toast({ type: "error", title: "네트워크 오류" });
    }
    setLoading(false);
  }, [bidId, authFetch]);

  // ─── 미리보기 (저장된 요율 기준) ───
  const loadPreview = useCallback(async () => {
    if (!bidId) return;
    setPreviewLoading(true);
    try {
      const res = await authFetch(`/api/contractor/bids/${bidId}/preview`);
      if (res.ok) {
        const data = (await res.json()) as PreviewData;
        setPreview(data);
      }
    } catch (e) {
      console.error(e);
    }
    setPreviewLoading(false);
  }, [bidId, authFetch]);

  useEffect(() => {
    if (authChecked && bidId) {
      loadRates();
      loadPreview();
    }
  }, [authChecked, bidId, loadRates, loadPreview]);

  // ─── 검증 ───
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (form.safetyRate < POLICY.safetyMin) {
      e.safetyRate = `법정 최저값 ${(POLICY.safetyMin * 100).toFixed(2)}% 이상이어야 합니다`;
    }
    if (form.generalManagementRate < 0 || form.generalManagementRate > POLICY.generalMax) {
      e.generalManagementRate = `0% ~ ${(POLICY.generalMax * 100).toFixed(0)}% 범위 내`;
    }
    if (form.profitRate < 0 || form.profitRate > POLICY.profitMax) {
      e.profitRate = `0% ~ ${(POLICY.profitMax * 100).toFixed(0)}% 범위 내`;
    }
    for (const k of [
      "elevatorProtection",
      "entranceProtection",
      "scaffolding",
      "wasteDisposal",
    ] as const) {
      if (form[k] < 0) e[k] = "음수 불가";
    }
    return e;
  }, [form]);

  const hasError = Object.keys(errors).length > 0;
  const setupTotal =
    form.elevatorProtection +
    form.entranceProtection +
    form.scaffolding +
    form.wasteDisposal;

  // ─── 저장 ───
  const handleSave = async () => {
    if (hasError) {
      toast({ type: "error", title: "입력값을 확인해주세요" });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/contractor/bids/${bidId}/rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elevator_protection: form.elevatorProtection,
          entrance_protection: form.entranceProtection,
          scaffolding: form.scaffolding,
          waste_disposal: form.wasteDisposal,
          safety_rate: form.safetyRate,
          general_management_rate: form.generalManagementRate,
          profit_rate: form.profitRate,
          modification_reason: form.modificationReason || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ type: "error", title: err.message || err.error || "저장 실패" });
      } else {
        toast({ type: "success", title: "요율이 저장되었습니다" });
        await loadRates();
        await loadPreview();
      }
    } catch (e) {
      console.error(e);
      toast({ type: "error", title: "네트워크 오류" });
    }
    setSaving(false);
  };

  // ─── 기본값 복원 ───
  const handleReset = () => {
    setForm({
      elevatorProtection: 350000,
      entranceProtection: 180000,
      scaffolding: 250000,
      wasteDisposal: 480000,
      safetyRate: 0.0311,
      generalManagementRate: 0.05,
      profitRate: 0.10,
      modificationReason: "",
    });
  };

  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!rates) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-center text-gray-500 py-12">요율 정보를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-24">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
            입찰 요율 조정
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            견적번호 · {bidId.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* 잠금 안내 */}
      {!editable && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">이 입찰은 수정 불가 상태입니다</p>
            <p className="text-xs mt-0.5">
              현재 상태: <span className="font-semibold">{bidStatus}</span> · 선정·거절된
              입찰의 요율은 변경할 수 없습니다.
            </p>
          </div>
        </div>
      )}

      {/* ─── 직접공사비 (수정 불가, 참고) ─── */}
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          직접공사비 (수정 불가)
        </h2>
        <div className="space-y-1.5 text-sm tabular">
          <div className="flex justify-between">
            <span className="text-gray-600">자재비 + 노무비</span>
            <span className="font-semibold">
              {preview ? won(preview.directCost) : "—"}
            </span>
          </div>
          <p className="text-[0.65rem] text-gray-500 mt-2">
            ※ 견적 단가 + 표준품셈 기반. 자재 변경 외 직접공사비 수정 불가.
          </p>
        </div>
      </section>

      {/* ─── 가설공사비 (수정 가능) ─── */}
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          가설공사비 (조정 가능)
        </h2>
        <div className="space-y-2.5">
          <SetupRow
            label="엘리베이터 보양"
            value={form.elevatorProtection}
            onChange={(v) => setForm({ ...form, elevatorProtection: v })}
            disabled={!editable}
            error={errors.elevatorProtection}
          />
          <SetupRow
            label="출입구 보양"
            value={form.entranceProtection}
            onChange={(v) => setForm({ ...form, entranceProtection: v })}
            disabled={!editable}
            error={errors.entranceProtection}
          />
          <SetupRow
            label="가설자재"
            value={form.scaffolding}
            onChange={(v) => setForm({ ...form, scaffolding: v })}
            disabled={!editable}
            error={errors.scaffolding}
          />
          <SetupRow
            label="폐기물 처리"
            value={form.wasteDisposal}
            onChange={(v) => setForm({ ...form, wasteDisposal: v })}
            disabled={!editable}
            error={errors.wasteDisposal}
          />
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
          <span>소계</span>
          <span className="tabular">{won(setupTotal)}</span>
        </div>
      </section>

      {/* ─── 간접비 요율 (수정 가능, 한도 검증) ─── */}
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          간접비 요율 (조정 가능, 법정 한도 검증)
        </h2>
        <div className="space-y-3">
          <RateRow
            label="산업안전보건관리비"
            value={form.safetyRate}
            onChange={(v) => setForm({ ...form, safetyRate: v })}
            min={POLICY.safetyMin}
            max={0.10}
            step={0.0001}
            warningText={`⚠️ 법정 최저값 ${(POLICY.safetyMin * 100).toFixed(2)}%, 하향 불가`}
            error={errors.safetyRate}
            disabled={!editable}
          />
          <RateRow
            label="일반관리비"
            value={form.generalManagementRate}
            onChange={(v) => setForm({ ...form, generalManagementRate: v })}
            min={0}
            max={POLICY.generalMax}
            step={0.001}
            warningText={`한도 0% ~ ${(POLICY.generalMax * 100).toFixed(0)}%`}
            error={errors.generalManagementRate}
            disabled={!editable}
          />
          <RateRow
            label="기업이윤"
            value={form.profitRate}
            onChange={(v) => setForm({ ...form, profitRate: v })}
            min={0}
            max={POLICY.profitMax}
            step={0.001}
            warningText={`한도 0% ~ ${(POLICY.profitMax * 100).toFixed(0)}%`}
            error={errors.profitRate}
            disabled={!editable}
          />
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-sm">
            <span className="text-gray-600">부가가치세</span>
            <span className="font-semibold tabular">10% (법정 고정)</span>
          </div>
        </div>
      </section>

      {/* ─── 실시간 미리보기 (저장된 요율 기준) ─── */}
      <section className="mb-5 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <h2 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-1.5">
          <Info className="w-4 h-4" />
          미리보기 (저장된 요율 기준)
        </h2>
        {previewLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
          </div>
        ) : preview ? (
          <div className="space-y-1.5 text-sm tabular">
            <Row label="직접공사비" value={won(preview.directCost)} />
            <Row label="가설공사비" value={won(preview.indirectCosts.setupCost)} />
            <Row
              label="산업안전보건관리비"
              value={won(preview.indirectCosts.safetyCost)}
            />
            <Row
              label="일반관리비"
              value={won(preview.indirectCosts.generalManagementCost)}
            />
            <Row label="기업이윤" value={won(preview.indirectCosts.profit)} />
            <Row
              label="공급가액"
              value={won(preview.indirectCosts.supplyAmount)}
              bold
            />
            <Row label="부가세 (10%)" value={won(preview.indirectCosts.vat)} />
            <div className="flex justify-between pt-2 border-t-2 border-blue-300 mt-2 text-base">
              <span className="font-extrabold text-blue-900">입찰 총액</span>
              <span className="font-extrabold text-blue-700 tabular">
                {won(preview.previewTotal)}
              </span>
            </div>
            {preview.bidAmount !== preview.previewTotal && (
              <p className="text-[0.65rem] text-amber-700 mt-1">
                ⓘ 현재 등록된 입찰 금액 ({won(preview.bidAmount)})과 미리보기 금액이 다릅니다
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500 py-4">미리보기 불가</p>
        )}
      </section>

      {/* ─── 수정 사유 (선택) ─── */}
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-bold text-gray-900 mb-2">
          수정 사유 (선택)
        </label>
        <textarea
          value={form.modificationReason}
          onChange={(e) => setForm({ ...form, modificationReason: e.target.value })}
          disabled={!editable}
          rows={3}
          maxLength={500}
          placeholder="예: 현장 답사 결과 가설자재 추가 필요, 안전 등급 상향 등"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </section>

      {/* 한도 위반 안내 */}
      {hasError && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-bold">법정 한도를 위반한 항목이 있습니다</p>
            <ul className="mt-1 text-xs list-disc list-inside">
              {Object.entries(errors).map(([k, msg]) => (
                <li key={k}>
                  {k}: {msg}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ─── 액션 버튼 ─── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={!editable || saving}
          className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          기본값 복원
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!editable || saving || hasError}
          className="flex-1 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          저장
        </button>
      </div>
    </div>
  );
}

// ──────────────── 서브 컴포넌트 ────────────────

function SetupRow({
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700 flex-1">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            min={0}
            step={10000}
            className={`w-32 rounded-lg border px-2 py-1.5 text-right text-sm tabular outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 ${
              error ? "border-red-400" : "border-gray-300"
            }`}
          />
          <span className="text-xs text-gray-500">원</span>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-0.5 text-right">{error}</p>}
    </div>
  );
}

function RateRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  warningText,
  error,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  warningText: string;
  error?: string;
  disabled?: boolean;
}) {
  const pct = (value * 100).toFixed(2);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700 flex-1">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={pct}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            disabled={disabled}
            min={min * 100}
            max={max * 100}
            step={step * 100}
            className={`w-20 rounded-lg border px-2 py-1.5 text-right text-sm tabular outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 ${
              error ? "border-red-400" : "border-gray-300"
            }`}
          />
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>
      <p className={`text-[0.65rem] mt-0.5 text-right ${error ? "text-red-600" : "text-gray-500"}`}>
        {error || warningText}
      </p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
