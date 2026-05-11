"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, Camera, Sparkles, X } from "lucide-react";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import Step1Cards, { Step1Data } from "@/components/workflow/Step1Cards";
import Step2Designer, { Step2Data } from "@/components/workflow/Step2Designer";
import { useTokens } from "@/hooks/useTokens";
import { useRouter } from "next/navigation";
import LenisProvider from "@/components/landing-v4/LenisProvider";

// 빠른 진입 모드 — 평수 프리셋
const QUICK_PYEONG_PRESETS = [10, 15, 20, 24, 30, 34, 40, 50];

const TOTAL_STEPS = 5;

export default function WorkflowPage() {
  const router = useRouter();
  const { balance, consume } = useTokens();

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
  // 빠른 사진 진입 모달
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPyeong, setQuickPyeong] = useState<number>(24);
  const hydratedRef = useRef(false);

  const startQuickPhotoFlow = () => {
    const pyeong = Math.max(5, Math.min(150, Math.round(quickPyeong || 24)));
    const exclusiveArea = Math.round(pyeong * 3.3058 * 10) / 10;
    setStep1({
      basicInfo: {
        mode: "address",
        budget: 3500,
        expansionType: "basic",
        selectedPyeong: {
          pyeongNo: -1,
          pyeongName: `${pyeong}평`,
          exclusiveArea,
        },
      },
      buildingType: "apartment",
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
    setStep(2);
  };

  // 마운트 시 sessionStorage 복원 (토큰 충전 갔다 와도 진행 상태 유지)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s1raw = sessionStorage.getItem("workflow_step1");
      const s2raw = sessionStorage.getItem("workflow_step2");
      const stepRaw = sessionStorage.getItem("workflow_step");
      if (s1raw) setStep1(JSON.parse(s1raw));
      if (s2raw) setStep2(JSON.parse(s2raw));
      if (stepRaw === "2") setStep(2);
    } catch (e) {
      console.warn("workflow restore fail", e);
    }
    hydratedRef.current = true;
  }, []);

  // 변경 시 자동 저장
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem("workflow_step1", JSON.stringify(step1));
      sessionStorage.setItem("workflow_step2", JSON.stringify(step2));
      sessionStorage.setItem("workflow_step", String(step));
    } catch {
      /* quota / private mode */
    }
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
  const goBranch = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("workflow_step1", JSON.stringify(step1));
      sessionStorage.setItem("workflow_step2", JSON.stringify(step2));
    }
    // branch 페이지 우회 — 사용자가 견적으로 직접 가는 흐름 원함
    // (AR은 branch 페이지에서 따로 들어갈 수 있음)
    router.push("/workflow/estimate");
  };

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-[#FFF6F5] text-primary-900">
        {/* STEP 01 — 이미지 배경 + 메인 톤 오버랩 */}
        {step === 1 && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/images/workflow-step1-bg.jpg)" }}
            />
            {/* 메인 톤 오버랩 (오렌지-레드 #F73B20 + 살구 그라데이션) */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,59,32,0.55)_0%,rgba(255,107,53,0.45)_45%,rgba(253,203,196,0.55)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,246,245,0.35),transparent_55%)]" />
            <div className="absolute -right-[15%] top-[5%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.32),transparent_70%)] blur-3xl" />
            <div className="absolute -left-[10%] top-[40%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.28),transparent_70%)] blur-3xl" />
          </div>
        )}

        {/* STEP 02 — 이미지 배경 + 메인 톤 오버랩 */}
        {step === 2 && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/images/workflow-step2-bg.jpg)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,59,32,0.50)_0%,rgba(253,203,196,0.55)_55%,rgba(255,246,245,0.65)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_at_top,rgba(255,246,245,0.30),transparent_60%)]" />
            <div className="absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.20),transparent_70%)] blur-3xl" />
            <div className="absolute left-[-12%] top-[40%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.18),transparent_70%)] blur-3xl" />
          </div>
        )}

        <Notch step={step} total={TOTAL_STEPS} />

        {/* 평면도 정형화 진행 오버레이 */}
        <AnimatePresence>
          {normalizing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-primary-900/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                className="rounded-[24px] bg-white p-7 shadow-card-hover max-w-sm w-full mx-6 text-center"
              >
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                  AI 평면도 정형화 중
                </h3>
                <p className="mt-2 text-sm text-primary-900/70 leading-relaxed">
                  실별 치수·구조·개구부를 자동 추출하고 있습니다.
                  <br />약 10–20초 소요
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 헤더 */}
        <header
          className={`relative z-30 mx-auto flex items-center justify-between px-4 lg:px-6 ${
            step === 2 ? "max-w-screen-2xl pt-4 lg:pt-5" : "max-w-7xl px-6 pt-12 lg:px-8 lg:pt-14"
          }`}
        >
          <div className="flex items-center gap-3">
            {step === 2 ? (
              <button
                onClick={goPrev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white/80 text-primary-900 backdrop-blur hover:bg-white"
                aria-label="이전 단계"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <a
                href="/"
                className="text-[1.3rem] font-extrabold tracking-tightest text-primary-900"
              >
                In<span className="text-primary-500">Pick</span>
              </a>
            )}
          </div>
          <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
        </header>

        {/* 본문 */}
        <section
          className={`relative z-20 mx-auto ${
            step === 2
              ? "max-w-screen-2xl px-4 lg:px-6 py-3 lg:py-4"
              : "max-w-7xl px-6 lg:px-8 py-12 lg:py-16"
          }`}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="max-w-3xl">
                  <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-600">
                    STEP 01
                  </p>
                  <h1 className="mt-3 text-[2.4rem] font-extrabold leading-[1.02] tracking-tightest text-primary-900 sm:text-[3.4rem] lg:text-[4rem]">
                    주소·예산·시공범위만
                    <br />
                    <span className="text-gradient-primary">알려주세요.</span>
                  </h1>
                  <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-primary-900/70">
                    이 세 가지로 평면도 자동 인식·공식 단가 적용·공간별 디자인 시안까지 다 자동입니다.
                  </p>
                </div>

                {/* 빠른 진입 — 사진 + 평수만으로 AI 상담으로 직행 */}
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => setQuickOpen(true)}
                    className="group relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/40 bg-white/90 px-6 py-5 text-left shadow-card-hover backdrop-blur transition hover:bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-cta">
                        <Camera className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-extrabold tracking-tight text-primary-900">
                            도면 없이 사진으로 바로 시작
                          </p>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700">
                            STEP 1 건너뛰기
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-primary-900/70 leading-relaxed">
                          평수만 알려주시면 AI 상담으로 바로 이동해요. 원하는 인테리어 사진을 첨부하고
                          <span className="font-bold text-primary-700"> &ldquo;이렇게 꾸며줘&rdquo;</span>라고 말씀하시면,
                          AI가 분석해서 디자인 이미지와 견적까지 만들어 드려요.
                        </p>
                      </div>
                      <Sparkles className="h-5 w-5 text-amber-500 shrink-0 group-hover:scale-110 transition" />
                    </div>
                  </button>
                </div>

                <div className="mt-12">
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
                      try {
                        sessionStorage.removeItem("workflow_step1");
                        sessionStorage.removeItem("workflow_step2");
                        sessionStorage.removeItem("workflow_step");
                      } catch {
                        /* private mode */
                      }
                      setNormalizeError(null);
                    }}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: -80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Step2 — 한 줄 압축 헤더 (큰 여백 제거) */}
                <div className="mb-3 flex items-center gap-3 flex-wrap">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-600">
                    STEP 02
                  </p>
                  <span className="text-primary-300">·</span>
                  <h1 className="text-base font-bold tracking-tight text-primary-900">
                    실별 AI 디자인 → <span className="text-gradient-primary">자재 견적 자동 흐름</span>
                  </h1>
                  {normalizeError && (
                    <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] text-amber-700">
                      ⚠ 평면도 정형화 실패 — 표준 치수로 진행
                    </span>
                  )}
                </div>

                <Step2Designer
                  rooms={step1.rooms}
                  basicInfo={step1.basicInfo}
                  normalizedFloorplan={step1.normalizedFloorplan}
                  roomFurnishings={step1.roomFurnishings}
                  value={step2}
                  onChange={setStep2}
                  tokenBalance={balance}
                  onConsumeToken={(amount, feature) => consume(amount, feature)}
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
                className="fixed inset-0 z-[85] bg-primary-900/55 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed left-1/2 top-1/2 z-[86] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover"
              >
                <button
                  onClick={() => setQuickOpen(false)}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary-900/50 hover:bg-primary-50 hover:text-primary-900"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-cta">
                  <Camera className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-primary-900">
                  평수만 알려주세요
                </h3>
                <p className="mt-2 text-sm text-primary-900/70 leading-relaxed">
                  AI 상담으로 바로 이동합니다. 원하시는 인테리어 사진을 첨부하고{" "}
                  <span className="font-bold text-primary-700">대화로 디자인</span>까지 진행해요.
                </p>

                <div className="mt-5">
                  <p className="text-xs font-bold text-primary-700 mb-2">평형 선택</p>
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
                              ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                              : "border-amber-200 bg-white text-primary-900 hover:border-primary-300"
                          }`}
                        >
                          {p}평
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-bold text-primary-700">직접 입력</label>
                    <input
                      type="number"
                      min={5}
                      max={150}
                      value={quickPyeong}
                      onChange={(e) => setQuickPyeong(Number(e.target.value) || 0)}
                      className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm tabular text-primary-900 outline-none focus:border-primary-400"
                    />
                    <span className="text-xs text-primary-900/60">평</span>
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-primary-900/50">
                    약 {Math.round((quickPyeong || 0) * 3.3058 * 10) / 10}m² (전용면적)
                  </p>
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickOpen(false)}
                    className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={startQuickPhotoFlow}
                    disabled={!quickPyeong || quickPyeong < 5}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:opacity-95 disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI 상담 시작
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 하단 stepper — jeton walkthrough 패턴 (활성 dot width 확장) */}
        <footer className="sticky bottom-6 z-30 mx-auto flex max-w-md items-center justify-center px-6 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 bg-white/85 px-4 py-2 backdrop-blur-md">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const idx = i + 1;
              const active = idx === step;
              const done = idx < step;
              return (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    active
                      ? "w-7 bg-primary-500"
                      : done
                      ? "w-3 bg-primary-300"
                      : "w-3 bg-primary-100"
                  }`}
                />
              );
            })}
            <span className="ml-2 text-[0.7rem] font-semibold tabular text-primary-900/60">
              {step}/{TOTAL_STEPS}
            </span>
          </div>
        </footer>
      </main>
    </LenisProvider>
  );
}
