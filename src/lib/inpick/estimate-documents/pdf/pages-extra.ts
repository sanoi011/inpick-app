/**
 * 견적서 PDF 확장 페이지 (2026-07-04 대표 지시):
 *   8. 공정 순서·선행공정 분석
 *   9. 공정거래위원회 표준계약서 양식 (참고용 — 업체 매칭 시 상세 계약서 별도 제공)
 *  10+. 프로젝트 AI 디자인 이미지 부록
 */
import type jsPDF from "jspdf";
import type { EstimateDocumentPackage } from "../types";
import { PAGE, fmtWon } from "./format";

const M = 14; // 좌우 여백(mm)

/* ── 8. 공정 순서·선행공정 ── */
const PHASE_ORDER: Array<{ name: string; keywords: string[]; note: string }> = [
  { name: "철거", keywords: ["철거", "폐기"], note: "보양 → 철거 → 폐기물 반출" },
  { name: "설비·전기 배관", keywords: ["설비", "배관", "전기"], note: "벽체 매립 배관·배선 선시공" },
  { name: "방수·조적·미장", keywords: ["방수", "조적", "미장"], note: "욕실 방수 후 담수 테스트" },
  { name: "목공·타일", keywords: ["목공", "타일"], note: "구조 목공 → 벽·바닥 타일" },
  { name: "마감(도배·도장·바닥·천장)", keywords: ["도배", "도장", "바닥", "마루", "천장", "필름"], note: "천장 → 벽 → 바닥 순 마감" },
  { name: "창호·가구·주방", keywords: ["창호", "문", "가구", "주방", "샷시"], note: "마감 후 설치물 시공" },
  { name: "마무리(조명·위생·정리)", keywords: ["조명", "위생", "도기", "걸레받이", "정리", "청소", "잡철", "고정"], note: "기구 부착 → 입주 청소" },
];

export function drawSchedulePage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(15);
  doc.text("공정 순서 · 선행공정 분석", M, 20);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text("본 견적의 공종을 표준 시공 순서에 배치한 것입니다. 각 공정은 선행 공정 완료 후 착수를 권장합니다.", M, 27);
  doc.setTextColor(0);

  const tradeNames = pkg.tradeSummaries.map((t) => t.tradeName);
  const rows = PHASE_ORDER.map((p, i) => {
    const included = tradeNames.filter((n) => p.keywords.some((k) => n.includes(k)));
    return {
      order: i + 1,
      name: p.name,
      included,
      preceding: i === 0 ? "—" : PHASE_ORDER.slice(0, i).map((x) => x.name.split("(")[0]).join(" → "),
      note: p.note,
    };
  }).filter((r) => r.included.length > 0);

  const colX = [M, M + 12, M + 62, M + 130, M + 216];
  let y = 36;
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y - 5, PAGE.width - M * 2, 8, "F");
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(8.5);
  ["순서", "공정", "포함 공종(본 견적)", "선행 공정", "비고"].forEach((h, i) => doc.text(h, colX[i] + 1, y));
  y += 8;
  doc.setFont("NanumGothic", "normal");
  for (const r of rows) {
    const inc = doc.splitTextToSize(r.included.join(", "), 64) as string[];
    const pre = doc.splitTextToSize(r.preceding, 82) as string[];
    const rowH = Math.max(inc.length, pre.length, 1) * 4.5 + 4;
    doc.setDrawColor(225);
    doc.line(M, y + rowH - 4.5, PAGE.width - M, y + rowH - 4.5);
    doc.text(String(r.order), colX[0] + 3, y);
    doc.setFont("NanumGothic", "bold");
    doc.text(r.name, colX[1] + 1, y);
    doc.setFont("NanumGothic", "normal");
    doc.text(inc, colX[2] + 1, y);
    doc.text(pre, colX[3] + 1, y);
    doc.setTextColor(120);
    doc.text(r.note, colX[4] + 1, y);
    doc.setTextColor(0);
    y += rowH;
  }
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("※ 실제 공사 기간·순서는 현장 여건과 시공사 계획에 따라 조정될 수 있습니다.", M, y);
  doc.setTextColor(0);
}

/* ── 9. 공정거래위원회 표준계약서 양식 ── */
const CONTRACT_CLAUSES: Array<{ title: string; text: string }> = [
  { title: "제1조 (총칙)", text: "본 계약은 갑(소비자)이 을(시공사)에게 실내건축공사를 도급함에 있어 필요한 사항을 정함을 목적으로 한다." },
  { title: "제2조 (공사 범위)", text: "을은 본 계약서 및 첨부 설계도서(도면, 시방서, 내역서 등)에 따라 공사를 성실히 수행하여야 한다." },
  { title: "제3조 (공사기간)", text: "① 을은 약정한 기간 내에 공사를 완료하여야 한다. ② 천재지변, 갑의 사정 등 부득이한 사유로 공사기간의 변경이 필요한 경우, 갑·을 합의 하에 변경할 수 있다." },
  { title: "제4조 (공사대금의 지급)", text: "① 갑은 공사대금을 공사 진행에 따라 분할 지급한다. ② 선급금은 계약 체결 시, 중도금은 공정률 50% 시점, 잔금은 준공 검사 후 지급한다." },
  { title: "제5조 (설계 변경)", text: "① 갑이 설계 변경을 요구할 경우, 을과 협의하여 추가 비용 및 공기 변경 사항을 서면으로 합의한다. ② 을은 갑의 서면 승인 없이 설계를 임의로 변경할 수 없다." },
  { title: "제6조 (자재)", text: "① 을은 내역서에 명시된 자재를 사용하여야 한다. ② 동등 이상의 자재로 대체할 경우 갑의 사전 승인을 받아야 한다." },
  { title: "제7조 (하자보수)", text: "① 을은 공사 완료 후 1년간 하자보수 책임을 진다. ② 방수공사는 3년, 구조체는 5년의 하자보수 기간을 적용한다. ③ 갑의 귀책 사유로 발생한 하자는 제외한다." },
  { title: "제8조 (준공 검사)", text: "을은 공사 완료 시 갑에게 통지하고, 갑은 통지 받은 날로부터 7일 이내에 준공 검사를 실시한다." },
  { title: "제9조 (지체 배상)", text: "을의 귀책 사유로 공사가 지연될 경우, 지체일수 1일당 공사대금의 1/1000에 해당하는 지체배상금을 갑에게 지급한다." },
  { title: "제10조 (계약의 해제·해지)", text: "① 갑·을 일방이 계약 조건을 위반한 경우 상대방은 서면 최고 후 계약을 해제·해지할 수 있다. ② 해제·해지 시 기성 부분에 대한 정산은 갑·을 합의에 의한다." },
  { title: "제11조 (분쟁해결)", text: "본 계약에 관한 분쟁은 갑·을 합의에 의해 해결하되, 합의가 이루어지지 않을 경우 관할 법원의 판결에 따른다." },
];

export function drawStandardContractPages(doc: jsPDF, pkg: EstimateDocumentPackage) {
  // ── 표지·계약 정보 ──
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(16);
  doc.text("실내건축·창호 공사 표준계약서 (양식)", PAGE.width / 2, 22, { align: "center" });
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text("공정거래위원회 표준약관(제10096호)을 참고한 양식입니다. 업체 매칭 완료 시 당사자 정보가 기입된 상세 계약서가 별도 제공됩니다.", PAGE.width / 2, 29, { align: "center" });
  doc.setTextColor(0);

  const rows: Array<[string, string]> = [
    ["공 사 명", pkg.project.projectName || "________________________"],
    ["공사 장소", pkg.project.addressMaskedText || pkg.project.addressText || "________________________"],
    ["공사 기간", "20___년 ___월 ___일  ~  20___년 ___월 ___일"],
    ["계약 금액", `${fmtWon(pkg.summary.totalAmount)} 원 (본 견적 기준 · VAT 포함)`],
    ["발주자 (갑)", "성명: ______________   연락처: ______________   (서명/인)"],
    ["시공자 (을)", "상호: ______________   대표: ______________   (서명/인)"],
  ];
  let y = 42;
  doc.setFontSize(9.5);
  for (const [k, v] of rows) {
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y - 5.5, 34, 9, "F");
    doc.setDrawColor(200);
    doc.rect(M, y - 5.5, PAGE.width - M * 2, 9);
    doc.setFont("NanumGothic", "bold");
    doc.text(k, M + 3, y);
    doc.setFont("NanumGothic", "normal");
    doc.text(v, M + 40, y);
    y += 9;
  }

  // ── 일반조건 (2단) ──
  y += 8;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(11);
  doc.text("계약 일반조건", M, y);
  y += 6;
  doc.setFontSize(7.5);
  const colW = (PAGE.width - M * 2 - 8) / 2;
  let colYs = [y, y];
  CONTRACT_CLAUSES.forEach((c, idx) => {
    const col = idx < 6 ? 0 : 1;
    const x = M + col * (colW + 8);
    const lines = doc.splitTextToSize(c.text, colW) as string[];
    doc.setFont("NanumGothic", "bold");
    doc.text(c.title, x, colYs[col]);
    colYs[col] += 4;
    doc.setFont("NanumGothic", "normal");
    doc.setTextColor(70);
    doc.text(lines, x, colYs[col]);
    doc.setTextColor(0);
    colYs[col] += lines.length * 3.4 + 3;
  });
}

/* ── 10+. 디자인 이미지 부록 ── */
export interface DesignImageInput {
  url: string;
  label: string;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 2×2 그리드로 디자인 이미지 부록 페이지 추가. 반환: 그린 이미지 수 */
export async function drawDesignImagePages(
  doc: jsPDF,
  images: DesignImageInput[],
): Promise<number> {
  const loaded: Array<{ dataUrl: string; label: string }> = [];
  for (const img of images.slice(0, 12)) {
    const dataUrl = await toDataUrl(img.url);
    if (dataUrl) loaded.push({ dataUrl, label: img.label });
  }
  if (loaded.length === 0) return 0;

  const cellW = (PAGE.width - M * 2 - 8) / 2;
  const cellH = 78;
  loaded.forEach((img, i) => {
    const slot = i % 4;
    if (slot === 0) {
      doc.addPage("a4", "landscape");
      doc.setFont("NanumGothic", "bold");
      doc.setFontSize(13);
      doc.text("AI 디자인 이미지 부록", M, 18);
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("본 견적의 근거가 된 생성 디자인입니다. 실제 시공 결과와 차이가 있을 수 있습니다.", M, 24);
      doc.setTextColor(0);
    }
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const x = M + col * (cellW + 8);
    const y = 30 + row * (cellH + 12);
    try {
      const fmt = img.dataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(img.dataUrl, fmt, x, y, cellW, cellH, undefined, "FAST");
    } catch {
      /* 개별 이미지 실패는 스킵 */
    }
    doc.setFontSize(8.5);
    doc.setFont("NanumGothic", "bold");
    doc.text(img.label, x, y + cellH + 5);
  });
  return loaded.length;
}
