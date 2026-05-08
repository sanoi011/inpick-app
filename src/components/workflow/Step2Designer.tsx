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
  Minimize2,
  Maximize2,
  Home,
  Bed,
  ChefHat,
  Bath,
  DoorOpen,
  Layers,
  X,
  Sparkles,
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

const ROOM_TABS: Array<{ v: string; label: string; dimKey: string; icon: typeof Home }> = [
  { v: "all", label: "전체", dimKey: "거실", icon: Layers },
  { v: "living", label: "거실", dimKey: "거실", icon: Home },
  { v: "master", label: "안방", dimKey: "안방", icon: Bed },
  { v: "kitchen", label: "부엌", dimKey: "주방", icon: ChefHat },
  { v: "bath", label: "욕실", dimKey: "욕실1", icon: Bath },
  { v: "bedroom", label: "침실", dimKey: "침실1", icon: Bed },
  { v: "entrance", label: "현관", dimKey: "현관", icon: DoorOpen },
  { v: "balcony", label: "베란다", dimKey: "발코니", icon: Layers },
  { v: "dress", label: "드레스룸", dimKey: "드레스룸", icon: Layers },
];

const STYLE_PRESETS = [
  "모던 미니멀",
  "내추럴 우드 톤",
  "스칸디 화이트",
  "클래식 럭셔리",
  "재패니즈 미니멀",
  "인더스트리얼 로프트",
];

const RENDER_COUNT = 4;

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
  selectedByRoom: Record<string, number | null>;
  generations: Record<string, number>;
  rendersByRoom: Record<string, RenderItem[]>;
  promptByRoom: Record<string, string>;
}

type ConsumeFeature = "ai_render" | "drawing_option";

interface Props {
  rooms: string[];
  basicInfo: BasicInfoData;
  normalizedFloorplan?: NormalizedFloorplan;
  roomFurnishings?: Record<string, string[]>;
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
  roomFurnishings,
  value,
  onChange,
  tokenBalance,
  onConsumeToken,
  onComplete,
}: Props) {
  const availableTabs = useMemo(() => {
    // "전체" 탭은 항상 최상단에 표시 — 한 번에 모든 방 생성용
    const allTab = ROOM_TABS.find((t) => t.v === "all")!;
    const roomTabs = rooms.includes("all")
      ? ROOM_TABS.filter((t) => t.v !== "all")
      : ROOM_TABS.filter((t) => rooms.includes(t.v));
    return [allTab, ...roomTabs];
  }, [rooms]);

  const [activeRoom, setActiveRoom] = useState<string>(availableTabs[0]?.v ?? "living");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [openRoomPopup, setOpenRoomPopup] = useState<string | null>(null);
  const [imageMinimized, setImageMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 진행률 게이지 — 0→90% 점진 증가, 응답 후 100%
  useEffect(() => {
    if (!generating) {
      if (progress > 0 && progress < 100) {
        setProgress(100);
        const t = setTimeout(() => setProgress(0), 800);
        return () => clearTimeout(t);
      }
      return;
    }
    setProgress(5);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const target = Math.min(90, (elapsed / 60) * 90);
      setProgress((p) => Math.max(p, target));
    }, 400);
    return () => clearInterval(interval);
  }, [generating, progress]);

  // popup 외부 클릭 닫기
  useEffect(() => {
    if (!openRoomPopup) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-room-popup]") && !target.closest("[data-room-tab]")) {
        setOpenRoomPopup(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [openRoomPopup]);

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

  const realRoomTabs = useMemo(() => availableTabs.filter((t) => t.v !== "all"), [availableTabs]);
  const renders = value.rendersByRoom[activeRoom] || [];
  const currentPrompt = value.promptByRoom?.[activeRoom] || "";
  const selectedIdx =
    value.selectedByRoom[activeRoom] ?? (renders.length > 0 ? renders.length - 1 : null);
  const activeRender = selectedIdx != null ? renders[selectedIdx] : null;
  const hasGenerated = renders.length > 0;
  const allRoomsDecided = realRoomTabs.every((t) => (value.rendersByRoom[t.v] || []).length > 0);

  // 채팅 히스토리 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renders.length, generating]);

  const setPrompt = (text: string) => {
    onChange({
      ...value,
      promptByRoom: { ...(value.promptByRoom || {}), [activeRoom]: text },
    });
  };

  // 평면도 정보 → 방별 창문/구조
  const inferStructure = (roomLabel: string) => {
    const interiorRooms = ["욕실", "드레스룸", "팬트리", "현관", "다용도실", "보일러실"];
    const exteriorRooms = ["거실", "안방", "침실", "주방", "발코니", "다이닝"];
    const isInterior = interiorRooms.some((k) => roomLabel.includes(k));
    const isExterior = exteriorRooms.some((k) => roomLabel.includes(k));
    let windows = 0;
    if (normalizedFloorplan?.openings) {
      for (const op of normalizedFloorplan.openings) {
        if ((op.type === "window" || op.type === "sliding") && op.wall?.includes(roomLabel)) {
          windows++;
        }
      }
    }
    if (windows === 0 && isExterior) windows = 1;
    return { windows, isInteriorRoom: isInterior };
  };

  const handleGenerate = async () => {
    if (!currentPrompt.trim()) {
      setErrorMsg("프롬프트를 입력해주세요. 예: '모던 미니멀, 화이트 + 라이트 우드'");
      return;
    }
    // "전체" 탭에서는 모든 방에 일괄 생성
    if (activeRoom === "all") {
      const promptToUse = currentPrompt;
      setPrompt("");
      await handleBulkGenerate(promptToUse);
      return;
    }
    setErrorMsg(null);
    setGenerating(true);
    try {
      const tab = ROOM_TABS.find((t) => t.v === activeRoom)!;
      const dim = roomDims[tab.dimKey] || roomDims["거실"];
      const struct = inferStructure(tab.label);
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
          windows: struct.windows,
          isInteriorRoom: struct.isInteriorRoom,
          furnishingOptions: roomFurnishings?.[activeRoom] || [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        const baseMsg = data.error || "렌더링 실패";
        const hintMsg = data.hint ? ` — ${data.hint}` : "";
        throw new Error(baseMsg + hintMsg);
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
      setImageMinimized(false); // 생성 후 큰 이미지로
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async (conceptPrompt: string) => {
    const emptyTabs = availableTabs.filter((t) => (value.rendersByRoom[t.v] || []).length === 0);
    if (emptyTabs.length === 0) {
      setErrorMsg("이미 모든 방에 시안이 있습니다");
      return;
    }
    setErrorMsg(null);
    setGenerating(true);
    try {
      const results = await Promise.allSettled(
        emptyTabs.map(async (tab) => {
          const dim = roomDims[tab.dimKey] || roomDims["거실"];
          const struct = inferStructure(tab.label);
          const res = await fetch("/api/inpick/render-room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomName: tab.label,
              widthMm: dim.widthMm,
              depthMm: dim.depthMm,
              heightMm: dim.heightMm,
              style: conceptPrompt,
              expansion: basicInfo.expansionType === "extended",
              size: "1024x1024",
              windows: struct.windows,
              isInteriorRoom: struct.isInteriorRoom,
              furnishingOptions: roomFurnishings?.[tab.v] || [],
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.imageUrl) {
            throw new Error(`${tab.label}: ${data.error || "렌더링 실패"}${data.hint ? ` — ${data.hint}` : ""}`);
          }
          return {
            tabKey: tab.v,
            item: {
              url: data.imageUrl,
              prompt: conceptPrompt,
              revisedPrompt: data.revisedPrompt,
              costUsd: data.costUsd ?? 0.08,
              timestamp: new Date().toISOString(),
            } as RenderItem,
          };
        }),
      );
      const next = { ...value };
      next.rendersByRoom = { ...next.rendersByRoom };
      next.selectedByRoom = { ...next.selectedByRoom };
      next.generations = { ...next.generations };
      next.promptByRoom = { ...(next.promptByRoom || {}) };
      const failures: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          const { tabKey, item } = r.value;
          const list = [...(next.rendersByRoom[tabKey] || []), item];
          next.rendersByRoom[tabKey] = list;
          next.selectedByRoom[tabKey] = list.length - 1;
          next.generations[tabKey] = (next.generations[tabKey] ?? 0) + 1;
        } else {
          failures.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
      }
      onChange(next);
      if (failures.length > 0) {
        setErrorMsg(`일부 방 실패: ${failures.slice(0, 2).join(" / ")}`);
      }
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

  const completedCount = realRoomTabs.filter(
    (t) => (value.rendersByRoom[t.v] || []).length > 0,
  ).length;
  const totalCount = realRoomTabs.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-stretch">
      {/* ─── 좌측 툴바 ─── */}
      <aside className="flex flex-col gap-3">
        {/* 전체 인테리어 이미지 한번에 생성 — 좌측 상단 (방 선택 위) */}
        <div className="rounded-2xl bg-white border border-primary-200 p-3 shadow-card">
          <p className="text-xs font-bold text-primary-700 mb-2">
            전체 인테리어 이미지 한번에 생성
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handleBulkGenerate(preset)}
                disabled={
                  generating ||
                  !availableTabs.some((t) => t.v !== "all" && (value.rendersByRoom[t.v] || []).length === 0)
                }
                className="rounded-lg border border-primary-100 bg-primary-50/50 px-2 py-1.5 text-[0.7rem] font-semibold text-primary-900 hover:bg-primary-100 hover:border-primary-300 disabled:opacity-30 transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.65rem] text-primary-900/50 leading-snug">
            클릭 시 비어있는 방 자동 생성
          </p>
        </div>

        {/* 방 선택 */}
        <div className="rounded-2xl bg-white border border-primary-200 p-3 shadow-card">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-bold text-primary-700">방 선택</p>
            <span className="text-[0.6rem] tabular text-primary-900/50">{pyeongLabel}</span>
          </div>
          <div className="space-y-1">
            {availableTabs.map((t) => {
              const isAll = t.v === "all";
              const sel = activeRoom === t.v;
              const count = (value.rendersByRoom[t.v] || []).length;
              const decided = !isAll && count > 0;
              const Icon = t.icon;
              return (
                <div key={t.v} className="relative">
                  <button
                    data-room-tab
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRoom(t.v);
                      // "전체" 탭은 popup 비활성화 (전체 컨셉 입력용)
                      if (isAll) {
                        setOpenRoomPopup(null);
                      } else {
                        setOpenRoomPopup(openRoomPopup === t.v ? null : t.v);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all ${
                      sel
                        ? isAll
                          ? "bg-gradient-to-r from-primary-500 to-amber-400 text-white shadow-cta"
                          : "bg-primary-500 text-white shadow-cta"
                        : isAll
                          ? "bg-gradient-to-r from-primary-50 to-amber-50 text-primary-900 border border-primary-200 hover:from-primary-100 hover:to-amber-100"
                          : "bg-primary-50/30 text-primary-900/70 hover:bg-primary-100 hover:text-primary-900"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </span>
                    {decided && (
                      <span
                        className={`text-[0.6rem] font-bold tabular px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                          sel ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        <Check className="h-2 w-2" strokeWidth={3} />
                        {count}
                      </span>
                    )}
                  </button>
                  {/* popup — 클릭 토글만, "전체" 제외 */}
                  <AnimatePresence>
                    {!isAll && openRoomPopup === t.v && (
                      <motion.div
                        data-room-popup
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="absolute left-full top-0 ml-3 z-30 min-w-[220px] rounded-xl border border-primary-200 bg-white p-3 shadow-card-hover"
                      >
                        <div className="absolute left-0 top-3 -translate-x-1 h-2 w-2 rotate-45 bg-white border-l border-b border-primary-200" />
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-primary-700">{t.label}</p>
                          <button onClick={() => setOpenRoomPopup(null)}>
                            <X className="h-3 w-3 text-primary-900/40 hover:text-primary-900" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-primary-900">
                          {count > 0 ? (
                            <>
                              <span className="text-emerald-600">{count}</span>
                              <span className="text-primary-900/50 ml-1">장 생성됨</span>
                            </>
                          ) : (
                            <span className="text-primary-900/40">아직 미생성</span>
                          )}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-primary-900/60 tabular">
                          치수 ·{" "}
                          {(() => {
                            const d = roomDims[t.dimKey];
                            return d ? `${d.widthMm}×${d.depthMm}×${d.heightMm}mm` : "—";
                          })()}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* 보유 토큰 */}
        <div className="rounded-2xl bg-white border border-amber-200 p-3 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700">보유 토큰</p>
            <span className="text-lg tabular font-extrabold text-amber-700">
              ⬢ {tokenBalance}
            </span>
          </div>
          <p className="mt-1 text-[0.65rem] text-amber-700/70 leading-snug">
            1차 미리보기 무료 · 자재 분석 1 · 고화질 재렌더 2
          </p>
        </div>

        {/* 진행 상황 — 좌측 컬럼 하단으로 push (메인 캔버스 하단과 정렬) */}
        <div className="mt-auto rounded-2xl bg-white border border-primary-200 p-3 shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-primary-700">진행 상황</p>
            <span className="text-[0.65rem] tabular font-bold text-primary-900">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-primary-50 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / Math.max(1, totalCount)) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary-500 to-amber-400"
            />
          </div>
          <button
            onClick={onComplete}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary-500 px-3 py-2 text-xs font-bold text-white shadow-cta hover:bg-primary-600"
          >
            {allRoomsDecided ? "디자인 완료 (견적 요청)" : "디자인 완료 · 견적 요청"}
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </aside>

      {/* ─── 메인: ChatGPT 스타일 채팅 + 이미지 오버랩 ─── */}
      <section className="relative flex flex-col">
        <div className="relative rounded-3xl bg-white border border-primary-100 shadow-card flex-1 min-h-[480px] flex flex-col overflow-hidden">
          {/* 채팅 헤더 */}
          <div className="px-5 py-3 border-b border-primary-100 flex items-center justify-between bg-gradient-to-r from-primary-50/50 to-amber-50/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <p className="text-sm font-bold text-primary-900">
                {ROOM_TABS.find((t) => t.v === activeRoom)?.label} · AI 디자인 챗
              </p>
            </div>
            <p className="text-[0.7rem] text-primary-900/50 tabular">
              {activeRoom === "all" ? (
                <>모든 방 일괄 · {realRoomTabs.length}개 방</>
              ) : (
                <>
                  치수 ·{" "}
                  {(() => {
                    const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                    const d = tab ? roomDims[tab.dimKey] : null;
                    return d ? `${d.widthMm}×${d.depthMm}×${d.heightMm}mm` : "—";
                  })()}
                </>
              )}
            </p>
          </div>

          {/* 채팅 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!hasGenerated && !generating && (
              <div className="h-full flex items-center justify-center min-h-[40vh]">
                <div className="text-center max-w-md">
                  <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-500 mb-4">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-primary-900">
                    {activeRoom === "all"
                      ? "전체 컨셉을 한 번에 만들어볼까요?"
                      : "무엇을 만들고 싶으세요?"}
                  </h3>
                  <p className="mt-2 text-sm text-primary-900/60 leading-relaxed">
                    {activeRoom === "all" ? (
                      <>
                        하나의 컨셉으로 <span className="font-bold text-primary-700">모든 방</span>에
                        같은 스타일로 일괄 생성됩니다.
                        <br />
                        프롬프트 입력 또는 좌측 프리셋 클릭.
                      </>
                    ) : (
                      <>
                        스타일·자재·분위기를 자유롭게 적어주세요.
                        <br />
                        또는 좌측{" "}
                        <span className="font-bold text-primary-700">전체 인테리어 이미지 한번에 생성</span>{" "}
                        프리셋을 클릭하세요.
                      </>
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    {STYLE_PRESETS.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(currentPrompt ? `${currentPrompt}, ${p}` : p)}
                        className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 hover:border-primary-400"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 채팅 히스토리 — 사용자 prompt + AI 이미지 응답 */}
            {renders.map((r, i) => (
              <div key={i} className="space-y-2">
                {/* 사용자 메시지 */}
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl rounded-tr-sm bg-primary-500 text-white px-4 py-2.5 text-sm shadow-sm">
                    {r.prompt}
                  </div>
                </div>
                {/* AI 응답 (작은 미리보기) */}
                <div className="flex justify-start">
                  <button
                    onClick={() => {
                      onChange({
                        ...value,
                        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: i },
                      });
                      setImageMinimized(false);
                    }}
                    className={`group relative rounded-2xl rounded-tl-sm overflow-hidden border-2 transition-all ${
                      i === selectedIdx
                        ? "border-primary-500 ring-2 ring-primary-200"
                        : "border-primary-100 hover:border-primary-300"
                    }`}
                  >
                    <img
                      src={r.refinedUrl || r.url}
                      alt={`design-${i}`}
                      className="block w-56 h-56 object-cover"
                    />
                    <div className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-bold tabular text-primary-900 backdrop-blur">
                      #{String(i + 1).padStart(2, "0")}
                    </div>
                    {r.refinedUrl && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                        ✓ HD
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* 생성 중 — 게이지 */}
            {generating && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-primary-50 border border-primary-100 px-5 py-4 max-w-md">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                    <p className="text-sm font-bold text-primary-900">AI 디자인 생성 중…</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                    <motion.div
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-primary-500 to-amber-400"
                    />
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-primary-900/60">
                    <span className="tabular font-bold">{Math.round(progress)}%</span> · 고퀄리티
                    이미지 생성으로 30~60초 소요됩니다
                  </p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 하단 sticky prompt bar (흰색 60% 투명) */}
          <div className="border-t border-primary-100 bg-white/60 backdrop-blur-md p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl border border-primary-200 bg-white/90 px-4 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
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
                    activeRoom === "all"
                      ? "전체 컨셉 입력 — 모든 방에 같은 스타일로 일괄 생성. 예) 모던 미니멀, 화이트 + 라이트 우드, 따뜻한 톤"
                      : hasGenerated
                        ? "수정 요청: 예) 소파를 회색 패브릭으로, TV 뒷벽 우드 패널..."
                        : "원하는 스타일·자재·분위기를 입력하세요. (Shift+Enter 줄바꿈)"
                  }
                  rows={hasGenerated ? 1 : 2}
                  className="w-full resize-none bg-transparent text-sm text-primary-900 outline-none placeholder:text-primary-900/40"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !currentPrompt.trim()}
                className="shrink-0 inline-flex h-11 items-center gap-1.5 rounded-2xl bg-primary-500 px-4 text-sm font-bold text-white shadow-cta hover:bg-primary-600 disabled:opacity-30"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>1차 생성</span>
                    <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[0.6rem] font-bold">
                      무료
                    </span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-amber-700 leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* 풀스크린 이미지 오버랩 (선택된 시안 큰 보기) */}
          <AnimatePresence>
            {activeRender && !imageMinimized && hasGenerated && !generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="absolute inset-3 rounded-2xl overflow-hidden bg-white border border-primary-200 shadow-2xl pointer-events-auto"
                style={{ zIndex: 20 }}
              >
                <button
                  onClick={() => setImageMinimized(true)}
                  className="absolute top-3 right-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-primary-200 text-primary-700 hover:bg-primary-50 shadow"
                  title="우측으로 작게"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <img
                  src={activeRender.refinedUrl || activeRender.url}
                  alt="design"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {activeRender.refinedUrl && (
                  <div className="absolute top-3 left-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[0.7rem] font-bold text-white shadow">
                    ✓ 고화질 재렌더
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 우측 미니 thumbnail (minimized 상태) */}
        <AnimatePresence>
          {imageMinimized && activeRender && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => setImageMinimized(false)}
              className="fixed right-6 top-24 z-30 h-32 w-32 rounded-xl border-2 border-primary-500 overflow-hidden shadow-2xl bg-white hover:scale-105 transition-transform"
              title="중앙 큰 보기로"
            >
              <img
                src={activeRender.refinedUrl || activeRender.url}
                alt="mini"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-primary-700">
                <Maximize2 className="h-2.5 w-2.5" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[0.6rem] font-bold p-1 text-center">
                클릭해서 크게 보기
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 자재 수정 (벡터화) — 선택된 시안 아래 */}
        {activeRender && selectedIdx != null && hasGenerated && (
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
                자재 영역 분석 1토큰 / 고화질 재렌더 2토큰이 필요합니다.
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
                  href="/account/tokens?return=/workflow"
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
