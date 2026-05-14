/**
 * Community Redaction — Step3 견적의 개인정보 제거 후 공개 스냅샷 생성.
 * 가이드: inpick-community-naver-cafe-style-dev-plan-20260514.md §5
 *
 * 핵심 원칙: privacy-first
 *   - 절대 공개 금지: 실명/전화/이메일/정확한 주소/동호수/도면 원본 URL/계약 ID/결제 정보
 *   - 공개 허용: 시/구 수준, 건물 유형, 면적, 디자인 이미지, 공종별 합계, 카테고리
 *
 * 사용:
 *   const result = redactProjectForCommunity({
 *     project, estimate, designOutputs, visibility,
 *   });
 *   → community_public_snapshots에 저장
 */

export interface CommunityShareVisibility {
  showTotalAmount: boolean;
  showTradeSummary: boolean;
  showDetailedLines: boolean;
  showBrandSku: boolean;
  showDesignImages: boolean;
}

export interface RedactedCommunitySnapshot {
  snapshotType: "estimate_share" | "design_share";
  projectMode: "apartment" | "commercial" | "photo_only" | string;
  redactedProject: {
    regionLabel: string | null;
    buildingType: string | null;
    businessType: string | null;
    areaLabel: string | null;
    areaM2: number | null;
    areaPyeong: number | null;
    expansionLabel: string | null;
    rooms: string[];
    scope: string[];
  };
  redactedDesignOutputs: Array<{
    id: string;
    imageUrl: string;
    targetLabel: string | null;
    style: string | null;
  }>;
  redactedEstimateSummary: {
    totalAmount: number | null;
    totalAmountRangeLabel: string | null;
    precisionLevel: string | null;
    lineCount: number;
    tradeCount: number;
  };
  redactedTradeGroups: Array<{
    tradeCode: string;
    tradeName: string;
    lineCount: number;
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
    total: number | null;
  }>;
  redactedMaterialSummary: Array<{
    categoryCode: string;
    categoryName: string;
    brandLabel: string | null; // visibility.showBrandSku=true일 때만
    skuLabel: string | null;
    quantity: number;
    unit: string;
  }>;
  privacyReport: {
    removedFields: string[];
    suspiciousMatches: string[];
    autoScanPassed: boolean;
    timestamp: string;
  };
  visibilityOptions: CommunityShareVisibility;
}

// ─── 정규식 패턴 (한국 환경 특화) ────────────────────────
const PATTERNS = {
  phone: /(?:0(?:1[0-9]|2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|7|8[1-2]|9[0-9]))[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
  phoneIntl: /\+82[-.\s]?1[0-9][-.\s]?\d{3,4}[-.\s]?\d{4}/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // 한국 주소 패턴: "XX동 1003호", "지번", "도로명 343"
  unitNumber: /\d{1,3}\s?동\s?\d{1,4}\s?호/g,
  jibun: /\d{1,4}(?:-\d{1,4})?번지/g,
  detailedRoadAddress: /(?:로|길)\s?\d{1,4}(?:-\d{1,4})?(?:\s?,?\s?\d+층)?(?:\s?\d{1,4}호)?/g,
  // 13자리 사업자등록번호
  bizNo: /\d{3}-?\d{2}-?\d{5}/g,
  // 주민등록번호 (사용 안 함)
  ssn: /\d{6}-?[1-4]\d{6}/g,
  // 계약/견적 ID 패턴
  contractId: /(?:contract|estimate|payment)[-_]?id[:\s=]+["']?[a-zA-Z0-9-]{8,}/gi,
};

/**
 * 텍스트에서 개인정보 감지 (true = 의심 항목 있음).
 */
export function detectPrivateInfo(text: string): {
  found: boolean;
  matches: Array<{ type: string; value: string }>;
} {
  const matches: Array<{ type: string; value: string }> = [];
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    const found = text.match(pattern);
    if (found) {
      for (const m of found) {
        matches.push({ type, value: m });
      }
    }
  }
  return { found: matches.length > 0, matches };
}

/**
 * 텍스트에서 개인정보 자동 마스킹.
 * (사용자 본문에 들어간 개인정보를 ▒로 가림)
 */
export function maskPrivateInfo(text: string): string {
  let masked = text;
  masked = masked.replace(PATTERNS.phone, "[전화번호]");
  masked = masked.replace(PATTERNS.phoneIntl, "[전화번호]");
  masked = masked.replace(PATTERNS.email, "[이메일]");
  masked = masked.replace(PATTERNS.unitNumber, "[동호수]");
  masked = masked.replace(PATTERNS.jibun, "[지번]");
  masked = masked.replace(PATTERNS.detailedRoadAddress, "[상세주소]");
  masked = masked.replace(PATTERNS.bizNo, "[사업자번호]");
  masked = masked.replace(PATTERNS.ssn, "[주민번호]");
  masked = masked.replace(PATTERNS.contractId, "[ID]");
  return masked;
}

/**
 * 한국 주소를 "시 + 구" 수준으로 축약.
 *
 * "대전광역시 유성구 지족로 343, 반석마을아파트2단지 204동 1003호"
 *   → "대전 유성구"
 *
 * "서울특별시 강남구 테헤란로 123"
 *   → "서울 강남구"
 *
 * "경기도 성남시 분당구 ..."
 *   → "경기 성남시 분당구"
 */
export function redactAddress(fullAddress: string | null | undefined): string | null {
  if (!fullAddress || fullAddress.trim().length === 0) return null;
  const text = fullAddress.trim();

  // 광역시/특별시
  const metroRe = /^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시)\s+([가-힣]+(?:구|군))/;
  const m = text.match(metroRe);
  if (m) {
    const cityShort = m[1].replace(/(?:특별|광역|특별자치)시$/, "");
    return `${cityShort} ${m[2]}`;
  }

  // 도 + 시 + 구 (예: 경기도 성남시 분당구)
  const provinceCityGuRe = /^([가-힣]+도)\s+([가-힣]+시)\s+([가-힣]+(?:구|군))/;
  const m2 = text.match(provinceCityGuRe);
  if (m2) {
    return `${m2[1].replace(/도$/, "")} ${m2[2]} ${m2[3]}`;
  }

  // 도 + 시/군
  const provinceCityRe = /^([가-힣]+도)\s+([가-힣]+(?:시|군))/;
  const m3 = text.match(provinceCityRe);
  if (m3) {
    return `${m3[1].replace(/도$/, "")} ${m3[2]}`;
  }

  // 그 외: 첫 단어만
  const firstToken = text.split(/\s+/)[0];
  return firstToken || null;
}

/**
 * 면적을 평수 라벨로 변환.
 * "20평대" / "30평대" / "40평대" / "50평대"
 */
export function buildAreaLabel(areaM2: number | null | undefined): string | null {
  if (!areaM2 || areaM2 <= 0) return null;
  const pyeong = areaM2 / 3.3058;
  if (pyeong < 15) return "10평대";
  if (pyeong < 25) return "20평대";
  if (pyeong < 35) return "30평대";
  if (pyeong < 45) return "40평대";
  if (pyeong < 55) return "50평대";
  if (pyeong < 70) return "60평대";
  if (pyeong < 100) return "70~100평";
  return "100평 이상";
}

/**
 * 견적 총액을 범위 라벨로 변환 (정확한 금액 노출 방지).
 * "3,000~4,000만원" / "8,000만~1억원" 등
 */
export function buildAmountRangeLabel(amount: number | null | undefined): string | null {
  if (!amount || amount <= 0) return null;
  const man = amount / 10000;
  if (man < 500) return "500만원 이하";
  if (man < 1000) return "500~1,000만원";
  if (man < 2000) return "1,000~2,000만원";
  if (man < 3000) return "2,000~3,000만원";
  if (man < 4000) return "3,000~4,000만원";
  if (man < 5000) return "4,000~5,000만원";
  if (man < 6000) return "5,000~6,000만원";
  if (man < 7000) return "6,000~7,000만원";
  if (man < 8000) return "7,000~8,000만원";
  if (man < 10000) return "8,000만~1억원";
  if (man < 15000) return "1억~1.5억원";
  if (man < 20000) return "1.5억~2억원";
  return "2억원 이상";
}

// ─── 입력 타입 ───────────────────────────────────────────
export interface RedactionProjectInput {
  id: string;
  projectMode?: string;
  basicInfo?: {
    selectedAddress?: { roadAddress?: string; jibunAddress?: string; buildingName?: string };
    selectedPyeong?: { exclusiveArea?: number; pyeong?: number };
    expansionType?: string;
    buildingType?: string;
    businessType?: string;
  };
  scope?: string[];
  rooms?: string[];
}

export interface RedactionEstimateInput {
  id: string;
  totalAmount?: number;
  precisionLevel?: string;
  lines?: Array<{
    tradeCode: string;
    tradeName: string;
    materialCost?: number;
    laborCost?: number;
    expenseCost?: number;
    totalAmount?: number;
    materialCategoryCode?: string | null;
    materialCategoryName?: string | null;
    brand?: string | null;
    sku?: string | null;
    productName?: string | null;
    quantity?: number;
    unit?: string;
  }>;
}

export interface RedactionDesignOutput {
  id: string;
  imageUrl?: string | null;
  targetLabel?: string | null;
  style?: string | null;
  isPublicAllowed?: boolean;
}

/**
 * 메인 — Step3 견적을 커뮤니티 공개용 스냅샷으로 변환.
 */
export function redactProjectForCommunity(input: {
  project: RedactionProjectInput;
  estimate: RedactionEstimateInput;
  designOutputs: RedactionDesignOutput[];
  visibility: CommunityShareVisibility;
  snapshotType: "estimate_share" | "design_share";
}): RedactedCommunitySnapshot {
  const { project, estimate, designOutputs, visibility, snapshotType } = input;
  const removedFields: string[] = [];
  const suspiciousMatches: string[] = [];

  // 1) 주소 마스킹
  const fullAddress =
    project.basicInfo?.selectedAddress?.roadAddress ||
    project.basicInfo?.selectedAddress?.jibunAddress ||
    null;
  const regionLabel = redactAddress(fullAddress);
  if (fullAddress) {
    removedFields.push("fullAddress");
    if (project.basicInfo?.selectedAddress?.buildingName) removedFields.push("buildingName");
  }

  // 2) 면적 라벨
  const areaM2 = project.basicInfo?.selectedPyeong?.exclusiveArea ?? null;
  const areaPyeong = project.basicInfo?.selectedPyeong?.pyeong ?? null;
  const areaLabel = buildAreaLabel(areaM2);

  // 3) 확장 라벨
  const expansionLabel =
    project.basicInfo?.expansionType === "extended"
      ? "확장형"
      : project.basicInfo?.expansionType === "basic"
        ? "기본형"
        : null;

  // 4) 디자인 이미지 — visibility 체크 + isPublicAllowed
  const redactedDesignOutputs = visibility.showDesignImages
    ? designOutputs
        .filter((d) => d.imageUrl && (d.isPublicAllowed !== false))
        .map((d) => ({
          id: d.id,
          imageUrl: d.imageUrl!,
          targetLabel: d.targetLabel ?? null,
          style: d.style ?? null,
        }))
    : [];
  if (!visibility.showDesignImages) removedFields.push("designOutputs");

  // 5) 견적 총액 — 정확한 금액 노출 X, 범위만
  const totalAmount = visibility.showTotalAmount ? estimate.totalAmount ?? null : null;
  const totalAmountRangeLabel = buildAmountRangeLabel(estimate.totalAmount ?? null);

  // 6) 공종별 그룹
  const tradeMap = new Map<
    string,
    { tradeName: string; material: number; labor: number; expense: number; lineCount: number }
  >();
  for (const l of estimate.lines ?? []) {
    const cur =
      tradeMap.get(l.tradeCode) ??
      { tradeName: l.tradeName, material: 0, labor: 0, expense: 0, lineCount: 0 };
    cur.material += Number(l.materialCost ?? 0);
    cur.labor += Number(l.laborCost ?? 0);
    cur.expense += Number(l.expenseCost ?? 0);
    cur.lineCount += 1;
    tradeMap.set(l.tradeCode, cur);
  }
  const redactedTradeGroups = visibility.showTradeSummary
    ? Array.from(tradeMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, v]) => ({
          tradeCode: code,
          tradeName: v.tradeName,
          lineCount: v.lineCount,
          materialCost: visibility.showDetailedLines ? v.material : null,
          laborCost: visibility.showDetailedLines ? v.labor : null,
          expenseCost: visibility.showDetailedLines ? v.expense : null,
          total: v.material + v.labor + v.expense,
        }))
    : [];
  if (!visibility.showTradeSummary) removedFields.push("tradeGroups");
  if (!visibility.showDetailedLines) removedFields.push("detailedLines");

  // 7) 자재 요약 — 브랜드/SKU는 visibility 체크
  const materialMap = new Map<
    string,
    { name: string; brand: string | null; sku: string | null; qty: number; unit: string }
  >();
  for (const l of estimate.lines ?? []) {
    if (!l.materialCategoryCode) continue;
    const key = l.materialCategoryCode;
    const cur =
      materialMap.get(key) ??
      {
        name: l.materialCategoryName ?? l.materialCategoryCode,
        brand: visibility.showBrandSku ? l.brand ?? null : null,
        sku: visibility.showBrandSku ? l.sku ?? null : null,
        qty: 0,
        unit: l.unit ?? "ea",
      };
    cur.qty += Number(l.quantity ?? 0);
    materialMap.set(key, cur);
  }
  const redactedMaterialSummary = Array.from(materialMap.entries()).map(([code, v]) => ({
    categoryCode: code,
    categoryName: v.name,
    brandLabel: v.brand,
    skuLabel: v.sku,
    quantity: v.qty,
    unit: v.unit,
  }));
  if (!visibility.showBrandSku) removedFields.push("brandSku");

  // 8) 자동 감사: 의심 항목 (visibility 가 다 켜져 있어도 검출)
  const allText = JSON.stringify({ project, estimate });
  const detection = detectPrivateInfo(allText);
  if (detection.found) {
    suspiciousMatches.push(...detection.matches.map((m) => `${m.type}: ${m.value.slice(0, 20)}…`));
  }

  return {
    snapshotType,
    projectMode: project.projectMode ?? "apartment",
    redactedProject: {
      regionLabel,
      buildingType: project.basicInfo?.buildingType ?? null,
      businessType: project.basicInfo?.businessType ?? null,
      areaLabel,
      areaM2,
      areaPyeong,
      expansionLabel,
      rooms: project.rooms ?? [],
      scope: project.scope ?? [],
    },
    redactedDesignOutputs,
    redactedEstimateSummary: {
      totalAmount,
      totalAmountRangeLabel,
      precisionLevel: estimate.precisionLevel ?? null,
      lineCount: estimate.lines?.length ?? 0,
      tradeCount: tradeMap.size,
    },
    redactedTradeGroups,
    redactedMaterialSummary,
    privacyReport: {
      removedFields,
      suspiciousMatches,
      autoScanPassed: suspiciousMatches.length === 0,
      timestamp: new Date().toISOString(),
    },
    visibilityOptions: visibility,
  };
}

/**
 * 게시글 제목/본문에서 자동으로 개인정보 의심 항목 검출 + 마스킹.
 */
export function buildCommunityPrivacyReport(text: string): {
  cleanText: string;
  report: { removed: number; suspicious: string[] };
} {
  const detection = detectPrivateInfo(text);
  const cleanText = maskPrivateInfo(text);
  return {
    cleanText,
    report: {
      removed: detection.matches.length,
      suspicious: detection.matches.map((m) => m.type),
    },
  };
}
