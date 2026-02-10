"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Square, Circle, ArrowUpRight, Pencil, Type, Undo2, Trash2, MousePointer2,
} from "lucide-react";
import type { CanvasAnnotation } from "@/types/consumer-project";

type Tool = "select" | "rect" | "circle" | "arrow" | "freehand" | "text";

interface AnnotationCanvasProps {
  backgroundImage?: string;
  annotations: CanvasAnnotation[];
  onAnnotationsChange: (annotations: CanvasAnnotation[]) => void;
  onSnapshotRequest?: () => string | null;
  className?: string;
}

const TOOL_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "선택" },
  { id: "rect", icon: Square, label: "사각형" },
  { id: "circle", icon: Circle, label: "원" },
  { id: "arrow", icon: ArrowUpRight, label: "화살표" },
  { id: "freehand", icon: Pencil, label: "자유그리기" },
  { id: "text", icon: Type, label: "텍스트" },
];

export default function AnnotationCanvas({
  backgroundImage,
  annotations,
  onAnnotationsChange,
  className = "",
}: AnnotationCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeColor, setActiveColor] = useState(TOOL_COLORS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [, setImgLoaded] = useState(false);

  // 배경 이미지 로드 및 캔버스 크기 설정
  useEffect(() => {
    if (!backgroundImage || !bgCanvasRef.current || !containerRef.current) return;
    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const ratio = img.height / img.width;
      const w = containerWidth;
      const h = Math.min(w * ratio, 700);

      setCanvasSize({ width: w, height: h });
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      setImgLoaded(true);
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  // 오버레이 캔버스 크기 동기화
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    overlayCanvasRef.current.width = canvasSize.width;
    overlayCanvasRef.current.height = canvasSize.height;
  }, [canvasSize]);

  // 주석 그리기
  const drawAnnotations = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth || 2;
      ctx.fillStyle = ann.color + "20";

      switch (ann.type) {
        case "rect": {
          if (ann.points.length < 2) break;
          const [p1, p2] = ann.points;
          const w = p2.x - p1.x;
          const h = p2.y - p1.y;
          ctx.fillRect(p1.x, p1.y, w, h);
          ctx.strokeRect(p1.x, p1.y, w, h);
          if (ann.label) {
            ctx.fillStyle = ann.color;
            ctx.font = "12px sans-serif";
            ctx.fillText(ann.label, p1.x + 4, p1.y - 4);
          }
          break;
        }
        case "circle": {
          if (ann.points.length < 2) break;
          const [c, edge] = ann.points;
          const r = Math.sqrt((edge.x - c.x) ** 2 + (edge.y - c.y) ** 2);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "arrow": {
          if (ann.points.length < 2) break;
          const [start, end] = ann.points;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          // 화살촉
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = 12;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle - 0.4), end.y - headLen * Math.sin(angle - 0.4));
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle + 0.4), end.y - headLen * Math.sin(angle + 0.4));
          ctx.stroke();
          break;
        }
        case "freehand": {
          if (ann.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x, ann.points[i].y);
          }
          ctx.stroke();
          break;
        }
        case "text": {
          if (ann.points.length === 0 || !ann.label) break;
          ctx.fillStyle = ann.color;
          ctx.font = "bold 14px sans-serif";
          ctx.fillText(ann.label, ann.points[0].x, ann.points[0].y);
          break;
        }
      }
    });

    // 현재 그리기 중인 것
    if (isDrawing && currentPoints.length > 0) {
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = activeColor + "20";
      ctx.setLineDash([5, 5]);

      if (activeTool === "rect" && currentPoints.length === 2) {
        const [p1, p2] = currentPoints;
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      } else if (activeTool === "circle" && currentPoints.length === 2) {
        const [c, edge] = currentPoints;
        const r = Math.sqrt((edge.x - c.x) ** 2 + (edge.y - c.y) ** 2);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === "freehand" && currentPoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.stroke();
      } else if (activeTool === "arrow" && currentPoints.length === 2) {
        const [start, end] = currentPoints;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }
  }, [annotations, isDrawing, currentPoints, activeTool, activeColor]);

  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations]);

  // 좌표 변환
  const getCanvasPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === "select") return;
    const point = getCanvasPoint(e);

    if (activeTool === "text") {
      const label = prompt("텍스트를 입력하세요:");
      if (label) {
        const newAnnotation: CanvasAnnotation = {
          id: crypto.randomUUID(),
          type: "text",
          points: [point],
          color: activeColor,
          strokeWidth: 2,
          label,
          createdAt: new Date().toISOString(),
        };
        onAnnotationsChange([...annotations, newAnnotation]);
      }
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([point]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const point = getCanvasPoint(e);

    if (activeTool === "freehand") {
      setCurrentPoints((prev) => [...prev, point]);
    } else {
      setCurrentPoints((prev) => [prev[0], point]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    const newAnnotation: CanvasAnnotation = {
      id: crypto.randomUUID(),
      type: activeTool as CanvasAnnotation["type"],
      points: currentPoints,
      color: activeColor,
      strokeWidth: 2,
      createdAt: new Date().toISOString(),
    };

    onAnnotationsChange([...annotations, newAnnotation]);
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    if (annotations.length > 0) {
      onAnnotationsChange(annotations.slice(0, -1));
    }
  };

  const handleClear = () => {
    onAnnotationsChange([]);
  };

  // 캔버스 스냅샷 (AI 전송용)
  const getSnapshot = (): string | null => {
    const bg = bgCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!bg || !overlay) return null;

    const combined = document.createElement("canvas");
    combined.width = canvasSize.width;
    combined.height = canvasSize.height;
    const ctx = combined.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(overlay, 0, 0);
    return combined.toDataURL("image/jpeg", 0.8);
  };

  // 외부에서 스냅샷 요청할 수 있도록 ref 대신 이벤트 사용
  useEffect(() => {
    const handler = () => {
      const snapshot = getSnapshot();
      if (snapshot) {
        window.dispatchEvent(new CustomEvent("canvas-snapshot", { detail: snapshot }));
      }
    };
    window.addEventListener("request-canvas-snapshot", handler);
    return () => window.removeEventListener("request-canvas-snapshot", handler);
  });

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 도구 모음 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`p-1.5 rounded-md transition-colors ${
                activeTool === tool.id ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              title={tool.label}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 색상 선택 */}
        <div className="flex items-center gap-1">
          {TOOL_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setActiveColor(color)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                activeColor === color ? "border-gray-800 scale-125" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 되돌리기/지우기 */}
        <button
          onClick={handleUndo}
          disabled={annotations.length === 0}
          className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
          title="되돌리기"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleClear}
          disabled={annotations.length === 0}
          className="p-1.5 text-gray-500 hover:text-red-500 disabled:opacity-30"
          title="전체 지우기"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <span className="ml-auto text-xs text-gray-400">
          주석 {annotations.length}개
        </span>
      </div>

      {/* 캔버스 영역 */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-gray-900 overflow-hidden"
        style={{ minHeight: 400 }}
      >
        {!backgroundImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Square className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-lg font-medium text-gray-300">이미지를 선택해주세요</p>
            <p className="text-sm text-gray-500 mt-1">도면 또는 사진을 업로드하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <>
            <canvas
              ref={bgCanvasRef}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0"
              style={{
                width: "100%",
                height: "auto",
                cursor: activeTool === "select" ? "default" : "crosshair",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </>
        )}
      </div>
    </div>
  );
}
