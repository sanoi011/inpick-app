/* eslint-disable @next/next/no-img-element */
/**
 * 자재 수정 에디터 — 1차 렌더 위에 SVG 폴리곤 오버레이로 클릭 가능 영역 표시.
 *
 * 흐름:
 * 1. "자재 영역 분석 (1토큰)" → /api/inpick/extract-material-regions
 * 2. SVG 폴리곤 오버레이 → 사용자가 영역 클릭
 * 3. 자재 입력 모달 → 영역 자재 수정
 * 4. "고화질 재렌더 (2토큰)" → /api/inpick/refine-render (gpt-image-1 inpaint)
 *
 * 자재 수정을 안 하면 그냥 다음 단계로 — 모든 단계가 옵셔널.
 */
"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hexagon, Loader2, Wand2, Sparkles, X, Edit3 } from "lucide-react";
import type { RenderItem } from "./Step2Designer";

export interface MaterialRegion {
  id: string;
  surface: string;
  detail: string;
  material: string;
  colorHex?: string;
  polygon: [number, number][];
  // 사용자 수정 사항
  newMaterial?: string;
  newColorHex?: string;
}

interface Props {
  roomLabel: string;
  styleHint?: string;
  renderItem: RenderItem;
  tokenBalance: number;
  onConsumeToken: (
    amount: number,
    feature: "ai_render" | "drawing_option",
  ) => Promise<boolean>;
  onUpdate: (next: RenderItem) => void;
}

export default function MaterialEditor({
  roomLabel,
  styleHint,
  renderItem,
  tokenBalance,
  onConsumeToken,
  onUpdate,
}: Props) {
  const regions = renderItem.materialRegions;
  const [extracting, setExtracting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEdits = useMemo(
    () => !!regions?.some((r) => r.newMaterial && r.newMaterial !== r.material),
    [regions],
  );

  // 1) 영역 추출
  const handleExtract = async () => {
    if (tokenBalance < 1) {
      setError("토큰 부족 — 1토큰 필요");
      return;
    }
    const ok = await onConsumeToken(1, "drawing_option");
    if (!ok) {
      setError("토큰 차감 실패");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/inpick/extract-material-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: renderItem.url, roomName: roomLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "영역 추출 실패");
      onUpdate({ ...renderItem, materialRegions: data.regions });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  };

  // 2) 영역의 자재 변경
  const handleRegionEdit = (regionId: string, newMaterial: string, newColorHex?: string) => {
    if (!regions) return;
    const next = regions.map((r) =>
      r.id === regionId ? { ...r, newMaterial, newColorHex } : r,
    );
    onUpdate({ ...renderItem, materialRegions: next });
    setActiveRegionId(null);
  };

  // 3) 마스크 생성 + 고화질 재렌더
  const handleRefine = async () => {
    if (!regions || !hasEdits) return;
    if (tokenBalance < 2) {
      setError("토큰 부족 — 고화질 재렌더는 2토큰 필요");
      return;
    }
    const ok = await onConsumeToken(2, "drawing_option");
    if (!ok) {
      setError("토큰 차감 실패");
      return;
    }
    setRefining(true);
    setError(null);
    try {
      // 수정된 영역만 흰색으로 마스크 그리기
      const editedRegions = regions.filter((r) => r.newMaterial && r.newMaterial !== r.material);
      const maskBase64 = await buildMask(1024, 1024, editedRegions);
      const promptParts = editedRegions.map((r) => `${r.detail}: ${r.newMaterial}`);

      const res = await fetch("/api/inpick/refine-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: renderItem.url,
          maskBase64,
          prompt: promptParts.join("; "),
          roomName: roomLabel,
          styleHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "재렌더 실패");
      onUpdate({
        ...renderItem,
        refinedUrl: data.imageUrl,
        refinedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/30 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold tracking-tight text-primary-900 inline-flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary-500" />
            자재 수정 (선택)
          </p>
          <p className="mt-0.5 text-[0.72rem] text-primary-900/50">
            마음에 안 드는 자재만 클릭해서 교체 → 고화질 재렌더
          </p>
        </div>
        {!regions && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-primary-600 disabled:opacity-60"
          >
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 분석 중… (5–10초)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                자재 영역 분석 시작
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[0.7rem]">
                  <Hexagon className="h-2.5 w-2.5 fill-white" /> 1
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 분석 중 큰 로딩 패널 — 즉시 시각 피드백 */}
      {extracting && (
        <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50/50 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-primary-900">
            AI가 자재 영역을 분석 중입니다
          </p>
          <p className="mt-1 text-xs text-primary-900/60">
            GPT-4o Vision이 바닥·벽·가구·조명 폴리곤 추출 — 5~10초 소요
          </p>
        </div>
      )}
      {refining && (
        <div className="mt-4 rounded-xl border border-primary-300 bg-primary-50 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-primary-900">
            고화질 재렌더 중입니다
          </p>
          <p className="mt-1 text-xs text-primary-900/60">
            gpt-image-1로 수정 영역만 inpaint — 30~60초 소요
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      )}

      {regions && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* 좌: 클릭 가능 SVG 오버레이 이미지 */}
          <div className="relative aspect-square overflow-hidden rounded-xl border border-primary-100 bg-white">
            <img
              src={renderItem.refinedUrl || renderItem.url}
              alt="design"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              {regions.map((r) => {
                const points = r.polygon.map(([x, y]) => `${x},${y}`).join(" ");
                const edited = r.newMaterial && r.newMaterial !== r.material;
                const active = activeRegionId === r.id;
                return (
                  <polygon
                    key={r.id}
                    points={points}
                    onClick={() => setActiveRegionId(r.id)}
                    className="cursor-pointer transition-all"
                    fill={
                      active
                        ? "rgba(247, 59, 32, 0.35)"
                        : edited
                          ? "rgba(245, 158, 11, 0.35)"
                          : "rgba(255, 255, 255, 0.05)"
                    }
                    stroke={
                      active
                        ? "#F73B20"
                        : edited
                          ? "#F59E0B"
                          : "rgba(247, 59, 32, 0.5)"
                    }
                    strokeWidth={active ? 0.005 : 0.003}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            {renderItem.refinedUrl && (
              <div className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                ✓ 고화질
              </div>
            )}
          </div>

          {/* 우: 영역 리스트 */}
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50 mb-2">
              자재 영역 ({regions.length})
            </p>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {regions.map((r) => {
                const edited = r.newMaterial && r.newMaterial !== r.material;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveRegionId(r.id)}
                      onMouseEnter={() => setActiveRegionId(r.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-all ${
                        activeRegionId === r.id
                          ? "border-primary-500 bg-white shadow-sm"
                          : edited
                            ? "border-amber-300 bg-amber-50"
                            : "border-primary-100 bg-white/70 hover:border-primary-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full border border-primary-200 shrink-0"
                            style={{ background: r.newColorHex || r.colorHex || "#fff" }}
                          />
                          <span className="font-semibold text-primary-900 truncate">
                            {r.detail}
                          </span>
                        </div>
                        <span className="text-[0.65rem] text-primary-900/40 shrink-0">
                          {r.surface}
                        </span>
                      </div>
                      <div className="mt-1 text-primary-900/70">
                        {edited ? (
                          <>
                            <span className="line-through opacity-50">{r.material}</span>
                            <span className="ml-1 font-semibold text-amber-700">
                              → {r.newMaterial}
                            </span>
                          </>
                        ) : (
                          r.material
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {hasEdits && (
              <button
                onClick={handleRefine}
                disabled={refining}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {refining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    고화질 재렌더 중… (15–30초)
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    고화질 재렌더 (수정 영역만)
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.7rem]">
                      <Hexagon className="h-3 w-3 fill-white" /> 2
                    </span>
                  </>
                )}
              </button>
            )}

            {!hasEdits && (
              <p className="mt-3 text-[0.7rem] text-primary-900/50 text-center">
                영역을 클릭하면 자재 교체 모달이 열립니다
              </p>
            )}
          </div>
        </div>
      )}

      {/* 자재 교체 모달 */}
      <AnimatePresence>
        {activeRegionId && regions && (
          <RegionEditModal
            region={regions.find((r) => r.id === activeRegionId)!}
            onClose={() => setActiveRegionId(null)}
            onSave={handleRegionEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 마스크 PNG 생성 (canvas → base64) ───
async function buildMask(
  w: number,
  h: number,
  regions: MaterialRegion[],
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // gpt-image-1 마스크 규칙: 투명/검정 = 유지, 흰색 = 재생성
  // 안전하게 RGBA: 검정 채우기 후 영역만 흰색
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#FFFFFF";
  for (const r of regions) {
    ctx.beginPath();
    r.polygon.forEach(([nx, ny], i) => {
      const x = nx * w;
      const y = ny * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  return canvas.toDataURL("image/png");
}

// ─── 자재 교체 모달 ───
const PRESET_MATERIALS = [
  { label: "오크 원목마루", colorHex: "#C8A77D" },
  { label: "월넛 원목마루", colorHex: "#5D3A1A" },
  { label: "화이트 페인트", colorHex: "#FFFFFF" },
  { label: "그레이 페인트", colorHex: "#A8A8A8" },
  { label: "베이지 도배", colorHex: "#E8DCC8" },
  { label: "대리석 타일", colorHex: "#F0EDE8" },
  { label: "포세린 타일", colorHex: "#D8D5D0" },
  { label: "블랙 메탈", colorHex: "#2A2A2A" },
];

function RegionEditModal({
  region,
  onClose,
  onSave,
}: {
  region: MaterialRegion;
  onClose: () => void;
  onSave: (id: string, newMaterial: string, colorHex?: string) => void;
}) {
  const [text, setText] = useState(region.newMaterial || "");
  const [color, setColor] = useState(region.newColorHex || region.colorHex || "");

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
        className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-primary-100 bg-white p-6 shadow-card-hover"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight text-primary-900">
            {region.detail} 자재 변경
          </h3>
          <button onClick={onClose} className="text-primary-900/50 hover:text-primary-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-primary-900/60">
          현재: <span className="font-semibold">{region.material}</span>
        </p>

        <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
          빠른 선택
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {PRESET_MATERIALS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setText(p.label);
                setColor(p.colorHex);
              }}
              className="flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-2 py-1.5 text-xs hover:border-primary-300"
            >
              <span
                className="h-3 w-3 rounded-full border border-primary-200"
                style={{ background: p.colorHex }}
              />
              <span className="text-primary-900/80">{p.label}</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
          또는 직접 입력
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 헤링본 오크 원목마루, 라임스톤 벽"
          className="mt-2 w-full rounded-xl border border-primary-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
          >
            취소
          </button>
          <button
            onClick={() => onSave(region.id, text.trim(), color || undefined)}
            disabled={!text.trim()}
            className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
          >
            적용
          </button>
        </div>
      </motion.div>
    </>
  );
}
