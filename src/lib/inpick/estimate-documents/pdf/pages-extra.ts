/**
 * 견적서 PDF 확장 페이지 (2026-07-04 대표 지시):
 *   8. 공정 순서·선행공정 분석
 *   9. 특기사항 기입·서명란
 *  10+. 프로젝트 AI 디자인 이미지 부록
 */
import type jsPDF from "jspdf";
import type { EstimateDocumentPackage } from "../types";
import { PAGE } from "./format";

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

/* ── 9. 특기사항·서명란 ── */
export function drawSpecialNotesSignaturePage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(15);
  doc.text("특기사항 · 계약 확인", M, 20);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(
    "현장 확인 후 변경되는 공사범위·자재·추가금액은 반드시 아래 특기사항에 기재하고 당사자가 서명합니다.",
    M,
    27,
  );
  doc.setTextColor(0);

  const notesTop = 35;
  const notesHeight = 80;
  doc.setDrawColor(185);
  doc.rect(M, notesTop, PAGE.width - M * 2, notesHeight);
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(9);
  doc.text("특기사항", M + 3, notesTop + 7);
  doc.setDrawColor(225);
  for (let y = notesTop + 16; y < notesTop + notesHeight; y += 10) {
    doc.line(M + 3, y, PAGE.width - M - 3, y);
  }

  const signedAt = "20____년 ____월 ____일";
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(9);
  doc.text(`계약 확인일: ${signedAt}`, PAGE.width / 2, 128, { align: "center" });

  const boxY = 138;
  const boxW = (PAGE.width - M * 2 - 8) / 2;
  const parties: Array<{ title: string; lines: string[] }> = [
    {
      title: "발주자 (갑)",
      lines: [
        `성명: ${pkg.consumer.displayName || "________________________"}`,
        "연락처: ________________________",
        "주소: __________________________",
        "서명 또는 인: __________________",
      ],
    },
    {
      title: "시공자 (을)",
      lines: [
        `상호: ${pkg.contractor?.companyName || "________________________"}`,
        `대표자: ${pkg.contractor?.ceoName || "______________________"}`,
        "사업자등록번호: _________________",
        "서명 또는 인: __________________",
      ],
    },
  ];
  parties.forEach((party, index) => {
    const x = M + index * (boxW + 8);
    doc.setDrawColor(185);
    doc.rect(x, boxY, boxW, 46);
    doc.setFillColor(242, 242, 242);
    doc.rect(x, boxY, boxW, 9, "F");
    doc.setFont("NanumGothic", "bold");
    doc.text(party.title, x + 3, boxY + 6);
    doc.setFont("NanumGothic", "normal");
    party.lines.forEach((line, lineIndex) => {
      doc.text(line, x + 4, boxY + 16 + lineIndex * 7);
    });
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
