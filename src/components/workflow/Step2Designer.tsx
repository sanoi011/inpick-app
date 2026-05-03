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
    <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
      {/* 좌측: 방 선택 + 클릭 시 진행 popup */}
      <aside className="relative">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
          방 ({pyeongLabel})
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {availableTabs.map((t) => {
            const sel = activeRoom === t.v;
            const count = (value.rendersByRoom[t.v] || []).length;
            const decided = count > 0;
            return (
              <div key={t.v} className="relative group">
                <button
                  onClick={() => setActiveRoom(t.v)}
                  className={`flex w-full shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold tracking-tight transition-all ${
                    sel
                      ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                      : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                  }`}
                >
                  <span>{t.label}</span>
                  {decided && (
                    <span
                      className={`text-[0.65rem] font-bold tabular px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                        sel ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      {count}
                    </span>
                  )}
                </button>
                {/* 탭업 popup — hover/active 시 우측에서 튀어나옴 */}
                {sel && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="hidden lg:block absolute left-full top-0 ml-2 z-20 min-w-[200px] rounded-xl border border-primary-100 bg-white p-3 shadow-card-hover"
                  >
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary-900/50">
                      {t.label} 진행
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-primary-900">
                      {count > 0 ? `${count}장 생성` : "아직 미생성"}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-primary-900/60 tabular">
                      치수 {(() => {
                        const d = roomDims[t.dimKey];
                        return d ? `${d.widthMm}×${d.depthMm}×${d.heightMm}mm` : "—";
                      })()}
                    </p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* 전체 진행 요약 (모든 방 합계) + 다음 단계 */}
        <div className="mt-4 rounded-xl border border-primary-100 bg-white/90 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary-900/50">
            전체
          </p>
          <p className="mt-1 text-xs font-bold text-primary-900">
            {availableTabs.filter((t) => (value.rendersByRoom[t.v] || []).length > 0).length} / {availableTabs.length} 방 완료
          </p>
          <button
            onClick={onComplete}
            disabled={!allRoomsDecided}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full bg-primary-900 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-800 disabled:bg-primary-100 disabled:text-primary-900/40"
          >
            견적 보기
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </aside>

      {/* 중앙: 화면 꽉 차는 큰 이미지 카드 + 채팅 */}
      <section className="relative">
        <div className="relative rounded-[28px] overflow-hidden bg-primary-50/30 border border-primary-100">
          {/* 메인 이미지 — 16:9 비율로 모니터 가득 */}
          <div className="relative w-full aspect-[16/9] min-h-[60vh]">
            {!hasGenerated && !generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100/50">
                <div className="text-center px-8">
                  <ImageIcon className="h-20 w-20 text-primary-300 mx-auto mb-6" />
                  <p className="text-2xl font-extrabold tracking-tight text-primary-900">
                    {ROOM_TABS.find((t) => t.v === activeRoom)?.label} AI 디자인
                  </p>
                  <p className="mt-2 text-sm text-primary-900/50">
                    하단에 원하는 스타일·자재·분위기를 입력하면 이미지가 생성됩니다
                  </p>
                  <p className="mt-4 text-xs text-primary-900/40 tabular font-semibold">
                    치수 {(() => {
                      const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                      const d = tab ? roomDims[tab.dimKey] : null;
                      return d ? `${d.widthMm}×${d.depthMm}×${d.heightMm}mm` : "—";
                    })()}
                  </p>
                </div>
              </div>
            )}

            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary-50">
                <div className="text-center">
                  <Loader2 className="h-16 w-16 animate-spin text-primary-500 mx-auto" />
                  <p className="mt-5 text-xl font-bold text-primary-900">AI 디자인 생성 중…</p>
                  <p className="mt-1.5 text-sm text-primary-900/50">DALL-E 3 HD · 약 15–25초</p>
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

          {/* 갤러리 (이전 시안) — 2장 이상부터 */}
          {renders.length > 1 && (
            <div className="absolute left-3 right-3 top-3 flex gap-1.5 overflow-x-auto">
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
                    className={`shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${
                      sel
                        ? "border-primary-500 ring-2 ring-white"
                        : "border-white/60 hover:border-white"
                    }`}
                  >
                    <img src={r.refinedUrl || r.url} alt={`v${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {/* 채팅 히스토리 (1차 생성 후 = 투명, 생성 전 = 숨김) */}
          {hasGenerated && (
            <div className="absolute inset-x-0 bottom-[88px] max-h-48 overflow-y-auto px-5 py-3 space-y-2 bg-gradient-to-t from-black/40 via-black/20 to-transparent backdrop-blur-[2px] pointer-events-none">
              {renders.slice(-3).map((r, i) => (
                <div key={i} className="text-xs text-white/90 drop-shadow-md">
                  <span className="font-bold opacity-70">→ </span>
                  {r.prompt}
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}

          {/* 프롬프트 입력 바 (생성 전 = 80% 투명, 생성 후 = 흰색 sticky 하단) */}
          <div
            className={`absolute inset-x-0 bottom-0 p-3 transition-all ${
              hasGenerated ? "bg-white shadow-lg" : "bg-white/80 backdrop-blur-md"
            }`}
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                {!hasGenerated && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {STYLE_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(currentPrompt ? `${currentPrompt}, ${p}` : p)}
                        className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-primary-900/70 hover:border-primary-400 hover:text-primary-900"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                )}
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
                      ? "예: 소파를 회색 패브릭으로 바꿔줘 / TV 뒷벽에 우드 패널"
                      : "원하는 스타일·자재·분위기를 입력하세요. 예: 모던 미니멀, 화이트 + 라이트 우드, 따뜻한 자연광"
                  }
                  rows={hasGenerated ? 1 : 2}
                  className="w-full resize-none rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm text-primary-900 outline-none placeholder:text-primary-900/40 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !currentPrompt.trim()}
                className="shrink-0 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-500 px-4 text-sm font-semibold text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">생성</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]">
                      <Hexagon className="h-2.5 w-2.5 fill-white" /> 1
                    </span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </div>
            )}
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
