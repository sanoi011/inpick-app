/**
 * EditableRenderCanvas — 1차 AI 렌더 이미지 위에 layer polygon overlay + 클릭 hit-test.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §9-5
 *
 * 동작:
 *  - 이미지 위에 SVG polygon overlay
 *  - hover 시 layer highlight
 *  - 클릭 시 onSelectLayer 콜백
 *  - 자재 적용된 layer는 materialLabel 뱃지 표시
 *  - confidence < 0.5 layer는 점선으로 표시
 */
"use client";

import { useMemo, useState } from "react";
import type { EditableRenderLayer } from "@/lib/inpick/editable-render/types";
import { selectLayerAt } from "@/lib/inpick/editable-render/hit-test";

interface Props {
  imageUrl: string;
  layers: EditableRenderLayer[];
  selectedLayerId?: string | null;
  onSelectLayer?: (layer: EditableRenderLayer | null) => void;
  /** 비활성화 (보기 전용) */
  readOnly?: boolean;
  /** layer overlay 표시 여부 — false면 이미지만 */
  showOverlay?: boolean;
  className?: string;
}

const COLOR_BY_SURFACE: Record<string, { fill: string; stroke: string }> = {
  floor: { fill: "rgba(217, 119, 6, 0.18)", stroke: "rgb(217, 119, 6)" }, // amber
  wall: { fill: "rgba(59, 130, 246, 0.18)", stroke: "rgb(59, 130, 246)" }, // blue
  ceiling: { fill: "rgba(168, 85, 247, 0.18)", stroke: "rgb(168, 85, 247)" }, // purple
  window: { fill: "rgba(14, 165, 233, 0.20)", stroke: "rgb(14, 165, 233)" }, // sky
  door: { fill: "rgba(234, 88, 12, 0.20)", stroke: "rgb(234, 88, 12)" }, // orange
  baseboard: { fill: "rgba(100, 116, 139, 0.15)", stroke: "rgb(100, 116, 139)" },
  molding: { fill: "rgba(100, 116, 139, 0.15)", stroke: "rgb(100, 116, 139)" },
  counter: { fill: "rgba(132, 204, 22, 0.20)", stroke: "rgb(132, 204, 22)" },
  cabinet: { fill: "rgba(132, 204, 22, 0.20)", stroke: "rgb(132, 204, 22)" },
  tile_wall: { fill: "rgba(14, 165, 233, 0.20)", stroke: "rgb(14, 165, 233)" },
  fixture: { fill: "rgba(244, 63, 94, 0.18)", stroke: "rgb(244, 63, 94)" },
  signage: { fill: "rgba(236, 72, 153, 0.20)", stroke: "rgb(236, 72, 153)" },
  storefront_glass: { fill: "rgba(14, 165, 233, 0.20)", stroke: "rgb(14, 165, 233)" },
  facade_wall: { fill: "rgba(59, 130, 246, 0.18)", stroke: "rgb(59, 130, 246)" },
  furniture: { fill: "rgba(132, 204, 22, 0.20)", stroke: "rgb(132, 204, 22)" },
  unknown: { fill: "rgba(115, 115, 115, 0.15)", stroke: "rgb(115, 115, 115)" },
};

function polygonToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x * 100} ${first.y * 100} ${rest
    .map((p) => `L ${p.x * 100} ${p.y * 100}`)
    .join(" ")} Z`;
}

export default function EditableRenderCanvas({
  imageUrl,
  layers,
  selectedLayerId,
  onSelectLayer,
  readOnly = false,
  showOverlay = true,
  className,
}: Props) {
  const [hoverLayerId, setHoverLayerId] = useState<string | null>(null);

  // zIndex DESC로 정렬 → 렌더 순서 (상위 layer 위에)
  const sortedLayers = useMemo(
    () => [...layers].sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onSelectLayer) return;
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const point = {
      x: (evt.clientX - rect.left) / rect.width,
      y: (evt.clientY - rect.top) / rect.height,
    };
    const hit = selectLayerAt(point, layers);
    onSelectLayer(hit);
  };

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      {/* 배경 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="AI 렌더 이미지"
        className="block w-full h-auto rounded-xl object-contain"
        draggable={false}
      />

      {/* SVG overlay */}
      {showOverlay && layers.length > 0 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleClick}
          onMouseLeave={() => setHoverLayerId(null)}
          className={`absolute inset-0 h-full w-full ${
            readOnly ? "pointer-events-none" : "cursor-pointer"
          }`}
        >
          {sortedLayers.map((layer) => {
            const color =
              COLOR_BY_SURFACE[layer.surfaceType] || COLOR_BY_SURFACE.unknown;
            const isSelected = selectedLayerId === layer.id;
            const isHover = hoverLayerId === layer.id;
            const isLowConfidence = layer.confidence < 0.5;
            const fillOpacity = isSelected ? 0.55 : isHover ? 0.35 : 0.18;
            return (
              <path
                key={layer.id}
                d={polygonToPath(layer.polygon)}
                fill={color.fill.replace(/[\d.]+\)$/, `${fillOpacity})`)}
                stroke={color.stroke}
                strokeWidth={isSelected ? 0.6 : isHover ? 0.4 : 0.25}
                strokeDasharray={isLowConfidence ? "1.2 0.8" : undefined}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() => setHoverLayerId(layer.id)}
                style={{ transition: "fill-opacity 120ms ease-out" }}
              />
            );
          })}

          {/* materialLabel 뱃지 — 자재 확정된 layer만 표시 */}
          {sortedLayers
            .filter((l) => l.materialProductId && l.materialLabel)
            .map((layer) => {
              const cx = layer.bbox.x + layer.bbox.width / 2;
              const cy = layer.bbox.y + layer.bbox.height / 2;
              return (
                <g
                  key={`badge-${layer.id}`}
                  transform={`translate(${cx * 100} ${cy * 100})`}
                  pointerEvents="none"
                >
                  <rect
                    x={-6}
                    y={-1.6}
                    width={12}
                    height={3.2}
                    rx={1.6}
                    fill="rgba(34, 197, 94, 0.92)"
                  />
                  <text
                    x={0}
                    y={0.6}
                    fontSize={2}
                    fontWeight={700}
                    fill="white"
                    textAnchor="middle"
                  >
                    ✓ {layer.materialLabel!.slice(0, 8)}
                  </text>
                </g>
              );
            })}
        </svg>
      )}

      {/* hover 라벨 */}
      {hoverLayerId && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
          {(() => {
            const l = layers.find((x) => x.id === hoverLayerId);
            if (!l) return "";
            return `${l.labelKo} (신뢰도 ${(l.confidence * 100).toFixed(0)}%)`;
          })()}
        </div>
      )}
    </div>
  );
}
