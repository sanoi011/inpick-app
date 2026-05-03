/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Hexagon,
  Loader2,
  Check,
  ChevronRight,
  AlertCircle,
  Send,
  ImageIcon,
} from "lucide-react";
import type { BasicInfoData } from "./BasicInfoCard";
import type { NormalizedFloorplan } from "./Step1Cards";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";
import MaterialEditor from "./MaterialEditor";
import type { MaterialRegion } from "./MaterialEditor";

const ROOM_TABS: Array<{ v: string; label: string; dimKey: string }> = [
  { v: "all", label: "전체", dimKey: "거실" },
  { v: "living", label: "거실", dimKey: "거실" },
  { v: "master", label: "안방", dimKey: "안방" },
  { v: "kitchen", label: "부엌", dimKey: "주방" },
  { v: "bath", label: "욕실", dimKey: "욕실1" },
  { v: "bedroom", label: "침실", dimKey: "침실1" },
  { v: "entrance", label: "현관", dimKey: "현관" },
  { v: "balcony", label: "베란다", dimKey: "발코니" },
  { v: "dress", label: "드레스룸", dimKey: "드레스룸" },
];

const STYLE_PRESETS = [
  "모던 미니멀",
  "내추럴 우드 톤",
  "스칸디 화이트",
  "클래식 럭셔리",
  "재패니즈 미니멀",
  "인더스트리얼 로프트",
];

export interface RenderItem {
  url: string;
  prompt: string;
  revisedPrompt?: string;
  costUsd: number;
  timestamp: string;
  materialRegions?: MaterialRegion[];
  refinedUrl?: string;
  refinedAt?: string;
}

export interface Step2Data {
  selectedByRoom: Record<string, number | null>;        // 활성 방의 갤러리 인덱스
  generations: Record<string, number>;
  rendersByRoom: Record<string, RenderItem[]>;          // 방별 채팅 히스토리 (시간순)
  promptByRoom: Record<string, string>;                 // 방별 현재 입력
}

type ConsumeFeature = "ai_render" | "drawing_option";

interface Props {
  rooms: string[];
  basicInfo: BasicInfoData;
  normalizedFloorplan?: NormalizedFloorplan;
  value: Step2Data;
  onChange: (next: Step2Data) => void;
  tokenBalance: number;
  onConsumeToken: (amount: number, feature: ConsumeFeature) => Promise<boolean>;
  onComplete: () => void;
}

export default function Step2Designer({
  rooms,
  basicInfo,
  normalizedFloorplan,
  value,
  onChange,
  tokenBalance,
  onConsumeToken,
  onComplete,
}: Props) {
  const availableTabs = useMemo(() => {
    if (rooms.includes("all")) return ROOM_TABS.filter((t) => t.v !== "all");
    return ROOM_TABS.filter((t) => rooms.includes(t.v));
  }, [rooms]);

  const [activeRoom, setActiveRoom] = useState<string>(availableTabs[0]?.v ?? "living");
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const roomDims: Record<string, RoomDim> = useMemo(() => {
    if (normalizedFloorplan?.rooms?.length) {
      const map: Record<string, RoomDim> = {};
      for (const r of normalizedFloorplan.rooms) {
        map[r.name] = {
          name: r.name,
          widthMm: r.widthMm,
          depthMm: r.depthMm,
          heightMm: r.heightMm,
        };
      }
      return map;
    }
    const area = basicInfo.selectedPyeong?.exclusiveArea;
    if (area) return estimateRoomDimsFromPyeong(area);
    return estimateRoomDimsFromPyeong("30평");
  }, [normalizedFloorplan, basicInfo.selectedPyeong?.exclusiveArea]);

  const pyeongLabel = useMemo(() => {
    const area = basicInfo.selectedPyeong?.exclusiveArea;
    return area ? classifyPyeong(area) : "30평";
  }, [basicInfo.selectedPyeong?.exclusiveArea]);

  const renders = value.rendersByRoom[activeRoom] || [];
  const currentPrompt = value.promptByRoom?.[activeRoom] || "";
  const selectedIdx = value.selectedByRoom[activeRoom] ?? (renders.length > 0 ? renders.length - 1 : null);
  const activeRender = selectedIdx != null ? renders[selectedIdx] : null;
  const hasGenerated = renders.length > 0;
  const allRoomsDecided = availableTabs.every((t) => (value.rendersByRoom[t.v] || []).length > 0);

  // 채팅 히스토리 자동 스크롤
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renders.length]);

  const setPrompt = (text: string) => {
    onChange({
      ...value,
      promptByRoom: { ...(value.promptByRoom || {}), [activeRoom]: text },
    });
  };

  const handleGenerate = async () => {
    if (!currentPrompt.trim()) {
      setErrorMsg("프롬프트를 입력해주세요");
      return;
    }
    if (tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }
    const ok = await onConsumeToken(1, "ai_render");
    if (!ok) {
      setInsufficientOpen(true);
      return;
    }
    setErrorMsg(null);
    setGenerating(true);
    try {
      const tab = ROOM_TABS.find((t) => t.v === activeRoom)!;
      const dim = roomDims[tab.dimKey] || roomDims["거실"];
      const res = await fetch("/api/inpick/render-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: tab.label,
          widthMm: dim.widthMm,
          depthMm: dim.depthMm,
          heightMm: dim.heightMm,
          style: currentPrompt,
          expansion: basicInfo.expansionType === "extended",
          size: "1024x1024",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || "렌더링 실패");
      }
      const item: RenderItem = {
        url: data.imageUrl,
        prompt: currentPrompt,
        revisedPrompt: data.revisedPrompt,
        costUsd: data.costUsd ?? 0.08,
        timestamp: new Date().toISOString(),
      };
      const nextRenders = [...renders, item];
      onChange({
        ...value,
        rendersByRoom: { ...value.rendersByRoom, [activeRoom]: nextRenders },
        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: nextRenders.length - 1 },
        generations: {
          ...value.generations,
          [activeRoom]: (value.generations[activeRoom] ?? 0) + 1,
        },
        promptByRoom: { ...(value.promptByRoom || {}), [activeRoom]: "" },
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const updateRender = (idx: number, updated: RenderItem) => {
    const next = [...renders];
    next[idx] = updated;
    onChange({
      ...value,
      rendersByRoom: { ...value.rendersByRoom, [activeRoom]: next },
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr] font-mono">
      {/* 좌측: 게이밍 HUD 스타일 방 선택 패널 */}
      <aside className="relative">
        {/* HUD 패널 — 다크 + 네온 오렌지 보더 */}
        <div className="rounded-2xl bg-zinc-900/95 border border-primary-500/40 p-3 shadow-[0_0_20px_rgba(247,59,32,0.15)]">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-400">
              ▸ ROOMS
            </p>
            <span className="text-[0.6rem] tabular text-zinc-500">{pyeongLabel}</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {availableTabs.map((t) => {
              const sel = activeRoom === t.v;
              const count = (value.rendersByRoom[t.v] || []).length;
              const decided = count > 0;
              return (
                <div key={t.v} className="relative">
                  <button
                    onClick={() => setActiveRoom(t.v)}
                    className={`flex w-full shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold tracking-wider uppercase transition-all ${
                      sel
                        ? "border-primary-500 bg-primary-500/20 text-primary-300 shadow-[inset_0_0_12px_rgba(247,59,32,0.3)]"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sel && <span className="text-primary-400">▸</span>}
                      {t.label}
                    </span>
                    {decided && (
                      <span
                        className={`text-[0.6rem] font-bold tabular px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                          sel ? "bg-primary-500 text-white" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        <Check className="h-2 w-2" strokeWidth={3} />
                        {count}
                      </span>
                    )}
                  </button>
                  {sel && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden lg:block absolute left-full top-0 ml-3 z-20 min-w-[220px] rounded-xl border border-primary-500/40 bg-zinc-900/95 backdrop-blur-md p-3 shadow-[0_0_24px_rgba(247,59,32,0.25)]"
                    >
                      <div className="absolute left-0 top-3 -translate-x-1 h-2 w-2 rotate-45 bg-zinc-900 border-l border-b border-primary-500/40" />
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-primary-400">
                        ▸ {t.label} STATUS
                      </p>
                      <p className="mt-2 text-sm font-bold text-zinc-100">
                        {count > 0 ? (
                          <>
                            <span className="text-emerald-400 tabular">{count}</span>
                            <span className="text-zinc-500 ml-1">renders</span>
                          </>
                        ) : (
                          <span className="text-zinc-600">— STANDBY —</span>
                        )}
                      </p>
                      <p className="mt-1 text-[0.65rem] text-zinc-500 tabular">
                        DIM: {(() => {
                          const d = roomDims[t.dimKey];
                          return d ? `${d.widthMm}·${d.depthMm}·${d.heightMm}` : "—";
                        })()}
                      </p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 전체 진행 게임 HUD — XP bar 스타일 */}
        <div className="mt-3 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-400">
              ▸ PROGRESS
            </p>
            <span className="text-[0.65rem] tabular font-bold text-zinc-100">
              {availableTabs.filter((t) => (value.rendersByRoom[t.v] || []).length > 0).length}/{availableTabs.length}
            </span>
          </div>
          {/* progress bar */}
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${(availableTabs.filter((t) => (value.rendersByRoom[t.v] || []).length > 0).length / Math.max(1, availableTabs.length)) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary-500 to-amber-400 shadow-[0_0_8px_rgba(247,59,32,0.6)]"
            />
          </div>
          <button
            onClick={onComplete}
            disabled={!allRoomsDecided}
            className={`mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wider transition-all ${
              allRoomsDecided
                ? "bg-primary-500 text-white shadow-[0_0_16px_rgba(247,59,32,0.5)] hover:bg-primary-400 hover:shadow-[0_0_24px_rgba(247,59,32,0.7)]"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {allRoomsDecided ? "▸ NEXT STAGE" : "LOCKED"}
            {allRoomsDecided && <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

        {/* 토큰 잔액 HUD */}
        <div className="mt-3 rounded-2xl bg-zinc-900/95 border border-amber-500/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-amber-400">
              ▸ TOKENS
            </p>
            <span className="text-lg tabular font-extrabold text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]">
              ⬢{tokenBalance}
            </span>
          </div>
        </div>
      </aside>

      {/* 중앙: 맥북 베젤 + 게이밍 HUD */}
      <section className="relative">
        {/* 맥북 외부 알루미늄 프레임 */}
        <div className="rounded-[2rem] bg-gradient-to-br from-zinc-300 via-zinc-200 to-zinc-400 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          {/* 맥북 검은 베젤 */}
          <div className="relative rounded-[1.5rem] bg-black p-3 lg:p-4">
            {/* 노치 (상단 카메라) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 h-5 w-32 bg-black rounded-b-2xl flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-zinc-600">InPick OS</span>
            </div>

            {/* 스크린 — 실제 콘텐츠 */}
            <div className="relative rounded-xl overflow-hidden bg-zinc-950 ring-1 ring-zinc-800">
              {/* 메인 이미지 — 16:9 비율로 모니터 가득 */}
              <div className="relative w-full aspect-[16/9] min-h-[60vh]">
            {!hasGenerated && !generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
                {/* 그리드 패턴 배경 */}
                <div className="absolute inset-0 opacity-[0.04]" style={{
                  backgroundImage: `linear-gradient(rgba(247,59,32,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(247,59,32,0.5) 1px, transparent 1px)`,
                  backgroundSize: "32px 32px",
                }} />
                <div className="text-center px-8 relative z-10">
                  <div className="inline-block mb-6 px-4 py-1 rounded border border-primary-500/40 bg-primary-500/10 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-primary-400">
                    ▸ AWAITING INPUT
                  </div>
                  <ImageIcon className="h-20 w-20 text-primary-500/60 mx-auto mb-6" />
                  <p className="text-3xl font-extrabold tracking-tight text-zinc-100">
                    <span className="text-primary-400">{ROOM_TABS.find((t) => t.v === activeRoom)?.label}</span>
                    <span className="text-zinc-500 mx-2">//</span>
                    <span className="text-zinc-300">AI RENDER</span>
                  </p>
                  <p className="mt-3 text-sm text-zinc-500">
                    하단 콘솔에 스타일·자재·분위기를 입력하면 이미지가 생성됩니다
                  </p>
                  <p className="mt-4 text-xs text-amber-400/70 tabular font-bold uppercase tracking-wider">
                    DIM // {(() => {
                      const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                      const d = tab ? roomDims[tab.dimKey] : null;
                      return d ? `${d.widthMm} × ${d.depthMm} × ${d.heightMm}` : "—";
                    })()}
                  </p>
                </div>
              </div>
            )}

            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                <div className="absolute inset-0 opacity-[0.06]" style={{
                  backgroundImage: `linear-gradient(rgba(247,59,32,0.8) 1px, transparent 1px)`,
                  backgroundSize: "100% 4px",
                }} />
                <div className="text-center relative z-10">
                  <div className="inline-block mb-5 px-4 py-1 rounded border border-primary-500/60 bg-primary-500/20 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-primary-300 animate-pulse">
                    ▸ RENDERING
                  </div>
                  <Loader2 className="h-16 w-16 animate-spin text-primary-400 mx-auto drop-shadow-[0_0_12px_rgba(247,59,32,0.6)]" />
                  <p className="mt-5 text-2xl font-extrabold text-zinc-100 tracking-tight">
                    AI · DALL-E 3 HD
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 tabular uppercase tracking-wider">
                    EST. 15–25 sec
                  </p>
                </div>
              </div>
            )}

            {activeRender && !generating && (
              <img
                src={activeRender.refinedUrl || activeRender.url}
                alt="design"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {activeRender?.refinedUrl && (
              <div className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[0.7rem] font-bold text-white shadow-md">
                ✓ 고화질 재렌더
              </div>
            )}
          </div>

          {/* 갤러리 (이전 시안) — 2장 이상부터, 게이밍 인벤토리 스타일 */}
          {renders.length > 1 && (
            <div className="absolute left-4 top-4 flex gap-1.5 overflow-x-auto z-20 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-zinc-700">
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-zinc-400 self-center pr-1">SLOT</span>
              {renders.map((r, i) => {
                const sel = i === selectedIdx;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      onChange({
                        ...value,
                        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: i },
                      })
                    }
                    className={`relative shrink-0 h-12 w-12 rounded overflow-hidden border-2 transition-all ${
                      sel
                        ? "border-primary-500 shadow-[0_0_12px_rgba(247,59,32,0.6)]"
                        : "border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={r.refinedUrl || r.url} alt={`v${i + 1}`} className="h-full w-full object-cover" />
                    <span className={`absolute bottom-0 right-0 px-1 text-[0.55rem] font-bold tabular ${sel ? "bg-primary-500 text-white" : "bg-black/70 text-zinc-300"}`}>
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 채팅 히스토리 — 콘솔 로그 스타일 */}
          {hasGenerated && (
            <div className="absolute inset-x-0 bottom-[100px] max-h-48 overflow-y-auto px-5 py-3 space-y-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[2px] pointer-events-none">
              {renders.slice(-3).map((r, i) => (
                <div key={i} className="text-[0.7rem] text-emerald-300/90 drop-shadow-md font-mono tabular tracking-tight">
                  <span className="text-primary-400 font-bold">$ </span>
                  <span className="text-zinc-300">prompt</span>
                  <span className="text-zinc-500 mx-1">::</span>
                  {r.prompt}
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}

          {/* 콘솔 입력 바 — 다크 게이밍 터미널 */}
          <div
            className={`absolute inset-x-0 bottom-0 p-3 transition-all border-t ${
              hasGenerated
                ? "bg-zinc-950 border-primary-500/40 shadow-[0_-8px_24px_rgba(247,59,32,0.15)]"
                : "bg-zinc-950/85 backdrop-blur-md border-zinc-800"
            }`}
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                {!hasGenerated && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {STYLE_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(currentPrompt ? `${currentPrompt}, ${p}` : p)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider uppercase text-zinc-400 hover:border-primary-500/60 hover:text-primary-300 hover:bg-primary-500/10 transition-all"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-primary-400 font-bold text-sm">$</span>
                  <textarea
                    value={currentPrompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder={
                      hasGenerated
                        ? "modify> 소파 회색 패브릭, TV 뒷벽 우드 패널..."
                        : "render> 모던 미니멀, 화이트 + 라이트 우드, 따뜻한 자연광"
                    }
                    rows={hasGenerated ? 1 : 2}
                    className="flex-1 resize-none rounded bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/40 font-mono tabular"
                  />
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !currentPrompt.trim()}
                className="shrink-0 inline-flex h-11 items-center gap-1.5 rounded bg-primary-500 px-4 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_16px_rgba(247,59,32,0.4)] hover:bg-primary-400 hover:shadow-[0_0_24px_rgba(247,59,32,0.6)] disabled:opacity-30 disabled:shadow-none transition-all"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">EXEC</span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-black/30 px-1.5 py-0.5 text-[0.6rem] tabular">
                      <Hexagon className="h-2.5 w-2.5 fill-amber-300" /> 1
                    </span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-amber-400 font-mono">
                <AlertCircle className="h-3.5 w-3.5" />
                ERROR :: {errorMsg}
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* 자재 수정 — 선택된 시안 아래 */}
        {activeRender && selectedIdx != null && (
          <div className="mt-4">
            <MaterialEditor
              roomLabel={ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom}
              styleHint={activeRender.prompt}
              renderItem={activeRender}
              tokenBalance={tokenBalance}
              onConsumeToken={onConsumeToken}
              onUpdate={(updated) => updateRender(selectedIdx, updated)}
            />
          </div>
        )}
      </section>

      {/* 토큰 부족 모달 */}
      <AnimatePresence>
        {insufficientOpen && (
          <Modal onClose={() => setInsufficientOpen(false)}>
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                <Hexagon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                토큰이 부족합니다
              </h3>
              <p className="mt-2 text-sm text-primary-900/70">
                AI 디자인 1장에 1토큰이 필요합니다.
                <br />
                현재 보유: <span className="font-bold">{tokenBalance}</span>
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
