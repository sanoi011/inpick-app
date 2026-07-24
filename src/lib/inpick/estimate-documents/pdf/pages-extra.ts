/**
 * 견적서 PDF 확장 페이지 (2026-07-04 대표 지시):
 *   8. 공정 순서·선행공정 분석
 *   9. 특기사항 기입·서명란
 *  10+. 프로젝트 AI 디자인 이미지 부록
 */
import type jsPDF from "jspdf";
import type { EstimateDocumentPackage } from "../types";
import { PAGE } from "./format";
import { buildScheduleFromDocumentLines } from "@/lib/estimate-pro/schedule-model";

const M = 14; // 좌우 여백(mm)

export function drawSchedulePage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  const schedule = buildScheduleFromDocumentLines(pkg.lines);
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(15);
  doc.text("수량 기반 예정 공정표", M, 20);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(
    `견적 수량과 표준 일당 시공량·품질 대기시간으로 산정한 예비 공기 ${schedule.totalDays}일입니다. 계약 전 사업자가 수정·확정합니다.`,
    M,
    27,
  );
  doc.setTextColor(0);

  const labelWidth = 76;
  const chartX = M + labelWidth;
  const chartWidth = PAGE.width - M - chartX;
  const safeTotalDays = Math.max(1, schedule.totalDays);
  let y = 39;
  doc.setFillColor(239, 246, 255);
  doc.rect(M, y - 6, PAGE.width - M * 2, 9, "F");
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(7.5);
  doc.text("공정 / 산정 근거", M + 2, y);
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const x = chartX + chartWidth * ratio;
    doc.setDrawColor(210, 225, 245);
    doc.line(x, y + 4, x, y + 4 + schedule.phases.length * 10);
    doc.text(
      `${Math.round(schedule.totalDays * ratio)}일`,
      x,
      y,
      { align: ratio === 0 ? "left" : ratio === 1 ? "right" : "center" },
    );
  });
  y += 8;

  schedule.phases.forEach((phase, index) => {
    const rowY = y + index * 10;
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 50, 90);
    doc.text(phase.name, M + 2, rowY + 3);
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(100);
    doc.text(
      doc.splitTextToSize(phase.basis, labelWidth - 5)[0] || "",
      M + 2,
      rowY + 6.5,
    );

    doc.setFillColor(244, 248, 253);
    doc.roundedRect(chartX, rowY, chartWidth, 6.5, 1.5, 1.5, "F");
    const barX = chartX + (phase.startDay / safeTotalDays) * chartWidth;
    const barWidth = Math.max(
      4,
      (phase.durationDays / safeTotalDays) * chartWidth,
    );
    const blue = Math.max(90, 205 - index * 7);
    doc.setFillColor(25, 95, blue);
    doc.roundedRect(barX, rowY, Math.min(barWidth, chartX + chartWidth - barX), 6.5, 1.5, 1.5, "F");
    doc.setTextColor(255);
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(6.5);
    doc.text(
      `${phase.durationDays}일`,
      Math.min(barX + 2, chartX + chartWidth - 8),
      rowY + 4.4,
    );
    doc.setTextColor(0);
  });

  y += schedule.phases.length * 10 + 3;
  if (y < PAGE.height - 15) {
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(105);
    doc.text(
      "※ 병렬 투입, 작업 가능 시간, 자재 제작·납기, 현장 조건에 따라 계약 전 입찰 사업자가 시작일과 기간을 수정합니다.",
      M,
      y,
    );
    doc.setTextColor(0);
  }
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
