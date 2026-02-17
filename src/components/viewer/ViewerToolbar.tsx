"use client";

import { ZoomIn, ZoomOut, Maximize, Ruler, Tag } from "lucide-react";

interface ViewerToolbarProps {
  // 줌
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  // 2D 전용
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
  // 구조 정보
  showEngInfo?: boolean;
  onToggleEngInfo?: () => void;
}

export default function ViewerToolbar({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  showDimensions = true,
  onToggleDimensions,
  showEngInfo = true,
  onToggleEngInfo,
}: ViewerToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-white/95 backdrop-blur-sm border-t border-gray-200">
      {/* 좌: 빈 공간 (균형 맞추기용) */}
      <div className="flex items-center gap-2" />

      {/* 중앙: 줌 */}
      <div className="flex items-center gap-1">
        <button onClick={onZoomOut}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" title="축소">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={onFitToScreen}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" title="화면 맞춤">
          <Maximize className="w-4 h-4" />
        </button>
        <button onClick={onZoomIn}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" title="확대">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* 우: 토글 */}
      <div className="flex items-center gap-1">
        {onToggleDimensions && (
          <button
            onClick={onToggleDimensions}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
              showDimensions ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
            title="치수선"
          >
            <Ruler className="w-3.5 h-3.5" /> 치수
          </button>
        )}

        {onToggleEngInfo && (
          <button
            onClick={onToggleEngInfo}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
              showEngInfo ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
            title="구조 정보"
          >
            <Tag className="w-3.5 h-3.5" /> 구조
          </button>
        )}
      </div>
    </div>
  );
}
