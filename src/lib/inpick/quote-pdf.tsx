// @ts-nocheck — @react-pdf/renderer는 npm install 후에만 type 인식. 빌드 시 정상 동작.
/* eslint-disable jsx-a11y/alt-text */
/**
 * InPick 견적서 PDF — 한국 인테리어 업계 표준 양식.
 *
 * A4 가로 3장:
 *   1. 갑지 (Cover) — 발주자/시공장소/총액/견적일자/유효기간
 *   2. 총괄표 (Summary) — 카테고리별 소계 + 가설비/경비/관리비/간접비
 *   3. 내역서 (Detail) — 항목별 수량 × 단가 (자재 + 노무 분리)
 *
 * 폰트: NanumGothic (public/fonts 로컬 번들 — CDN 의존성 0).
 *       가이드 v2 §6 Phase 3-3 / 4-3-4 PDF 폰트 번들 정책.
 *
 * 호출:
 *   import { generateQuotePdf } from '@/lib/inpick/quote-pdf';
 *   await generateQuotePdf(estimate, { quoteNo, clientName, siteAddress });
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
// 폰트 등록 — NanumGothic (public/fonts 로컬 번들)
// 가이드 v2 §6 Phase 3-3 — Google Fonts CDN 다운 시 PDF 생성 실패 위험 제거.
// public/fonts/NanumGothic-{Regular,Bold}.ttf 가 Vercel 정적 자산으로 서빙됨.
// 클라이언트 fetch 시 same-origin이므로 절대 URL 변환은 런타임에 origin 부착.
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

// 줄바꿈 hyphenation 한글에서 이상하게 작동 — 비활성
Font.registerHyphenationCallback((word) => [word]);

// ═══════════════════════════════════════════════════
// 타입 (segmentation-estimate 응답과 동일)
// ═══════════════════════════════════════════════════
export interface QuoteEstimate {
  items: {
    region_id: string;
    category: string;
    label_ko: string;
    material_name: string;
    material_sku: string;
    brand?: string;
    unit: string;
    qty: number;
    material_price: number;
    labor_price: number;
    unit_total: number;
    material_subtotal: number;
    labor_subtotal: number;
    subtotal: number;
  }[];
  material_subtotal: number;
  labor_subtotal: number;
  direct_total: number;
  setup_items: { id: string; name: string; description?: string; computed_amount: number }[];
  setup_total: number;
  expenses: number;
  expenses_ratio: number;
  management: number;
  management_ratio: number;
  safety: number;
  safety_ratio: number;
  indirect: number;
  indirect_ratio: number;
  total: number;
  vat_rate: number;
  vat_separate: number;
  generated_at: string;
}

export interface QuoteMeta {
  quote_no: string;             // 견적번호 (예: INP-2026-0509-001)
  client_name: string;          // 발주자
  client_phone?: string;
  site_address: string;         // 시공 장소
  pyeong?: string;              // 평형 (예: "30평")
  expansion?: "basic" | "extended";
  rooms?: string[];             // 시공 범위 (방 이름들)
  validity_days?: number;       // 견적 유효기간 (기본 30일)
  company_name?: string;        // 시공사 (기본: 인픽 InPick)
  company_address?: string;
  company_phone?: string;
  company_biz_no?: string;      // 사업자번호
  representative?: string;       // 대표자
}

// ═══════════════════════════════════════════════════
// Stylesheet (A4 가로, 한국 인테리어 견적서 표준)
// ═══════════════════════════════════════════════════
const styles = StyleSheet.create({
  page: {
    fontFamily: "NanumGothic",
    paddingHorizontal: 30,
    paddingVertical: 25,
    fontSize: 9,
    color: "#1A1A1A",
  },
  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1A1A1A",
    paddingBottom: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 4,
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  brandBox: {
    fontSize: 8,
    textAlign: "right",
    color: "#666",
    lineHeight: 1.4,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#F73B20",
    letterSpacing: 1,
  },
  // 갑지 큰 박스
  coverGrid: {
    marginTop: 15,
    flexDirection: "row",
    gap: 10,
  },
  coverLeft: {
    flex: 1,
    border: "1px solid #999",
  },
  coverRight: {
    flex: 1,
    border: "1px solid #999",
  },
  coverHeader: {
    backgroundColor: "#F5F0EE",
    padding: "6 8",
    fontSize: 10,
    fontWeight: 700,
    borderBottom: "1px solid #999",
  },
  coverRow: {
    flexDirection: "row",
    borderBottom: "1px solid #DDD",
    minHeight: 28,
    alignItems: "center",
  },
  coverLabel: {
    width: 90,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 9,
    color: "#666",
    fontWeight: 700,
    borderRight: "1px solid #DDD",
  },
  coverValue: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 10,
  },
  // 합계 큰 박스 (갑지)
  totalBigBox: {
    marginTop: 18,
    border: "2px solid #1A1A1A",
    backgroundColor: "#FFF6F5",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#666",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#F73B20",
    letterSpacing: 1,
  },
  totalSub: {
    fontSize: 9,
    color: "#888",
    marginTop: 2,
  },
  // 표 (table)
  table: {
    border: "1px solid #999",
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 8.5,
    minHeight: 24,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #DDD",
    minHeight: 22,
    alignItems: "center",
    fontSize: 8.5,
  },
  tableRowAlt: {
    backgroundColor: "#FAFAFA",
  },
  td: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tdHeader: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    color: "#FFFFFF",
  },
  // 카테고리별 소계 행
  catRow: {
    flexDirection: "row",
    backgroundColor: "#F5F0EE",
    fontWeight: 700,
    minHeight: 24,
    alignItems: "center",
    borderBottom: "1px solid #999",
  },
  // 합계 영역 (총괄표 하단)
  summaryTable: {
    marginTop: 12,
    border: "1px solid #999",
  },
  summaryRow: {
    flexDirection: "row",
    minHeight: 26,
    borderBottom: "0.5px solid #DDD",
    alignItems: "center",
  },
  summaryLabelCell: {
    flex: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 9,
  },
  summaryValueCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "right",
    fontSize: 9,
  },
  summaryTotalRow: {
    flexDirection: "row",
    minHeight: 36,
    borderTop: "2px solid #1A1A1A",
    backgroundColor: "#FFF6F5",
    alignItems: "center",
  },
  summaryTotalLabel: {
    flex: 3,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: 700,
  },
  summaryTotalValue: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlign: "right",
    fontSize: 14,
    fontWeight: 700,
    color: "#F73B20",
  },
  // 푸터
  footer: {
    position: "absolute",
    bottom: 15,
    left: 30,
    right: 30,
    paddingTop: 6,
    borderTop: "1px solid #DDD",
    fontSize: 7,
    color: "#999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageNo: {
    fontSize: 7,
    color: "#999",
  },
  noteBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#FAFAFA",
    border: "0.5px solid #DDD",
    fontSize: 7.5,
    color: "#666",
    lineHeight: 1.5,
  },
});

// ═══════════════════════════════════════════════════
// Helper — 통화 포맷
// ═══════════════════════════════════════════════════
const won = (n: number) => `₩${n.toLocaleString()}`;
const ymd = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// 카테고리 라벨
const CAT_LABEL: Record<string, string> = {
  floor: "바닥",
  wall: "벽",
  ceiling: "천장",
  window: "창호",
  door: "문/도어",
  curtain: "커튼/블라인드",
  unknown: "기타",
};

// 카테고리별 그룹핑
function groupByCategory(items: QuoteEstimate["items"]) {
  const map = new Map<string, { items: typeof items; subtotal: number; material: number; labor: number }>();
  for (const it of items) {
    const key = it.category;
    if (!map.has(key)) map.set(key, { items: [], subtotal: 0, material: 0, labor: 0 });
    const g = map.get(key)!;
    g.items.push(it);
    g.subtotal += it.subtotal;
    g.material += it.material_subtotal;
    g.labor += it.labor_subtotal;
  }
  return map;
}

// ═══════════════════════════════════════════════════
// Footer (모든 페이지 공통)
// ═══════════════════════════════════════════════════
const FooterRow: React.FC<{ meta: QuoteMeta; page: string }> = ({ meta, page }) => (
  <View style={styles.footer}>
    <Text>
      {meta.company_name || "InPick (인픽)"} · {meta.company_phone || "-"} ·
      {meta.company_biz_no ? ` 사업자 ${meta.company_biz_no} ·` : ""}
      견적번호 {meta.quote_no}
    </Text>
    <Text style={styles.pageNo}>{page}</Text>
  </View>
);

// ═══════════════════════════════════════════════════
// 1. 갑지 (Cover Sheet)
// ═══════════════════════════════════════════════════
const CoverSheet: React.FC<{ estimate: QuoteEstimate; meta: QuoteMeta }> = ({ estimate, meta }) => {
  const validityDays = meta.validity_days || 30;
  const validUntil = new Date(estimate.generated_at);
  validUntil.setDate(validUntil.getDate() + validityDays);

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>견 적 서</Text>
          <Text style={styles.subtitle}>QUOTATION</Text>
        </View>
        <View style={styles.brandBox}>
          <Text style={styles.brandName}>InPick</Text>
          <Text>AI 인테리어 견적 플랫폼</Text>
          <Text>{meta.company_address || "대전광역시"}</Text>
          <Text>Tel. {meta.company_phone || "-"}</Text>
          {meta.company_biz_no && <Text>사업자등록번호 {meta.company_biz_no}</Text>}
        </View>
      </View>

      {/* 발주자 / 시공자 정보 박스 */}
      <View style={styles.coverGrid}>
        <View style={styles.coverLeft}>
          <Text style={styles.coverHeader}>발 주 자</Text>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>성명</Text>
            <Text style={styles.coverValue}>{meta.client_name || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>연락처</Text>
            <Text style={styles.coverValue}>{meta.client_phone || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>시공장소</Text>
            <Text style={styles.coverValue}>{meta.site_address || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>평형 / 시공형태</Text>
            <Text style={styles.coverValue}>
              {meta.pyeong || "—"}
              {meta.expansion === "extended" ? " (확장형)" : meta.expansion === "basic" ? " (기본형)" : ""}
            </Text>
          </View>
          <View style={[styles.coverRow, { borderBottom: "none" }]}>
            <Text style={styles.coverLabel}>시공범위</Text>
            <Text style={styles.coverValue}>
              {meta.rooms && meta.rooms.length > 0 ? meta.rooms.join(", ") : "전체"}
            </Text>
          </View>
        </View>

        <View style={styles.coverRight}>
          <Text style={styles.coverHeader}>시 공 자 (당사)</Text>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>상호</Text>
            <Text style={styles.coverValue}>{meta.company_name || "InPick (인픽)"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>대표자</Text>
            <Text style={styles.coverValue}>{meta.representative || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>사업자번호</Text>
            <Text style={styles.coverValue}>{meta.company_biz_no || "—"}</Text>
          </View>
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>주소</Text>
            <Text style={styles.coverValue}>{meta.company_address || "—"}</Text>
          </View>
          <View style={[styles.coverRow, { borderBottom: "none" }]}>
            <Text style={styles.coverLabel}>연락처</Text>
            <Text style={styles.coverValue}>{meta.company_phone || "—"}</Text>
          </View>
        </View>
      </View>

      {/* 합계 큰 박스 */}
      <View style={styles.totalBigBox}>
        <View>
          <Text style={styles.totalLabel}>총 견적 금액 (부가세 별도)</Text>
          <Text style={styles.totalSub}>
            견적일 {ymd(estimate.generated_at)} · 유효기간 {ymd(validUntil.toISOString())} ({validityDays}일)
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.totalValue}>{won(estimate.total)}</Text>
          <Text style={styles.totalSub}>VAT 별도 {won(estimate.vat_separate)}</Text>
        </View>
      </View>

      {/* 견적 요약 (간단 break-down) */}
      <View style={[styles.coverGrid, { marginTop: 14 }]}>
        <View style={[styles.coverLeft, { padding: 10 }]}>
          <Text style={[styles.coverHeader, { backgroundColor: "transparent", borderBottom: "1px solid #DDD", paddingHorizontal: 0, marginBottom: 6 }]}>
            견적 구성 (요약)
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 자재비</Text><Text>{won(estimate.material_subtotal)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 노무비</Text><Text>{won(estimate.labor_subtotal)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 가설비</Text><Text>{won(estimate.setup_total)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text>· 경비 / 관리비 / 안전비</Text>
            <Text>{won(estimate.expenses + estimate.management + estimate.safety)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text>· 간접비 (이윤)</Text><Text>{won(estimate.indirect)}</Text>
          </View>
        </View>

        <View style={[styles.coverRight, { padding: 10 }]}>
          <Text style={[styles.coverHeader, { backgroundColor: "transparent", borderBottom: "1px solid #DDD", paddingHorizontal: 0, marginBottom: 6 }]}>
            견적 조건
          </Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.7, color: "#444" }}>
            · 단가: 한국물가협회(KPA) + 대한건설협회 표준품셈 기준{"\n"}
            · 시공기간: 약 30~45일 (평형/시공범위에 따라 변동){"\n"}
            · 결제: 착수금 30% / 기성 30% / 기성 30% / 준공 10%{"\n"}
            · 견적 유효기간 {validityDays}일 (자재 단가 변동 가능){"\n"}
            · 부가세 10% 별도{"\n"}
            · 인픽 수수료는 계약 시점 별도
          </Text>
        </View>
      </View>

      <FooterRow meta={meta} page="갑지 1/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// 2. 총괄표 (Summary)
// ═══════════════════════════════════════════════════
const SummarySheet: React.FC<{ estimate: QuoteEstimate; meta: QuoteMeta }> = ({ estimate, meta }) => {
  const groups = groupByCategory(estimate.items);
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* 헤더 */}
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

      {/* 카테고리별 소계 표 */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tdHeader, { width: 40, textAlign: "center" }]}>NO.</Text>
          <Text style={[styles.tdHeader, { flex: 2 }]}>구 분</Text>
          <Text style={[styles.tdHeader, { flex: 1.2, textAlign: "right" }]}>자재비</Text>
          <Text style={[styles.tdHeader, { flex: 1.2, textAlign: "right" }]}>노무비</Text>
          <Text style={[styles.tdHeader, { flex: 1.5, textAlign: "right" }]}>소계</Text>
          <Text style={[styles.tdHeader, { flex: 0.8, textAlign: "right" }]}>비율</Text>
        </View>
        {Array.from(groups.entries()).map(([cat, g], i) => {
          const ratio = estimate.direct_total > 0 ? (g.subtotal / estimate.direct_total) * 100 : 0;
          return (
            <View key={cat} style={[styles.tableRow, i % 2 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.td, { width: 40, textAlign: "center" }]}>{i + 1}</Text>
              <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>{CAT_LABEL[cat] || cat}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>{won(g.material)}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>{won(g.labor)}</Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: "right", fontWeight: 700 }]}>{won(g.subtotal)}</Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right", color: "#888" }]}>{ratio.toFixed(1)}%</Text>
            </View>
          );
        })}
        {/* 직접비 합 */}
        <View style={[styles.tableRow, { backgroundColor: "#F5F0EE", fontWeight: 700, borderTop: "1.5px solid #999" }]}>
          <Text style={[styles.td, { width: 40 }]}></Text>
          <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>직 접 비 합 계</Text>
          <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>{won(estimate.material_subtotal)}</Text>
          <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>{won(estimate.labor_subtotal)}</Text>
          <Text style={[styles.td, { flex: 1.5, textAlign: "right", fontWeight: 700 }]}>{won(estimate.direct_total)}</Text>
          <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>100%</Text>
        </View>
      </View>

      {/* 가설비 + 경비 + 관리비 + 간접비 + 합계 */}
      <View style={styles.summaryTable}>
        {/* 가설비 항목별 */}
        {estimate.setup_items.map((s) => (
          <View key={s.id} style={styles.summaryRow}>
            <Text style={styles.summaryLabelCell}>· 가설비 — {s.name}</Text>
            <Text style={styles.summaryValueCell}>{won(s.computed_amount)}</Text>
          </View>
        ))}
        <View style={[styles.summaryRow, { backgroundColor: "#FAFAFA" }]}>
          <Text style={[styles.summaryLabelCell, { fontWeight: 700 }]}>가설비 소계</Text>
          <Text style={[styles.summaryValueCell, { fontWeight: 700 }]}>{won(estimate.setup_total)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>경비 ({(estimate.expenses_ratio * 100).toFixed(0)}% — 운반·잡재료)</Text>
          <Text style={styles.summaryValueCell}>{won(estimate.expenses)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>현장관리비 ({(estimate.management_ratio * 100).toFixed(1)}%)</Text>
          <Text style={styles.summaryValueCell}>{won(estimate.management)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>안전관리비 ({(estimate.safety_ratio * 100).toFixed(1)}%)</Text>
          <Text style={styles.summaryValueCell}>{won(estimate.safety)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelCell}>간접비 (이윤 {(estimate.indirect_ratio * 100).toFixed(0)}%)</Text>
          <Text style={styles.summaryValueCell}>{won(estimate.indirect)}</Text>
        </View>

        {/* 합계 */}
        <View style={styles.summaryTotalRow}>
          <Text style={styles.summaryTotalLabel}>합 계 (부가세 별도)</Text>
          <Text style={styles.summaryTotalValue}>{won(estimate.total)}</Text>
        </View>
        <View style={[styles.summaryRow, { borderBottom: "none" }]}>
          <Text style={[styles.summaryLabelCell, { color: "#666", fontSize: 8 }]}>참고: 부가세 ({(estimate.vat_rate * 100).toFixed(0)}%)</Text>
          <Text style={[styles.summaryValueCell, { color: "#666", fontSize: 8 }]}>{won(estimate.vat_separate)}</Text>
        </View>
      </View>

      <View style={styles.noteBox}>
        본 견적은 한국물가협회(KPA) 자재 단가 + 대한건설협회 표준품셈 기준 평균값으로 산정되었습니다.
        실제 시공 시 자재 변동 / 현장 여건에 따라 ±10% 조정될 수 있으며, 인픽 수수료는 계약 체결 시 별도 청구됩니다.
      </View>

      <FooterRow meta={meta} page="총괄표 2/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// 3. 내역서 (Detail)
// ═══════════════════════════════════════════════════
const DetailSheet: React.FC<{ estimate: QuoteEstimate; meta: QuoteMeta }> = ({ estimate, meta }) => {
  const groups = groupByCategory(estimate.items);

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { fontSize: 18 }]}>공 사 내 역 서</Text>
          <Text style={styles.subtitle}>견적번호 {meta.quote_no} · 항목별 상세 내역</Text>
        </View>
        <View style={styles.brandBox}>
          <Text style={styles.brandName}>InPick</Text>
          <Text>{ymd(estimate.generated_at)}</Text>
        </View>
      </View>

      <View style={styles.table}>
        {/* 헤더 */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tdHeader, { width: 30, textAlign: "center" }]}>No.</Text>
          <Text style={[styles.tdHeader, { flex: 2.4 }]}>품 명 / 규 격</Text>
          <Text style={[styles.tdHeader, { flex: 1 }]}>제조사</Text>
          <Text style={[styles.tdHeader, { width: 60, textAlign: "center" }]}>단위</Text>
          <Text style={[styles.tdHeader, { width: 65, textAlign: "right" }]}>수 량</Text>
          <Text style={[styles.tdHeader, { width: 75, textAlign: "right" }]}>자재단가</Text>
          <Text style={[styles.tdHeader, { width: 75, textAlign: "right" }]}>노무단가</Text>
          <Text style={[styles.tdHeader, { width: 85, textAlign: "right" }]}>자재금액</Text>
          <Text style={[styles.tdHeader, { width: 85, textAlign: "right" }]}>노무금액</Text>
          <Text style={[styles.tdHeader, { width: 95, textAlign: "right" }]}>합 계</Text>
        </View>

        {/* 카테고리별 그룹 + 항목 */}
        {Array.from(groups.entries()).map(([cat, g]) => (
          <View key={cat}>
            {/* 카테고리 헤더 */}
            <View style={styles.catRow}>
              <Text style={[styles.td, { width: 30 }]}></Text>
              <Text style={[styles.td, { flex: 5, fontWeight: 700, color: "#1A1A1A" }]}>
                ▶ {CAT_LABEL[cat] || cat}
              </Text>
              <Text style={[styles.td, { width: 85, textAlign: "right", fontWeight: 700, color: "#666" }]}>
                자재 {won(g.material)}
              </Text>
              <Text style={[styles.td, { width: 85, textAlign: "right", fontWeight: 700, color: "#666" }]}>
                노무 {won(g.labor)}
              </Text>
              <Text style={[styles.td, { width: 95, textAlign: "right", fontWeight: 700 }]}>
                {won(g.subtotal)}
              </Text>
            </View>
            {/* 항목들 */}
            {g.items.map((it, i) => (
              <View key={it.region_id} style={[styles.tableRow, i % 2 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.td, { width: 30, textAlign: "center", color: "#888" }]}>{i + 1}</Text>
                <Text style={[styles.td, { flex: 2.4 }]}>{it.material_name}</Text>
                <Text style={[styles.td, { flex: 1, color: "#666" }]}>{it.brand || "—"}</Text>
                <Text style={[styles.td, { width: 60, textAlign: "center" }]}>
                  {it.unit === "sqm" ? "㎡" : it.unit === "m" ? "m" : "EA"}
                </Text>
                <Text style={[styles.td, { width: 65, textAlign: "right" }]}>{it.qty.toLocaleString()}</Text>
                <Text style={[styles.td, { width: 75, textAlign: "right" }]}>{won(it.material_price)}</Text>
                <Text style={[styles.td, { width: 75, textAlign: "right" }]}>{won(it.labor_price)}</Text>
                <Text style={[styles.td, { width: 85, textAlign: "right" }]}>{won(it.material_subtotal)}</Text>
                <Text style={[styles.td, { width: 85, textAlign: "right" }]}>{won(it.labor_subtotal)}</Text>
                <Text style={[styles.td, { width: 95, textAlign: "right", fontWeight: 700 }]}>{won(it.subtotal)}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* 직접비 합계 */}
        <View style={[styles.tableRow, { backgroundColor: "#F5F0EE", borderTop: "1.5px solid #999", minHeight: 30 }]}>
          <Text style={[styles.td, { width: 30 }]}></Text>
          <Text style={[styles.td, { flex: 5, fontWeight: 700, fontSize: 10 }]}>직 접 비 합 계</Text>
          <Text style={[styles.td, { width: 85, textAlign: "right", fontWeight: 700 }]}>{won(estimate.material_subtotal)}</Text>
          <Text style={[styles.td, { width: 85, textAlign: "right", fontWeight: 700 }]}>{won(estimate.labor_subtotal)}</Text>
          <Text style={[styles.td, { width: 95, textAlign: "right", fontWeight: 700, fontSize: 10 }]}>{won(estimate.direct_total)}</Text>
        </View>
      </View>

      <View style={styles.noteBox}>
        품명/규격은 제조사 카탈로그 기준 표시. 실 시공 시 동급 자재로 대체 가능 (사전 협의).
        수량은 도면 + AI 영역 분석 결과 기준 추정값 — 현장 답사 후 확정.
      </View>

      <FooterRow meta={meta} page="내역서 3/3" />
    </Page>
  );
};

// ═══════════════════════════════════════════════════
// Document
// ═══════════════════════════════════════════════════
export const QuoteDocument: React.FC<{ estimate: QuoteEstimate; meta: QuoteMeta }> = ({ estimate, meta }) => (
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
export async function generateQuotePdf(
  estimate: QuoteEstimate,
  meta: QuoteMeta,
): Promise<Blob> {
  const blob = await pdf(<QuoteDocument estimate={estimate} meta={meta} />).toBlob();
  return blob;
}

export async function downloadQuotePdf(
  estimate: QuoteEstimate,
  meta: QuoteMeta,
): Promise<void> {
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

/** 견적번호 자동 생성 (yyyyMMdd-NNN 형식) */
export function generateQuoteNo(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `INP-${ymd}-${seq}`;
}
