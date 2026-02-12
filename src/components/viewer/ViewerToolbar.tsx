"use client";

import { Eye, Box, ZoomIn, ZoomOut, Maximize, Ruler, Tag, Grid3X3 } from "lucide-react";
import type { CameraMode } from "@/components/project/FloorPlan3D";

type ViewMode = "2d" | "3d";

interface ViewerToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  // 3D 전용
  cameraMode?: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
  showCeiling?: boolean;
  onToggleCeiling?: () => void;
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
  viewMode,
  onViewModeChange,
  cameraMode = "free",
  onCameraModeChange,
  showCeiling = false,
  onToggleCeiling,
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
      {/* 좌: 2D/3D 토글 + 카메라 프리셋 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange("2d")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "2d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> 2D
          </button>
          <button
            onClick={() => onViewModeChange("3d")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "3d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Box className="w-3.5 h-3.5" /> 3D
          </button>
        </div>

        {viewMode === "3d" && onCameraModeChange && (
          <div className="flex items-center gap-0.5 ml-1">
            {(["free", "iso", "top"] as CameraMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onCameraModeChange(mode)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  cameraMode === mode
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {mode === "free" ? "자유" : mode === "iso" ? "ISO" : "TOP"}
              </button>
            ))}
          </div>
        )}
      </div>

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
        {viewMode === "2d" && onToggleDimensions && (
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

        {viewMode === "3d" && onToggleCeiling && (
          <button
            onClick={onToggleCeiling}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
              showCeiling ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
            title="천장"
          >
            <Grid3X3 className="w-3.5 h-3.5" /> 천장
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
