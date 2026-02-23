"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, X, Maximize2, FileText, Loader2 } from "lucide-react";
import { DRAWING_TYPE_LABELS } from "@/types/construction-drawing";
import type { DrawingType } from "@/types/construction-drawing";
import { toast } from "@/components/ui/Toast";

interface Drawing {
  drawingType: string;
  finalUrl?: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  drawings: Drawing[];
  pdfUrl?: string;
  onDownloadPdf?: () => void;
}

export default function DrawingViewer({ drawings, pdfUrl, onDownloadPdf }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const validDrawings = drawings.filter(d => d.finalUrl);
  if (validDrawings.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">생성된 도면이 없습니다.</p>
      </div>
    );
  }

  const current = validDrawings[currentIndex];
  const label = DRAWING_TYPE_LABELS[current.drawingType as DrawingType] || current.drawingType;

  const goNext = () => setCurrentIndex(i => (i + 1) % validDrawings.length);
  const goPrev = () => setCurrentIndex(i => (i - 1 + validDrawings.length) % validDrawings.length);

  const downloadImage = async (url: string, filename: string) => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ type: "error", title: "다운로드 실패", message: "이미지를 다운로드할 수 없습니다. URL이 만료되었을 수 있습니다." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">시공도면</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {currentIndex + 1} / {validDrawings.length}
          </span>
          {(pdfUrl || onDownloadPdf) && (
            <button
              onClick={() => {
                if (onDownloadPdf) onDownloadPdf();
                else if (pdfUrl) window.open(pdfUrl, "_blank");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              PDF 다운로드
            </button>
          )}
        </div>
      </div>

      {/* 이미지 영역 */}
      <div className="relative bg-gray-900 aspect-[4/3]">
        {current.finalUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.finalUrl}
            alt={label}
            className="w-full h-full object-contain"
          />
        )}

        {/* 좌우 네비게이션 */}
        {validDrawings.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* 확대 버튼 */}
        <button
          onClick={() => setShowModal(true)}
          className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* 라벨 */}
        <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
          <span className="text-sm font-medium text-white">{label}</span>
          {current.metadata?.roomName ? (
            <span className="text-xs text-white/70 ml-2">
              ({String(current.metadata.roomName)} {current.metadata.wallLabel ? `${String(current.metadata.wallLabel)}면` : ""})
            </span>
          ) : null}
        </div>
      </div>

      {/* 썸네일 바 */}
      {validDrawings.length > 1 && (
        <div className="flex gap-1.5 p-3 overflow-x-auto">
          {validDrawings.map((d, idx) => {
            const thumbLabel = DRAWING_TYPE_LABELS[d.drawingType as DrawingType] || d.drawingType;
            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`
                  shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors
                  ${idx === currentIndex
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                  }
                `}
              >
                {d.finalUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.finalUrl}
                    alt={thumbLabel}
                    className="w-16 h-12 object-cover rounded bg-gray-900"
                  />
                ) : (
                  <div className="w-16 h-12 bg-gray-100 rounded flex items-center justify-center">
                    <FileText className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <span className="text-xs text-gray-500 whitespace-nowrap max-w-[70px] truncate">
                  {thumbLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 개별 다운로드 */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {validDrawings.length}장 도면
        </span>
        <button
          onClick={() => {
            if (current.finalUrl) {
              const filename = `INPICK_${label}_${current.metadata?.wallLabel || ""}.png`;
              downloadImage(current.finalUrl, filename);
            }
          }}
          disabled={!current.finalUrl || downloading}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-40"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {downloading ? "다운로드 중..." : "현재 도면 다운로드"}
        </button>
      </div>

      {/* 확대 모달 */}
      {showModal && current.finalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <button
            onClick={() => setShowModal(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.finalUrl}
            alt={label}
            className="max-w-[95vw] max-h-[90vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-lg">
            <span className="text-sm text-white">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
