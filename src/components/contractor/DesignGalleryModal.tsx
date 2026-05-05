/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { X, Image as ImageIcon, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";

export interface DesignRender {
  url: string;
  roomName: string;
  prompt?: string;
  refinedUrl?: string;
}

/**
 * 사업자가 입찰 페이지에서 소비자 AI 디자인 시안을 미리 볼 수 있는 모달.
 */
export default function DesignGalleryModal({
  open,
  onClose,
  renders,
  projectTitle,
}: {
  open: boolean;
  onClose: () => void;
  renders: DesignRender[];
  projectTitle?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [open]);

  if (!open) return null;

  const active = renders[activeIdx];
  const total = renders.length;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div
        className={`relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          fullscreen ? "w-full h-full" : "max-w-5xl w-full max-h-[90vh]"
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#1B3556]" />
              AI 디자인 시안
              {projectTitle && (
                <span className="text-sm font-normal text-zinc-500">· {projectTitle}</span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              소비자가 생성한 인테리어 디자인 — 입찰 견적 산정 시 참고
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              title={fullscreen ? "축소" : "전체화면"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center text-zinc-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
              <p className="text-sm">소비자가 첨부한 디자인 시안이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden">
            {/* 메인 이미지 */}
            <div className="relative bg-zinc-900 flex items-center justify-center overflow-hidden">
              {active && (
                <img
                  src={active.refinedUrl || active.url}
                  alt={active.roomName}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              {/* 좌·우 화살표 */}
              {total > 1 && (
                <>
                  <button
                    onClick={() => setActiveIdx((i) => (i - 1 + total) % total)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setActiveIdx((i) => (i + 1) % total)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              {/* 인덱스 표시 */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur px-3 py-1 text-xs font-bold text-white tabular">
                {activeIdx + 1} / {total}
              </div>
              {/* 방 이름 */}
              {active && (
                <div className="absolute top-3 left-3 rounded bg-black/60 backdrop-blur px-2.5 py-1 text-xs font-bold text-white">
                  {active.roomName}
                </div>
              )}
            </div>

            {/* 사이드 갤러리 */}
            <div className="bg-zinc-50 border-l border-zinc-200 overflow-y-auto p-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-zinc-500 mb-2 px-1">
                전체 시안 ({total})
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                {renders.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`relative aspect-[4/3] rounded overflow-hidden border-2 transition-all ${
                      i === activeIdx
                        ? "border-[#1B3556] ring-2 ring-[#1B3556]/30"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <img
                      src={r.refinedUrl || r.url}
                      alt={r.roomName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[0.65rem] font-bold p-1.5 text-left">
                      {r.roomName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 프롬프트 (현재 시안) */}
        {active?.prompt && (
          <div className="px-5 py-2.5 border-t border-zinc-200 bg-zinc-50">
            <p className="text-[0.7rem] text-zinc-500 mb-0.5">소비자 입력 프롬프트</p>
            <p className="text-sm text-zinc-700 truncate">{active.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
