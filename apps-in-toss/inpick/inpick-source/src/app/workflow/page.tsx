"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, Camera, Sparkles, X } from "lucide-react";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import Step1Cards, {
  Step1Data,
  type PhotoCommercialBusiness,
  type PhotoResidentialSpace,
  type WorkflowEntry,
} from "@/components/workflow/Step1Cards";
import type { Step2Data } from "@/components/workflow/Step2Designer";
import { useTokens } from "@/hooks/useTokens";
import { useRouter } from "next/navigation";
import LenisProvider from "@/components/landing-v4/LenisProvider";
// P8: workflow 상태 사용자×프로젝트 DB 영속화 + design_outputs 이미지 복원
import {
  clearActiveWorkflowSessionSnapshot,
  fetchDesignOutputs,
  fetchWorkflowState,
  fetchWorkflowProjects,
  getOrCreateWorkflowProjectId,
  isActiveWorkflowProjectId,
  readWorkflowSessionSnapshot,
  resolveWorkflowLastStep,
  resolveWorkflowVisibleStep,
  saveWorkflowSessionSnapshot,
  setWorkflowProjectId,
  saveWorkflowState,
  shouldAdoptLatestWorkflowProject,
  startFreshWorkflowSession,
  lightenWorkflowStep2,
} from "@/lib/inpick/estimate-context/client";
import type { DesignOutput } from "@/lib/inpick/estimate-context/types";

const Step2Designer = dynamic(() => import("@/components/workflow/Step2Designer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-black/[0.06] bg-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-black/55" />
        <p className="mt-3 text-xs font-medium text-black/45">디자인 도구를 여는 중</p>
      </div>
    </div>
  ),
});

// 빠른 진입 모드 — 평수 프리셋
const QUICK_PYEONG_PRESETS = [10, 15, 20, 24, 30, 34, 40, 50];

const TOTAL_STEPS = 3;

function sanitizeRestoredStep1(state: Step1Data): Step1Data {
  // 네트워크 요청 중 저장된 일시 상태를 그대로 복원하면 새로고침 후 영구 로딩에 빠진다.
  // 처리 결과가 없는 경우에만 normalizing을 내려 AddressMode가 요청을 한 번 다시 시작하게 한다.
  if (!state.basicInfo.normalizing || state.basicInfo.cleanedImageUrl) return state;
  return {
    ...state,
    basicInfo: {
      ...state.basicInfo,
      normalizing: false,
      normalizationStartedAt: undefined,
      normalizationWarning: undefined,
    },
  };
}

function mergeDesignOutputs(step2: Step2Data, outputs: DesignOutput[]): Step2Data {
  if (outputs.length === 0) return step2;

  const next: Step2Data = {
    ...step2,
    selectedByRoom: { ...(step2.selectedByRoom || {}) },
    rendersByRoom: { ...(step2.rendersByRoom || {}) },
  };
  const roomKeyMap: Record<string, string> = {
    거실: "living",
    안방: "master",
    주방: "kitchen",
    부엌: "kitchen",
    "욕실1": "bath",
    욕실: "bath",
    "침실1": "bedroom",
    침실: "bedroom",
    현관: "entrance",
    발코니: "balcony",
    드레스룸: "dress",
  };
  let changed = false;

  for (const output of outputs) {
    if (!output.imageUrl) continue;
    const key = roomKeyMap[output.targetName] || output.targetId || "living";
    const existing = next.rendersByRoom[key] || [];
    if (existing.some((render) => render.url === output.imageUrl || render.refinedUrl === output.imageUrl)) {
      continue;
    }
    const cleaned = existing.filter(
      (render) => !render.url?.startsWith("[base64") && !render.refinedUrl?.startsWith("[base64"),
    );
    cleaned.push({
      url: output.imageUrl,
      prompt: output.prompt || "",
      costUsd: 0,
      timestamp: output.createdAt || new Date().toISOString(),
    });
    next.rendersByRoom[key] = cleaned;
    if (next.selectedByRoom[key] == null) next.selectedByRoom[key] = cleaned.length - 1;
    changed = true;
  }

  return changed ? next : step2;
}

export default function WorkflowPage() {
  const router = useRouter();
  const { balance, consume, refresh: refreshTokens } = useTokens();

  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Data>({
    basicInfo: {
      mode: "address",
      budget: 3500,
      expansionType: "basic", // 기본형 자동 선택 (사용자가 변경 가능)
    },
    buildingType: null,
    rooms: [],
  });
  const [step2, setStep2] = useState<Step2Data>({
    selectedByRoom: {},
    generations: {},
    rendersByRoom: {},
    promptByRoom: {},
  });

  const [normalizing, setNormalizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  // 빠른 사진 진입 모달 (다단계: 모드 선택 → 세부 입력 → 평수)
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPyeong, setQuickPyeong] = useState<number>(24);
  const [quickMode, setQuickMode] = useState<WorkflowEntry | null>(null);
  const [quickPhotoSpace, setQuickPhotoSpace] = useState<PhotoResidentialSpace>("apartment");
  const [quickBusiness, setQuickBusiness] = useState<PhotoCommercialBusiness>("cafe");
  const [workflowReady, setWorkflowReady] = useState(false);
  const hydratedRef = useRef(false);
  const autoSaveMountedRef = useRef(false);

  const startQuickPhotoFlow = () => {
    if (!quickMode) return;
    startFreshWorkflowSession();
    const pyeong = Math.max(5, Math.min(500, Math.round(quickPyeong || 24)));
    const exclusiveArea = Math.round(pyeong * 3.3058 * 10) / 10;

    // 모드별 step1 분기 — buildingType은 기존 호환을 위해 매핑
    const buildingType =
      quickMode === "photo_commercial" ? "store" : quickMode === "photo_residential" ? "apartment" : "apartment";

    setStep1({
      basicInfo: {
        mode: "address",
        budget: quickMode === "photo_commercial" ? 5000 : 3500,
        expansionType: "basic",
        selectedPyeong: {
          pyeongNo: -1,
          pyeongName: `${pyeong}평`,
          exclusiveArea,
        },
      },
      buildingType,
      workflowEntry: quickMode,
      photoSpaceType: quickMode === "photo_residential" ? quickPhotoSpace : undefined,
      commercialBusiness: quickMode === "photo_commercial" ? quickBusiness : undefined,
      rooms: [],
    });
    setStep2({
      selectedByRoom: {},
      generations: {},
      rendersByRoom: {},
      promptByRoom: {},
      chatMode: true,
    });
    setQuickOpen(false);
    setQuickMode(null);
    setStep(2);
  };

  // 마운트 시 복원
  //   - 프로젝트별 sessionStorage를 먼저 적용해 같은 탭 재진입은 즉시 표시
  //   - ?projectId= 직접 진입은 해당 프로젝트 DB 복원 전 Step1을 노출하지 않음
  //   - design_outputs은 workflow_state와 병렬 조회하고, 기본 화면을 먼저 연 뒤 보강
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const requestedProjectId = params.get("projectId")?.trim() || "";
      const requestedStep2 = params.get("step") === "2";
      const freshProjectRequested = params.get("new") === "1";
      const previousProjectId = freshProjectRequested
        ? startFreshWorkflowSession()
        : getOrCreateWorkflowProjectId();
      let projectId = requestedProjectId || previousProjectId;

      // 프로젝트 id를 교체하기 전에 프로젝트별 캐시를 읽어야
      // 이전 프로젝트의 글로벌 키를 잘못 채택하지 않는다.
      const cached = projectId ? readWorkflowSessionSnapshot(projectId) : null;
      if (requestedProjectId && requestedProjectId !== previousProjectId) {
        clearActiveWorkflowSessionSnapshot();
        setWorkflowProjectId(requestedProjectId);
      }

      let s1 = cached?.step1
        ? sanitizeRestoredStep1(cached.step1 as Step1Data)
        : null;
      let s2 = (cached?.step2 as Step2Data | undefined) ?? null;
      let lastStep: 1 | 2 = cached?.lastStep === 2 ? 2 : 1;
      const localLastStep = cached && (cached.step1 != null || cached.step2 != null)
        ? cached.lastStep
        : undefined;
      const openedFromCompleteCache = !!s1 && !!s2;

      const applyRestoredState = (ready: boolean) => {
        if (cancelled) return;
        if (s1) setStep1(s1);
        if (s2) setStep2(s2);
        // DB가 lastStep=2여도 step2 본문이 없으면 빈 화면으로 옮기지 않는다.
        setStep(resolveWorkflowVisibleStep({ requestedStep2, lastStep, hasStep2: !!s2 }));
        if (projectId && (s1 || s2)) {
          saveWorkflowSessionSnapshot({
            projectId,
            step1: s1 ?? undefined,
            step2: s2 ? lightenWorkflowStep2(s2) : undefined,
            lastStep,
          });
        }
        hydratedRef.current = true;
        if (ready) setWorkflowReady(true);
      };

      // 완전한 로컬 스냅샷이 있으면 네트워크를 기다리지 않는다.
      // 프로젝트 지정이 없는 새 진입도 Step1을 즉시 연다.
      if (openedFromCompleteCache || (!requestedProjectId && !requestedStep2)) {
        applyRestoredState(true);
      }

      let outputsPromise = projectId
        ? fetchDesignOutputs(projectId)
        : Promise.resolve([] as DesignOutput[]);

      // DB 상태와 렌더 결과를 병렬로 시작한다.
      if (projectId) {
        try {
          let dbRow = await fetchWorkflowState(projectId);
          if (cancelled) return;
          // 계정 복원은 projectId가 없는 일반 진입에서만 수행한다.
          // 명시적으로 선택한 프로젝트를 최신 프로젝트로 바꾸지 않는다.
          // (재로그인 / 스토리지 초기화 / 다른 기기) 계정의 최신 프로젝트를 채택해 그대로 복원.
          if (shouldAdoptLatestWorkflowProject({
            freshProjectRequested,
            requestedProjectId,
            workflowStateExists: Boolean(dbRow?.exists && dbRow.workflowState),
            hasStep2: Boolean(s2),
          })) {
            const projects = await fetchWorkflowProjects();
            if (cancelled) return;
            const latest = projects
              .slice()
              .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
            if (latest?.id && latest.id !== projectId) {
              projectId = latest.id;
              setWorkflowProjectId(projectId);
              dbRow = await fetchWorkflowState(projectId);
              outputsPromise = fetchDesignOutputs(projectId);
              if (cancelled) return;
            }
          }
          if (dbRow?.exists && dbRow.workflowState) {
            const ws = dbRow.workflowState;
            if (!s1 && ws.step1) {
              s1 = sanitizeRestoredStep1(ws.step1 as unknown as Step1Data);
            }
            if (!s2 && ws.step2) s2 = ws.step2 as unknown as Step2Data;
            // 현재 브라우저의 단계 선택이 DB 디바운스 저장보다 최대 1.2초 최신이다.
            // 로컬 스냅샷이 있으면 뒤늦은 DB lastStep이 화면을 자동 이동시키지 못하게 한다.
            lastStep = resolveWorkflowLastStep(localLastStep, ws.lastStep);
          }
        } catch (e) {
          console.warn("[workflow] DB restore fail", e);
        }
      }

      // workflow_state 복원만으로 화면을 먼저 연다.
      if (!openedFromCompleteCache) applyRestoredState(true);

      // 렌더 이미지는 늦게 도착해도 현재 사용자 수정을 덮어쓰지 않고 병합한다.
      if (s2) {
        try {
          const outputs = await outputsPromise;
          if (
            cancelled ||
            outputs.length === 0 ||
            !isActiveWorkflowProjectId(projectId)
          ) return;
          setStep2((current) => mergeDesignOutputs(current, outputs));
        } catch (e) {
          console.warn("[workflow] design_outputs 보강 실패 (non-fatal):", e);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // 디자인 단계에 있는 동안 다음 화면의 JS를 미리 받아 첫 전환을 빠르게 만든다.
  useEffect(() => {
    if (step === 2) router.prefetch("/workflow/estimate");
  }, [router, step]);

  // Step1이 보이는 동안 브라우저가 한가할 때 큰 Step2 번들을 미리 받아
  // "내 공간 꾸미기" 클릭 직후의 메인 스레드 정지를 줄인다.
  useEffect(() => {
    if (!workflowReady || step !== 1) return;
    const preload = () => {
      void import("@/components/workflow/Step2Designer");
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preload, { timeout: 1_200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = setTimeout(preload, 300);
    return () => clearTimeout(timer);
  }, [step, workflowReady]);

  // 변경 시 자동 저장 — sessionStorage 즉시 + DB 디바운스 (P8)
  const dbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // 복원 effect가 마운트 첫 passive-effect에서 state를 교체하는 동안
    // 초기 기본값이 프로젝트 캐시/DB를 덮어쓰지 못하게 첫 자동 저장은 건너뛴다.
    if (!autoSaveMountedRef.current) {
      autoSaveMountedRef.current = true;
      return;
    }
    if (!hydratedRef.current) return;
    const lightStep2 = lightenWorkflowStep2(step2);
    const projectId = getOrCreateWorkflowProjectId();
    if (projectId) {
      saveWorkflowSessionSnapshot({
        projectId,
        step1,
        step2: lightStep2,
        lastStep: step,
      });
    }
    // DB 디바운스 저장 (1.2초)
    if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
    dbSaveTimer.current = setTimeout(() => {
      if (!projectId) return;
      void saveWorkflowState({
        projectId,
        step1: step1 as unknown as Record<string, unknown>,
        step2: lightStep2 as unknown as Record<string, unknown>,
        lastStep: step,
      });
    }, 1200);
    return () => {
      if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
    };
  }, [step1, step2, step]);

  const goNext = async () => {
    const bi = step1.basicInfo;

    // BasicInfoCard에서 이미 정형화 끝났으면 재호출 없이 그대로 복사
    if (bi.normalizedRooms?.length) {
      setStep1((prev) => ({
        ...prev,
        normalizedFloorplan: {
          pyeong: bi.normalizedPyeong || "30평",
          rooms: bi.normalizedRooms!,
          openings: bi.normalizedOpenings || [],
          notes: bi.normalizedNotes || "",
        },
      }));
      setStep(2);
      return;
    }

    // 도면 업로드/LIDAR 모드면 여기서 정형화 호출
    const imageUrl = bi.selectedPyeong?.grandPlanUrl;
    const imageBase64 =
      bi.uploadedFloorplan?.dataUrl?.split(",")[1] || bi.lidarScan?.dataUrl?.split(",")[1];

    if (!imageUrl && !imageBase64) {
      setStep(2);
      return;
    }

    // 주소 모드는 공간 분석을 백그라운드로 유지한다. 완료 여부와 무관하게
    // 면적·형태·원본 참조로 Step2를 열고 분석 요청을 중복 생성하지 않는다.
    if (bi.mode === "address" && imageUrl) {
      if (bi.normalizationWarning) setNormalizeError(bi.normalizationWarning);
      setStep(2);
      return;
    }

    setNormalizing(true);
    setNormalizeError(null);
    try {
      const res = await fetch("/api/inpick/normalize-floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          imageBase64,
          imageMimeType: imageBase64 ? "image/jpeg" : undefined,
          exclusiveAreaM2: bi.selectedPyeong?.exclusiveArea,
          isHandDrawn: bi.uploadedFloorplan?.isHandDrawn,
          skipImageClean: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "정형화 실패");
      setStep1((prev) => ({
        ...prev,
        normalizedFloorplan: {
          pyeong: data.pyeong,
          rooms: data.rooms,
          openings: data.openings,
          notes: data.notes,
        },
      }));
      setStep(2);
    } catch (e) {
      console.error(e);
      setNormalizeError(e instanceof Error ? e.message : String(e));
      setStep(2);
    } finally {
      setNormalizing(false);
    }
  };
  const goPrev = () => setStep(1);
  const goBranch = (finalStep2: Step2Data = step2) => {
    // sessionStorage 저장 실패(Quota/프라이빗 모드)가 네비게이션을 막지 않도록 보호.
    // (step2에 base64 렌더 이미지가 많으면 QuotaExceeded로 throw → 견적요청 클릭이 먹통이 되던 버그)
    if (typeof window !== "undefined") {
      const projectId = getOrCreateWorkflowProjectId();
      if (projectId) {
        saveWorkflowSessionSnapshot({
          projectId,
          step1,
          step2: lightenWorkflowStep2(finalStep2),
          lastStep: 2,
        });
      }
    }
    // context 생성은 견적 화면에서 진행한다. 여기서는 먼저 화면을 전환해 클릭 반응을 즉시 보인다.
    router.push("/workflow/estimate");
  };

  if (!workflowReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="w-full max-w-sm rounded-[28px] border border-black/[0.07] bg-white p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-black/[0.06]" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-r-black border-t-black" />
          </div>
          <p className="mt-4 text-base font-semibold">디자인 작업을 불러오는 중</p>
          <p className="mt-1 text-xs text-black/45">저장된 디자인 화면으로 바로 돌아갑니다.</p>
        </div>
      </main>
    );
  }

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-[#f7f7f5] text-[#0d0d0d]">

        <Notch step={step} total={TOTAL_STEPS} />

        {/* 평면도 정형화 진행 오버레이 */}
        <AnimatePresence>
          {normalizing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                className="rounded-[24px] bg-white p-7 shadow-card-hover max-w-sm w-full mx-6 text-center"
              >
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f7f7f5] text-black">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-black">
                  AI 평면도 정형화 중
                </h3>
                <p className="mt-2 text-sm text-black/70 leading-relaxed">
                  실별 치수·구조·개구부를 자동 추출하고 있습니다.
                  <br />약 10–20초 소요
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 헤더 */}
        <header
          className={`relative z-30 mx-auto flex items-center justify-between ${
            step === 2 ? "max-w-[1600px] px-4 pt-4 lg:px-6 lg:pt-5" : "max-w-[1500px] px-5 pt-4 sm:px-8 lg:px-10 lg:pt-5"
          }`}
        >
          <div className="flex items-center gap-3">
            {step === 2 ? (
              <button
                onClick={goPrev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/65 transition hover:bg-black/[0.035]"
                aria-label="이전 단계"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <a href="/" className="flex items-center gap-2.5">
                <span className="hex-mask h-[22px] w-[22px] text-black" />
                <span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span>
              </a>
            )}
          </div>
          <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
        </header>

        {/* 본문 */}
        <section
          className={`relative z-20 mx-auto ${
            step === 2
              ? "max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5"
              : "max-w-[1500px] px-5 pb-20 pt-16 sm:px-8 lg:px-10 lg:pt-20"
          }`}
        >
          <AnimatePresence initial={false} mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="max-w-3xl">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black">
                    STEP 01
                  </p>
                  <h1 className="mt-3 break-keep text-[32px] font-medium leading-[1.08] tracking-[-0.06em] text-black sm:text-[44px] lg:text-[52px]">
                    어떤 공간을 바꾸고 싶으세요?
                  </h1>
                  <p className="mt-4 max-w-xl text-[13px] leading-6 text-black/48 sm:text-[14px]">
                    주소·도면·사진 중 편한 방법으로 시작하세요. 공간 정보부터 AI 디자인과 견적까지 이어집니다.
                  </p>
                </div>

                <div className="mt-10 lg:mt-12">
                  <Step1Cards
                    value={step1}
                    onChange={setStep1}
                    onNext={goNext}
                    onReset={() => {
                      // BasicInfoData / Step1Data 모든 optional 필드까지 명시적 초기화
                      setStep1({
                        basicInfo: {
                          mode: "address",
                          budget: 3500,
                          expansionType: "basic",
                          selectedAddress: undefined,
                          selectedComplex: undefined,
                          selectedPyeong: undefined,
                          uploadedFloorplan: undefined,
                          lidarScan: undefined,
                          cleanedImageUrl: undefined,
                          dimensionOverlaySvg: undefined,
                          totalWidthMm: undefined,
                          totalDepthMm: undefined,
                          normalizing: false,
                          normalizedRooms: undefined,
                          normalizedOpenings: undefined,
                          normalizedNotes: undefined,
                          normalizedPyeong: undefined,
                        },
                        buildingType: null,
                        rooms: [],
                        floorLevel: undefined,
                        storeUsage: undefined,
                        storeUsageEtc: undefined,
                        normalizedFloorplan: undefined,
                        roomFurnishings: undefined,
                      });
                      setStep2({
                        selectedByRoom: {},
                        generations: {},
                        rendersByRoom: {},
                        promptByRoom: {},
                      });
                      setStep(1);
                      startFreshWorkflowSession();
                      setNormalizeError(null);
                    }}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Step2 — 한 줄 압축 헤더 (큰 여백 제거) */}
                <div className="mb-4 flex flex-wrap items-center gap-3 px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black">
                    STEP 02
                  </p>
                  <span className="text-black/15">·</span>
                  <h1 className="text-[15px] font-semibold tracking-[-0.03em] text-black sm:text-[17px]">
                    공간별 AI 디자인
                  </h1>
                  {normalizeError && (
                    <span className="ml-auto rounded-full border border-black/10 bg-[#f7f7f5] px-2 py-0.5 text-[0.65rem] text-black">
                      ⚠ 공간 분석 보류 — 평형 평균값으로 진행
                    </span>
                  )}
                </div>

                <Step2Designer
                  rooms={step1.rooms}
                  basicInfo={step1.basicInfo}
                  normalizedFloorplan={step1.normalizedFloorplan}
                  roomFurnishings={step1.roomFurnishings}
                  workflowEntry={step1.workflowEntry}
                  photoSpaceType={step1.photoSpaceType}
                  commercialBusiness={step1.commercialBusiness}
                  value={step2}
                  onChange={setStep2}
                  tokenBalance={balance}
                  onConsumeToken={(amount, feature) => consume(amount, feature)}
                  onTokensChanged={refreshTokens}
                  onComplete={goBranch}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 빠른 사진 진입 — 평수 모달 */}
        <AnimatePresence>
          {quickOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setQuickOpen(false)}
                className="fixed inset-0 z-[85] bg-black/55 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed left-1/2 top-1/2 z-[86] w-[calc(100%-2rem)] max-w-md max-h-[92vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-black/10 bg-white p-7 shadow-card-hover"
              >
                <button
                  onClick={() => setQuickOpen(false)}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-black/50 hover:bg-[#f7f7f5] hover:text-black"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-black to-black text-white shadow-cta">
                  <Camera className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-black">
                  {!quickMode ? "어떤 공간이세요?" : "평수만 알려주세요"}
                </h3>
                <p className="mt-2 text-sm text-black/70 leading-relaxed">
                  {!quickMode
                    ? "도면 없이 사진으로 시작합니다. 공간 유형을 먼저 선택해주세요."
                    : "사진 첨부와 함께 AI 상담으로 진행됩니다."}
                </p>

                {/* 1단계: 모드 선택 */}
                {!quickMode && (
                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      onClick={() => setQuickMode("photo_residential")}
                      className="w-full rounded-2xl border-2 border-black/10 bg-[#f7f7f5]/50 p-4 text-left transition hover:border-black/10 hover:bg-[#f7f7f5]/50"
                    >
                      <p className="text-sm font-bold text-black">🏠 내 집 (도면 없이)</p>
                      <p className="mt-1 text-[0.72rem] text-black/60">
                        원룸·투룸·아파트·주택 등. 도면이 없거나 못 찾는 경우.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickMode("photo_commercial")}
                      className="w-full rounded-2xl border-2 border-black/10 bg-[#f7f7f5]/50 p-4 text-left transition hover:border-black/10 hover:bg-[#f7f7f5]/50"
                    >
                      <p className="text-sm font-bold text-black">☕ 상가·사무실</p>
                      <p className="mt-1 text-[0.72rem] text-black/60">
                        카페·식당·미용실·학원·사무실 등. 업종별 zone 디자인.
                      </p>
                    </button>
                  </div>
                )}

                {/* 2단계: 모드별 세부 입력 */}
                {quickMode === "photo_residential" && (
                  <div className="mt-5">
                    <p className="text-xs font-bold text-black mb-2">공간 유형</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { v: "studio", label: "원룸" },
                        { v: "one_bed", label: "투룸" },
                        { v: "two_bed", label: "쓰리룸" },
                        { v: "apartment", label: "아파트" },
                        { v: "house", label: "단독주택" },
                        { v: "officetel", label: "오피스텔" },
                      ] as Array<{ v: PhotoResidentialSpace; label: string }>).map((s) => {
                        const active = quickPhotoSpace === s.v;
                        return (
                          <button
                            key={s.v}
                            type="button"
                            onClick={() => setQuickPhotoSpace(s.v)}
                            className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                              active
                                ? "border-black/10 bg-black text-white shadow-cta"
                                : "border-black/10 bg-white text-black hover:border-black/10"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {quickMode === "photo_commercial" && (
                  <div className="mt-5">
                    <p className="text-xs font-bold text-black mb-2">업종</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { v: "cafe", label: "카페" },
                        { v: "restaurant", label: "식당" },
                        { v: "bakery", label: "베이커리" },
                        { v: "bar", label: "주점/바" },
                        { v: "beauty_salon", label: "미용실" },
                        { v: "clinic", label: "병원" },
                        { v: "academy", label: "학원" },
                        { v: "office", label: "사무실" },
                        { v: "gym", label: "헬스/필라테스" },
                        { v: "retail", label: "판매점" },
                        { v: "studio_space", label: "스튜디오" },
                        { v: "other_commercial", label: "기타" },
                      ] as Array<{ v: PhotoCommercialBusiness; label: string }>).map((b) => {
                        const active = quickBusiness === b.v;
                        return (
                          <button
                            key={b.v}
                            type="button"
                            onClick={() => setQuickBusiness(b.v)}
                            className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                              active
                                ? "border-black/10 bg-black text-white shadow-cta"
                                : "border-black/10 bg-white text-black hover:border-black/10"
                            }`}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3단계: 평수 입력 (모드 선택 후) */}
                {quickMode && (
                  <div className="mt-5">
                    <p className="text-xs font-bold text-black mb-2">평형 선택</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUICK_PYEONG_PRESETS.map((p) => {
                        const active = quickPyeong === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setQuickPyeong(p)}
                            className={`rounded-lg border px-2 py-2 text-sm font-bold transition ${
                              active
                                ? "border-black/10 bg-black text-white shadow-cta"
                                : "border-black/10 bg-white text-black hover:border-black/10"
                            }`}
                          >
                            {p}평
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs font-bold text-black">직접 입력</label>
                      <input
                        type="number"
                        min={5}
                        max={500}
                        value={quickPyeong}
                        onChange={(e) => setQuickPyeong(Number(e.target.value) || 0)}
                        className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm tabular text-black outline-none focus:border-black/10"
                      />
                      <span className="text-xs text-black/60">평</span>
                    </div>
                    <p className="mt-1.5 text-[0.7rem] text-black/50">
                      약 {Math.round((quickPyeong || 0) * 3.3058 * 10) / 10}m²
                    </p>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (quickMode) setQuickMode(null);
                      else setQuickOpen(false);
                    }}
                    className="flex-1 rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-black/70 hover:bg-[#f7f7f5]"
                  >
                    {quickMode ? "이전" : "취소"}
                  </button>
                  {quickMode && (
                    <button
                      type="button"
                      onClick={startQuickPhotoFlow}
                      disabled={!quickPyeong || quickPyeong < 5}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-black to-black px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:opacity-95 disabled:opacity-40"
                    >
                      <Sparkles className="h-4 w-4" />
                      AI 상담 시작
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 하단 stepper — jeton walkthrough 패턴 (활성 dot width 확장) */}
        <footer className="sticky bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-center px-6 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-4 py-2 backdrop-blur-md">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const idx = i + 1;
              const active = idx === step;
              const done = idx < step;
              return (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    active
                      ? "w-7 bg-black"
                      : done
                      ? "w-3 bg-black/35"
                      : "w-3 bg-black/10"
                  }`}
                />
              );
            })}
            <span className="ml-2 text-[0.7rem] font-semibold tabular text-black/48">
              {step}/{TOTAL_STEPS}
            </span>
          </div>
        </footer>
      </main>
    </LenisProvider>
  );
}
