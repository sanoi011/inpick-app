"use client";

import jsPDF from "jspdf";
import { DRAWING_TYPE_LABELS } from "@/types/construction-drawing";
import type { DrawingType } from "@/types/construction-drawing";

interface DrawingData {
  drawingType: string;
  finalUrl?: string;
  metadata?: Record<string, unknown>;
}

interface ProjectInfo {
  projectName: string;
  address: string;
  area: number;
  date: string;
  contractId?: string;
}

const MARGIN = 15;
const PAGE_W = 420; // A3 가로
const PAGE_H = 297;

let fontsLoaded = false;
let regularFontData: string | null = null;
let boldFontData: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function loadFonts() {
  if (fontsLoaded) return;
  try {
    const [regRes, boldRes] = await Promise.all([
      fetch("/fonts/NanumGothic-Regular.ttf"),
      fetch("/fonts/NanumGothic-Bold.ttf"),
    ]);
    const [regBuf, boldBuf] = await Promise.all([
      regRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    regularFontData = arrayBufferToBase64(regBuf);
    boldFontData = arrayBufferToBase64(boldBuf);
    fontsLoaded = true;
  } catch (err) {
    console.error("[drawing-pdf] Font loading failed:", err);
  }
}

function setupFonts(doc: jsPDF) {
  if (regularFontData) {
    doc.addFileToVFS("NanumGothic-Regular.ttf", regularFontData);
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
  }
  if (boldFontData) {
    doc.addFileToVFS("NanumGothic-Bold.ttf", boldFontData);
    doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");
  }
  doc.setFont("NanumGothic", "normal");
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_H - 8;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("INPICK 시공도면", MARGIN, y);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: "right" });
}

/**
 * 시공도면 세트 PDF 생성 + 다운로드
 */
export async function generateConstructionDrawingPdf(
  drawings: DrawingData[],
  projectInfo: ProjectInfo
): Promise<void> {
  await loadFonts();

  const validDrawings = drawings.filter(d => d.finalUrl);
  const totalPages = 1 + validDrawings.length; // 표지 + 도면들

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
  });
  setupFonts(doc);

  // ─── 표지 (A3 가로) ───
  doc.setFillColor(13, 17, 23); // DRAWING_COLORS.BG
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // INPICK 로고
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(36);
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text("INPICK", PAGE_W / 2, 80, { align: "center" });

  // 서브타이틀
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(14);
  doc.setTextColor(201, 209, 217);
  doc.text("시공도면 세트 (Construction Drawing Set)", PAGE_W / 2, 100, { align: "center" });

  // 프로젝트 정보 박스
  const boxW = 200;
  const boxX = (PAGE_W - boxW) / 2;
  const boxY = 125;
  doc.setDrawColor(48, 54, 61);
  doc.setFillColor(22, 27, 34);
  doc.roundedRect(boxX, boxY, boxW, 80, 4, 4, "FD");

  doc.setFontSize(10);
  doc.setTextColor(201, 209, 217);
  const info = [
    ["공사명", projectInfo.projectName],
    ["주소", projectInfo.address],
    ["면적", `${projectInfo.area.toFixed(1)}㎡ (${(projectInfo.area / 3.3058).toFixed(1)}평)`],
    ["작성일", projectInfo.date],
    ["도면 수", `${validDrawings.length}장`],
  ];

  let infoY = boxY + 15;
  for (const [key, value] of info) {
    doc.setFont("NanumGothic", "bold");
    doc.setTextColor(139, 148, 158);
    doc.text(key, boxX + 15, infoY);
    doc.setFont("NanumGothic", "normal");
    doc.setTextColor(201, 209, 217);
    doc.text(value, boxX + 60, infoY);
    infoY += 13;
  }

  // 도면 목차
  const tocY = boxY + 95;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.setTextColor(139, 148, 158);
  doc.text("도면 목차", boxX, tocY);

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(9);
  let tocRowY = tocY + 12;
  validDrawings.forEach((d, idx) => {
    const label = DRAWING_TYPE_LABELS[d.drawingType as DrawingType] || d.drawingType;
    const extra = d.metadata?.roomName ? ` (${d.metadata.roomName}${d.metadata?.wallLabel ? ` ${d.metadata.wallLabel}면` : ""})` : "";
    doc.setTextColor(201, 209, 217);
    doc.text(`${idx + 1}. ${label}${extra}`, boxX + 5, tocRowY);
    tocRowY += 10;
    if (tocRowY > PAGE_H - 30) return; // overflow 방지
  });

  addFooter(doc, 1, totalPages);

  // ─── 도면 페이지들 ───
  for (let i = 0; i < validDrawings.length; i++) {
    doc.addPage("a3", "landscape");

    const d = validDrawings[i];
    const label = DRAWING_TYPE_LABELS[d.drawingType as DrawingType] || d.drawingType;

    // 배경
    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    // 타이틀 바
    doc.setFillColor(22, 27, 34);
    doc.rect(0, 0, PAGE_W, 18, "F");
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(label, MARGIN, 12);
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(8);
    doc.setTextColor(139, 148, 158);
    doc.text(`Page ${i + 2} of ${totalPages}`, PAGE_W - MARGIN, 12, { align: "right" });

    // 이미지 삽입
    if (d.finalUrl) {
      const imageData = await loadImage(d.finalUrl);
      if (imageData) {
        try {
          const imgW = PAGE_W - MARGIN * 2;
          const imgH = PAGE_H - 30 - MARGIN;
          doc.addImage(imageData, "PNG", MARGIN, 22, imgW, imgH);
        } catch (err) {
          console.error(`[drawing-pdf] Image add error for ${d.drawingType}:`, err);
          // 이미지 실패 시 플레이스홀더
          doc.setTextColor(139, 148, 158);
          doc.setFontSize(12);
          doc.text("이미지를 불러올 수 없습니다.", PAGE_W / 2, PAGE_H / 2, { align: "center" });
        }
      }
    }

    addFooter(doc, i + 2, totalPages);
  }

  // PDF 저장
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `INPICK_시공도면_${projectInfo.contractId || ""}${date}.pdf`;
  doc.save(filename);
}
