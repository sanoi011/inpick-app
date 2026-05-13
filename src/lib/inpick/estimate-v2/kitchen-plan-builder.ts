/**
 * KitchenPlan builder — 도면/면적/사용자 입력에서 주방 카운터 길이 추정.
 * 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §7-2
 *
 * 우선순위:
 *   1. 사용자 직접 입력 (counterLengthM 명시)
 *   2. 도면 치수에서 주방 벽 길이 (room.widthMm/depthMm 중 긴 변)
 *   3. Vision 카운터 bbox 길이 (향후 — bbox 비율 × 방 길이)
 *   4. 면적 기반 (default lookup table)
 *   5. 기본 3.0m
 */
import type { RoomQuantityBasis } from "./types";

export type KitchenLayoutType = "linear" | "l_shape" | "u_shape" | "island" | "unknown";
export type PlumbingRelocation = "none" | "minor" | "major" | "unknown";
export type KitchenPlanSource =
  | "user_input"
  | "floorplan_inferred"
  | "vision_inferred"
  | "area_inference"
  | "default_inferred";

export interface KitchenPlan {
  projectId: string;
  roomName: string;
  layoutType: KitchenLayoutType;
  counterLengthM: number;
  /** 하부장 길이 (m) — 기본 counterLengthM과 동일 */
  lowerCabinetLengthM: number;
  /** 상부장 길이 (m) — 창문 영역 차감으로 보통 counterLengthM × 0.8 */
  upperCabinetLengthM: number;
  /** 키큰장 개수 — 1ea (냉장고장) 또는 2ea (냉장고장 + 팬트리) */
  tallCabinetEa: number;
  /** 상판 길이 (m) — 기본 counterLengthM과 동일 */
  worktopLengthM: number;
  sinkEa: number;
  faucetEa: number;
  hoodEa: number;
  cooktopEa: number;
  /** 백스플래시 면적 (m²) — 상하부장 사이 벽 (counter × 0.6m 높이) */
  backsplashM2: number;
  plumbingRelocation: PlumbingRelocation;
  /** 추가 콘센트/전용회로 개수 */
  electricalAdditionsEa: number;
  source: KitchenPlanSource;
  confidence: number;
  assumptions: string[];
}

export interface BuildKitchenPlanInput {
  projectId: string;
  roomName: string;
  kitchenBasis?: RoomQuantityBasis;
  /** 사용자 직접 입력 (있으면 최우선) */
  userInput?: Partial<KitchenPlan>;
  /** 도면 치수 — width × depth (mm) */
  floorplanRoom?: { widthMm?: number; depthMm?: number };
  /** 면적 기반 추정 (m²) — basis 없을 때 fallback */
  areaM2?: number;
}

/**
 * 면적 기반 카운터 길이 추정 (한국 표준 주방 layout 기준).
 *
 * <5m²: 2.4m (소형, linear)
 * 5-8m²: 3.0m (표준 linear)
 * 8-12m²: 3.6m (l_shape 또는 긴 linear)
 * ≥12m²: 4.2m (l_shape 또는 u_shape)
 */
function inferCounterLengthFromArea(areaM2: number): number {
  if (areaM2 < 5) return 2.4;
  if (areaM2 < 8) return 3.0;
  if (areaM2 < 12) return 3.6;
  return 4.2;
}

function inferLayoutFromArea(areaM2: number): KitchenLayoutType {
  if (areaM2 < 6) return "linear";
  if (areaM2 < 10) return "linear";
  if (areaM2 < 14) return "l_shape";
  return "u_shape";
}

export function buildKitchenPlan(input: BuildKitchenPlanInput): KitchenPlan {
  const assumptions: string[] = [];
  let source: KitchenPlanSource = "default_inferred";
  let confidence = 0.4;
  let counterLengthM = 3.0;
  let layoutType: KitchenLayoutType = "linear";

  // 1순위: 사용자 입력
  if (input.userInput?.counterLengthM && input.userInput.counterLengthM > 0) {
    counterLengthM = input.userInput.counterLengthM;
    source = "user_input";
    confidence = 1.0;
    assumptions.push(`사용자가 입력한 카운터 길이 ${counterLengthM}m 적용`);
  } else if (input.floorplanRoom?.widthMm && input.floorplanRoom?.depthMm) {
    // 2순위: 도면 치수 — 긴 변을 카운터로 (linear 가정)
    const widthM = input.floorplanRoom.widthMm / 1000;
    const depthM = input.floorplanRoom.depthMm / 1000;
    const longerSide = Math.max(widthM, depthM);
    // 카운터는 보통 벽 한 면 — 길이의 80~90% (모서리/문 차감)
    counterLengthM = Math.round(longerSide * 0.85 * 10) / 10;
    source = "floorplan_inferred";
    confidence = 0.8;
    layoutType = inferLayoutFromArea(widthM * depthM);
    assumptions.push(
      `도면 치수 ${widthM.toFixed(1)}m × ${depthM.toFixed(1)}m 기반 — 긴 변 × 85% = ${counterLengthM}m`,
    );
  } else if (input.kitchenBasis?.floorM2) {
    // 4순위: basis 면적 기반
    counterLengthM = inferCounterLengthFromArea(input.kitchenBasis.floorM2);
    source = "area_inference";
    confidence = 0.55;
    layoutType = inferLayoutFromArea(input.kitchenBasis.floorM2);
    assumptions.push(
      `주방 면적 ${input.kitchenBasis.floorM2.toFixed(1)}m² 기반 추정 — ${counterLengthM}m`,
    );
  } else if (input.areaM2) {
    counterLengthM = inferCounterLengthFromArea(input.areaM2);
    source = "area_inference";
    confidence = 0.5;
    layoutType = inferLayoutFromArea(input.areaM2);
    assumptions.push(`전체 면적 기반 추정 (주방 면적 미정) — ${counterLengthM}m`);
  } else {
    // 5순위: 기본
    counterLengthM = 3.0;
    source = "default_inferred";
    confidence = 0.4;
    assumptions.push("도면/면적 정보 없음 — 표준 3.0m 적용");
  }

  // 상부장 — 창문/후드 차감으로 카운터의 80%
  const upperCabinetLengthM =
    input.userInput?.upperCabinetLengthM ?? Math.round(counterLengthM * 0.8 * 10) / 10;
  // 키큰장 — 기본 1ea (냉장고장)
  const tallCabinetEa = input.userInput?.tallCabinetEa ?? 1;
  // 백스플래시 m² = counter × 0.6m (상하부장 사이 높이)
  const backsplashM2 = Math.round(counterLengthM * 0.6 * 10) / 10;

  return {
    projectId: input.projectId,
    roomName: input.roomName,
    layoutType: input.userInput?.layoutType ?? layoutType,
    counterLengthM,
    lowerCabinetLengthM: counterLengthM,
    upperCabinetLengthM,
    tallCabinetEa,
    worktopLengthM: counterLengthM,
    sinkEa: input.userInput?.sinkEa ?? 1,
    faucetEa: input.userInput?.faucetEa ?? 1,
    hoodEa: input.userInput?.hoodEa ?? 1,
    cooktopEa: input.userInput?.cooktopEa ?? 1,
    backsplashM2,
    plumbingRelocation: input.userInput?.plumbingRelocation ?? "none",
    electricalAdditionsEa: input.userInput?.electricalAdditionsEa ?? 1,
    source,
    confidence,
    assumptions,
  };
}

/**
 * 주방 룰의 quantityMultiplier 대신 KitchenPlan의 실제 길이/개수를 적용하는 헬퍼.
 * (build-construction-estimate에서 사용)
 *
 * subTradeCode → KitchenPlan 필드 매핑
 */
export function getKitchenLineQuantity(
  subTradeCode: string,
  plan: KitchenPlan,
): number | null {
  switch (subTradeCode) {
    case "02-20":
      return plan.counterLengthM; // 주방 철거 — 카운터 길이 m
    case "12-11":
      return plan.lowerCabinetLengthM; // 하부장
    case "12-12":
      return plan.upperCabinetLengthM; // 상부장
    case "12-13":
      return plan.tallCabinetEa; // 키큰장
    case "12-14":
      return plan.worktopLengthM; // 상판
    case "12-15":
      return plan.sinkEa; // 싱크볼
    case "12-16":
      return plan.faucetEa; // 수전
    case "12-17":
      return Math.max(plan.hoodEa, plan.cooktopEa); // 후드/쿡탑 (묶음 — 최대값)
    case "07-31":
      return plan.backsplashM2; // 백스플래시
    case "04-21":
      return plan.electricalAdditionsEa; // 추가 콘센트
    case "05-21":
    case "15-21":
      return 1; // 1식
    default:
      return null;
  }
}
