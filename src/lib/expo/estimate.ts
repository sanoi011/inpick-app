import type { ExpoBoothScene } from "@/lib/expo/scene";
import type { ExpoConfirmedDimensions } from "@/lib/expo/footprint";

/**
 * INPICK EXPO — 견적 스켈레톤 (블루프린트 §3.17/§3.18).
 *
 * 불변조건:
 *   - 가격 단계(stage)와 금액 소스 상태(source)는 별개다. v1 코스트북의
 *     모든 단가는 `allowance`(공식 근거 없는 명시적 가정) — UI는 이를 숨기지
 *     않고 표기한다.
 *   - 치수 확정 전에는 `conceptual_range`(범위)만 제공한다. 단일 금액을
 *     확정된 것처럼 보여주지 않는다.
 *   - `catalog_estimate`는 확정 면적 + 씬 컴포넌트에서만 계산한다.
 *   - `contractor_proposal`/`contract`는 사람이(시공사/계약) 만든다 —
 *     이 모듈은 자동으로 그 단계를 생성하지 않는다.
 *   - 모든 함수는 순수 함수. 금액은 KRW 정수, 부가세 별도.
 */

export type ExpoPriceStage =
  | "conceptual_range"
  | "catalog_estimate"
  | "contractor_proposal"
  | "contract";

export type ExpoMoneySource =
  | "planned"
  | "allowance"
  | "quoted"
  | "committed"
  | "actual";

export const EXPO_MONEY_SOURCE_LABELS: Record<ExpoMoneySource, string> = {
  planned: "예산",
  allowance: "가정 단가",
  quoted: "견적 접수",
  committed: "계약 확정",
  actual: "정산 완료",
};

export type ExpoTradeCategory =
  | "system_structure"
  | "floor_finish"
  | "lighting"
  | "electrical_venue"
  | "furniture_fixtures"
  | "signage_lightbox"
  | "graphics_print"
  | "design_pm"
  | "install_dismantle"
  | "overhead_profit"
  | "contingency";

export const EXPO_TRADE_LABELS: Record<ExpoTradeCategory, string> = {
  system_structure: "시스템/모듈 구조체",
  floor_finish: "바닥재",
  lighting: "기본 조명",
  electrical_venue: "전기/주최측 서비스",
  furniture_fixtures: "가구/집기",
  signage_lightbox: "사이니지/라이트박스",
  graphics_print: "그래픽 출력·부착",
  design_pm: "디자인/PM",
  install_dismantle: "설치·해체",
  overhead_profit: "일반관리·이윤",
  contingency: "예비비",
};

export interface ExpoEstimateLine {
  id: string;
  trade: ExpoTradeCategory;
  label: string;
  quantity: number;
  unit: "sqm" | "ea" | "lot" | "pct" | "kw";
  unitAmountKrw: number;
  amountKrw: number;
  source: ExpoMoneySource;
  note?: string;
}

export interface ExpoConceptualRange {
  stage: "conceptual_range";
  costbookVersion: number;
  areaSqm: number;
  lowKrw: number;
  highKrw: number;
  source: "allowance";
  vatIncluded: false;
  assumptions: string[];
}

export interface ExpoCatalogEstimate {
  stage: "catalog_estimate";
  costbookVersion: number;
  areaSqm: number;
  lines: ExpoEstimateLine[];
  markupLines: ExpoEstimateLine[];
  directSubtotalKrw: number;
  totalKrw: number;
  vatIncluded: false;
  assumptions: string[];
}

export class ExpoEstimateError extends Error {
  code:
    | "EXPO_EST_AREA_INVALID"
    | "EXPO_EST_DIMENSIONS_REQUIRED"
    | "EXPO_EST_UNKNOWN_CATALOG_ITEM";

  constructor(code: ExpoEstimateError["code"], message: string) {
    super(message);
    this.name = "ExpoEstimateError";
    this.code = code;
  }
}

/** footprint와 동일한 지원 범위 (4–1,000㎡) */
const MIN_AREA_SQM = 4;
const MAX_AREA_SQM = 1000;

/**
 * v1 코스트북 — 전 항목 allowance. 한국 조립부스 관행 기준의 러프 가정으로,
 * design-partner 검증 전 임시값이다. 개정 시 version을 올린다.
 */
export const EXPO_ALLOWANCE_COSTBOOK = {
  version: 1,
  areaRates: [
    {
      trade: "system_structure" as ExpoTradeCategory,
      label: "시스템/모듈 구조체",
      perSqmKrw: 120_000,
    },
    {
      trade: "floor_finish" as ExpoTradeCategory,
      label: "바닥재(파이텍스)",
      perSqmKrw: 25_000,
    },
    {
      trade: "lighting" as ExpoTradeCategory,
      label: "기본 조명(스팟)",
      perSqmKrw: 30_000,
    },
  ],
  fixedLines: [
    {
      trade: "electrical_venue" as ExpoTradeCategory,
      label: "전기 인입/분전 기본(1kW)",
      amountKrw: 150_000,
    },
  ],
  /** 행사 매뉴얼 전기 용량 입력 시 kW당 단가로 대체 */
  electricalPerKwKrw: 150_000,
  /** 카탈로그 컴포넌트별 단가 — catalogId 기준 */
  componentUnits: {
    info_counter: {
      trade: "furniture_fixtures" as ExpoTradeCategory,
      label: "안내 카운터",
      unitKrw: 180_000,
    },
    display_showcase: {
      trade: "furniture_fixtures" as ExpoTradeCategory,
      label: "쇼케이스",
      unitKrw: 350_000,
    },
    product_table: {
      trade: "furniture_fixtures" as ExpoTradeCategory,
      label: "제품 테이블",
      unitKrw: 120_000,
    },
    signage_tower: {
      trade: "signage_lightbox" as ExpoTradeCategory,
      label: "사이니지 타워",
      unitKrw: 450_000,
    },
    graphic_wall: {
      trade: "graphics_print" as ExpoTradeCategory,
      label: "그래픽 월(3m) 출력·부착",
      unitKrw: 600_000,
    },
    lightbox_panel: {
      trade: "signage_lightbox" as ExpoTradeCategory,
      label: "라이트박스(1m)",
      unitKrw: 550_000,
    },
    brochure_stand: {
      trade: "furniture_fixtures" as ExpoTradeCategory,
      label: "브로슈어 랙",
      unitKrw: 80_000,
    },
  } as Record<
    string,
    { trade: ExpoTradeCategory; label: string; unitKrw: number }
  >,
  /** 직접비 대비 요율 — contingency는 범위 상단에만 반영 */
  markups: [
    { trade: "design_pm" as ExpoTradeCategory, label: "디자인/PM", rate: 0.1 },
    {
      trade: "install_dismantle" as ExpoTradeCategory,
      label: "설치·해체",
      rate: 0.15,
    },
    {
      trade: "overhead_profit" as ExpoTradeCategory,
      label: "일반관리·이윤",
      rate: 0.15,
    },
  ],
  contingencyRate: 0.1,
};

const BASE_ASSUMPTIONS = [
  "코스트북 v1의 모든 단가는 allowance(가정) 상태 — 시공사 검토 전 확정 금액이 아닙니다.",
  "시스템(옥타놈) 조립부스 표준 사양 기준, 특수 목공 미포함 — 그래픽 출력은 배치한 그래픽 월/라이트박스 항목에만 포함.",
  "전기 1kW 기본 가정 — 실제 용량·주최측 단가는 행사 매뉴얼 기준.",
  "부가세 별도.",
];

function assertValidArea(areaSqm: number): void {
  if (!Number.isFinite(areaSqm) || areaSqm < MIN_AREA_SQM || areaSqm > MAX_AREA_SQM) {
    throw new ExpoEstimateError(
      "EXPO_EST_AREA_INVALID",
      `면적은 ${MIN_AREA_SQM}~${MAX_AREA_SQM}㎡ 범위여야 합니다: ${areaSqm}`,
    );
  }
}

function roundKrw(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

function loadedDirectKrw(areaSqm: number): number {
  const book = EXPO_ALLOWANCE_COSTBOOK;
  const areaDirect = book.areaRates.reduce(
    (sum, rate) => sum + rate.perSqmKrw * areaSqm,
    0,
  );
  const fixedDirect = book.fixedLines.reduce(
    (sum, line) => sum + line.amountKrw,
    0,
  );
  const markupRate = book.markups.reduce((sum, m) => sum + m.rate, 0);
  return (areaDirect + fixedDirect) * (1 + markupRate);
}

/** 치수 확정 전 — 면적만으로 만드는 고객 논의용 금액 범위. */
export function buildConceptualRange(areaSqm: number): ExpoConceptualRange {
  assertValidArea(areaSqm);
  const loaded = loadedDirectKrw(areaSqm);
  const low = roundKrw(loaded * 0.85, 10_000);
  const high = roundKrw(
    loaded * (1 + EXPO_ALLOWANCE_COSTBOOK.contingencyRate) * 1.15,
    10_000,
  );
  return {
    stage: "conceptual_range",
    costbookVersion: EXPO_ALLOWANCE_COSTBOOK.version,
    areaSqm,
    lowKrw: low,
    highKrw: high,
    source: "allowance",
    vatIncluded: false,
    assumptions: [
      "치수 확정 전 — 면적 기반 개념 범위이며 배치 구성은 반영되지 않았습니다.",
      ...BASE_ASSUMPTIONS,
    ],
  };
}

/** 치수 확정 후 — 확정 면적 + 씬 컴포넌트 기반 라인아이템 견적. */
export interface ExpoEstimateOptions {
  /** 행사 매뉴얼에서 입력한 전기 용량 (kW) — 있으면 기본 1kW 가정을 대체 */
  powerKw?: number | null;
}

export function buildCatalogEstimate(
  scene: ExpoBoothScene | null,
  confirmed: ExpoConfirmedDimensions | null,
  options: ExpoEstimateOptions = {},
): ExpoCatalogEstimate {
  if (!confirmed) {
    throw new ExpoEstimateError(
      "EXPO_EST_DIMENSIONS_REQUIRED",
      "카탈로그 견적은 치수 확정 후에만 계산합니다.",
    );
  }
  const areaSqm = confirmed.areaSqm;
  assertValidArea(areaSqm);

  const book = EXPO_ALLOWANCE_COSTBOOK;
  const lines: ExpoEstimateLine[] = [];

  for (const rate of book.areaRates) {
    lines.push({
      id: `area_${rate.trade}`,
      trade: rate.trade,
      label: rate.label,
      quantity: areaSqm,
      unit: "sqm",
      unitAmountKrw: rate.perSqmKrw,
      amountKrw: roundKrw(rate.perSqmKrw * areaSqm, 1_000),
      source: "allowance",
    });
  }
  const powerKw =
    typeof options.powerKw === "number" &&
    Number.isFinite(options.powerKw) &&
    options.powerKw > 0 &&
    options.powerKw <= 500
      ? options.powerKw
      : null;
  if (powerKw !== null) {
    lines.push({
      id: "fixed_electrical_venue",
      trade: "electrical_venue",
      label: `전기 인입/분전 (${powerKw}kW — 매뉴얼 입력)`,
      quantity: powerKw,
      unit: "kw",
      unitAmountKrw: book.electricalPerKwKrw,
      amountKrw: roundKrw(book.electricalPerKwKrw * powerKw, 1_000),
      source: "allowance",
      note: "행사 매뉴얼 입력 용량 기준",
    });
  } else {
    for (const fixed of book.fixedLines) {
      lines.push({
        id: `fixed_${fixed.trade}`,
        trade: fixed.trade,
        label: fixed.label,
        quantity: 1,
        unit: "lot",
        unitAmountKrw: fixed.amountKrw,
        amountKrw: fixed.amountKrw,
        source: "allowance",
      });
    }
  }

  // 씬 컴포넌트 — catalogId별 수량 집계 (컴포넌트 없는 씬도 유효)
  const counts = new Map<string, number>();
  for (const component of scene?.components ?? []) {
    counts.set(component.catalogId, (counts.get(component.catalogId) ?? 0) + 1);
  }
  for (const [catalogId, quantity] of Array.from(counts.entries())) {
    const unit = book.componentUnits[catalogId];
    if (!unit) {
      throw new ExpoEstimateError(
        "EXPO_EST_UNKNOWN_CATALOG_ITEM",
        `코스트북에 없는 카탈로그 항목: ${catalogId}`,
      );
    }
    lines.push({
      id: `component_${catalogId}`,
      trade: unit.trade,
      label: unit.label,
      quantity,
      unit: "ea",
      unitAmountKrw: unit.unitKrw,
      amountKrw: unit.unitKrw * quantity,
      source: "allowance",
    });
  }

  const directSubtotalKrw = lines.reduce((sum, line) => sum + line.amountKrw, 0);
  const markupLines: ExpoEstimateLine[] = book.markups.map((markup) => ({
    id: `markup_${markup.trade}`,
    trade: markup.trade,
    label: markup.label,
    quantity: markup.rate * 100,
    unit: "pct",
    unitAmountKrw: 0,
    amountKrw: roundKrw(directSubtotalKrw * markup.rate, 1_000),
    source: "allowance",
    note: "직접비 대비 요율",
  }));

  const totalKrw =
    directSubtotalKrw + markupLines.reduce((sum, line) => sum + line.amountKrw, 0);

  return {
    stage: "catalog_estimate",
    costbookVersion: book.version,
    areaSqm,
    lines,
    markupLines,
    directSubtotalKrw,
    totalKrw,
    vatIncluded: false,
    assumptions: [
      "확정 면적과 현재 배치 기준 — 배치를 바꾸면 금액이 갱신됩니다.",
      "예비비(예상 변동분)는 합계에 포함하지 않았습니다.",
      ...BASE_ASSUMPTIONS,
    ],
  };
}

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
