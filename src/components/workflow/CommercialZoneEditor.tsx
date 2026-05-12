/**
 * CommercialZoneEditor — 상가/사무실 zone 편집 패널.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §8-2
 *
 * UI:
 *  - zone 행: 이름(input) / 유형(select) / 면적(m²) / 우선순위 / 삭제
 *  - "+ zone 추가" 버튼
 *  - 면적 합산 vs 전체 면적 비교 경고
 *  - 비어 있으면 commercialZoneTemplates(businessType) 기본값 채움
 */
"use client";

import { useMemo } from "react";
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { commercialZoneTemplates } from "@/lib/inpick/commercial/templates";
import type {
  CommercialBusinessType,
  CommercialZoneSpec,
} from "@/lib/inpick/workflow/project-mode";

const ZONE_TYPE_OPTIONS: Array<{ v: CommercialZoneSpec["type"]; label: string }> = [
  { v: "main_hall", label: "메인 홀" },
  { v: "counter", label: "카운터" },
  { v: "kitchen", label: "주방/조리실" },
  { v: "storage", label: "창고" },
  { v: "restroom", label: "화장실" },
  { v: "treatment_room", label: "트리트먼트 룸" },
  { v: "fitting_room", label: "피팅룸" },
  { v: "office_room", label: "사무 공간" },
  { v: "front_facade", label: "파사드" },
  { v: "signage", label: "간판" },
  { v: "corridor", label: "복도" },
  { v: "other", label: "기타" },
];

interface Props {
  businessType: CommercialBusinessType;
  totalAreaM2: number;
  zones: CommercialZoneSpec[];
  onChange: (zones: CommercialZoneSpec[]) => void;
}

export default function CommercialZoneEditor({
  businessType,
  totalAreaM2,
  zones,
  onChange,
}: Props) {
  // 비어있으면 템플릿 자동 채움
  const effectiveZones = useMemo(() => {
    if (!zones || zones.length === 0) return commercialZoneTemplates(businessType);
    return zones;
  }, [zones, businessType]);

  const sumAreaM2 = effectiveZones.reduce((s, z) => s + (z.areaM2 || 0), 0);
  const diffM2 = totalAreaM2 - sumAreaM2;
  const ratio = totalAreaM2 > 0 ? sumAreaM2 / totalAreaM2 : 0;
  const status: "ok" | "under" | "over" | "empty" =
    sumAreaM2 === 0 ? "empty" : ratio > 1.1 ? "over" : ratio < 0.9 ? "under" : "ok";

  const updateZone = (index: number, patch: Partial<CommercialZoneSpec>) => {
    const next = [...effectiveZones];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeZone = (index: number) => {
    const next = effectiveZones.filter((_, i) => i !== index);
    onChange(next);
  };

  const addZone = () => {
    const id = `cz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newZone: CommercialZoneSpec = {
      id,
      nameKo: "신규 공간",
      type: "other",
      priority: effectiveZones.length + 1,
      areaM2: Math.max(0, diffM2 > 0 ? Math.round(diffM2) : 0),
    };
    onChange([...effectiveZones, newZone]);
  };

  const autoDistribute = () => {
    if (totalAreaM2 <= 0 || effectiveZones.length === 0) return;
    // 업종 템플릿 기본 비율 사용 — 없으면 균등 분배
    const tplDefaults = commercialZoneTemplates(businessType);
    const next = effectiveZones.map((z) => {
      const tpl = tplDefaults.find((t) => t.type === z.type);
      const ratio = tpl
        ? // ratio 추정 — main_hall 0.5, counter 0.1, kitchen 0.2, restroom 0.07, storage 0.05, etc.
          DEFAULT_RATIOS[z.type] ?? 0.05
        : 1 / effectiveZones.length;
      return { ...z, areaM2: Math.round(totalAreaM2 * ratio * 10) / 10 };
    });
    // 정규화 — 합이 totalAreaM2와 일치하도록 마지막 zone 조정
    const sum = next.reduce((s, z) => s + (z.areaM2 || 0), 0);
    if (sum > 0 && Math.abs(sum - totalAreaM2) > 0.5) {
      const last = next[next.length - 1];
      next[next.length - 1] = {
        ...last,
        areaM2: Math.max(0, Math.round((last.areaM2! + (totalAreaM2 - sum)) * 10) / 10),
      };
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-primary-700">공간 구성 (zone)</p>
          <p className="text-[0.65rem] text-primary-900/50 mt-0.5">
            업종 템플릿 기본값. 면적은 직접 조정 가능합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={autoDistribute}
          disabled={totalAreaM2 <= 0}
          className="rounded-full border border-primary-200 bg-white px-3 py-1 text-[0.65rem] font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
        >
          업종 비율로 자동 분배
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-200/60 bg-white">
        <table className="w-full text-[0.7rem]">
          <thead className="bg-amber-50/60 text-primary-700">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">이름</th>
              <th className="px-2 py-1.5 text-left font-semibold">유형</th>
              <th className="px-2 py-1.5 text-right font-semibold">면적 (m²)</th>
              <th className="px-2 py-1.5 text-right font-semibold">평수</th>
              <th className="px-2 py-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {effectiveZones.map((z, idx) => (
              <tr key={z.id} className="hover:bg-amber-50/30">
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={z.nameKo}
                    onChange={(e) => updateZone(idx, { nameKo: e.target.value })}
                    className="w-full rounded border border-amber-100 bg-white px-1.5 py-0.5"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={z.type}
                    onChange={(e) =>
                      updateZone(idx, {
                        type: e.target.value as CommercialZoneSpec["type"],
                      })
                    }
                    className="w-full rounded border border-amber-100 bg-white px-1.5 py-0.5"
                  >
                    {ZONE_TYPE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={z.areaM2 ?? ""}
                    min={0}
                    step={0.5}
                    onChange={(e) =>
                      updateZone(idx, { areaM2: Number(e.target.value) || 0 })
                    }
                    className="w-20 text-right rounded border border-amber-100 bg-white px-1.5 py-0.5"
                  />
                </td>
                <td className="px-2 py-1 text-right text-primary-900/60">
                  {((z.areaM2 || 0) / 3.3058).toFixed(1)}평
                </td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => removeZone(idx)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title="삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-amber-50/60">
            <tr>
              <td colSpan={2} className="px-2 py-1.5 text-right font-semibold text-primary-700">
                합계
              </td>
              <td className="px-2 py-1.5 text-right font-bold text-primary-900">
                {sumAreaM2.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right text-primary-900/60">
                {(sumAreaM2 / 3.3058).toFixed(1)}평
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addZone}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-white px-3 py-1 text-[0.7rem] font-semibold text-primary-700 hover:bg-primary-50"
        >
          <Plus className="h-3 w-3" />
          공간 추가
        </button>

        {totalAreaM2 > 0 && (
          <div className="flex items-center gap-1.5 text-[0.65rem]">
            {status === "empty" && (
              <span className="text-primary-900/50">면적을 입력해주세요</span>
            )}
            {status === "ok" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                전체 면적과 일치 ({(ratio * 100).toFixed(0)}%)
              </span>
            )}
            {status === "under" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {Math.abs(diffM2).toFixed(1)}m² 부족 ({(ratio * 100).toFixed(0)}%)
              </span>
            )}
            {status === "over" && (
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {Math.abs(diffM2).toFixed(1)}m² 초과 ({(ratio * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 업종 무관 기본 비율 (대략) — autoDistribute 폴백
const DEFAULT_RATIOS: Record<CommercialZoneSpec["type"], number> = {
  main_hall: 0.5,
  counter: 0.08,
  kitchen: 0.18,
  storage: 0.05,
  restroom: 0.06,
  treatment_room: 0.15,
  fitting_room: 0.03,
  office_room: 0.5,
  front_facade: 0.03,
  signage: 0.02,
  corridor: 0.05,
  other: 0.03,
};
