import type { DetailLine } from "./detail-model";

export interface EstimateLineOption {
  id: string;
  label: string;
  itemName: string;
  spec: string;
  brand: string;
  product: string;
  matUnit: number;
  labUnit?: number;
  expenseUnit?: number;
  trade?: string;
  order?: number;
  priceBand?: string;
  imageHint?: string;
}

const FLOOR_OPTIONS: EstimateLineOption[] = [
  {
    id: "floor-engineered-wood",
    label: "강마루 · 오크 7.5T",
    itemName: "강마루 시공",
    spec: "강마루 7.5T · 친환경 E0",
    brand: "맞춤형",
    product: "내추럴 오크 강마루",
    matUnit: 65_000,
    labUnit: 18_000,
    expenseUnit: 2_500,
    trade: "바닥재공사",
    order: 16,
    priceBand: "재료 55~75천원/㎡",
    imageHint: "내추럴 오크 톤",
  },
  {
    id: "floor-vinyl-22",
    label: "장판 · 주거용 2.2T",
    itemName: "주거용 장판 시공",
    spec: "친환경 모노륨 장판 2.2T",
    brand: "맞춤형",
    product: "주거용 모노륨 장판",
    matUnit: 28_000,
    labUnit: 9_000,
    expenseUnit: 1_000,
    trade: "바닥재공사",
    order: 16,
    priceBand: "재료 22~35천원/㎡",
    imageHint: "밝은 오크 패턴",
  },
  {
    id: "floor-porcelain-600",
    label: "포세린 타일 · 600각",
    itemName: "포세린 타일 시공",
    spec: "무광 포세린 타일 600×600",
    brand: "맞춤형",
    product: "600각 무광 포세린 타일",
    matUnit: 42_000,
    labUnit: 35_000,
    expenseUnit: 3_000,
    trade: "타일공사",
    order: 11,
    priceBand: "재료 35~55천원/㎡",
    imageHint: "웜그레이 무광 포세린",
  },
];

const CEILING_OPTIONS: EstimateLineOption[] = [
  {
    id: "ceiling-wallpaper",
    label: "도배 · 국내 주거 기본",
    itemName: "천장 실크벽지 도배",
    spec: "실크벽지 또는 천장용 합지",
    brand: "맞춤형",
    product: "천장용 실크벽지",
    matUnit: 8_500,
    labUnit: 7_000,
    expenseUnit: 500,
    trade: "도배공사",
    order: 15,
    priceBand: "재료 7~10천원/㎡",
    imageHint: "무광 웜화이트 천장",
  },
  {
    id: "ceiling-water-paint",
    label: "도장 · 친환경 수성 무광",
    itemName: "천장 친환경 수성 도장",
    spec: "친환경 수성페인트 무광 2회",
    brand: "맞춤형",
    product: "친환경 수성페인트",
    matUnit: 7_000,
    labUnit: 14_000,
    expenseUnit: 800,
    trade: "도장공사",
    order: 15,
    priceBand: "재료 5~9천원/㎡",
    imageHint: "이음매 없는 무광 웜화이트",
  },
];

const WALL_OPTIONS: EstimateLineOption[] = [
  {
    id: "wall-silk-wallpaper",
    label: "실크벽지 · 무지",
    itemName: "실크벽지 시공",
    spec: "친환경 실크벽지 · 무지",
    brand: "맞춤형",
    product: "웜화이트 실크벽지",
    matUnit: 8_500,
    labUnit: 7_000,
    expenseUnit: 500,
    trade: "도배공사",
    order: 15,
    priceBand: "재료 7~10천원/㎡",
    imageHint: "웜화이트 무지",
  },
  {
    id: "wall-paper-wallpaper",
    label: "합지벽지 · 기본형",
    itemName: "합지벽지 시공",
    spec: "친환경 합지벽지",
    brand: "맞춤형",
    product: "친환경 합지벽지",
    matUnit: 4_500,
    labUnit: 5_500,
    expenseUnit: 400,
    trade: "도배공사",
    order: 15,
    priceBand: "재료 3~6천원/㎡",
    imageHint: "밝은 무지 벽지",
  },
  {
    id: "wall-water-paint",
    label: "도장 · 친환경 수성 무광",
    itemName: "벽 친환경 수성 도장",
    spec: "친환경 수성페인트 무광 2회",
    brand: "맞춤형",
    product: "친환경 수성페인트",
    matUnit: 7_500,
    labUnit: 14_000,
    expenseUnit: 800,
    trade: "도장공사",
    order: 15,
    priceBand: "재료 5~10천원/㎡",
    imageHint: "웜화이트 무광 도장",
  },
];

function lightingOptions(line: DetailLine): EstimateLineOption[] {
  const baseMatUnit = Math.max(
    1,
    line.optionBaseMatUnit ?? line.matUnit ?? 1,
  );
  const baseLabUnit = Math.max(
    0,
    line.optionBaseLabUnit ?? line.labUnit ?? 0,
  );
  const spec = line.spec && line.spec !== "-" ? line.spec : "현장 규격 확인";
  const productStem = line.itemName
    .replace(/\s+(설치|시공|교체)$/, "")
    .trim();

  return [
    {
      id: "lighting-vitson",
      label: "비츠온 · 실속형",
      itemName: line.itemName,
      spec,
      brand: "비츠온",
      product: `${productStem} 실속형`,
      matUnit: Math.round(baseMatUnit * 0.95),
      labUnit: baseLabUnit,
      expenseUnit: line.expenseUnit,
      priceBand: "실속형",
    },
    {
      id: "lighting-kumho",
      label: "번개표 · 표준형",
      itemName: line.itemName,
      spec,
      brand: "번개표",
      product: `${productStem} 표준형`,
      matUnit: Math.round(baseMatUnit * 1.1),
      labUnit: baseLabUnit,
      expenseUnit: line.expenseUnit,
      priceBand: "표준형",
    },
    {
      id: "lighting-ledvance",
      label: "LEDVANCE · 고효율형",
      itemName: line.itemName,
      spec,
      brand: "LEDVANCE",
      product: `${productStem} 고효율형`,
      matUnit: Math.round(baseMatUnit * 1.35),
      labUnit: baseLabUnit,
      expenseUnit: line.expenseUnit,
      priceBand: "고효율형",
    },
    {
      id: "lighting-philips",
      label: "필립스 · 프리미엄",
      itemName: line.itemName,
      spec,
      brand: "필립스",
      product: `${productStem} 프리미엄`,
      matUnit: Math.round(baseMatUnit * 1.75),
      labUnit: baseLabUnit,
      expenseUnit: line.expenseUnit,
      priceBand: "프리미엄",
    },
  ];
}

function isLightingProduct(line: DetailLine): boolean {
  const text = `${line.trade} ${line.itemName} ${line.product}`;
  return (
    line.materialSelectable === true &&
    /(조명|등기구|다운라이트|센서등|펜던트|LED)/i.test(text) &&
    !/(배선|회로|전원|스위치|콘센트|차단기)/.test(text)
  );
}

export function getEstimateLineOptions(
  line: DetailLine,
): EstimateLineOption[] {
  if (!line.materialSelectable) return [];
  const context = `${line.room} ${line.itemName} ${line.spec} ${line.product}`;
  if (
    /(욕실|화장실|SMC|알루미늄 천장|발코니|베란다|탄성코트)/i.test(context) &&
    ["바닥", "벽", "천장"].includes(line.part)
  ) {
    return [];
  }
  if (line.part === "천장") return CEILING_OPTIONS;
  if (line.part === "바닥") return FLOOR_OPTIONS;
  if (line.part === "벽") return WALL_OPTIONS;
  if (isLightingProduct(line)) return lightingOptions(line);
  return [];
}

export function inferEstimateLineOptionId(
  line: DetailLine,
  options: EstimateLineOption[] = getEstimateLineOptions(line),
): string {
  if (line.materialOptionId && options.some((option) => option.id === line.materialOptionId)) {
    return line.materialOptionId;
  }
  const text = `${line.itemName} ${line.spec} ${line.brand} ${line.product}`.toLowerCase();
  if (line.part === "천장") {
    return /(도장|페인트|paint)/.test(text)
      ? "ceiling-water-paint"
      : "ceiling-wallpaper";
  }
  if (line.part === "바닥") {
    if (/(타일|포세린|600×600|600x600)/.test(text)) return "floor-porcelain-600";
    if (/(장판|모노륨|vinyl)/.test(text)) return "floor-vinyl-22";
    return "floor-engineered-wood";
  }
  if (line.part === "벽") {
    if (/(도장|페인트|paint)/.test(text)) return "wall-water-paint";
    if (/(합지|paper wallpaper)/.test(text)) return "wall-paper-wallpaper";
    return "wall-silk-wallpaper";
  }
  if (isLightingProduct(line)) {
    if (text.includes("필립스")) return "lighting-philips";
    if (text.includes("ledvance")) return "lighting-ledvance";
    if (text.includes("번개표")) return "lighting-kumho";
    return "lighting-vitson";
  }
  return options[0]?.id || "";
}

function recalculate(line: DetailLine): DetailLine {
  const matAmount = Math.round(line.quantity * line.matUnit);
  const labAmount = Math.round(line.quantity * line.labUnit);
  const expenseAmount = Math.round(line.quantity * line.expenseUnit);
  return {
    ...line,
    matAmount,
    labAmount,
    expenseAmount,
    amount: matAmount + labAmount + expenseAmount,
  };
}

function supportingPatch(
  line: DetailLine,
  displayLine: DetailLine,
  option: EstimateLineOption,
): Partial<DetailLine> {
  if (displayLine.part === "천장") {
    const paint = option.id === "ceiling-water-paint";
    if (line.itemName.includes("기존 벽지") || line.itemName.includes("기존 천장 마감")) {
      return { itemName: paint ? "기존 천장 마감 제거" : "기존 벽지 제거" };
    }
    if (line.itemName.includes("초배") || line.itemName.includes("프라이머")) {
      return {
        itemName: paint ? "천장 퍼티·프라이머 바탕" : "초배지 시공",
        spec: paint ? "퍼티 면정리 + 수성 프라이머" : "천장용 초배지",
        trade: paint ? "도장공사" : "도배공사",
        order: 15,
      };
    }
    if (line.itemName.includes("바탕면 보수")) {
      return {
        itemName: paint ? "천장 바탕면 보수" : "바탕면 보수",
        trade: paint ? "도장공사" : "도배공사",
        order: 15,
      };
    }
  }

  if (displayLine.part === "벽") {
    const paint = option.id === "wall-water-paint";
    if (line.itemName.includes("초배") || line.itemName.includes("프라이머")) {
      return {
        itemName: paint ? "벽 퍼티·프라이머 바탕" : "초배지 시공",
        spec: paint ? "퍼티 면정리 + 수성 프라이머" : "벽지용 초배지",
        trade: paint ? "도장공사" : "도배공사",
        order: 15,
      };
    }
  }

  if (displayLine.part === "바닥" && line.itemName.includes("부자재")) {
    if (option.id === "floor-porcelain-600") {
      return {
        itemName: "타일 접착제·줄눈 부자재",
        spec: "압착시멘트 + 일반 줄눈",
      };
    }
    if (option.id === "floor-vinyl-22") {
      return {
        itemName: "장판 접착제·부자재",
        spec: "친환경 수성 접착제",
      };
    }
    return {
      itemName: "방습지·접착제·부자재",
      spec: "강마루용 방습지·접착제",
    };
  }

  return {};
}

export function applyEstimateLineOption(
  rows: DetailLine[],
  displayLine: DetailLine,
  optionId: string,
): DetailLine[] {
  const options = getEstimateLineOptions(displayLine);
  const option = options.find((candidate) => candidate.id === optionId);
  if (!option) return rows;

  const finishLineId = displayLine.finishLineId || displayLine.id;
  const packageLineIds = new Set(
    displayLine.sourceLineIds || [finishLineId],
  );
  const baseMatUnit =
    displayLine.optionBaseMatUnit ?? displayLine.matUnit;
  const baseLabUnit =
    displayLine.optionBaseLabUnit ?? displayLine.labUnit;

  return rows.map((line) => {
    if (!packageLineIds.has(line.id)) return line;
    if (line.id !== finishLineId) {
      return recalculate({
        ...line,
        ...supportingPatch(line, displayLine, option),
      });
    }
    return recalculate({
      ...line,
      itemName: option.itemName,
      spec: option.spec,
      brand: option.brand,
      product: option.product,
      matUnit: option.matUnit,
      labUnit: option.labUnit ?? line.labUnit,
      expenseUnit: option.expenseUnit ?? line.expenseUnit,
      trade: option.trade ?? line.trade,
      order: option.order ?? line.order,
      priceBand: option.priceBand,
      imageHint: option.imageHint,
      source: "사용자 견적 옵션",
      materialOptionId: option.id,
      optionBaseMatUnit: line.optionBaseMatUnit ?? baseMatUnit,
      optionBaseLabUnit: line.optionBaseLabUnit ?? baseLabUnit,
    });
  });
}
