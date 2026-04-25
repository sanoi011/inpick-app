"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wand2, Hexagon, Loader2, Check, Sparkles, ChevronRight } from "lucide-react";

const ROOM_TABS = [
  { v: "living", label: "거실" },
  { v: "master", label: "안방" },
  { v: "kitchen", label: "부엌" },
  { v: "bath", label: "욕실" },
  { v: "bedroom", label: "침실" },
  { v: "entrance", label: "현관" },
];

const STYLES = [
  { v: "modern", label: "모던" },
  { v: "natural", label: "내추럴" },
  { v: "classic", label: "클래식" },
  { v: "minimal", label: "미니멀" },
  { v: "scandi", label: "스칸디" },
  { v: "industrial", label: "인더스트리얼" },
];

export interface Step2Data {
  selectedByRoom: Record<string, number | null>; // room → 선택한 디자인 인덱스
  generations: Record<string, number>; // room → 생성한 횟수
}

interface Props {
  rooms: string[]; // STEP1에서 고른 방
  value: Step2Data;
  onChange: (next: Step2Data) => void;
  tokenBalance: number;
  onConsumeToken: () => Promise<boolean>; // 1토큰 차감 (true면 성공)
  onComplete: () => void;
}

export default function Step2Designer({
  rooms,
  value,
  onChange,
  tokenBalance,
  onConsumeToken,
  onComplete,
}: Props) {
  const availableTabs = ROOM_TABS.filter((t) => rooms.includes(t.v));
  const [activeRoom, setActiveRoom] = useState<string>(availableTabs[0]?.v ?? "living");
  const [style, setStyle] = useState<string>("modern");
  const [generating, setGenerating] = useState(false);
  const [renderShown, setRenderShown] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);

  const selectedIdx = value.selectedByRoom[activeRoom] ?? null;
  const hasGenerated = !!renderShown[activeRoom];
  const allRoomsDecided = availableTabs.every((t) => value.selectedByRoom[t.v] != null);

  const handleGenerate = async () => {
    if (tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const performGenerate = async () => {
    setConfirmOpen(false);
    const ok = await onConsumeToken();
    if (!ok) {
      setInsufficientOpen(true);
      return;
    }
    setGenerating(true);
    // 가짜 렌더링 시뮬레이션 (실제 API 연결 자리)
    await new Promise((r) => setTimeout(r, 1400));
    setGenerating(false);
    setRenderShown((p) => ({ ...p, [activeRoom]: true }));
    onChange({
      ...value,
      generations: { ...value.generations, [activeRoom]: (value.generations[activeRoom] ?? 0) + 1 },
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* 좌측 사이드: 방 탭 */}
      <aside className="lg:col-span-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">방</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {availableTabs.map((t) => {
            const sel = activeRoom === t.v;
            const decided = value.selectedByRoom[t.v] != null;
            return (
              <button
                key={t.v}
                onClick={() => setActiveRoom(t.v)}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                <span>{t.label}</span>
                {decided && <Check className={`h-3.5 w-3.5 ${sel ? "text-white" : "text-primary-600"}`} />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 중앙: 디자인 8장 */}
      <section className="lg:col-span-7">
        <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/75 p-7 shadow-card backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-tight text-primary-900/60">{availableTabs.find((t) => t.v === activeRoom)?.label} · AI 디자인</p>
              <p className="mt-0.5 text-[0.72rem] text-primary-900/40">
                생성 횟수 <span className="tabular font-semibold">{value.generations[activeRoom] ?? 0}</span>회
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-tight transition-all ${
                tokenBalance < 1
                  ? "bg-primary-100 text-primary-900/40"
                  : "bg-primary-500 text-white shadow-cta hover:bg-primary-600"
              } disabled:opacity-60`}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중…
                </>
              ) : tokenBalance < 1 ? (
                <>
                  <Hexagon className="h-3.5 w-3.5" />
                  토큰 충전 필요
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  AI 디자인 생성하기
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.7rem]">
                    <Hexagon className="h-3 w-3 fill-white" /> 1
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="mt-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">스타일</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.v}
                  onClick={() => setStyle(s.v)}
                  className={`rounded-full border px-3 py-1 text-[0.78rem] font-semibold tracking-tight transition-all ${
                    style === s.v
                      ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                      : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => {
              const isSel = selectedIdx === i;
              return (
                <button
                  key={i}
                  disabled={!hasGenerated}
                  onClick={() =>
                    onChange({
                      ...value,
                      selectedByRoom: { ...value.selectedByRoom, [activeRoom]: i },
                    })
                  }
                  className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                    isSel
                      ? "border-primary-500 ring-2 ring-primary-200 shadow-card-hover"
                      : hasGenerated
                      ? "border-primary-100 hover:border-primary-300"
                      : "border-dashed border-primary-200"
                  }`}
                >
                  {!hasGenerated && (
                    <div className="flex h-full items-center justify-center bg-primary-50/50">
                      <span className="text-[0.7rem] font-medium tabular text-primary-900/30">#{i + 1}</span>
                    </div>
                  )}
                  {hasGenerated && (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `linear-gradient(135deg, ${
                          [
                            ["#FEE9E6", "#F5B1A3"],
                            ["#FDD6CE", "#FA8270"],
                            ["#FFF6F5", "#FDCBC4"],
                            ["#FAEEDA", "#FAC775"],
                            ["#E8EBEE", "#A8ACB1"],
                            ["#FFF8EE", "#E0A347"],
                            ["#FCE8C2", "#BA7517"],
                            ["#F4F6F8", "#6E7378"],
                          ][i].join(", ")
                        })`,
                      }}
                    />
                  )}
                  {hasGenerated && (
                    <div className="absolute left-1.5 top-1.5 rounded-full bg-white/85 px-1.5 py-0.5 text-[0.6rem] font-semibold tabular text-primary-900 backdrop-blur">
                      #{String(i + 1).padStart(2, "0")}
                    </div>
                  )}
                  {isSel && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 우측: 선택된 디자인 요약 */}
      <aside className="lg:col-span-3">
        <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/75 p-6 shadow-card backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
          />
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">선택 현황</p>
          <ul className="mt-4 space-y-2.5">
            {availableTabs.map((t) => {
              const idx = value.selectedByRoom[t.v];
              return (
                <li key={t.v} className="flex items-center justify-between text-[0.85rem]">
                  <span className="font-medium tracking-tight text-primary-900/80">{t.label}</span>
                  {idx != null ? (
                    <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[0.7rem] font-bold tabular text-white">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="text-[0.7rem] text-primary-900/30">미선택</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            onClick={onComplete}
            disabled={!allRoomsDecided}
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-900 px-4 py-3 text-sm font-semibold tracking-tight text-white transition-all hover:bg-primary-800 disabled:bg-primary-100 disabled:text-primary-900/40"
          >
            다음 단계로
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {!allRoomsDecided && (
            <p className="mt-3 text-center text-[0.7rem] text-primary-900/50">
              모든 방의 디자인을 골라주세요
            </p>
          )}
        </div>
      </aside>

      {/* 토큰 차감 확인 모달 */}
      <AnimatePresence>
        {confirmOpen && (
          <Modal onClose={() => setConfirmOpen(false)}>
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-token-50 text-token-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">AI 디자인 생성</h3>
              <p className="mt-2 text-sm text-primary-900/70">
                이 작업은 <span className="font-bold text-token-400">⬢ 1 토큰</span>을 사용합니다.
                <br />
                현재 잔액 {tokenBalance} → 생성 후 {tokenBalance - 1}
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                >
                  취소
                </button>
                <button
                  onClick={performGenerate}
                  className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-cta hover:bg-primary-600"
                >
                  생성하기
                </button>
              </div>
            </div>
          </Modal>
        )}

        {insufficientOpen && (
          <Modal onClose={() => setInsufficientOpen(false)}>
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                <Hexagon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">토큰이 부족합니다</h3>
              <p className="mt-2 text-sm text-primary-900/70">
                AI 디자인 1세트에 1토큰이 필요합니다.
                <br />
                현재 보유 토큰: <span className="font-bold">{tokenBalance}</span>
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setInsufficientOpen(false)}
                  className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                >
                  나중에
                </button>
                <a
                  href="/account/tokens"
                  className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-cta hover:bg-primary-600"
                >
                  토큰 충전하기
                </a>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
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
        className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover"
      >
        {children}
      </motion.div>
    </>
  );
}
