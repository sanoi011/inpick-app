"use client";

import { useState } from "react";
import { Camera, Smartphone, PenTool, ChevronDown, ChevronUp, FileImage } from "lucide-react";

interface Props {
  onSelectMode: (mode: "upload" | "lidar" | "photo" | "hand-drawing" | "draw") => void;
}

export default function UploadOptionsPanel({ onSelectMode }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="text-xs font-medium text-gray-700">도면 등록 방법</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelectMode("upload")}
            className="p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
          >
            <FileImage className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-xs font-bold text-gray-900">파일 업로드</p>
            <p className="text-xs text-gray-500">PDF/JPG/PNG</p>
          </button>
          <button
            onClick={() => onSelectMode("lidar")}
            className="p-3 rounded-lg border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 transition-all text-left"
          >
            <Smartphone className="w-5 h-5 text-violet-600 mb-1" />
            <p className="text-xs font-bold text-gray-900">LiDAR 스캔</p>
            <p className="text-xs text-gray-500">iPhone/iPad</p>
          </button>
          <button
            onClick={() => onSelectMode("photo")}
            className="p-3 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left"
          >
            <Camera className="w-5 h-5 text-emerald-600 mb-1" />
            <p className="text-xs font-bold text-gray-900">사진 촬영</p>
            <p className="text-xs text-gray-500">AI 도면 생성</p>
          </button>
          <button
            onClick={() => onSelectMode("hand-drawing")}
            className="p-3 rounded-lg border border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left"
          >
            <PenTool className="w-5 h-5 text-amber-600 mb-1" />
            <p className="text-xs font-bold text-gray-900">손도면</p>
            <p className="text-xs text-gray-500">사진 변환</p>
          </button>
          <button
            onClick={() => onSelectMode("draw")}
            className="col-span-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left"
          >
            <PenTool className="w-5 h-5 text-indigo-600 mb-1" />
            <p className="text-xs font-bold text-gray-900">직접 그리기</p>
            <p className="text-xs text-gray-500">벽과 문/창문을 직접 그리기</p>
          </button>
        </div>
      )}
    </div>
  );
}
