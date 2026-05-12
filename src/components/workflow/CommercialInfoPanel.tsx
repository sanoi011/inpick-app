/**
 * CommercialInfoPanel — Step1 상가 모드 입력 패널.
 *
 * 가이드: c:\Users\user\Downloads\inpick-commercial-editable-render-workflow-plan-20260511.md §2-2 / §10-1
 */
"use client";

import { useState, useCallback } from "react";
import { Store, Building2, ChefHat, Scissors, Stethoscope, GraduationCap, Briefcase, ShoppingBag } from "lucide-react";
import type {
  CommercialBusinessType,
  CommercialProgramSpec,
  CommercialSystemRequirement,
  CommercialZoneSpec,
} from "@/lib/inpick/workflow/project-mode";
import { businessTypeLabelKo } from "@/lib/inpick/workflow/project-mode";
import { commercialZoneTemplates, defaultRequiredSystems } from "@/lib/inpick/commercial/templates";
import CommercialZoneEditor from "./CommercialZoneEditor";

interface Props {
  value?: Partial<CommercialProgramSpec>;
  onChange?: (spec: CommercialProgramSpec) => void;
}

const BUSINESS_TYPES: Array<{ key: CommercialBusinessType; icon: typeof Store }> = [
  { key: "cafe", icon: ChefHat },
  { key: "restaurant", icon: ChefHat },
  { key: "retail", icon: ShoppingBag },
  { key: "beauty_salon", icon: Scissors },
  { key: "clinic", icon: Stethoscope },
  { key: "academy", icon: GraduationCap },
  { key: "office", icon: Briefcase },
  { key: "bakery", icon: ChefHat },
  { key: "bar", icon: Store },
  { key: "gym", icon: Building2 },
  { key: "studio", icon: Store },
  { key: "other_commercial", icon: Store },
];

const SYSTEM_LABELS: Record<CommercialSystemRequirement, string> = {
  demolition: "철거",
  flooring: "바닥",
  wall_finish: "벽 마감",
  ceiling: "천장",
  lighting: "조명",
  electrical_upgrade: "전기 증설",
  plumbing: "급배수",
  gas: "가스",
  kitchen_exhaust: "주방/후드",
  hvac: "냉난방/환기",
  fire_sprinkler: "소방",
  signage: "간판",
  facade: "파사드",
  custom_millwork: "맞춤 가구",
  restroom: "화장실",
  waterproofing: "방수",
  soundproofing: "방음",
  network_cctv: "네트워크/CCTV",
};

export default function CommercialInfoPanel({ value, onChange }: Props) {
  const [businessType, setBusinessType] = useState<CommercialBusinessType>(
    value?.businessType || "cafe",
  );
  const [areaM2, setAreaM2] = useState(value?.areaM2 || 33);
  const [ceilingHeightMm, setCeilingHeightMm] = useState(value?.ceilingHeightMm || 2700);
  const [frontWidthMm, setFrontWidthMm] = useState(value?.frontWidthMm || 0);
  const [depthMm, setDepthMm] = useState(value?.depthMm || 0);
  const [requiredSystems, setRequiredSystems] = useState<CommercialSystemRequirement[]>(
    value?.requiredSystems || defaultRequiredSystems("cafe"),
  );
  const [hasFloorPlan, setHasFloorPlan] = useState(value?.hasExistingFloorPlan || false);
  const [restroomIncluded, setRestroomIncluded] = useState(value?.restroomIncluded ?? true);
  const [kitchenRequired, setKitchenRequired] = useState(value?.kitchenRequired || false);
  const [zones, setZones] = useState<CommercialZoneSpec[]>(
    value?.zones && value.zones.length > 0
      ? value.zones
      : commercialZoneTemplates(value?.businessType || "cafe"),
  );

  const buildAndEmit = useCallback(
    (overrides?: Partial<CommercialProgramSpec>) => {
      const spec: CommercialProgramSpec = {
        projectMode: "commercial",
        businessType,
        businessTypeLabelKo: businessTypeLabelKo(businessType),
        areaM2,
        areaPyeong: Math.round(areaM2 / 3.3058),
        ceilingHeightMm,
        frontWidthMm: frontWidthMm || undefined,
        depthMm: depthMm || undefined,
        hasExistingFloorPlan: hasFloorPlan,
        hasPhotos: false,
        frontFacadeIncluded: requiredSystems.includes("facade"),
        restroomIncluded,
        wetAreaRequired: requiredSystems.includes("plumbing"),
        kitchenRequired,
        gasRequired: requiredSystems.includes("gas"),
        exhaustRequired: requiredSystems.includes("kitchen_exhaust"),
        electricalUpgradeRequired: requiredSystems.includes("electrical_upgrade"),
        fireSafetyRequired: requiredSystems.includes("fire_sprinkler"),
        requiredSystems,
        zones,
        ...overrides,
      };
      onChange?.(spec);
    },
    [
      businessType,
      areaM2,
      ceilingHeightMm,
      frontWidthMm,
      depthMm,
      requiredSystems,
      hasFloorPlan,
      restroomIncluded,
      kitchenRequired,
      zones,
      onChange,
    ],
  );

  const handleZonesChange = (newZones: CommercialZoneSpec[]) => {
    setZones(newZones);
    setTimeout(() => buildAndEmit({ zones: newZones }), 0);
  };

  const toggleSystem = (sys: CommercialSystemRequirement) => {
    const next = requiredSystems.includes(sys)
      ? requiredSystems.filter((s) => s !== sys)
      : [...requiredSystems, sys];
    setRequiredSystems(next);
    setTimeout(() => buildAndEmit(), 0);
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white/80 backdrop-blur border border-amber-200/60 p-4 shadow-sm">
      {/* 업종 */}
      <div>
        <p className="text-xs font-bold text-primary-700 mb-2">업종</p>
        <div className="grid grid-cols-3 gap-2">
          {BUSINESS_TYPES.map((b) => {
            const Icon = b.icon;
            const active = businessType === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => {
                  setBusinessType(b.key);
                  const newSystems = defaultRequiredSystems(b.key);
                  setRequiredSystems(newSystems);
                  // 업종 변경 시 zones도 새 템플릿으로 리셋 (사용자가 면적 입력 이전이면 부담 없음)
                  const newZones = commercialZoneTemplates(b.key);
                  setZones(newZones);
                  setTimeout(
                    () => buildAndEmit({ businessType: b.key, requiredSystems: newSystems, zones: newZones }),
                    0,
                  );
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[0.7rem] transition ${
                  active
                    ? "border-primary-500 bg-primary-50 text-primary-900 font-bold"
                    : "border-amber-200/60 bg-white text-primary-900/70 hover:border-primary-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {businessTypeLabelKo(b.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 면적 / 층고 / 전면 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-primary-700 mb-1">면적 (m²)</p>
          <input
            type="number"
            value={areaM2}
            min={5}
            max={500}
            onChange={(e) => {
              setAreaM2(Number(e.target.value) || 0);
              setTimeout(() => buildAndEmit(), 0);
            }}
            className="w-full rounded-lg border border-amber-200/70 bg-white px-3 py-1.5 text-sm"
          />
          <p className="text-[0.6rem] text-primary-900/50 mt-0.5">
            약 {Math.round(areaM2 / 3.3058)}평
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-primary-700 mb-1">층고 (mm)</p>
          <input
            type="number"
            value={ceilingHeightMm}
            min={2000}
            max={5000}
            step={100}
            onChange={(e) => {
              setCeilingHeightMm(Number(e.target.value) || 2700);
              setTimeout(() => buildAndEmit(), 0);
            }}
            className="w-full rounded-lg border border-amber-200/70 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-primary-700 mb-1">전면 폭 (mm)</p>
          <input
            type="number"
            value={frontWidthMm}
            min={0}
            placeholder="모르면 비워두세요"
            onChange={(e) => {
              setFrontWidthMm(Number(e.target.value) || 0);
              setTimeout(() => buildAndEmit(), 0);
            }}
            className="w-full rounded-lg border border-amber-200/70 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-primary-700 mb-1">깊이 (mm)</p>
          <input
            type="number"
            value={depthMm}
            min={0}
            placeholder="모르면 비워두세요"
            onChange={(e) => {
              setDepthMm(Number(e.target.value) || 0);
              setTimeout(() => buildAndEmit(), 0);
            }}
            className="w-full rounded-lg border border-amber-200/70 bg-white px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* 시스템 요구사항 */}
      <div>
        <p className="text-xs font-bold text-primary-700 mb-2">시공 범위 / 시스템</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SYSTEM_LABELS) as CommercialSystemRequirement[]).map((sys) => {
            const active = requiredSystems.includes(sys);
            return (
              <button
                key={sys}
                type="button"
                onClick={() => toggleSystem(sys)}
                className={`rounded-full border px-2.5 py-1 text-[0.65rem] transition ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
                    : "border-amber-200/60 bg-white text-primary-900/60 hover:border-primary-300"
                }`}
              >
                {SYSTEM_LABELS[sys]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone 편집 */}
      <CommercialZoneEditor
        businessType={businessType}
        totalAreaM2={areaM2}
        zones={zones}
        onChange={handleZonesChange}
      />

      {/* 기타 옵션 */}
      <div className="flex flex-wrap gap-2 text-[0.7rem]">
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={hasFloorPlan}
            onChange={(e) => {
              setHasFloorPlan(e.target.checked);
              setTimeout(() => buildAndEmit(), 0);
            }}
          />
          도면 보유
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={restroomIncluded}
            onChange={(e) => {
              setRestroomIncluded(e.target.checked);
              setTimeout(() => buildAndEmit(), 0);
            }}
          />
          화장실 포함
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={kitchenRequired}
            onChange={(e) => {
              setKitchenRequired(e.target.checked);
              setTimeout(() => buildAndEmit(), 0);
            }}
          />
          주방 포함
        </label>
      </div>

      {/* 안내 */}
      <p className="text-[0.65rem] text-primary-900/50 leading-relaxed">
        {hasFloorPlan
          ? "도면이 있으면 Step2에서 업로드/실측해서 정확도를 올릴 수 있습니다."
          : "도면이 없으면 입력한 면적/층고/전면 폭 기준으로 임시 매장 쉘을 만들어 Step2로 진행합니다. 도면 추가 시 정확도가 올라갑니다."}
      </p>
    </div>
  );
}
