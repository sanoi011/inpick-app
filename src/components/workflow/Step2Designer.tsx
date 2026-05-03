/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wand2, Hexagon, Loader2, Check, Sparkles, ChevronRight, AlertCircle } from "lucide-react";
import type { BasicInfoData } from "./BasicInfoCard";
import type { NormalizedFloorplan } from "./Step1Cards";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";

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

const STYLES = [
  { v: "modern", label: "모던", prompt: "modern minimal" },
  { v: "natural", label: "내추럴", prompt: "natural warm wood tones" },
  { v: "classic", label: "클래식", prompt: "classic elegant" },
  { v: "minimal", label: "미니멀", prompt: "ultra minimal japandi" },
  { v: "scandi", label: "스칸디", prompt: "scandinavian bright airy" },
  { v: "industrial", label: "인더스트리얼", prompt: "industrial loft" },
];

const RENDER_COUNT = 4; // DALL-E 3 비용 절약 (8장 → 4장)

import MaterialEditor from "./MaterialEditor";
import type { MaterialRegion } from "./MaterialEditor";

export interface RenderItem {
  url: string;
  revisedPrompt?: string;
  style: string;
  costUsd: number;
  materialRegions?: MaterialRegion[];
  refinedUrl?: string;       // 고화질 재렌더 결과 (data:image/png;base64,...)
  refinedAt?: string;        // ISO timestamp
}

export interface Step2Data {
  selectedByRoom: Record<string, number | null>;
  generations: Record<string, number>;
  rendersByRoom: Record<string, RenderItem[]>;
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
  // "전체" 선택 시 모든 탭 노출
  const availableTabs = useMemo(() => {
    if (rooms.includes("all")) return ROOM_TABS.filter((t) => t.v !== "all");
    return ROOM_TABS.filter((t) => rooms.includes(t.v));
  }, [rooms]);

  const [activeRoom, setActiveRoom] = useState<string>(availableTabs[0]?.v ?? "living");
  const [styleKey, setStyleKey] = useState<string>("modern");
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 정형화된 평면도가 있으면 그걸 우선, 없으면 평형 표준치수 fallback
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

  const selectedIdx = value.selectedByRoom[activeRoom] ?? null;
  const renders = value.rendersByRoom[activeRoom] || [];
  const hasGenerated = renders.length > 0;
  const allRoomsDecided = availableTabs.every((t) => value.selectedByRoom[t.v] != null);

  const handleGenerate = () => {
    if (tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const performGenerate = async () => {
    setConfirmOpen(false);
    setErrorMsg(null);
    const ok = await onConsumeToken(1, "ai_render");
    if (!ok) {
      setInsufficientOpen(true);
      return;
    }
    setGenerating(true);

    try {
      const tab = ROOM_TABS.find((t) => t.v === activeRoom)!;
      const dim = roomDims[tab.dimKey] || roomDims["거실"];
      const stylePrompt = STYLES.find((s) => s.v === styleKey)?.prompt || "modern minimal";

      // RENDER_COUNT 장 병렬 생성 (다양한 시안 위해 약간 다른 feeling 추가)
      const feelings = ["warm cozy", "bright airy", "luxury sophisticated", "clean fresh"];
      const promises = Array.from({ length: RENDER_COUNT }).map((_, i) =>
        fetch("/api/inpick/render-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: tab.label,
            widthMm: dim.widthMm,
            depthMm: dim.depthMm,
            heightMm: dim.heightMm,
            style: stylePrompt,
            expansion: basicInfo.expansionType === "extended",
            feeling: feelings[i % feelings.length],
            size: "1024x1024",
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.text();
            throw new Error(err.slice(0, 200));
          }
          return r.json();
        })
      );

      const results = await Promise.allSettled(promises);
      const items: RenderItem[] = results
        .filter((r): r is PromiseFulfilledResult<{ imageUrl: string; revisedPrompt?: string; costUsd: number }> => r.status === "fulfilled" && !!r.value.imageUrl)
        .map((r) => ({
          url: r.value.imageUrl,
          revisedPrompt: r.value.revisedPrompt,
          style: stylePrompt,
          costUsd: r.value.costUsd ?? 0.08,
        }));

      if (items.length === 0) {
        const firstReason = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstReason?.reason?.message || "렌더링 실패 — OpenAI API 응답 없음");
      }

      onChange({
        ...value,
        rendersByRoom: { ...value.rendersByRoom, [activeRoom]: items },
        generations: {
          ...value.generations,
          [activeRoom]: (value.generations[activeRoom] ?? 0) + 1,
        },
      });
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* 좌측 사이드: 방 탭 */}
      <aside className="lg:col-span-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
          방 ({pyeongLabel})
        </p>
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
                {decided && (
                  <Check className={`h-3.5 w-3.5 ${sel ? "text-white" : "text-primary-600"}`} />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 중앙: 디자인 시안 */}
      <section className="lg:col-span-7">
        <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/75 p-7 shadow-card backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-tight text-primary-900/60">
                {availableTabs.find((t) => t.v === activeRoom)?.label} · AI 디자인
              </p>
              <p className="mt-0.5 text-[0.72rem] text-primary-900/40">
                {(() => {
                  const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                  const d = tab ? roomDims[tab.dimKey] : null;
                  return d
                    ? `치수 ${d.widthMm} × ${d.depthMm} × ${d.heightMm} mm · 생성 `
                    : "생성 ";
                })()}
                <span className="tabular font-semibold">
                  {value.generations[activeRoom] ?? 0}
                </span>
                회
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
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
              스타일
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.v}
                  onClick={() => setStyleKey(s.v)}
                  className={`rounded-full border px-3 py-1 text-[0.78rem] font-semibold tracking-tight transition-all ${
                    styleKey === s.v
                      ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                      : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">생성 실패</div>
                <div className="mt-0.5 opacity-80">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* 4장 시안 그리드 */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {Array.from({ length: RENDER_COUNT }).map((_, i) => {
              const isSel = selectedIdx === i;
              const item = renders[i];
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
                  {!item && (
                    <div className="flex h-full items-center justify-center bg-primary-50/50">
                      {generating ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
                      ) : (
                        <span className="text-[0.7rem] font-medium tabular text-primary-900/30">
                          #{i + 1}
                        </span>
                      )}
                    </div>
                  )}
                  {item && (
                    <img
                      src={item.url}
                      alt={`design-${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {item && (
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

          {/* 자재 수정 — 시안 선택 후 노출 */}
          {selectedIdx != null && renders[selectedIdx] && (
            <MaterialEditor
              roomLabel={availableTabs.find((t) => t.v === activeRoom)?.label || activeRoom}
              styleHint={STYLES.find((s) => s.v === styleKey)?.prompt}
              renderItem={renders[selectedIdx]}
              tokenBalance={tokenBalance}
              onConsumeToken={onConsumeToken}
              onUpdate={(updated) => {
                const next = [...renders];
                next[selectedIdx] = updated;
                onChange({
                  ...value,
                  rendersByRoom: { ...value.rendersByRoom, [activeRoom]: next },
                });
              }}
            />
          )}
        </div>
      </section>

      {/* 우측: 선택된 디자인 요약 */}
      <aside className="lg:col-span-3">
        <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/75 p-6 shadow-card backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
          />
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
            선택 현황
          </p>
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
            견적·자재 보기
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
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                AI 디자인 생성
              </h3>
              <p className="mt-2 text-sm text-primary-900/70">
                {RENDER_COUNT}장 동시 생성 · <span className="font-bold text-token-400">⬢ 1 토큰</span> 사용
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
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                토큰이 부족합니다
              </h3>
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

