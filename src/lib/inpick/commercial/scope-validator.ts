/**
 * 견적 가능도(readiness) validator.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-4
 *
 * 사용:
 *   const readiness = validateCommercialEstimateReadiness(spec);
 *   if (!readiness.canBuildEstimate) {
 *     // 누락 항목 사용자에게 안내
 *   }
 */
import type { CommercialScopeSpec, EstimateReadiness } from "./scope-spec";

export function validateCommercialEstimateReadiness(
  spec: CommercialScopeSpec,
): EstimateReadiness {
  const requiredMissingFields: string[] = [];
  const optionalMissingFields: string[] = [];

  if (!spec.businessType) requiredMissingFields.push("업종");
  if (!spec.totalAreaM2 || spec.totalAreaM2 <= 0) requiredMissingFields.push("전체 면적");
  if (!spec.zones?.length) requiredMissingFields.push("zone 구성");
  if (!spec.budgetTier) requiredMissingFields.push("예산 등급");

  for (const zone of spec.zones ?? []) {
    if (!zone.areaM2 || zone.areaM2 <= 0) {
      requiredMissingFields.push(`${zone.nameKo} 면적`);
    }
    const hasFloor = zone.surfacePlans.some((s) => s.surfaceType === "floor");
    const hasWall = zone.surfacePlans.some((s) => s.surfaceType === "wall");
    const hasCeiling = zone.surfacePlans.some((s) => s.surfaceType === "ceiling");
    if (!hasFloor) requiredMissingFields.push(`${zone.nameKo} 바닥 마감`);
    if (!hasWall) requiredMissingFields.push(`${zone.nameKo} 벽 마감`);
    if (!hasCeiling) requiredMissingFields.push(`${zone.nameKo} 천장 마감`);
  }

  // 업종별 필수 설비 검사
  const allSystems = [
    ...spec.globalSystems,
    ...spec.zones.flatMap((z) => z.systemPlans),
  ];
  const hasSystem = (t: string) => allSystems.some((s) => s.type === t);

  if (spec.businessType === "restaurant") {
    if (!hasSystem("exhaust_hood")) requiredMissingFields.push("주방 후드/덕트");
    if (!hasSystem("ventilation")) requiredMissingFields.push("환기");
    if (!hasSystem("fire_safety")) requiredMissingFields.push("소방");
    if (!hasSystem("gas")) requiredMissingFields.push("가스");
  } else if (spec.businessType === "cafe" || spec.businessType === "bakery") {
    if (!hasSystem("ventilation")) optionalMissingFields.push("환기");
    if (!hasSystem("hvac")) optionalMissingFields.push("냉난방");
  } else if (spec.businessType === "office") {
    if (!hasSystem("network")) optionalMissingFields.push("LAN/네트워크");
    if (!hasSystem("soundproofing")) optionalMissingFields.push("회의실 방음/흡음");
  } else if (spec.businessType === "beauty_salon" || spec.businessType === "clinic") {
    if (!hasSystem("plumbing")) requiredMissingFields.push("급수");
    if (!hasSystem("drainage")) requiredMissingFields.push("배수");
    if (!hasSystem("ventilation")) optionalMissingFields.push("환기");
  } else if (spec.businessType === "gym") {
    if (!hasSystem("ventilation")) requiredMissingFields.push("환기");
    if (!hasSystem("plumbing") || !hasSystem("drainage")) {
      requiredMissingFields.push("샤워실 급배수");
    }
  }

  if (!spec.ceilingHeightM) optionalMissingFields.push("층고");
  if (spec.siteCondition === "unknown") optionalMissingFields.push("기존 상태(공실/운영중/철거예정)");

  const score = Math.max(
    0,
    1 - requiredMissingFields.length * 0.12 - optionalMissingFields.length * 0.04,
  );

  return {
    canBuildEstimate: requiredMissingFields.length === 0 || score >= 0.7,
    score: Math.round(score * 100) / 100,
    requiredMissingFields,
    optionalMissingFields,
  };
}
