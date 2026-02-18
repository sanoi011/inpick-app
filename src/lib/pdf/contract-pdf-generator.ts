/**
 * 계약서 PDF 생성기
 * jsPDF + NanumGothic 한국어 폰트로 계약서 PDF 생성
 */
import { jsPDF } from "jspdf";

interface ContractPdfData {
  id: string;
  projectName: string;
  address: string;
  totalAmount: number;
  depositAmount: number;
  finalPayment: number;
  progressPayments: { label: string; amount: number; dueDate: string; status: string }[];
  startDate: string;
  expectedEndDate: string;
  consumerSignature?: string;
  contractorSignature?: string;
  signedAt?: string;
  contractorName?: string;
  consumerName?: string;
}

let fontLoaded = false;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function loadKoreanFont(doc: jsPDF): Promise<boolean> {
  if (fontLoaded) return true;
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/NanumGothic-Regular.ttf"),
      fetch("/fonts/NanumGothic-Bold.ttf"),
    ]);
    if (!regularRes.ok || !boldRes.ok) return false;
    const regularBuf = await regularRes.arrayBuffer();
    const boldBuf = await boldRes.arrayBuffer();
    doc.addFileToVFS("NanumGothic-Regular.ttf", arrayBufferToBase64(regularBuf));
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
    doc.addFileToVFS("NanumGothic-Bold.ttf", arrayBufferToBase64(boldBuf));
    doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");
    fontLoaded = true;
    return true;
  } catch {
    return false;
  }
}

const fmt = (n: number) => n.toLocaleString("ko-KR");
const PAGE_W = 210;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function generateContractPdf(data: ContractPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hasFont = await loadKoreanFont(doc);

  const setFont = (style: "normal" | "bold", size: number) => {
    if (hasFont) {
      doc.setFont("NanumGothic", style);
    }
    doc.setFontSize(size);
  };

  let y = MARGIN;
  let pageNum = 1;

  const checkNewPage = (need: number) => {
    if (y + need > 280) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = MARGIN;
    }
  };

  const addFooter = () => {
    doc.setDrawColor(200);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    setFont("normal", 7);
    doc.setTextColor(150);
    doc.text("INPICK 인테리어 견적 플랫폼 | www.inpick.kr", MARGIN, 290);
    doc.text(`${pageNum}`, PAGE_W - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  };

  // ─── 헤더 ───
  setFont("bold", 20);
  doc.setTextColor(37, 99, 235);
  doc.text("INPICK", MARGIN, y + 8);
  setFont("normal", 9);
  doc.setTextColor(100);
  doc.text("AI 인테리어 견적 플랫폼", MARGIN + 40, y + 8);
  y += 14;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  // ─── 제목 ───
  setFont("bold", 16);
  doc.setTextColor(0);
  doc.text("실내건축공사 도급계약서", PAGE_W / 2, y, { align: "center" });
  y += 12;

  // ─── 계약 정보 박스 ───
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, CONTENT_W, 36, 2, 2, "F");
  setFont("normal", 9);
  doc.setTextColor(80);

  const infoLeft = MARGIN + 5;
  const infoRight = PAGE_W / 2 + 5;
  let iy = y + 7;

  doc.text(`계약번호: ${data.id.slice(0, 8)}`, infoLeft, iy);
  doc.text(`작성일: ${data.signedAt ? new Date(data.signedAt).toLocaleDateString("ko-KR") : new Date().toLocaleDateString("ko-KR")}`, infoRight, iy);
  iy += 7;
  doc.text(`공사명: ${data.projectName}`, infoLeft, iy);
  doc.text(`공사기간: ${data.startDate || "미정"} ~ ${data.expectedEndDate || "미정"}`, infoRight, iy);
  iy += 7;
  doc.text(`공사장소: ${data.address || "미지정"}`, infoLeft, iy);
  iy += 7;

  setFont("bold", 10);
  doc.setTextColor(37, 99, 235);
  doc.text(`공사대금: ${fmt(data.totalAmount)}원`, infoLeft, iy);
  doc.setTextColor(0);
  y += 42;

  // ─── 당사자 ───
  checkNewPage(25);
  setFont("bold", 11);
  doc.text("계약 당사자", MARGIN, y);
  y += 7;

  setFont("normal", 9);
  doc.text(`갑 (소비자): ${data.consumerName || "—"}`, MARGIN + 5, y);
  y += 6;
  doc.text(`을 (시공사): ${data.contractorName || "—"}`, MARGIN + 5, y);
  y += 10;

  // ─── 대금 지급 ───
  checkNewPage(40);
  setFont("bold", 11);
  doc.text("공사대금 지급 계획", MARGIN, y);
  y += 8;

  // 테이블 헤더
  doc.setFillColor(37, 99, 235);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  setFont("bold", 8);
  doc.setTextColor(255);
  doc.text("구분", MARGIN + 5, y + 5);
  doc.text("금액", MARGIN + 60, y + 5);
  doc.text("지급일", MARGIN + 110, y + 5);
  doc.text("상태", MARGIN + 155, y + 5);
  y += 7;
  doc.setTextColor(0);

  const payRows = [
    { label: "계약금", amount: data.depositAmount, dueDate: data.startDate || "계약 시", status: "—" },
    ...data.progressPayments,
    { label: "잔금", amount: data.finalPayment, dueDate: data.expectedEndDate || "준공 시", status: "—" },
  ];

  for (const row of payRows) {
    checkNewPage(7);
    const bg = payRows.indexOf(row) % 2 === 0;
    if (bg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y, CONTENT_W, 7, "F");
    }
    setFont("normal", 8);
    doc.text(row.label, MARGIN + 5, y + 5);
    doc.text(`${fmt(row.amount)}원`, MARGIN + 60, y + 5);
    doc.text(row.dueDate || "—", MARGIN + 110, y + 5);
    doc.text(row.status === "PAID" ? "지급완료" : "미지급", MARGIN + 155, y + 5);
    y += 7;
  }

  // 합계
  doc.setFillColor(37, 99, 235);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  setFont("bold", 8);
  doc.setTextColor(255);
  doc.text("합계", MARGIN + 5, y + 5);
  doc.text(`${fmt(data.totalAmount)}원`, MARGIN + 60, y + 5);
  doc.setTextColor(0);
  y += 14;

  // ─── 계약 일반조건 ───
  checkNewPage(20);
  setFont("bold", 11);
  doc.text("계약 일반조건", MARGIN, y);
  y += 8;

  const articles = [
    ["제1조 (총칙)", "본 계약은 갑(소비자)이 을(시공사)에게 실내건축공사를 도급함에 있어 필요한 사항을 정함을 목적으로 한다."],
    ["제2조 (공사 범위)", "을은 본 계약서 및 첨부 설계도서(도면, 시방서, 내역서 등)에 따라 공사를 성실히 수행하여야 한다."],
    ["제3조 (공사기간)", "을은 약정한 기간 내에 공사를 완료하여야 한다. 부득이한 사유로 공사기간 변경이 필요한 경우, 갑·을 합의 하에 변경할 수 있다."],
    ["제4조 (공사대금 지급)", "갑은 공사대금을 공사 진행에 따라 분할 지급한다. 선급금은 계약 체결 시, 중도금은 공정률 50% 시점, 잔금은 준공 검사 후 지급한다."],
    ["제5조 (설계 변경)", "갑이 설계 변경을 요구할 경우, 을과 협의하여 추가 비용 및 공기 변경 사항을 서면으로 합의한다."],
    ["제6조 (자재)", "을은 내역서에 명시된 자재를 사용하여야 한다. 동등 이상의 자재로 대체할 경우 갑의 사전 승인을 받아야 한다."],
    ["제7조 (하자보수)", "을은 공사 완료 후 1년간 하자보수 책임을 진다. 방수공사는 3년, 구조체는 5년의 하자보수 기간을 적용한다."],
    ["제8조 (준공 검사)", "을은 공사 완료 시 갑에게 통지하고, 갑은 7일 이내에 준공 검사를 실시한다."],
    ["제9조 (지체 배상)", "을의 귀책 사유로 공사가 지연될 경우, 지체일수 1일당 공사대금의 1/1000에 해당하는 지체배상금을 지급한다."],
    ["제10조 (계약의 해제·해지)", "갑·을 일방이 계약 조건을 위반한 경우 상대방은 서면 최고 후 계약을 해제·해지할 수 있다."],
    ["제11조 (분쟁해결)", "본 계약에 관한 분쟁은 갑·을 합의에 의해 해결하되, 합의가 이루어지지 않을 경우 관할 법원의 판결에 따른다."],
  ];

  for (const [title, body] of articles) {
    checkNewPage(14);
    setFont("bold", 8);
    doc.text(title, MARGIN + 3, y);
    y += 5;
    setFont("normal", 8);
    const lines = doc.splitTextToSize(body, CONTENT_W - 6);
    doc.text(lines, MARGIN + 3, y);
    y += lines.length * 4 + 3;
  }

  // ─── 서명 ───
  checkNewPage(40);
  y += 5;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  setFont("bold", 11);
  doc.text("서명", MARGIN, y);
  y += 10;

  const halfW = CONTENT_W / 2 - 5;

  // 갑 서명
  doc.setDrawColor(200);
  doc.roundedRect(MARGIN, y, halfW, 25, 2, 2);
  setFont("bold", 9);
  doc.text("갑 (소비자)", MARGIN + 5, y + 7);
  setFont("normal", 8);
  doc.text(data.consumerName || "—", MARGIN + 5, y + 14);
  if (data.consumerSignature) {
    doc.setTextColor(37, 99, 235);
    doc.text(`서명일: ${new Date(data.consumerSignature).toLocaleDateString("ko-KR")}`, MARGIN + 5, y + 20);
    doc.setTextColor(0);
  }

  // 을 서명
  const rightX = MARGIN + halfW + 10;
  doc.roundedRect(rightX, y, halfW, 25, 2, 2);
  setFont("bold", 9);
  doc.text("을 (시공사)", rightX + 5, y + 7);
  setFont("normal", 8);
  doc.text(data.contractorName || "—", rightX + 5, y + 14);
  if (data.contractorSignature) {
    doc.setTextColor(37, 99, 235);
    doc.text(`서명일: ${new Date(data.contractorSignature).toLocaleDateString("ko-KR")}`, rightX + 5, y + 20);
    doc.setTextColor(0);
  }

  y += 32;

  // ─── 법적 고지 ───
  checkNewPage(15);
  setFont("normal", 7);
  doc.setTextColor(150);
  doc.text("본 계약서는 공정거래위원회 실내건축공사 표준계약서(표준약관 제10096호)를 준용하여 작성되었습니다.", MARGIN, y);
  y += 4;
  doc.text("INPICK은 계약의 당사자가 아니며, 중개 플랫폼으로서 계약 이행에 대한 직접적인 책임을 지지 않습니다.", MARGIN, y);
  doc.setTextColor(0);

  addFooter();

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`INPICK_계약서_${data.id.slice(0, 8)}_${dateStr}.pdf`);
}
