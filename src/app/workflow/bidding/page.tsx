/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileCheck2,
  Calendar,
  Paperclip,
  Hexagon,
  Check,
  Shield,
  AlertTriangle,
  MapPin,
  FileText,
  Loader2,
} from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { getOrCreateWorkflowProjectId } from "@/lib/inpick/estimate-context/client";
import type { Step1Data } from "@/components/workflow/Step1Cards";
import type { Step2Data } from "@/components/workflow/Step2Designer";

const REQUIRED_CONDITIONS = [
  {
    id: "biz_address",
    title: "사업자등록증 사업장 주소지 확인",
    desc: "페이퍼 업체 차단을 위해 사업장 실주소를 확인합니다.",
  },
  {
    id: "std_contract",
    title: "실내건축 표준계약서 시행 동의",
    desc: "국토부 고시 표준계약서 시행에 동의해야 합니다.",
  },
  {
    id: "fair_bid",
    title: "공정한 경쟁 입찰 시행 동의",
    desc: "입찰 기간 동안 사업자에게 가격 공개·비교를 허용합니다.",
  },
];

const PERIOD_OPTIONS = [
  { v: 3, label: "3일" },
  { v: 7, label: "7일", recommended: true },
  { v: 14, label: "14일" },
  { v: 21, label: "21일" },
];

const DRAWING_OPTIONS = [
  { id: "elev4", label: "실별 4면 입면도", cost: 5 },
  { id: "render", label: "입면 렌더링 도면", cost: 8 },
  { id: "ceil", label: "천장 평면도", cost: 3 },
  { id: "section", label: "상세 단면도", cost: 4 },
  { id: "schedule", label: "공정표 + 일정표", cost: 2 },
  { id: "spec", label: "자재 사양서", cost: 3 },
];

const AUTO_ATTACHMENTS = [
  "실내건축 표준계약서 (국토부 고시)",
  "부위별 요구조건 명세서",
  "AI 디자인 렌더 이미지",
  "상세 견적서 (한국물가협회 단가 기준)",
  "2D 평면도 + 치수",
];

export default function BiddingPage() {
  const router = useRouter();
  const { balance } = useTokens();

  const [step1, setStep1] = useState<Step1Data | null>(null);
  const [step2, setStep2] = useState<Step2Data | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [period, setPeriod] = useState<number>(7);
  const [pickedOpts, setPickedOpts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s1 = sessionStorage.getItem("workflow_step1");
      const s2 = sessionStorage.getItem("workflow_step2");
      if (s1) setStep1(JSON.parse(s1));
      if (s2) setStep2(JSON.parse(s2));
    } catch {
      /* ignore */
    }
  }, []);

  const region = useMemo(() => {
    const ra = step1?.basicInfo.selectedAddress?.roadAddress || "";
    // 도로명 주소에서 시·도 + 시·군·구 추출
    const parts = ra.split(" ");
    const sido = parts[0] || "—";
    const gugun = parts[1] || "—";
    return { sido, gugun, fullAddress: ra };
  }, [step1]);

  const allRequired = REQUIRED_CONDITIONS.every((c) => accepted[c.id]);
  const optionTokenCost = useMemo(
    () =>
      pickedOpts.reduce((s, id) => {
        const opt = DRAWING_OPTIONS.find((o) => o.id === id);
        return s + (opt?.cost ?? 0);
      }, 0),
    [pickedOpts],
  );

  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const postedDate = fmt(today);
  const deadlineDate = fmt(new Date(today.getTime() + period * 86400000));
  const selectionDate = fmt(new Date(today.getTime() + (period + 3) * 86400000));

  // 공고번호 자동 생성 (정부기관 스타일)
  const noticeNo = useMemo(() => {
    const ymd = fmt(today).replace(/-/g, "");
    const seq = Math.floor(Math.random() * 9000 + 1000);
    return `INPICK-${ymd}-${seq}`;
  }, [today]);

  const handlePost = async () => {
    if (!allRequired || posting) return;
    setPosting(true);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "bidding_post",
          JSON.stringify({
            noticeNo,
            period,
            pickedOpts,
            optionTokenCost,
            notes,
            region,
            postedDate,
            deadlineDate,
            selectionDate,
          }),
        );
      }

      // 실제 RFQ 등록 + 지역 사업자 자동 fanout
      // estimateId 대신 안정적인 워크플로우 projectId를 보내 estimates 행을 upsert(2026-07-05 H2).
      const consumerProjectId = getOrCreateWorkflowProjectId();
      let publishOk = false;
      try {
        const res = await fetch("/api/rfq/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consumerProjectId,
            noticeNo,
            region,
            addressText: region.fullAddress,
            deadlineAt: new Date(today.getTime() + period * 86400000).toISOString(),
            budgetWon: (step1?.basicInfo.budget ?? 0) * 10000,
            spaceType: step1?.buildingType === "apartment" ? "주거" : step1?.buildingType === "store" ? "상업" : "주거",
            exclusiveAreaM2: step1?.basicInfo.selectedPyeong?.exclusiveArea,
          }),
        });
        publishOk = res.ok;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          console.warn("[bidding] rfq publish failed:", d);
        }
      } catch (e) {
        console.warn("[bidding] rfq publish error:", e);
      }
      if (!publishOk) {
        alert("공고 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      // 마이페이지 계약 진행으로 이동 (입찰 비교)
      router.push("/mypage/contracts/progress");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F6FA] text-zinc-900 font-sans">
      {/* 정부기관 스타일 상단 바 */}
      <div className="bg-[#1B3556] text-white">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between text-[0.7rem]">
          <span className="opacity-80">대한민국 인테리어 표준 입찰 시스템</span>
          <span className="tabular opacity-70">{postedDate}</span>
        </div>
      </div>

      <header className="bg-white border-b-2 border-[#1B3556]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow/estimate")}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="이전"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#1B3556]" />
              <span className="text-lg font-extrabold tracking-tight text-zinc-900">
                In<span className="text-primary-500">Pick</span>
                <span className="ml-2 text-[0.7rem] font-bold tracking-widest text-zinc-500 uppercase">
                  표준 입찰 공고
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-[0.78rem] font-bold tabular text-zinc-700">
              <Hexagon className="h-3 w-3 fill-amber-500 text-amber-500" />
              {balance}
            </span>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-8">
        {/* 공고 헤더 */}
        <div className="bg-white border border-zinc-300 shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#1B3556] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-white">
                  STEP 05
                </span>
                <span className="text-[0.7rem] font-bold uppercase tracking-widest text-zinc-500">
                  경쟁 입찰 공고 등록
                </span>
              </div>
              <span className="font-mono text-[0.78rem] tabular text-zinc-700">
                공고번호 · {noticeNo}
              </span>
            </div>
            <h1 className="mt-3 text-[1.6rem] font-extrabold tracking-tight text-zinc-900">
              {step1?.basicInfo.selectedAddress?.buildingName ||
                step1?.basicInfo.selectedPyeong?.pyeongName ||
                "InPick"}{" "}
              실내건축 시공 입찰
            </h1>
            <p className="mt-1 text-[0.78rem] text-zinc-600">
              지역별 사업자에게 자동 노출되어 공정한 가격으로 경쟁 입찰됩니다.
            </p>
          </div>

          {/* 공고 메타 — 정부기관 표 스타일 */}
          <table className="w-full text-[0.85rem] border-b border-zinc-200">
            <tbody>
              <MetaRow label="입찰 지역" icon={MapPin}>
                <span className="font-bold text-[#1B3556]">
                  {region.sido} &gt; {region.gugun}
                </span>
                <span className="ml-2 text-zinc-500">{region.fullAddress}</span>
              </MetaRow>
              <MetaRow label="입찰 대상">
                {step1?.basicInfo.selectedPyeong?.pyeongName} · 전용{" "}
                {step1?.basicInfo.selectedPyeong?.exclusiveArea ?? "—"}㎡
                {step1?.basicInfo.expansionType && (
                  <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-[0.7rem]">
                    {step1.basicInfo.expansionType === "extended" ? "확장형" : "기본형"}
                  </span>
                )}
              </MetaRow>
              <MetaRow label="목표 예산">
                <span className="font-bold tabular">
                  ₩ {((step1?.basicInfo.budget ?? 0) * 10000).toLocaleString()}
                </span>
              </MetaRow>
              <MetaRow label="공고 일시" icon={Calendar}>
                <span className="tabular">{postedDate}</span>
              </MetaRow>
              <MetaRow label="입찰 마감">
                <span className="tabular font-bold text-red-600">
                  {deadlineDate}
                </span>
                <span className="ml-2 text-[0.78rem] text-zinc-500">
                  ({period}일 후)
                </span>
              </MetaRow>
              <MetaRow label="낙찰 발표 예정">
                <span className="tabular">{selectionDate}</span>
              </MetaRow>
              <MetaRow label="첨부 자료" icon={Paperclip}>
                <ul className="space-y-0.5">
                  {AUTO_ATTACHMENTS.map((a) => (
                    <li key={a} className="text-[0.78rem] text-zinc-700">
                      · {a}
                    </li>
                  ))}
                </ul>
              </MetaRow>
            </tbody>
          </table>
        </div>

        {/* 입찰 기간 선택 */}
        <div className="mt-5 bg-white border border-zinc-300">
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              ① 입찰 진행 기간 선택
            </h2>
          </div>
          <div className="px-6 py-5 flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriod(p.v)}
                className={`relative rounded border px-4 py-2 text-sm font-bold transition-colors ${
                  period === p.v
                    ? "border-[#1B3556] bg-[#1B3556] text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {p.label}
                {p.recommended && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-amber-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                    추천
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 도면 옵션 */}
        <div className="mt-5 bg-white border border-zinc-300">
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              ② 추가 도면 옵션 (선택)
            </h2>
            {pickedOpts.length > 0 && (
              <span className="text-[0.78rem] tabular font-bold text-[#1B3556]">
                ⬢ {optionTokenCost} 토큰
              </span>
            )}
          </div>
          <div className="px-6 py-5 grid grid-cols-2 lg:grid-cols-3 gap-2">
            {DRAWING_OPTIONS.map((o) => {
              const sel = pickedOpts.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() =>
                    setPickedOpts((prev) =>
                      prev.includes(o.id)
                        ? prev.filter((x) => x !== o.id)
                        : [...prev, o.id],
                    )
                  }
                  className={`flex items-center justify-between rounded border px-3 py-2 text-sm transition-colors ${
                    sel
                      ? "border-[#1B3556] bg-[#1B3556]/5 text-[#1B3556]"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <span className={sel ? "font-bold" : "font-medium"}>{o.label}</span>
                  <span className="inline-flex items-center gap-0.5 text-[0.7rem] tabular text-amber-700">
                    <Hexagon className="h-2.5 w-2.5 fill-amber-500" />
                    {o.cost}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 추가 요청사항 */}
        <div className="mt-5 bg-white border border-zinc-300">
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              ③ 추가 요청사항 (선택)
            </h2>
          </div>
          <div className="px-6 py-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="예) 평일 오후 시공 필수 / 펫 알러지 자재 회피 / 친환경 마감 우선"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1B3556]"
            />
          </div>
        </div>

        {/* 필수 동의 */}
        <div className="mt-5 bg-white border border-zinc-300">
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900">
              ④ 필수 시행 동의
            </h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {REQUIRED_CONDITIONS.map((c) => {
              const isAccepted = accepted[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setAccepted((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                  }
                  className={`flex w-full items-start gap-3 text-left rounded border px-4 py-3 transition-colors ${
                    isAccepted
                      ? "border-[#1B3556] bg-[#1B3556]/5"
                      : "border-zinc-300 bg-white hover:border-zinc-400"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded border-2 ${
                      isAccepted
                        ? "border-[#1B3556] bg-[#1B3556] text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {isAccepted && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold ${
                        isAccepted ? "text-[#1B3556]" : "text-zinc-900"
                      }`}
                    >
                      {c.title}
                    </p>
                    <p className="mt-1 text-[0.78rem] text-zinc-600 leading-relaxed">
                      {c.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 등록 버튼 */}
        <div className="mt-6 bg-white border border-zinc-300 px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-start gap-2 text-[0.78rem] text-zinc-600">
            {!allRequired ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>모든 필수 시행 동의를 완료해야 입찰 공고를 등록할 수 있습니다.</span>
              </>
            ) : (
              <>
                <FileCheck2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  공고 등록 즉시 <b>{region.gugun}</b> 지역 사업자 풀에 노출됩니다. 마감일까지 입찰 가능.
                </span>
              </>
            )}
          </div>
          <button
            onClick={handlePost}
            disabled={!allRequired || posting}
            className={`inline-flex items-center gap-2 rounded px-6 py-3 text-sm font-bold transition-all ${
              !allRequired || posting
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-[#1B3556] text-white hover:bg-[#2a4870]"
            }`}
          >
            {posting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                공고 등록 중…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                경쟁 입찰 공고 등록
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <div className="mt-4 px-6 py-3 bg-zinc-100 border border-zinc-200 text-[0.7rem] text-zinc-500 text-center">
          본 공고는 <b>대한민국 실내건축 표준계약서</b>(국토교통부 고시) 시행을 전제로 등록됩니다.
          허위 공고·페이퍼 사업자는 InPick 서비스 이용 제한 및 관계 법령에 따라 처벌받을 수 있습니다.
        </div>

        {/* Step2 시안 미리보기 */}
        {step2 && Object.keys(step2.rendersByRoom || {}).length > 0 && (
          <div className="mt-6 bg-white border border-zinc-300">
            <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
              <h2 className="text-sm font-bold tracking-tight text-zinc-900">
                첨부 — AI 디자인 렌더 (자동 첨부됨)
              </h2>
            </div>
            <div className="px-6 py-4 grid grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(step2.rendersByRoom).map(([roomKey, items]) => {
                const idx = step2.selectedByRoom?.[roomKey];
                const sel = idx != null ? items[idx] : items[items.length - 1];
                if (!sel) return null;
                return (
                  <div
                    key={roomKey}
                    className="relative aspect-square overflow-hidden rounded border border-zinc-200"
                  >
                    <img
                      src={sel.refinedUrl || sel.url}
                      alt={roomKey}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[0.6rem] font-bold p-1 text-center">
                      {roomKey}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-200 bg-white py-4">
        <div className="max-w-6xl mx-auto px-6 text-center text-[0.7rem] text-zinc-500">
          ⓒ 주식회사 아이오드 · 사업자등록번호 384-81-04107 · 대전광역시
        </div>
      </footer>
    </main>
  );
}

function MetaRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-zinc-200 last:border-0">
      <td className="w-40 bg-zinc-50/50 px-6 py-3 text-[0.78rem] font-bold uppercase tracking-widest text-zinc-600 align-top">
        <span className="inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </span>
      </td>
      <td className="px-6 py-3 text-zinc-900 align-top">{children}</td>
    </tr>
  );
}
