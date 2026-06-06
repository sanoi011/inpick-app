// @ts-nocheck — @react-pdf/renderer는 npm install 후에만 type 인식. 빌드 시 정상 동작.
/* eslint-disable jsx-a11y/alt-text */
/**
 * InPick 견적서 PDF — spec §A 표준 양식 (12 공종 + 5 간접비 + 시공자 placeholder).
 *
 * 가이드: InPick_Quote_System_Spec.md §A-1, A-2, A-3
 *
 * A4 가로 3장:
 *   1. 갑지 (Cover) — 발주자/시공자(placeholder)/공사개요/총액(VAT 포함, 한글)
 *   2. 총괄표 (Summary) — 12 공종 + 간접비 5종
 *   3. 내역서 (Detail) — 공종별 Section Header + 7 컬럼 (자재단가/노무단가 제거)
 *
 * 폰트: NanumGothic (public/fonts 로컬 번들)
 */
"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

// ═══════════════════════════════════════════════════
// 폰트 등록
// ═══════════════════════════════════════════════════
const FONT_BASE =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

Font.register({
  family: "NanumGothic",
  fonts: [
    { src: `${FONT_BASE}/fonts/NanumGothic-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/fonts/NanumGothic-Bold.ttf`, fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ═══════════════════════════════════════════════════
// 타입 — segmentation-estimate 응답 + spec 신규 필드
// ═══════════════════════════════════════════════════
export interface QuoteItemPdf {
  itemId: string;
  name: string;
  spec?: string;
  unit: string;
  quantity: number;
  materialCost: number;
  laborCost: number;
  expenseCost: number;
  totalCost: number;
  source: "catalog" | "standard";
  catalogSku?: string;
}

export interface QuoteSectionPdf {
  sectionId: string;
  sectionNumber: string;
  sectionName: string;
  items: QuoteItemPdf[];
  subtotal: {
    materialCost: number;
    laborCost: number;
    expenseCost: number;
    total: number;
  };
}

export interface IndirectCostsPdf {
  directCost: number;
  setupCost: number;
  safetyCost: number;
  generalManagementCost: number;
  profit: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  setupBreakdown?: {
    elevatorProtection: number;
    entranceProtection: number;
    scaffolding: number;
    wasteDisposal: number;
  };
  appliedRates?: {
    safety_rate: number;
    general_management_rate: number;
    profit_rate: number;
  };
}

export interface QuoteEstimate {
  // 신규 (spec)
  sections?: QuoteSectionPdf[];
  directCostSubtotal?: number;
  indirectCosts?: IndirectCostsPdf;
  totalAmount?: number;
  total_area_sqm?: number;
  // 호환 (옛 응답)
  items?: any[];
  material_subtotal?: number;
  labor_subtotal?: number;
  direct_total?: number;
  setup_items?: { id: string; name: string; description?: string; computed_amount: number }[];
  setup_total?: number;
  expenses?: number;
  expenses_ratio?: number;
  management?: number;
  management_ratio?: number;
  safety?: number;
  safety_ratio?: number;
  indirect?: number;
  indirect_ratio?: number;
  total?: number;
  vat_rate?: number;
  vat_separate?: number;
  generated_at: string;
}

export interface QuoteMeta {
  quote_no: string;             // spec — IP-YYYY-MMDD-NNN
  client_name: string;
  client_phone?: string;
  client_email?: string;
  site_address: string;
  site_area_sqm?: number;       // 시공면적
  pyeong?: string;
  expansion?: "basic" | "extended";
  rooms?: string[];
  validity_days?: number;
  expected_period_days?: number; // 공사기간
  // 시공자 정보 (입찰 선정 + 계약 체결 후 주입. 미입력 시 placeholder 표시)
  contractor?: {
    company_name?: string;
    representative?: string;
    biz_no?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════
const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
const ymd = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

/** 한글 금액 표기 (예: 12345678 → "일천이백삼십사만오천육백칠십팔원") */
function numToKorean(n: number): string {
  n = Math.round(n);
  if (n === 0) return "영원정";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const small = ["", "십", "백", "천"];
  const big = ["", "만", "억", "조", "경"];
  let str = "";
  let unit = 0;
  while (n > 0) {
    const part = n % 10000;
    if (part > 0) {
      let pStr = "";
      let p = part;
      let s = 0;
      while (p > 0) {
        const d = p % 10;
        if (d > 0) pStr = digits[d] + small[s] + pStr;
        p = Math.floor(p / 10);
        s++;
      }
      str = pStr + big[unit] + str;
    }
    n = Math.floor(n / 10000);
    unit++;
  }
  return str + "원정";
}

/** sections이 없는 옛 응답을 sections 형태로 자동 변환 (호환) */
function ensureSections(estimate: QuoteEstimate): QuoteSectionPdf[] {
  if (estimate.sections && estimate.sections.length > 0) return estimate.sections;
  // fallback: items[] → 단일 'unmapped' 섹션
  if (!estimate.items || estimate.items.length === 0) return [];
  const items: QuoteItemPdf[] = estimate.items.map((it: any) => ({
    itemId: it.region_id || it.id || "x",
    name: it.material_name || it.name || "—",
    unit: it.unit || "EA",
    quantity: it.qty ?? it.quantity ?? 1,
    materialCost: it.material_subtotal || 0,
    laborCost: it.labor_subtotal || 0,
    expenseCost: 0,
    totalCost: it.subtotal || 0,
    source: "catalog",
    catalogSku: it.material_sku,
  }));
  const sub = items.reduce(
    (a, it) => ({
      materialCost: a.materialCost + it.materialCost,
      laborCost: a.laborCost + it.laborCost,
      expenseCost: a.expenseCost + it.expenseCost,
      total: a.total + it.totalCost,
    }),
    { materialCost: 0, laborCost: 0, expenseCost: 0, total: 0 },
  );
  return [
    {
      sectionId: "unmapped",
      sectionNumber: "00",
      sectionName: "전체 항목",
      items,
      subtotal: sub,
    },
  ];
}

/** indirectCosts가 없는 옛 응답을 추정 (호환) */
function ensureIndirect(estimate: QuoteEstimate): IndirectCostsPdf {
  if (estimate.indirectCosts) return estimate.indirectCosts;
  // fallback — 평면 필드로부터 재구성
  const directCost = estimate.direct_total || 0;
  const setupCost = estimate.setup_total || 0;
  const safetyCost = estimate.safety || 0;
  const generalManagementCost = estimate.management || 0;
  const profit = estimate.indirect || 0;
  const supplyAmount = estimate.total || directCost + setupCost + safetyCost + generalManagementCost + profit;
  const vat = estimate.vat_separate || Math.round(supplyAmount * 0.10);
  const totalAmount = supplyAmount + vat;
  return { directCost, setupCost, safetyCost, generalManagementCost, profit, supplyAmount, vat, totalAmount };
}

// ═══════════════════════════════════════════════════
// Stylesheet
// ═══════════════════════════════════════════════════
const styles = StyleSheet.create({
  page: { fontFamily: "NanumGothic", paddingHorizontal: 30, paddingVertical: 25, fontSize: 9, color: "#1A1A1A" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1A1A1A", paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "#1A1A1A" },
  subtitle: { fontSize: 11, color: "#666", marginTop: 2 },
  brandBox: { fontSize: 8, textAlign: "right", color: "#666", lineHeight: 1.4 },
  brandName: { fontSize: 16, fontWeight: 700, color: "#F73B20", letterSpacing: 1 },

  coverGrid: { marginTop: 12, flexDirection: "row", gap: 10 },
  coverLeft: { flex: 1, border: "1px solid #999" },
  coverRight: { flex: 1, border: "1px solid #999" },
  // spec — 시공자 placeholder 박스 (점선 + 사선 배경 톤)
  contractorPlaceholderBox: { flex: 1, border: "1px dashed #B79575", backgroundColor: "#FBF7F2", position: "relative" },
  contractorBadge: { position: "absolute", top: -1, right: -1, backgroundColor: "#F73B20", color: "#FFFFFF", fontSize: 7.5, padding: "3 7", fontWeight: 700, letterSpacing: 0.5 },
  coverHeader: { backgroundColor: "#F5F0EE", padding: "6 8", fontSize: 10, fontWeight: 700, borderBottom: "1px solid #999" },
  coverHeaderPlaceholder: { backgroundColor: "#F5EBDD", padding: "6 8", fontSize: 10, fontWeight: 700, borderBottom: "1px dashed #B79575", color: "#8C6A4A" },
  coverRow: { flexDirection: "row", borderBottom: "1px solid #DDD", minHeight: 26, alignItems: "center" },
  coverRowDashed: { flexDirection: "row", borderBottom: "1px dashed #D9C9B3", minHeight: 26, alignItems: "center" },
  coverLabel: { width: 95, backgroundColor: "#FAFAFA", paddingHorizontal: 8, paddingVertical: 6, fontSize: 9, color: "#666", fontWeight: 700, borderRight: "1px solid #DDD" },
  coverLabelPlaceholder: { width: 95, backgroundColor: "#F5EBDD", paddingHorizontal: 8, paddingVertical: 6, fontSize: 9, color: "#8C6A4A", fontWeight: 700, borderRight: "1px dashed #D9C9B3" },
  coverValue: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10 },
  coverValuePlaceholder: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 9, color: "#B79575", fontStyle: "italic" },

  totalBigBox: { marginTop: 14, border: "2px solid #1A1A1A", backgroundColor: "#FFF6F5", padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 11, fontWeight: 700, color: "#666" },
  totalValue: { fontSize: 26, fontWeight: 700, color: "#F73B20", letterSpacing: 1 },
  totalSub: { fontSize: 9, color: "#888", marginTop: 2 },
  totalKorean: { fontSize: 10, color: "#1A1A1A", marginTop: 4, fontWeight: 700 },

  table: { border: "1px solid #999", marginTop: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1A1A1A", color: "#FFFFFF", fontWeight: 700, fontSize: 8.5, minHeight: 24, alignItems: "center" },
  tableRow: { flexDirection: "row", borderBottom: "0.5px solid #DDD", minHeight: 22, alignItems: "center", fontSize: 8.5 },
  tableRowAlt: { backgroundColor: "#FAFAFA" },
  td: { paddingHorizontal: 6, paddingVertical: 4 },
  tdHeader: { paddingHorizontal: 6, paddingVertical: 5, color: "#FFFFFF" },

  // spec — 공종 Section Header (검정)
  sectionHeader: { flexDirection: "row", backgroundColor: "#2A2A2A", color: "#FFFFFF", fontWeight: 700, minHeight: 26, alignItems: "center", borderBottom: "1px solid #1A1A1A" },
  sectionHeaderTd: { paddingHorizontal: 8, paddingVertical: 6, color: "#FFFFFF", fontSize: 9.5 },

  // 총괄표 — 간접비 행
  summaryTable: { marginTop: 12, border: "1px solid #999" },
  summaryRow: { flexDirection: "row", minHeight: 26, borderBottom: "0.5px solid #DDD", alignItems: "center" },
  summaryLabelCell: { flex: 3, paddingHorizontal: 8, paddingVertical: 6, fontSize: 9 },
  summaryValueCell: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, textAlign: "right", fontSize: 9 },
  summaryTotalRow: { flexDirection: "row", minHeight: 36, borderTop: "2px solid #1A1A1A", backgroundColor: "#FFF6F5", alignItems: "center" },
  summaryTotalLabel: { flex: 3, paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: 700 },
  summaryTotalValue: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#F73B20" },

  footer: { position: "absolute", bottom: 15, left: 30, right: 30, paddingTop: 6, borderTop: "1px solid #DDD", fontSize: 7, color: "#999", flexDirection: "row", justifyContent: "space-between" },
  pageNo: { fontSize: 7, color: "#999" },
  noteBox: { marginTop: 10, padding: 8, backgroundColor: "#FAFAFA", border: "0.5px solid #DDD", fontSize: 7.5, color: "#666", lineHeight: 1.5 },
  contractorNotice: { marginTop: 6, fontSize: 7.5, color: "#8C6A4A", textAlign: "center", fontStyle: "italic" },
});

// ═══════════════════════════════════════════════════
// Footer 공통
// ═══════════════════════════════════════════════════
const FooterRow = ({ meta, page }: { meta: QuoteMeta; page: string }) => (
  <View style={styles.footer}>
    <Text>
      {meta.contractor?.company_name || "InPick (인픽)"}
      {meta.contractor?.phone ? ` · ${meta.contractor.phone}` : ""}
      {meta.contractor?.biz_no ? ` · 사업자 ${meta.contractor.biz_no}` : ""}
      {` · 견적번호 ${meta.quote_no}`}
    </Text>
    <Text style={styles.pageNo}>{page}</Text>
  </View>
);

// ═══════════════════════════════════════════════════
// 1. 갑지 (Cover Sheet) — spec §A-1
// ═══════════════════════════════════════════════════
const CoverSheet = ({ estimate, meta }: { estimate: QuoteEstimate; meta: QuoteMeta }) => {
  const validityDays = meta.validity_days || 30;
  const validUntil = new Date(estimate.generated_at);
  validUntil.setDate(validUntil.getDate() + validityDays);

  const indirect = ensureIndirect(estimate);
  const totalIncludingVat = indirect.totalAmount; // VAT 포함 (spec — "총 견적금액 (VAT 포함)")
  const hasContractor = meta.contractor && (
    meta.contractor.company_name || meta.contractor.representative || meta.contractor.biz_no
  );

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>견 적 서</Text>
          <Text style={styles.subtitle}>QUOTATION · 견적번호 {meta.quote_no}</Text>
        </View>
        <View style={styles.brandBox}>
          <Text style={styles.brandName}>InPick</Text>
          <Text>AI 인테리어 견적 플랫폼</Text>
          <Text>발급일 {ymd(estimate.generated_at)}</Text>
          <Text>유효기간 {ymd(validUntil.toISOString())} ({validityDays}일)</Text>
        </View>
      </View>

      {/* 발주자 / 시공자 박스 */}
      <View style={styles.coverGrid}>
        {/* 발주자 (좌) */}
        <View style={styles.coverLeft}>
          <Text style={styles.coverHeader}>발 주 자 (수신처)</Text>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>성명</Text>
            <Text style={styles.coverValue}>{meta.client_name || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>연락처</Text>
            <Text style={styles.coverValue}>{meta.client_phone || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>이메일</Text>
            <Text style={styles.coverValue}>{meta.client_email || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>시공장소</Text>
            <Text style={styles.coverValue}>{meta.site_address || "—"}</Text>
          </View>
          <View style={[styles.coverRow, { borderBottom: "none" }]}>
            <Text style={styles.coverLabel}>시공면적</Text>
            <Text style={styles.coverValue}>
              {meta.pyeong || "—"}
              {meta.site_area_sqm ? ` (${meta.site_area_sqm.toFixed(1)}㎡)` : ""}
              {meta.expansion === "extended" ? " · 확장형" : meta.expansion === "basic" ? " · 기본형" : ""}
            </Text>
          </View>
        </View>

        {/* 시공자 (우) — 채워졌으면 normal, 비었으면 placeholder */}
        {hasContractor ? (
          <View style={styles.coverRight}>
            <Text style={styles.coverHeader}>시 공 자</Text>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>상호</Text>
              <Text style={styles.coverValue}>{meta.contractor!.company_name || "—"}</Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>대표자</Text>
              <Text style={styles.coverValue}>{meta.contractor!.representative || "—"}</Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>사업자번호</Text>
              <Text style={styles.coverValue}>{meta.contractor!.biz_no || "—"}</Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>사업장 주소</Text>
              <Text style={styles.coverValue}>{meta.contractor!.address || "—"}</Text>
            </View>
            <View style={[styles.coverRow, { borderBottom: "none" }]}>
              <Text style={styles.coverLabel}>연락처·이메일</Text>
              <Text style={styles.coverValue}>
                {meta.contractor!.phone || "—"}
                {meta.contractor!.email ? ` · ${meta.contractor!.email}` : ""}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.contractorPlaceholderBox}>
            <Text style={styles.contractorBadge}>계약 후 자동 입력</Text>
            <Text style={styles.coverHeaderPlaceholder}>시 공 자 (입찰 선정 시 채워짐)</Text>
            <View style={styles.coverRowDashed}>
              <Text style={styles.coverLabelPlaceholder}>상호</Text>
              <Text style={styles.coverValuePlaceholder}>입찰 선정 시 자동 입력</Text>
            </View>
            <View style={styles.coverRowDashed}>
              <Text style={styles.coverLabelPlaceholder}>대표자</Text>
              <Text style={styles.coverValuePlaceholder}>—</Text>
            </View>
            <View style={styles.coverRowDashed}>
              <Text style={styles.coverLabelPlaceholder}>사업자번호</Text>
              <Text style={styles.coverValuePlaceholder}>—</Text>
            </View>
            <View style={styles.coverRowDashed}>
              <Text style={styles.coverLabelPlaceholder}>사업장 주소</Text>
              <Text style={styles.coverValuePlaceholder}>—</Text>
            </View>
            <View style={[styles.coverRowDashed, { borderBottom: "none" }]}>
              <Text style={styles.coverLabelPlaceholder}>연락처·이메일</Text>
              <Text style={styles.coverValuePlaceholder}>—</Text>
            </View>
            <Text style={styles.contractorNotice}>InPick 표준계약서 시행 동의 업체만 노출</Text>
          </View>
        )}
      </View>

      {/* 총 금액 박스 — VAT 포함 + 한글 금액 */}
      <View style={styles.totalBigBox}>
        <View>
          <Text style={styles.totalLabel}>총 견적 금액 (VAT 포함)</Text>
          <Text style={styles.totalSub}>
            공급가액 {won(indirect.supplyAmount)} + 부가세 {won(indirect.vat)}
            {meta.expected_period_days ? ` · 공사기간 약 ${meta.expected_period_days}일` : ""}
          </Text>
          <Text style={styles.totalKorean}>金 {numToKorean(totalIncludingVat)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.totalValue}>{won(totalIncludingVat)}</Text>
          <Text style={styles.totalSub}>
            견적일 {ymd(estimate.generated_at)}
          </Text>
        </View>
      </View>

      {/* 공사 개요 + 견적 조건 */}
      <View style={[styles.coverGrid, { marginTop: 12 }]}>
        <View style={[styles.coverLeft, { padding: 10 }]}>
          <Text style={[styles.coverHeader, { backgroundColor: "transparent", borderBottom: "1px solid #DDD", paddingHorizontal: 0, marginBottom: 6 }]}>
            공사 개요
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 공사명</Text><Text>{meta.client_name || "—"}님 인테리어</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 위치</Text><Text>{meta.site_address || "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 시공범위</Text>
            <Text>{meta.rooms && meta.rooms.length > 0 ? meta.rooms.join(", ") : "전체"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text>· 공사기간</Text><Text>약 {meta.expected_period_days || 35}일</Text>
          </View>
        </View>

        <View style={[styles.coverRight, { padding: 10 }]}>
          <Text style={[styles.coverHeader, { backgroundColor: "transparent", borderBottom: "1px solid #DDD", paddingHorizontal: 0, marginBottom: 6 }]}>
            견적 조건
          </Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.7, color: "#444" }}>
            · 단가: 한국물가협회(KPA) + KICT 2026 표준품셈{"\n"}
            · 결제: 착공 10% / 중도 1차 30% / 중도 2차 30% / 잔금 30%{"\n"}
            · 산업안전보건관리비: 고용노동부 고시 2025-11호 적용{"\n"}
            · 견적 유효기간 {validityDays}일 (자재 단가 변동 가능){"\n"}
            · 부가세 10% 포함{"\n"}
            · 입찰 사업자별 요율 조정 가능 (산안비 하향 제외)
          </Text>
        </View>
      </View>

      <FooterRow meta={meta} page="갑지 1/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// 2. 총괄표 (Summary) — spec §A-2
// ═══════════════════════════════════════════════════
const SummarySheet = ({ estimate, meta }: { estimate: QuoteEstimate; meta: QuoteMeta }) => {
  const sections = ensureSections(estimate);
  const indirect = ensureIndirect(estimate);
  const directCost = estimate.directCostSubtotal ?? indirect.directCost;

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { fontSize: 18 }]}>공 사 비 총 괄 표</Text>
          <Text style={styles.subtitle}>견적번호 {meta.quote_no} · {meta.client_name}님</Text>
        </View>
        <View style={styles.brandBox}>
          <Text style={styles.brandName}>InPick</Text>
          <Text>{ymd(estimate.generated_at)}</Text>
        </View>
      </View>

      {/* 12 공종 표 */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tdHeader, { width: 35, textAlign: "center" }]}>NO.</Text>
          <Text style={[styles.tdHeader, { flex: 2 }]}>공 종</Text>
          <Text style={[styles.tdHeader, { flex: 1.2, textAlign: "right" }]}>자재비</Text>
          <Text style={[styles.tdHeader, { flex: 1.2, textAlign: "right" }]}>노무비</Text>
          <Text style={[styles.tdHeader, { flex: 1.5, textAlign: "right" }]}>소계</Text>
          <Text style={[styles.tdHeader, { flex: 0.8, textAlign: "right" }]}>비율</Text>
        </View>
        {sections.map((sec, i) => {
          const ratio = directCost > 0 ? (sec.subtotal.total / directCost) * 100 : 0;
          return (
            <View key={sec.sectionId} style={[styles.tableRow, i % 2 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.td, { width: 35, textAlign: "center" }]}>{sec.sectionNumber}</Text>
              <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>{sec.sectionName}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>{won(sec.subtotal.materialCost)}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                {won(sec.subtotal.laborCost + sec.subtotal.expenseCost)}
              </Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: "right", fontWeight: 700 }]}>{won(sec.subtotal.total)}</Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right", color: "#888" }]}>{ratio.toFixed(1)}%</Text>
            </View>
          );
        })}
        {/* 직접공사비 합계 */}
        <View style={[styles.tableRow, { backgroundColor: "#F5F0EE", fontWeight: 700, borderTop: "1.5px solid #999" }]}>
          <Text style={[styles.td, { width: 35 }]}></Text>
          <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>직 접 공 사 비 합 계</Text>
          <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}></Text>
          <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}></Text>
          <Text style={[styles.td, { flex: 1.5, textAlign: "right", fontWeight: 700, fontSize: 10 }]}>{won(directCost)}</Text>
          <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>100%</Text>
        </View>
      </View>

      {/* 간접비 5종 + 총액 */}
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>· 가설공사비 (엘리베이터/출입구/가설자재/폐기물 보양)</Text>
          <Text style={styles.summaryValueCell}>{won(indirect.setupCost)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>
            · 산업안전보건관리비 ({((indirect.appliedRates?.safety_rate ?? 0.0311) * 100).toFixed(2)}% — 고용노동부 고시 2025-11호)
          </Text>
          <Text style={styles.summaryValueCell}>{won(indirect.safetyCost)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>
            · 일반관리비 ({((indirect.appliedRates?.general_management_rate ?? 0.05) * 100).toFixed(1)}% — KPI 원가계산 기준)
          </Text>
          <Text style={styles.summaryValueCell}>{won(indirect.generalManagementCost)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>
            · 기업이윤 ({((indirect.appliedRates?.profit_rate ?? 0.10) * 100).toFixed(1)}% — KPI 한도 25%)
          </Text>
          <Text style={styles.summaryValueCell}>{won(indirect.profit)}</Text>
        </View>
        {/* 공급가액 */}
        <View style={[styles.summaryRow, { backgroundColor: "#FAFAFA" }]}>
          <Text style={[styles.summaryLabelCell, { fontWeight: 700 }]}>공 급 가 액 (소계)</Text>
          <Text style={[styles.summaryValueCell, { fontWeight: 700 }]}>{won(indirect.supplyAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>· 부가가치세 (10% — 부가가치세법)</Text>
          <Text style={styles.summaryValueCell}>{won(indirect.vat)}</Text>
        </View>
        {/* 총 견적금액 */}
        <View style={styles.summaryTotalRow}>
          <Text style={styles.summaryTotalLabel}>총 견 적 금 액 (VAT 포함)</Text>
          <Text style={styles.summaryTotalValue}>{won(indirect.totalAmount)}</Text>
        </View>
      </View>

      <View style={styles.noteBox}>
        2026 KICT 표준품셈 + 한국물가정보(KPI) 원가계산 제비율 + 고용노동부 고시 2025-11호 기준.
        사업자 입찰 시 가설공사비/일반관리비/이윤은 한도 내 조정 가능. 산업안전보건관리비는 법정 최저값(3.11%) 이상으로만 조정.
      </View>

      <FooterRow meta={meta} page="총괄표 2/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// 3. 내역서 (Detail) — spec §A-3
// 컬럼: 품명/규격 → 단위 → 수량 → 자재비 → 노무비 → 경비 → 합계
// ═══════════════════════════════════════════════════
const DetailSheet = ({ estimate, meta }: { estimate: QuoteEstimate; meta: QuoteMeta }) => {
  const sections = ensureSections(estimate);
  const indirect = ensureIndirect(estimate);
  const directCost = estimate.directCostSubtotal ?? indirect.directCost;

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { fontSize: 18 }]}>공 사 내 역 서</Text>
          <Text style={styles.subtitle}>견적번호 {meta.quote_no} · 공종별 상세 내역</Text>
        </View>
        <View style={styles.brandBox}>
          <Text style={styles.brandName}>InPick</Text>
          <Text>{ymd(estimate.generated_at)}</Text>
        </View>
      </View>

      <View style={styles.table}>
        {/* 헤더 — spec 7 컬럼 */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tdHeader, { width: 30, textAlign: "center" }]}>No.</Text>
          <Text style={[styles.tdHeader, { flex: 3 }]}>품 명 / 규 격</Text>
          <Text style={[styles.tdHeader, { width: 60, textAlign: "center" }]}>단위</Text>
          <Text style={[styles.tdHeader, { width: 70, textAlign: "right" }]}>수 량</Text>
          <Text style={[styles.tdHeader, { width: 95, textAlign: "right" }]}>자재비</Text>
          <Text style={[styles.tdHeader, { width: 95, textAlign: "right" }]}>노무비</Text>
          <Text style={[styles.tdHeader, { width: 80, textAlign: "right" }]}>경비</Text>
          <Text style={[styles.tdHeader, { width: 100, textAlign: "right" }]}>합 계</Text>
        </View>

        {/* 공종별 — Section Header + 항목들 */}
        {sections.map((sec) => (
          <View key={sec.sectionId} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderTd, { width: 30 }]}>{sec.sectionNumber}</Text>
              <Text style={[styles.sectionHeaderTd, { flex: 4.5 }]}>{sec.sectionName}</Text>
              <Text style={[styles.sectionHeaderTd, { width: 100, textAlign: "right" }]}>
                {won(sec.subtotal.total)}
              </Text>
            </View>
            {sec.items.map((it, i) => (
              <View key={it.itemId} style={[styles.tableRow, i % 2 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.td, { width: 30, textAlign: "center", color: "#888" }]}>{i + 1}</Text>
                <Text style={[styles.td, { flex: 3 }]}>
                  {it.name}
                  {it.spec ? `\n${it.spec}` : ""}
                </Text>
                <Text style={[styles.td, { width: 60, textAlign: "center" }]}>
                  {it.unit === "sqm" ? "㎡" : it.unit === "m" ? "m" : it.unit}
                </Text>
                <Text style={[styles.td, { width: 70, textAlign: "right" }]}>
                  {it.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.td, { width: 95, textAlign: "right" }]}>
                  {it.materialCost > 0 ? won(it.materialCost) : "—"}
                </Text>
                <Text style={[styles.td, { width: 95, textAlign: "right" }]}>
                  {it.laborCost > 0 ? won(it.laborCost) : "—"}
                </Text>
                <Text style={[styles.td, { width: 80, textAlign: "right" }]}>
                  {it.expenseCost > 0 ? won(it.expenseCost) : "—"}
                </Text>
                <Text style={[styles.td, { width: 100, textAlign: "right", fontWeight: 700 }]}>
                  {won(it.totalCost)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* 직접공사비 합계 */}
        <View style={[styles.tableRow, { backgroundColor: "#F5F0EE", borderTop: "1.5px solid #999", minHeight: 30 }]}>
          <Text style={[styles.td, { width: 30 }]}></Text>
          <Text style={[styles.td, { flex: 3, fontWeight: 700, fontSize: 10 }]}>직 접 공 사 비 합 계</Text>
          <Text style={[styles.td, { width: 60 }]}></Text>
          <Text style={[styles.td, { width: 70 }]}></Text>
          <Text style={[styles.td, { width: 95 }]}></Text>
          <Text style={[styles.td, { width: 95 }]}></Text>
          <Text style={[styles.td, { width: 80 }]}></Text>
          <Text style={[styles.td, { width: 100, textAlign: "right", fontWeight: 700, fontSize: 10 }]}>{won(directCost)}</Text>
        </View>
      </View>

      <View style={styles.noteBox}>
        품명/규격은 제조사 카탈로그 기준 표시. 실 시공 시 동급 자재로 대체 가능 (사전 협의).
        수량은 도면 + AI 영역 분석 기준 추정값 — 현장 답사 후 확정. 간접비(가설공사비/산안비/관리비/이윤/VAT)는 총괄표 참조.
      </View>

      <FooterRow meta={meta} page="내역서 3/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// Document
// ═══════════════════════════════════════════════════
export const QuoteDocument = ({ estimate, meta }: { estimate: QuoteEstimate; meta: QuoteMeta }) => (
  <Document
    title={`InPick 견적서 ${meta.quote_no}`}
    author="InPick"
    subject={`${meta.client_name} 인테리어 견적`}
    creator="InPick AI"
  >
    <CoverSheet estimate={estimate} meta={meta} />
    <SummarySheet estimate={estimate} meta={meta} />
    <DetailSheet estimate={estimate} meta={meta} />
  </Document>
);

// ═══════════════════════════════════════════════════
// 다운로드 헬퍼
// ═══════════════════════════════════════════════════
export async function generateQuotePdf(estimate: QuoteEstimate, meta: QuoteMeta): Promise<Blob> {
  return await pdf(<QuoteDocument estimate={estimate} meta={meta} />).toBlob();
}

export async function downloadQuotePdf(estimate: QuoteEstimate, meta: QuoteMeta): Promise<void> {
  const blob = await generateQuotePdf(estimate, meta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `InPick_견적서_${meta.quote_no}_${ymd(estimate.generated_at).replace(/\./g, "")}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** spec §A-1 — IP-YYYY-MMDD-NNN 형식 */
export function generateQuoteNo(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `IP-${yyyy}-${mm}${dd}-${seq}`;
}
