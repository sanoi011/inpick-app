"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Palette, Maximize2 } from "lucide-react";

const Room3D = dynamic(() => import("@/components/viewer/Room3D"), { ssr: false });

const SPACE_PRESETS = [
  { label: "거실", width: 5, depth: 4, height: 2.7 },
  { label: "주방", width: 3.5, depth: 3, height: 2.7 },
  { label: "안방", width: 4, depth: 3.5, height: 2.7 },
  { label: "욕실", width: 2.5, depth: 2, height: 2.4 },
  { label: "현관", width: 2, depth: 1.5, height: 2.4 },
];

const WALL_COLORS = [
  { label: "화이트", value: "#FFFFFF" },
  { label: "아이보리", value: "#F5F0EB" },
  { label: "베이지", value: "#E8DCC8" },
  { label: "그레이", value: "#D4D4D4" },
  { label: "민트", value: "#D1E8E0" },
  { label: "블루그레이", value: "#C8D1DC" },
];

const FLOOR_COLORS = [
  { label: "오크", value: "#C4A882" },
  { label: "월넛", value: "#8B6F4E" },
  { label: "메이플", value: "#DEC89C" },
  { label: "그레이타일", value: "#B0B0B0" },
  { label: "화이트타일", value: "#E8E8E8" },
  { label: "마블", value: "#D4CFC8" },
];

export default function ViewerPage() {
  const [selectedSpace, setSelectedSpace] = useState(0);
  const [wallColor, setWallColor] = useState("#F5F0EB");
  const [floorColor, setFloorColor] = useState("#C4A882");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const preset = SPACE_PRESETS[selectedSpace];

  const roomConfig = [{
    width: preset.width,
    depth: preset.depth,
    height: preset.height,
    wallColor,
    floorColor,
    ceilingColor: "#FFFFFF",
    label: preset.label,
  }];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/consult" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <span className="text-sm text-gray-500">3D 뷰어</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {preset.label} {preset.width}m x {preset.depth}m
          </span>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewer */}
        <div className={`flex-1 relative ${isFullscreen ? "w-full" : ""}`}>
          <Room3D rooms={roomConfig} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            마우스 드래그: 회전 | 스크롤: 줌 | 우클릭 드래그: 이동
          </div>
        </div>

        {/* Controls Panel */}
        {!isFullscreen && (
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-6">
              {/* Space Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  공간 선택
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {SPACE_PRESETS.map((space, i) => (
                    <button
                      key={space.label}
                      onClick={() => setSelectedSpace(i)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedSpace === i
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {space.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wall Color */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  벽면 마감재
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {WALL_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setWallColor(c.value)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                        wallColor === c.value ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full border border-gray-200"
                        style={{ backgroundColor: c.value }}
                      />
                      <span className="text-xs text-gray-600">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Floor Color */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  바닥 마감재
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {FLOOR_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setFloorColor(c.value)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                        floorColor === c.value ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full border border-gray-200"
                        style={{ backgroundColor: c.value }}
                      />
                      <span className="text-xs text-gray-600">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">공간 정보</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p>면적: {(preset.width * preset.depth).toFixed(1)}m² ({(preset.width * preset.depth * 0.3025).toFixed(1)}평)</p>
                  <p>크기: {preset.width}m x {preset.depth}m</p>
                  <p>천장 높이: {preset.height}m</p>
                  <p>벽면 면적: {((preset.width * 2 + preset.depth * 2) * preset.height).toFixed(1)}m²</p>
                </div>
              </div>

              <Link
                href="/consult"
                className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                AI 상담으로 견적 받기
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
