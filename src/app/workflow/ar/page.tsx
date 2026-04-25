"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Hexagon, AlertTriangle, RotateCcw } from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import { useTokens } from "@/hooks/useTokens";

const AR_COST = 3;

const ROOMS = [
  { v: "living", label: "거실" },
  { v: "kitchen", label: "주방" },
  { v: "master", label: "안방" },
];

const SURFACES = [
  { v: "floor", label: "바닥" },
  { v: "wall", label: "벽" },
  { v: "ceiling", label: "천장" },
];

const PALETTE: Record<string, { color: string; name: string }[]> = {
  floor: [
    { color: "#A88964", name: "오크 헤링본" },
    { color: "#7E5C3E", name: "월넛 와이드" },
    { color: "#D6CFC2", name: "라이트 애쉬" },
    { color: "#3F2D1F", name: "다크 체스넛" },
    { color: "#C4A07A", name: "메이플" },
  ],
  wall: [
    { color: "#E8E2D4", name: "워시 페인트" },
    { color: "#D9CFC2", name: "베이지 마감" },
    { color: "#B8A691", name: "라떼 우드" },
    { color: "#3D3530", name: "딥 차콜" },
    { color: "#F4ECDD", name: "샌드 오프" },
  ],
  ceiling: [
    { color: "#FFFFFF", name: "퓨어 화이트" },
    { color: "#F2EFE9", name: "오프 화이트" },
    { color: "#E5E0D6", name: "샌드 톤" },
  ],
};

export default function ArPage() {
  const router = useRouter();
  const { balance, consume } = useTokens();

  const [entered, setEntered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [room, setRoom] = useState<string>(ROOMS[0].v);
  const [surface, setSurface] = useState<string>(SURFACES[0].v);
  const [pickIdx, setPickIdx] = useState<Record<string, Record<string, number>>>({});

  // 진입 시 자동으로 확인 모달
  useEffect(() => {
    if (!entered) {
      if (balance < AR_COST) setInsufficientOpen(true);
      else setConfirmOpen(true);
    }
  }, [entered, balance]);

  const enterAr = async () => {
    setConfirmOpen(false);
    if (balance < AR_COST) {
      setInsufficientOpen(true);
      return;
    }
    const ok = await consume(AR_COST, "ar_session");
    if (!ok) {
      setInsufficientOpen(true);
      return;
    }
    setEntered(true);
  };

  const currentPalette = PALETTE[surface] ?? [];
  const selected = pickIdx[room]?.[surface] ?? 0;
  const selectedColor = currentPalette[selected]?.color ?? "#A88964";

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-primary-900 text-white">
        {/* 다크 그라데이션 메쉬 */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_at_top,rgba(247,59,32,0.18),transparent_60%)]" />
          <div className="absolute -right-[15%] top-[15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.22),transparent_70%)] blur-3xl" />
          <div className="absolute -left-[15%] top-[50%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.32),transparent_70%)] blur-3xl" />
        </div>

        <Notch step={3} total={5} />

        <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 pt-12 lg:px-8 lg:pt-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow/branch")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10"
              aria-label="이전"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[0.85rem] font-semibold tracking-tight text-white/80">AR 디자인 확인</span>
            {entered && (
              <span className="inline-flex items-center gap-1 rounded-full border border-token-200/40 bg-token-50/10 px-2.5 py-1 text-[0.7rem] font-bold tabular text-token-200">
                <Hexagon className="h-3 w-3 fill-token-200" /> {AR_COST} 사용됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
            {entered && (
              <button
                onClick={() => router.push("/workflow/estimate")}
                className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
              >
                견적서로 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </header>

        {entered && (
          <>
            {/* 실 탭 */}
            <div className="relative z-20 mx-auto mt-8 flex max-w-7xl items-center justify-center gap-2 px-6">
              {ROOMS.map((r) => {
                const sel = room === r.v;
                return (
                  <button
                    key={r.v}
                    onClick={() => setRoom(r.v)}
                    className={`rounded-full border px-4 py-2 text-[0.85rem] font-semibold tracking-tight transition-all ${
                      sel
                        ? "border-primary-300 bg-primary-500 text-white shadow-cta"
                        : "border-white/15 bg-white/5 text-white/70 backdrop-blur hover:bg-white/10"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <section className="relative z-20 mx-auto mt-8 grid max-w-7xl gap-5 px-6 pb-32 lg:grid-cols-12 lg:px-8">
              {/* 좌측: 마감재 팔레트 */}
              <aside className="lg:col-span-3">
                <div className="rounded-[28px] border border-white/15 bg-white/5 p-5 backdrop-blur-2xl">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-peach-200">부위</p>
                  <div className="mt-3 flex gap-1.5">
                    {SURFACES.map((s) => {
                      const sel = surface === s.v;
                      return (
                        <button
                          key={s.v}
                          onClick={() => setSurface(s.v)}
                          className={`flex-1 rounded-lg px-2 py-2 text-[0.78rem] font-semibold tracking-tight transition-all ${
                            sel ? "bg-primary-500 text-white shadow-cta" : "bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-widest text-peach-200">자재</p>
                  <div className="mt-3 space-y-2">
                    {currentPalette.map((p, i) => {
                      const sel = (pickIdx[room]?.[surface] ?? 0) === i;
                      return (
                        <button
                          key={p.color}
                          onClick={() =>
                            setPickIdx((prev) => ({
                              ...prev,
                              [room]: { ...(prev[room] ?? {}), [surface]: i },
                            }))
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[0.78rem] font-semibold tracking-tight transition-all ${
                            sel ? "border-primary-300 bg-primary-500/20" : "border-white/10 hover:border-white/20"
                          }`}
                        >
                          <span
                            className="h-7 w-7 shrink-0 rounded-md ring-2 ring-white/15"
                            style={{ background: p.color }}
                          />
                          <span className="text-white/90">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              {/* 중앙: AR 캔버스 */}
              <div className="lg:col-span-6">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-neutral-800 to-neutral-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                  {/* 가상 룸 시뮬레이션 */}
                  <div className="absolute inset-0 grid grid-rows-[60%_40%]">
                    <div
                      className="border-b border-white/5"
                      style={{
                        background:
                          surface === "wall"
                            ? selectedColor
                            : "linear-gradient(180deg, #1a1f2e 0%, #2a2f3e 100%)",
                      }}
                    />
                    <div
                      style={{
                        background:
                          surface === "floor"
                            ? `repeating-linear-gradient(45deg, ${selectedColor} 0 22px, ${selectedColor}cc 22px 44px)`
                            : "#202632",
                      }}
                    />
                  </div>
                  {/* 가상 가구 실루엣 */}
                  <div className="absolute bottom-[28%] left-1/2 h-32 w-64 -translate-x-1/2 rounded-t-2xl bg-black/40 backdrop-blur-sm" />
                  <div className="absolute bottom-[28%] left-[12%] h-44 w-16 rounded-t-xl bg-black/30" />

                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[0.7rem] font-semibold tracking-widest text-white/80 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse" />
                    AR LIVE · {ROOMS.find((r) => r.v === room)?.label}
                  </div>
                  <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[0.7rem] font-semibold tracking-tight text-peach-200 backdrop-blur">
                    {SURFACES.find((s) => s.v === surface)?.label} · {currentPalette[selected]?.name}
                  </div>
                </div>
              </div>

              {/* 우측: 선택 요약 */}
              <aside className="lg:col-span-3">
                <div className="rounded-[28px] border border-white/15 bg-white/5 p-5 backdrop-blur-2xl">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-peach-200">선택 현황</p>
                  <ul className="mt-4 space-y-3">
                    {ROOMS.map((r) => (
                      <li key={r.v} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                        <p className="text-[0.78rem] font-bold tracking-tight">{r.label}</p>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {SURFACES.map((s) => {
                            const idx = pickIdx[r.v]?.[s.v];
                            const c = idx != null ? PALETTE[s.v]?.[idx]?.color : null;
                            return (
                              <div key={s.v} className="rounded-md ring-1 ring-white/10">
                                <p className="px-1.5 pt-1 text-[0.6rem] uppercase tracking-wider text-peach-200">
                                  {s.label}
                                </p>
                                <div
                                  className="mx-1 mb-1 mt-0.5 h-5 rounded-sm"
                                  style={{ background: c ?? "rgba(255,255,255,0.06)" }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setPickIdx({})}
                    className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold tracking-tight text-white/80 hover:bg-white/5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 초기화
                  </button>
                </div>
              </aside>
            </section>

            {/* 하단 진행 stepper + CTA */}
            <footer className="sticky bottom-6 z-30 mx-auto flex max-w-md items-center justify-center px-6 pb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                {Array.from({ length: 5 }).map((_, i) => {
                  const idx = i + 1;
                  const active = idx === 3;
                  const done = idx < 3;
                  return (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        active ? "w-7 bg-primary-300" : done ? "w-3 bg-primary-200/70" : "w-3 bg-white/15"
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-[0.7rem] font-semibold tabular text-white/60">3/5</span>
              </div>
            </footer>
          </>
        )}

        {/* 진입 확인 모달 */}
        <AnimatePresence>
          {confirmOpen && (
            <Modal onClose={() => router.push("/workflow/branch")}>
              <div className="text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-token-50 text-token-400">
                  <Hexagon className="h-6 w-6 fill-token-400" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                  AR 모드 진입
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-900/70">
                  AR 디자인 확인 모드로 진입합니다.
                  <br />
                  토큰 <span className="font-bold text-token-400">⬢ {AR_COST}</span>이 차감되며 환급되지 않습니다.
                </p>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning-bg px-3 py-2.5 text-left text-[0.78rem] text-warning-text">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>한 번 진입한 AR 세션은 종료 후 재진입 시 다시 토큰이 필요합니다.</span>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => router.push("/workflow/branch")}
                    className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={enterAr}
                    className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
                  >
                    진입하기 ({AR_COST}토큰 사용)
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {insufficientOpen && (
            <Modal onClose={() => router.push("/workflow/branch")}>
              <div className="text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                  <Hexagon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                  토큰이 부족합니다
                </h3>
                <p className="mt-2 text-sm text-primary-900/70">
                  AR 진입에 {AR_COST}토큰이 필요하지만, 현재 보유 토큰은 <span className="font-bold">{balance}</span>개입니다.
                </p>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => router.push("/workflow/branch")}
                    className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                  >
                    돌아가기
                  </button>
                  <a
                    href="/account/tokens"
                    className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
                  >
                    토큰 충전하기
                  </a>
                </div>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </main>
    </LenisProvider>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-primary-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover"
      >
        {children}
      </motion.div>
    </>
  );
}
