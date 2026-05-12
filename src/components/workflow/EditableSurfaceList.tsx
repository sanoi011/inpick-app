/**
 * EditableSurfaceList — Editable Render layer 좌측 리스트.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §9
 *
 * 동작:
 *  - layers를 surfaceType으로 그룹화
 *  - 클릭 시 onSelectLayer 콜백 (Canvas와 양방향 동기화)
 *  - 자재 확정/미확정/신뢰도 상태 시각화
 */
"use client";

import { useMemo } from "react";
import {
  Layers as LayersIcon,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  surfaceTypeLabelKo,
  type EditableRenderLayer,
  type SurfaceType,
} from "@/lib/inpick/editable-render/types";

interface Props {
  layers: EditableRenderLayer[];
  selectedLayerId?: string | null;
  onSelectLayer: (layer: EditableRenderLayer) => void;
  /** 해당 surfaceType만 표시 (필터) */
  filterSurfaceTypes?: SurfaceType[];
  className?: string;
}

// 표시 순서 (시공 흐름 기반)
const TYPE_ORDER: SurfaceType[] = [
  "floor",
  "wall",
  "tile_wall",
  "ceiling",
  "window",
  "door",
  "baseboard",
  "molding",
  "counter",
  "cabinet",
  "fixture",
  "signage",
  "storefront_glass",
  "facade_wall",
  "furniture",
  "unknown",
];

export default function EditableSurfaceList({
  layers,
  selectedLayerId,
  onSelectLayer,
  filterSurfaceTypes,
  className,
}: Props) {
  const grouped = useMemo(() => {
    const filtered = filterSurfaceTypes
      ? layers.filter((l) => filterSurfaceTypes.includes(l.surfaceType))
      : layers;
    const map: Record<string, EditableRenderLayer[]> = {};
    for (const layer of filtered) {
      const key = layer.surfaceType;
      if (!map[key]) map[key] = [];
      map[key].push(layer);
    }
    // surface 내부에서는 instanceIndex 오름차순
    for (const key of Object.keys(map)) {
      map[key].sort(
        (a: EditableRenderLayer, b: EditableRenderLayer) =>
          a.instanceIndex - b.instanceIndex,
      );
    }
    // TYPE_ORDER 기준 정렬
    return TYPE_ORDER.filter((t) => !!map[t]).map((t) => ({
      type: t,
      items: map[t],
    }));
  }, [layers, filterSurfaceTypes]);

  const totalCount = layers.length;
  const confirmedCount = layers.filter((l) => l.materialProductId).length;

  return (
    <div className={`flex flex-col h-full ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
          <LayersIcon className="h-3.5 w-3.5 text-primary-500" />
          공간 부위 ({totalCount})
        </div>
        <span className="text-[10px] text-gray-500">
          확정 {confirmedCount}/{totalCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-[11px] text-gray-400">
            분석된 부위가 없습니다.
            <br />
            이미지 위에 클릭으로 영역을 추가할 수 있습니다.
          </div>
        ) : (
          grouped.map(({ type, items }) => (
            <div key={type} className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                {surfaceTypeLabelKo(type)}
              </p>
              <div className="space-y-0.5">
                {items.map((layer) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    selected={selectedLayerId === layer.id}
                    onSelect={() => onSelectLayer(layer)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  selected,
  onSelect,
}: {
  layer: EditableRenderLayer;
  selected: boolean;
  onSelect: () => void;
}) {
  const confirmed = !!layer.materialProductId;
  const lowConfidence = layer.confidence < 0.5;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-all ${
        selected
          ? "bg-primary-500 text-white shadow-sm"
          : "bg-white border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{layer.labelKo}</span>
          {layer.locked && <Lock className="h-2.5 w-2.5 flex-shrink-0" />}
        </div>
        {layer.materialLabel && (
          <p
            className={`mt-0.5 truncate text-[10px] ${
              selected ? "text-white/80" : "text-gray-500"
            }`}
            title={layer.materialLabel}
          >
            {layer.materialLabel}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {confirmed ? (
          <CheckCircle2
            className={`h-3 w-3 ${selected ? "text-white" : "text-emerald-500"}`}
          />
        ) : lowConfidence ? (
          <AlertTriangle
            className={`h-3 w-3 ${selected ? "text-white/80" : "text-amber-500"}`}
          />
        ) : (
          <span
            className={`h-2 w-2 rounded-full ${
              selected ? "bg-white/60" : "bg-gray-300"
            }`}
          />
        )}
        {layer.areaM2 && (
          <span
            className={`text-[9px] ${selected ? "text-white/70" : "text-gray-400"}`}
          >
            {layer.areaM2.toFixed(1)}㎡
          </span>
        )}
      </div>
    </button>
  );
}
