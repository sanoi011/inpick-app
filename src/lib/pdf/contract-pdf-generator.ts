"use client";

import jsPDF from "jspdf";

interface ContractPdfData {
  id: string;
  projectName: string;
  address: string;
  totalAmount: number;
  depositAmount: number;
  finalPayment: number;
  progressPayments: {
    label: string;
    amount: number;
    dueDate: string;
    status: string;
  }[];
  startDate: string;
  expectedEndDate: string;
  consumerSignature?: string;
  contractorSignature?: string;
  signedAt?: string;
  contractorName: string;
  consumerName: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

let fontsLoaded = false;
let regularFontData: string | null = null;
let boldFontData: string | null = null;

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
  } catch (e) {
    console.error("Font load failed:", e);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_H - 10;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("INPICK - AI 기반 인테리어 견적 플랫폼 | https://inpick.vercel.app", MARGIN, y);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: "right" });
}

export async function generateContractPdf(data: ContractPdfData) {
  await loadFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  let y = MARGIN;

  function checkNewPage(needed: number) {
    if (y + needed > PAGE_H - 25) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function setNormal(size = 9) {
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(size);
    doc.setTextColor(30);
  }

  function setBold(size = 9) {
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(size);
    doc.setTextColor(30);
  }

  // --- Header ---
  setBold(18);
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text("INPICK", MARGIN, y + 6);
  setNormal(8);
  doc.setTextColor(120);
  doc.text("AI 기반 인테리어 견적 플랫폼", MARGIN + 40, y + 6);
  y += 10;

  // Blue accent line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 3;

  // Double line
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  // --- Title ---
  setBold(16);
  doc.setTextColor(30);
  doc.text("실내건축공사 표준계약서", PAGE_W / 2, y, { align: "center" });
  y += 8;

  setNormal(8);
  doc.setTextColor(120);
  doc.text("공정거래위원회 표준약관 제10096호 준용", PAGE_W / 2, y, { align: "center" });
  y += 12;

  // --- Contract Info Box ---
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_W, 55);

  // Inner lines
  const labelW = 35;
  const rows = [
    { label: "1. 공사명", value: data.projectName || "인테리어 공사" },
    { label: "2. 공사장소", value: data.address || "미정" },
    { label: "3. 공사기간", value: `${data.startDate ? new Date(data.startDate).toLocaleDateString("ko-KR") : "미정"} ~ ${data.expectedEndDate ? new Date(data.expectedEndDate).toLocaleDateString("ko-KR") : "미정"}` },
    { label: "4. 공사금액", value: `금 ${fmt(data.totalAmount)}원 (부가세 포함)` },
    { label: "5. 계약일", value: data.signedAt ? new Date(data.signedAt).toLocaleDateString("ko-KR") : new Date().toLocaleDateString("ko-KR") },
  ];

  const rowH = 11;
  let ry = y;
  rows.forEach((row, i) => {
    if (i > 0) {
      doc.setDrawColor(180);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, ry, MARGIN + CONTENT_W, ry);
    }

    // Label bg
    doc.setFillColor(245, 245, 250);
    doc.rect(MARGIN, ry, labelW, rowH, "F");

    setBold(9);
    doc.text(row.label, MARGIN + 3, ry + 7);

    if (row.label === "4. 공사금액") {
      setBold(10);
      doc.setTextColor(37, 99, 235);
    } else {
      setNormal(9);
    }
    doc.text(row.value, MARGIN + labelW + 5, ry + 7);

    ry += rowH;
  });

  y = ry + 8;

  // --- Party Info (Gap / Eul) ---
  checkNewPage(35);
  const halfW = CONTENT_W / 2 - 3;

  // Gap (Consumer)
  doc.setFillColor(245, 245, 250);
  doc.rect(MARGIN, y, halfW, 28, "F");
  doc.setDrawColor(180);
  doc.rect(MARGIN, y, halfW, 28);

  setBold(8);
  doc.setTextColor(100);
  doc.text("갑 (소비자/발주자)", MARGIN + 3, y + 6);
  setNormal(8);
  doc.text(`성명: ${data.consumerName || "___________________"}`, MARGIN + 3, y + 13);
  doc.text(`주소: ${data.address || "___________________"}`, MARGIN + 3, y + 19);
  doc.text("연락처: ___________________", MARGIN + 3, y + 25);

  // Eul (Contractor)
  const x2 = MARGIN + halfW + 6;
  doc.setFillColor(245, 245, 250);
  doc.rect(x2, y, halfW, 28, "F");
  doc.setDrawColor(180);
  doc.rect(x2, y, halfW, 28);

  setBold(8);
  doc.setTextColor(100);
  doc.text("을 (시공사/수급인)", x2 + 3, y + 6);
  setNormal(8);
  doc.text(`상호: ${data.contractorName || "___________________"}`, x2 + 3, y + 13);
  doc.text("대표: ___________________", x2 + 3, y + 19);
  doc.text("연락처: ___________________", x2 + 3, y + 25);

  y += 38;

  // --- Payment Schedule ---
  checkNewPage(50);
  setBold(11);
  doc.text("결제 일정", MARGIN, y);
  y += 7;

  // Table header
  const cols = [
    { label: "구분", w: 40 },
    { label: "비율", w: 25 },
    { label: "금액", w: 45 },
    { label: "예정일", w: 35 },
    { label: "상태", w: 25 },
  ];

  doc.setFillColor(50, 60, 80);
  doc.rect(MARGIN, y, CONTENT_W, 8, "F");
  setBold(8);
  doc.setTextColor(255);
  let cx = MARGIN;
  cols.forEach((col) => {
    doc.text(col.label, cx + col.w / 2, y + 5.5, { align: "center" });
    cx += col.w;
  });
  y += 8;

  // Table rows
  data.progressPayments.forEach((payment, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 248, 252);
      doc.rect(MARGIN, y, CONTENT_W, 8, "F");
    }
    doc.setDrawColor(220);
    doc.line(MARGIN, y + 8, MARGIN + CONTENT_W, y + 8);

    setNormal(8);
    cx = MARGIN;

    // Label
    doc.text(payment.label, cx + 3, y + 5.5);
    cx += cols[0].w;

    // Percentage
    const pct = data.totalAmount > 0 ? Math.round(payment.amount / data.totalAmount * 100) : 0;
    doc.text(`${pct}%`, cx + cols[1].w / 2, y + 5.5, { align: "center" });
    cx += cols[1].w;

    // Amount
    setBold(8);
    doc.text(`${fmt(payment.amount)}원`, cx + cols[2].w - 3, y + 5.5, { align: "right" });
    cx += cols[2].w;

    // Due date
    setNormal(8);
    const dueStr = payment.dueDate ? new Date(payment.dueDate).toLocaleDateString("ko-KR") : "-";
    doc.text(dueStr, cx + cols[3].w / 2, y + 5.5, { align: "center" });
    cx += cols[3].w;

    // Status
    const statusStr = payment.status === "PAID" ? "지급완료" : "미지급";
    if (payment.status === "PAID") {
      doc.setTextColor(22, 163, 74);
    } else {
      doc.setTextColor(150);
    }
    doc.text(statusStr, cx + cols[4].w / 2, y + 5.5, { align: "center" });

    y += 8;
  });

  // Total row
  doc.setFillColor(50, 60, 80);
  doc.rect(MARGIN, y, CONTENT_W, 8, "F");
  setBold(8);
  doc.setTextColor(255);
  doc.text("합계", MARGIN + 3, y + 5.5);
  doc.text(`${fmt(data.totalAmount)}원`, MARGIN + cols[0].w + cols[1].w + cols[2].w - 3, y + 5.5, { align: "right" });
  y += 16;

  // --- Contract Clauses ---
  checkNewPage(20);
  setBold(11);
  doc.setTextColor(30);
  doc.text("계약 일반조건", MARGIN, y);
  y += 8;

  const clauses = [
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

  for (const clause of clauses) {
    const textLines = doc.splitTextToSize(clause.text, CONTENT_W - 5);
    const blockH = 5 + textLines.length * 4;
    checkNewPage(blockH + 3);

    setBold(8);
    doc.text(clause.title, MARGIN, y);
    y += 5;

    setNormal(7.5);
    doc.setTextColor(80);
    doc.text(textLines, MARGIN + 2, y);
    y += textLines.length * 4 + 2;
  }

  // --- Signature Section ---
  checkNewPage(40);
  y += 5;
  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  setBold(11);
  doc.setTextColor(30);
  doc.text("전자서명", PAGE_W / 2, y, { align: "center" });
  y += 10;

  // Consumer signature
  doc.setDrawColor(180);
  doc.rect(MARGIN, y, halfW, 25);
  setBold(8);
  doc.setTextColor(100);
  doc.text("갑 (소비자)", MARGIN + halfW / 2, y + 6, { align: "center" });

  if (data.consumerSignature) {
    setNormal(8);
    doc.setTextColor(22, 163, 74);
    doc.text("서명 완료", MARGIN + halfW / 2, y + 14, { align: "center" });
    setNormal(7);
    doc.setTextColor(120);
    doc.text(new Date(data.consumerSignature).toLocaleDateString("ko-KR"), MARGIN + halfW / 2, y + 20, { align: "center" });
  } else {
    setNormal(8);
    doc.setTextColor(180);
    doc.text("미서명", MARGIN + halfW / 2, y + 16, { align: "center" });
  }

  // Contractor signature
  doc.rect(x2, y, halfW, 25);
  setBold(8);
  doc.setTextColor(100);
  doc.text("을 (시공사)", x2 + halfW / 2, y + 6, { align: "center" });

  if (data.contractorSignature) {
    setNormal(8);
    doc.setTextColor(22, 163, 74);
    doc.text("서명 완료", x2 + halfW / 2, y + 14, { align: "center" });
    setNormal(7);
    doc.setTextColor(120);
    doc.text(new Date(data.contractorSignature).toLocaleDateString("ko-KR"), x2 + halfW / 2, y + 20, { align: "center" });
  } else {
    setNormal(8);
    doc.setTextColor(180);
    doc.text("미서명", x2 + halfW / 2, y + 16, { align: "center" });
  }

  y += 30;

  if (data.signedAt) {
    setBold(9);
    doc.setTextColor(22, 163, 74);
    doc.text(`계약 체결일: ${new Date(data.signedAt).toLocaleDateString("ko-KR")}`, PAGE_W / 2, y, { align: "center" });
    y += 6;
  }

  // --- Disclaimer ---
  y += 5;
  setNormal(7);
  doc.setTextColor(150);
  const disclaimer = "본 계약서는 공정거래위원회 실내건축공사 표준계약서(표준약관 제10096호)를 준용하여 INPICK 플랫폼에서 자동 생성되었습니다.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, CONTENT_W);
  checkNewPage(disclaimerLines.length * 4 + 5);
  doc.text(disclaimerLines, MARGIN, y);

  // --- Add Footers ---
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter(doc, i, total);
  }

  // --- Download ---
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = data.id.slice(0, 8);
  doc.save(`INPICK_계약서_${shortId}_${dateStr}.pdf`);
}
