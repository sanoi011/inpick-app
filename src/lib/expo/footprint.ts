/**
 * INPICK EXPO — provisional footprint service (마스터 지시문 §7.2).
 *
 * 면적만으로는 폭·깊이·부스 타입·오픈면·높이를 단정할 수 없다는 것이
 * 핵심 불변조건이다. 이 서비스는 "면적 → 가정이 명시된 임시 footprint"만
 * 만든다. 모든 결과는 confirmationState="provisional"이며, 사용자가 실제
 * 치수를 확정하기 전까지 BOM/제안서 단계로 갈 수 없다.
 *
 * 순수 함수 — DOM/DB/전역 상태 없음. 단위 테스트가 계약을 고정한다.
 */

export type ExpoAreaUnit = "sqm" | "sqft";
export type ExpoBoothType = "inline" | "corner" | "peninsula" | "island";

export const SQFT_PER_SQM = 10.763910416709722;
export const EXPO_MIN_AREA_SQM = 4;
export const EXPO_MAX_AREA_SQM = 1000;

/** 한국 전시장 관행 기준 기본값 — 행사/베뉴 매뉴얼이 항상 우선한다. */
export interface ExpoMarketConfig {
  standardModuleM: number;
  defaultDepthM: number;
  defaultWallHeightM: number;
  defaultBoothType: ExpoBoothType;
}

export const KR_EXPO_MARKET_CONFIG: ExpoMarketConfig = {
  standardModuleM: 3,
  defaultDepthM: 3,
  defaultWallHeightM: 2.5,
  // 기본은 아일랜드(4면 오픈·무벽) — 벽은 프롬프트/구성에서 만들어질 때만 생긴다
  defaultBoothType: "island",
};

export interface ExpoFootprintCandidate {
  widthM: number;
  depthM: number;
  areaSqm: number;
  standardMatch: boolean;
  label: string;
}

export type ExpoFootprintAssumption =
  | "area_only_no_confirmed_dimensions"
  | "default_booth_type_island"
  | "default_wall_height"
  | "non_standard_area_fitted"
  | "unit_converted_from_sqft";

export interface ExpoProvisionalFootprint {
  inputArea: number;
  inputUnit: ExpoAreaUnit;
  canonicalAreaSqm: number;
  selected: ExpoFootprintCandidate;
  alternatives: ExpoFootprintCandidate[];
  boothType: ExpoBoothType;
  openSides: number;
  wallHeightM: number;
  standardSizeMatch: boolean;
  assumptions: ExpoFootprintAssumption[];
  confirmationState: "provisional";
}

export class ExpoFootprintError extends Error {
  constructor(
    public readonly code:
      | "EXPO_AREA_NOT_A_NUMBER"
      | "EXPO_AREA_NOT_POSITIVE"
      | "EXPO_AREA_TOO_SMALL"
      | "EXPO_AREA_TOO_LARGE",
  ) {
    super(code);
    this.name = "ExpoFootprintError";
  }
}

export function convertArea(
  value: number,
  from: ExpoAreaUnit,
  to: ExpoAreaUnit,
): number {
  if (from === to) return round(value, 4);
  if (from === "sqft") return round(value / SQFT_PER_SQM, 4);
  return round(value * SQFT_PER_SQM, 4);
}

export const EXPO_OPEN_SIDES: Record<ExpoBoothType, number> = {
  inline: 1,
  corner: 2,
  peninsula: 3,
  island: 4,
};

export function createProvisionalFootprint(
  area: number,
  unit: ExpoAreaUnit,
  marketConfig: ExpoMarketConfig = KR_EXPO_MARKET_CONFIG,
): ExpoProvisionalFootprint {
  if (typeof area !== "number" || !Number.isFinite(area)) {
    throw new ExpoFootprintError("EXPO_AREA_NOT_A_NUMBER");
  }
  if (area <= 0) {
    throw new ExpoFootprintError("EXPO_AREA_NOT_POSITIVE");
  }
  const canonical = round(unit === "sqft" ? area / SQFT_PER_SQM : area, 2);
  if (canonical < EXPO_MIN_AREA_SQM) {
    throw new ExpoFootprintError("EXPO_AREA_TOO_SMALL");
  }
  if (canonical > EXPO_MAX_AREA_SQM) {
    throw new ExpoFootprintError("EXPO_AREA_TOO_LARGE");
  }

  const assumptions: ExpoFootprintAssumption[] = [
    "area_only_no_confirmed_dimensions",
    "default_booth_type_island",
    "default_wall_height",
  ];
  if (unit === "sqft") assumptions.push("unit_converted_from_sqft");

  const gridCandidates = buildStandardGridCandidates(canonical, marketConfig);
  let candidates: ExpoFootprintCandidate[];
  let standardSizeMatch: boolean;
  if (gridCandidates.length > 0) {
    candidates = gridCandidates;
    standardSizeMatch = true;
  } else {
    candidates = buildFittedCandidates(canonical, marketConfig);
    standardSizeMatch = false;
    assumptions.push("non_standard_area_fitted");
  }

  const [selected, ...alternatives] = candidates;
  return {
    inputArea: area,
    inputUnit: unit,
    canonicalAreaSqm: canonical,
    selected,
    alternatives,
    boothType: marketConfig.defaultBoothType,
    openSides: EXPO_OPEN_SIDES[marketConfig.defaultBoothType],
    wallHeightM: marketConfig.defaultWallHeightM,
    standardSizeMatch,
    assumptions,
    confirmationState: "provisional",
  };
}

/**
 * 3m(모듈) 격자에 정확히 맞는 면적이면 격자 조합을 만든다.
 * 선택 규칙: 폭:깊이 비율이 2:1에 가장 가까운 후보 (전시 인라인 관행),
 * 동률이면 깊이가 얕은 쪽. 결정적 정렬로 테스트가 고정한다.
 */
function buildStandardGridCandidates(
  areaSqm: number,
  config: ExpoMarketConfig,
): ExpoFootprintCandidate[] {
  const module = config.standardModuleM;
  const moduleArea = module * module;
  const blocks = areaSqm / moduleArea;
  const wholeBlocks = Math.round(blocks);
  if (wholeBlocks < 1 || Math.abs(blocks - wholeBlocks) > 0.001) return [];

  const pairs: Array<[number, number]> = [];
  for (let b = 1; b * b <= wholeBlocks; b += 1) {
    if (wholeBlocks % b === 0) {
      pairs.push([wholeBlocks / b, b]);
    }
  }
  const candidates = pairs.map(([a, b]) =>
    makeCandidate(a * module, b * module, true),
  );
  candidates.sort((x, y) => {
    const rx = Math.abs(x.widthM / x.depthM - 2);
    const ry = Math.abs(y.widthM / y.depthM - 2);
    if (rx !== ry) return rx - ry;
    return x.depthM - y.depthM;
  });
  return candidates;
}

/** 격자에 맞지 않는 면적: 기본 깊이 고정·정사각·4m 깊이 세 후보를 제시한다. */
function buildFittedCandidates(
  areaSqm: number,
  config: ExpoMarketConfig,
): ExpoFootprintCandidate[] {
  const seen = new Set<string>();
  const out: ExpoFootprintCandidate[] = [];
  const push = (width: number, depth: number) => {
    const w = round(width, 1);
    const d = round(depth, 1);
    if (w < 1 || d < 1) return;
    const key = `${w}x${d}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(makeCandidate(w, d, false));
  };
  push(areaSqm / config.defaultDepthM, config.defaultDepthM);
  const side = Math.sqrt(areaSqm);
  push(side, side);
  push(areaSqm / 4, 4);
  return out;
}

function makeCandidate(
  widthM: number,
  depthM: number,
  standardMatch: boolean,
): ExpoFootprintCandidate {
  const w = round(widthM, 1);
  const d = round(depthM, 1);
  return {
    widthM: w,
    depthM: d,
    areaSqm: round(w * d, 2),
    standardMatch,
    label: `${trimZero(w)}m × ${trimZero(d)}m`,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function trimZero(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// ─── 치수 확정 (provisional 해제) ───────────────────────────────────────────

export interface ExpoConfirmedDimensions {
  widthM: number;
  depthM: number;
  boothType: ExpoBoothType;
  openSides: number;
  wallHeightM: number;
  areaSqm: number;
  confirmedAt: string;
}

export class ExpoDimensionError extends Error {
  constructor(
    public readonly code:
      | "EXPO_DIM_WIDTH_INVALID"
      | "EXPO_DIM_DEPTH_INVALID"
      | "EXPO_DIM_HEIGHT_INVALID"
      | "EXPO_DIM_BOOTH_TYPE_INVALID",
  ) {
    super(code);
    this.name = "ExpoDimensionError";
  }
}

export const EXPO_MIN_SIDE_M = 1;
export const EXPO_MAX_SIDE_M = 60;
export const EXPO_MIN_WALL_HEIGHT_M = 2;
export const EXPO_MAX_WALL_HEIGHT_M = 8;

/**
 * 사용자가 실측/행사 매뉴얼 기준으로 치수를 확정한다. 확정 면적은 입력
 * 면적이 아니라 확정 폭×깊이에서 다시 계산한다 — 면적은 더 이상 추정값이
 * 아니다. confirmedAt은 호출자가 넘긴다 (순수 함수 유지).
 */
export function confirmExpoDimensions(
  input: {
    widthM: number;
    depthM: number;
    boothType: ExpoBoothType;
    wallHeightM: number;
  },
  confirmedAt: string,
): ExpoConfirmedDimensions {
  const width = Number(input.widthM);
  const depth = Number(input.depthM);
  const height = Number(input.wallHeightM);
  if (
    !Number.isFinite(width) ||
    width < EXPO_MIN_SIDE_M ||
    width > EXPO_MAX_SIDE_M
  ) {
    throw new ExpoDimensionError("EXPO_DIM_WIDTH_INVALID");
  }
  if (
    !Number.isFinite(depth) ||
    depth < EXPO_MIN_SIDE_M ||
    depth > EXPO_MAX_SIDE_M
  ) {
    throw new ExpoDimensionError("EXPO_DIM_DEPTH_INVALID");
  }
  if (
    !Number.isFinite(height) ||
    height < EXPO_MIN_WALL_HEIGHT_M ||
    height > EXPO_MAX_WALL_HEIGHT_M
  ) {
    throw new ExpoDimensionError("EXPO_DIM_HEIGHT_INVALID");
  }
  if (!(input.boothType in EXPO_OPEN_SIDES)) {
    throw new ExpoDimensionError("EXPO_DIM_BOOTH_TYPE_INVALID");
  }
  const w = Math.round(width * 10) / 10;
  const d = Math.round(depth * 10) / 10;
  const h = Math.round(height * 10) / 10;
  return {
    widthM: w,
    depthM: d,
    boothType: input.boothType,
    openSides: EXPO_OPEN_SIDES[input.boothType],
    wallHeightM: h,
    areaSqm: Math.round(w * d * 100) / 100,
    confirmedAt,
  };
}
