/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  EyeOff,
  FileText,
  Hexagon,
  Loader2,
  MapPin,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import {
  fetchWorkflowState,
  getOrCreateWorkflowProjectId,
} from "@/lib/inpick/estimate-context/client";
import type { Step1Data } from "@/components/workflow/Step1Cards";
import type { Step2Data } from "@/components/workflow/Step2Designer";

const PERIOD_OPTIONS = [
  { value: 3, label: "3일" },
  { value: 7, label: "7일", note: "추천" },
  { value: 14, label: "14일" },
  { value: 21, label: "21일" },
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
  "선택한 AI 디자인 렌더",
  "2D 평면도와 공간 정보",
  "부위별 자재 요구조건",
  "인픽 기준 견적 총괄표",
  "공정거래위원회 표준계약서 안내",
];

const REQUIRED_CONDITIONS = [
  {
    id: "verified_only",
    title: "검증된 사업자에게만 공고 전달",
    description: "활성 상태, 사업자 정보, 지역, 평점과 시공 실적을 기준으로 매칭합니다.",
  },
  {
    id: "standard_contract",
    title: "표준 계약서 사용",
    description: "업체 선정 후 공정거래위원회 표준계약서 기준으로 계약 단계를 진행합니다.",
  },
  {
    id: "fair_compare",
    title: "동일 조건으로 입찰 비교",
    description: "총액뿐 아니라 포함 공사, 자재, 일정, 보증 조건을 같은 형식으로 비교합니다.",
  },
];

const FLOW = ["공고 작성", "검증 업체 매칭", "입찰 비교", "업체 선정"];

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function BiddingPage() {
  const router = useRouter();
  const { balance } = useTokens();
  const [step1, setStep1] = useState<Step1Data | null>(null);
  const [step2, setStep2] = useState<Step2Data | null>(null);
  const [period, setPeriod] = useState(7);
  const [shortlistSize, setShortlistSize] = useState<3 | 5>(3);
  const [preferredStart, setPreferredStart] = useState("1개월 이내");
  const [visitPreference, setVisitPreference] = useState("현장 방문 가능");
  const [pickedOptions, setPickedOptions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [noticeNo, setNoticeNo] = useState("INPICK-RFQ");
  const [today] = useState(() => new Date());

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const projectId = getOrCreateWorkflowProjectId();
    setNoticeNo(`INPICK-${formatDate(new Date()).replaceAll("-", "")}-${projectId?.slice(-6).toUpperCase() || "RFQ"}`);
    try {
      const savedStep1 = sessionStorage.getItem("workflow_step1");
      const savedStep2 = sessionStorage.getItem("workflow_step2");
      if (savedStep1) setStep1(JSON.parse(savedStep1));
      if (savedStep2) setStep2(JSON.parse(savedStep2));
      if (savedStep1) return;
    } catch {
      // DB 복원으로 계속 진행
    }
    if (!projectId) return;
    void fetchWorkflowState(projectId)
      .then((row) => {
        if (cancelled || !row?.exists || !row.workflowState) return;
        if (row.workflowState.step1) setStep1(row.workflowState.step1 as unknown as Step1Data);
        if (row.workflowState.step2) setStep2(row.workflowState.step2 as unknown as Step2Data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const region = useMemo(() => {
    const fullAddress = step1?.basicInfo.selectedAddress?.roadAddress || "";
    const parts = fullAddress.split(" ").filter(Boolean);
    return {
      sido: parts[0] || "지역 미확인",
      gugun: parts[1] || "",
      fullAddress,
    };
  }, [step1]);

  const optionTokenCost = useMemo(
    () =>
      pickedOptions.reduce(
        (total, id) => total + (DRAWING_OPTIONS.find((option) => option.id === id)?.cost || 0),
        0,
      ),
    [pickedOptions],
  );
  const allRequired = REQUIRED_CONDITIONS.every((condition) => accepted[condition.id]);
  const hasEnoughTokens = optionTokenCost <= balance;
  const deadlineDate = formatDate(new Date(today.getTime() + period * 86_400_000));
  const selectionDate = formatDate(new Date(today.getTime() + (period + 3) * 86_400_000));
  const budgetWon = (step1?.basicInfo.budget || 0) * 10_000;

  const selectedRenders = useMemo(() => {
    if (!step2?.rendersByRoom) return [];
    return Object.entries(step2.rendersByRoom).flatMap(([roomKey, items]) => {
      const selectedIndex = step2.selectedByRoom?.[roomKey];
      const selected = selectedIndex != null ? items[selectedIndex] : items[items.length - 1];
      return selected ? [{ roomKey, url: selected.refinedUrl || selected.url }] : [];
    });
  }, [step2]);

  const handlePost = async () => {
    if (!allRequired || !hasEnoughTokens || posting) return;
    setPosting(true);
    try {
      const consumerProjectId = getOrCreateWorkflowProjectId();
      const payload = {
        consumerProjectId,
        noticeNo,
        region,
        addressText: region.fullAddress,
        deadlineAt: new Date(today.getTime() + period * 86_400_000).toISOString(),
        budgetWon,
        spaceType:
          step1?.buildingType === "store"
            ? "상업"
            : "주거",
        exclusiveAreaM2: step1?.basicInfo.selectedPyeong?.exclusiveArea,
        shortlistSize,
        preferredStart,
        visitPreference,
        notes,
        drawingOptions: pickedOptions,
      };
      const response = await fetch("/api/rfq/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(result.error || "공고 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      sessionStorage.setItem(
        "bidding_post",
        JSON.stringify({
          ...payload,
          period,
          optionTokenCost,
          postedDate: formatDate(today),
          deadlineDate,
          selectionDate,
          matchedContractors: result.fanoutCount || 0,
        }),
      );
      router.push("/mypage/contracts/progress");
    } catch (error) {
      console.warn("[bidding] publish failed:", error);
      alert("공고 등록에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      <header className="sticky top-0 z-30 bg-[#f7f7f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/workflow/estimate")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white transition hover:bg-black hover:text-white"
              aria-label="견적 페이지로 돌아가기"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Hexagon className="h-5 w-5 fill-[#f15b4a] text-[#f15b4a]" />
              <span className="text-base font-black tracking-tight">InPick</span>
              <span className="hidden text-xs text-black/45 sm:inline">입찰 공고</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-bold">
            <Hexagon className="h-3 w-3 fill-black text-black" />
            <span className="tabular-nums">{balance}</span>
            <span className="text-black/45">토큰</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-black/45">MATCH & COMPARE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            잘 맞는 업체에게만<br className="hidden sm:block" /> 공사를 제안하세요
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/55 sm:text-base">
            프로젝트 정보를 한 번 확인하면 인픽이 지역, 인증, 평점과 시공 실적을 기준으로 업체를 추려 같은 조건의 입찰을 받습니다.
          </p>
        </section>

        <section className="mt-8 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white px-4 py-5 sm:px-6">
          <div className="grid grid-cols-4 gap-2">
            {FLOW.map((label, index) => (
              <div key={label} className="relative text-center">
                {index < FLOW.length - 1 && (
                  <span className="absolute left-[55%] top-3 h-px w-[90%] bg-black/10" />
                )}
                <span
                  className={`relative mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.68rem] font-bold ${
                    index === 0 ? "bg-black text-white" : "border border-black/15 bg-white text-black/40"
                  }`}
                >
                  {index + 1}
                </span>
                <p className={`mt-2 text-[0.62rem] font-semibold sm:text-xs ${index === 0 ? "text-black" : "text-black/40"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <SectionCard number="01" title="프로젝트 브리프" description="워크플로우에서 만든 정보를 확인합니다.">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem icon={<MapPin className="h-4 w-4" />} label="공사 지역" value={`${region.sido} ${region.gugun}`.trim()} />
                <InfoItem
                  icon={<FileText className="h-4 w-4" />}
                  label="공간"
                  value={`${step1?.basicInfo.selectedPyeong?.pyeongName || "평형 미확인"} · 전용 ${step1?.basicInfo.selectedPyeong?.exclusiveArea || "—"}㎡`}
                />
                <InfoItem
                  icon={<Sparkles className="h-4 w-4" />}
                  label="형태"
                  value={step1?.basicInfo.expansionType === "extended" ? "확장형" : "기본형"}
                />
                <InfoItem
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="목표 예산"
                  value={budgetWon > 0 ? `${budgetWon.toLocaleString()}원` : "협의"}
                />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#f7f7f5] px-4 py-3">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-black/55" />
                <p className="text-xs leading-5 text-black/55">
                  초기 업체 알림에는 시·군·구, 면적, 예산과 공사 조건만 전달됩니다. 상세 주소는 현장 방문을 합의한 업체에게 공개합니다.
                </p>
              </div>
            </SectionCard>

            <SectionCard number="02" title="매칭 방식" description="검토할 업체 수와 일정을 정합니다.">
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceGroup label="입찰 받을 업체 수">
                  <ChoiceButton selected={shortlistSize === 3} onClick={() => setShortlistSize(3)} label="3개 업체" note="추천" />
                  <ChoiceButton selected={shortlistSize === 5} onClick={() => setShortlistSize(5)} label="5개 업체" />
                </ChoiceGroup>
                <ChoiceGroup label="입찰 진행 기간">
                  {PERIOD_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      selected={period === option.value}
                      onClick={() => setPeriod(option.value)}
                      label={option.label}
                      note={option.note}
                    />
                  ))}
                </ChoiceGroup>
                <ChoiceGroup label="공사 시작 희망">
                  {["2주 이내", "1개월 이내", "일정 협의"].map((value) => (
                    <ChoiceButton key={value} selected={preferredStart === value} onClick={() => setPreferredStart(value)} label={value} />
                  ))}
                </ChoiceGroup>
                <ChoiceGroup label="상담 방식">
                  {["현장 방문 가능", "영상·전화 우선", "모두 가능"].map((value) => (
                    <ChoiceButton key={value} selected={visitPreference === value} onClick={() => setVisitPreference(value)} label={value} />
                  ))}
                </ChoiceGroup>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  [ShieldCheck, "사업자 확인", "활성·인증 정보"],
                  [Star, "품질 순위", "평점·완료 실적"],
                  [Users, "지역 적합도", "시공 가능 지역"],
                ].map(([Icon, title, detail]) => {
                  const MatchIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(title)} className="rounded-2xl border border-black/[0.07] px-3 py-3">
                      <MatchIcon className="h-4 w-4" />
                      <p className="mt-2 text-xs font-bold">{String(title)}</p>
                      <p className="mt-0.5 text-[0.68rem] text-black/45">{String(detail)}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard number="03" title="추가 자료" description="필요한 도면만 선택합니다. 기본 자료는 자동 첨부됩니다.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DRAWING_OPTIONS.map((option) => {
                  const selected = pickedOptions.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setPickedOptions((current) =>
                          current.includes(option.id)
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id],
                        )
                      }
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selected ? "border-black bg-black text-white" : "border-black/[0.08] bg-white hover:border-black/25"
                      }`}
                    >
                      <span className="block text-xs font-bold">{option.label}</span>
                      <span className={`mt-1 block text-[0.68rem] ${selected ? "text-white/60" : "text-black/40"}`}>
                        {option.cost}토큰
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl bg-[#f7f7f5] p-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  <p className="text-xs font-bold">자동 첨부 자료</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {AUTO_ATTACHMENTS.map((attachment) => (
                    <p key={attachment} className="flex items-center gap-2 text-xs text-black/55">
                      <Check className="h-3 w-3" /> {attachment}
                    </p>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard number="04" title="업체에게 전할 내용" description="견적에 꼭 반영할 조건을 적어주세요.">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="예: 반려동물이 있어 친환경 마감재를 우선하고, 평일 오후 공사를 희망합니다."
                className="w-full resize-none rounded-2xl border border-black/[0.09] bg-[#f7f7f5] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:bg-white"
              />
            </SectionCard>

            {selectedRenders.length > 0 && (
              <SectionCard number="05" title="디자인 시안" description="선택한 렌더가 공고에 함께 전달됩니다.">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedRenders.slice(0, 6).map((render) => (
                    <div key={render.roomKey} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#ececea]">
                      <img src={render.url} alt={render.roomKey} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                      <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[0.65rem] font-bold backdrop-blur">
                        {render.roomKey}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard number={selectedRenders.length > 0 ? "06" : "05"} title="등록 전 확인" description="세 조건을 확인하면 공고를 등록할 수 있습니다.">
              <div className="space-y-2">
                {REQUIRED_CONDITIONS.map((condition) => {
                  const selected = Boolean(accepted[condition.id]);
                  return (
                    <button
                      key={condition.id}
                      type="button"
                      onClick={() => setAccepted((current) => ({ ...current, [condition.id]: !selected }))}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        selected ? "border-black bg-black text-white" : "border-black/[0.08] bg-white hover:border-black/25"
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-white bg-white text-black" : "border-black/20"}`}>
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{condition.title}</span>
                        <span className={`mt-1 block text-xs leading-5 ${selected ? "text-white/60" : "text-black/50"}`}>
                          {condition.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[26px] border border-black/[0.07] bg-white p-5 shadow-[0_16px_50px_rgba(0,0,0,0.05)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-black/40">PROJECT REQUEST</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    {step1?.basicInfo.selectedAddress?.buildingName || step1?.basicInfo.selectedPyeong?.pyeongName || "인테리어 프로젝트"}
                  </h2>
                </div>
                <span className="rounded-full bg-[#f7f7f5] px-2.5 py-1 text-[0.62rem] font-semibold text-black/50">작성 중</span>
              </div>
              <div className="mt-5 space-y-3 border-y border-black/[0.07] py-4">
                <SummaryRow label="공고번호" value={noticeNo} />
                <SummaryRow label="매칭 지역" value={`${region.sido} ${region.gugun}`.trim()} />
                <SummaryRow label="검토 업체" value={`${shortlistSize}곳`} />
                <SummaryRow label="입찰 마감" value={deadlineDate} />
                <SummaryRow label="선정 예정" value={selectionDate} />
                <SummaryRow label="추가 자료" value={optionTokenCost > 0 ? `${optionTokenCost}토큰` : "선택 없음"} />
              </div>
              <div className="mt-5 rounded-2xl bg-[#f7f7f5] p-4">
                <div className="flex items-center gap-2">
                  <CircleCheck className="h-4 w-4" />
                  <p className="text-xs font-bold">등록 후 진행</p>
                </div>
                <ol className="mt-3 space-y-2 text-xs leading-5 text-black/55">
                  <li>1. 조건에 맞는 검증 업체를 우선 매칭</li>
                  <li>2. 포함 항목·일정·보증을 같은 형식으로 접수</li>
                  <li>3. 마이페이지에서 입찰을 나란히 비교 후 선정</li>
                </ol>
              </div>
              {!hasEnoughTokens && (
                <p className="mt-3 text-xs font-semibold text-black">추가 자료에 필요한 토큰이 부족합니다.</p>
              )}
              <button
                type="button"
                onClick={handlePost}
                disabled={!allRequired || !hasEnoughTokens || posting}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
              >
                {posting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 검증 업체 매칭 중
                  </>
                ) : (
                  <>
                    공고 등록하고 업체 매칭 <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-[0.66rem] leading-5 text-black/40">
                필수 확인을 완료한 뒤 등록할 수 있습니다.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-black/[0.06] bg-white py-6">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 text-xs text-black/45 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 주식회사 아이오드 · 사업자등록번호 384-81-04107</p>
          <button type="button" onClick={() => router.push("/mypage/contracts/progress")} className="inline-flex items-center gap-1 text-left font-semibold text-black/65 hover:text-black">
            진행 중인 입찰 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </footer>
    </main>
  );
}

function SectionCard({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="mt-0.5 text-xs font-bold text-black/35">{number}</span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-black/45">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.07] p-4">
      <div className="flex items-center gap-2 text-black/45">
        {icon}
        <span className="text-[0.68rem] font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold leading-5">{value}</p>
    </div>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  label,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
        selected ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-black/30"
      }`}
    >
      {label}
      {note && <span className={`ml-1 text-[0.58rem] ${selected ? "text-white/55" : "text-black/35"}`}>{note}</span>}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-black/45">{label}</span>
      <span className="text-right font-bold tabular-nums">{value}</span>
    </div>
  );
}
