"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Home,
  Eye,
} from "lucide-react";
import type { ParsedFloorPlan, RoomType } from "@/types/floorplan";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";

interface DrawingParseResultProps {
  floorPlan: ParsedFloorPlan;
  confidence: number;
  warnings: string[];
  method: string;
  processingTimeMs?: number;
  onAccept: () => void;
  onRetry: () => void;
  onRoomTypeChange?: (roomId: string, newType: RoomType) => void;
}

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "LIVING", label: "거실" },
  { value: "KITCHEN", label: "주방" },
  { value: "MASTER_BED", label: "안방" },
  { value: "BED", label: "침실" },
  { value: "BATHROOM", label: "욕실" },
  { value: "ENTRANCE", label: "현관" },
  { value: "BALCONY", label: "발코니" },
  { value: "UTILITY", label: "다용도실" },
  { value: "CORRIDOR", label: "복도" },
  { value: "DRESSROOM", label: "드레스룸" },
];

export default function DrawingParseResult({
  floorPlan,
  confidence,
  warnings,
  method,
  processingTimeMs,
  onAccept,
  onRetry,
  onRoomTypeChange,
}: DrawingParseResultProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showWarnings, setShowWarnings] = useState(warnings.length > 0);

  const confidenceLevel =
    confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";

  const confidenceConfig = {
    high: {
      color: "bg-green-50 border-green-200 text-green-700",
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      label: "높음",
      badgeColor: "bg-green-100 text-green-700",
    },
    medium: {
      color: "bg-amber-50 border-amber-200 text-amber-700",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      label: "보통",
      badgeColor: "bg-amber-100 text-amber-700",
    },
    low: {
      color: "bg-red-50 border-red-200 text-red-700",
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      label: "낮음",
      badgeColor: "bg-red-100 text-red-700",
    },
  };

  const config = confidenceConfig[confidenceLevel];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className={`px-5 py-4 border-b ${config.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="text-sm font-bold">도면 인식 결과</h3>
              <p className="text-xs opacity-80 mt-0.5">
                {method === "gemini_vision" ? "Gemini AI 분석" : "Mock 데이터"}
                {processingTimeMs && ` (${(processingTimeMs / 1000).toFixed(1)}초)`}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${config.badgeColor}`}>
            신뢰도 {Math.round(confidence * 100)}% ({config.label})
          </span>
        </div>
      </div>

      {/* 요약 */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{floorPlan.totalArea}m²</p>
            <p className="text-xs text-gray-500">총면적</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{floorPlan.rooms.length}</p>
            <p className="text-xs text-gray-500">공간</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{floorPlan.doors.length}</p>
            <p className="text-xs text-gray-500">문</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{floorPlan.windows.length}</p>
            <p className="text-xs text-gray-500">창</p>
          </div>
        </div>

        {/* 공간 목록 */}
        <div className="mb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <Home className="w-4 h-4" />
            감지된 공간
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-1.5">
              {floorPlan.rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {room.name}
                    </span>
                    <span className="text-xs text-gray-400">{room.area}m²</span>
                  </div>
                  {onRoomTypeChange ? (
                    <select
                      value={room.type}
                      onChange={(e) =>
                        onRoomTypeChange(room.id, e.target.value as RoomType)
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      {ROOM_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {ROOM_TYPE_LABELS[room.type] || room.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 경고 */}
        {warnings.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900"
            >
              <AlertTriangle className="w-4 h-4" />
              경고 {warnings.length}건
              {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showWarnings && (
              <ul className="mt-2 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5 pl-1">
                    <span className="mt-0.5">-</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onAccept}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Eye className="w-4 h-4" />
            결과 수용 (뷰어에서 보기)
          </button>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 분석
          </button>
        </div>
      </div>
    </div>
  );
}
