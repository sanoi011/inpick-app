"use client";

/** 공유 제안 페이지의 인쇄/PDF 저장 버튼 — 브라우저 인쇄 대화상자 사용. */
export default function PrintProposalButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-[11px] font-bold text-black/70 hover:bg-zinc-50 print:hidden"
    >
      인쇄 / PDF 저장
    </button>
  );
}
