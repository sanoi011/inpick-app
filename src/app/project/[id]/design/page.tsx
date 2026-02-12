"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Upload, Camera, FileImage, CheckCircle2, Loader2, AlertTriangle, Zap } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useProjectState } from "@/hooks/useProjectState";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import type { FloorPlan2DHandle } from "@/components/viewer/FloorPlan2D";
import ViewerToolbar from "@/components/viewer/ViewerToolbar";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { CameraMode } from "@/components/project/FloorPlan3D";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import DrawingParseResult from "@/components/project/DrawingParseResult";
import type { RoomType } from "@/types/floorplan";
import dynamic from "next/dynamic";

// Three.js는 SSR 불가 → dynamic import
const FloorPlan3D = dynamic(() => import("@/components/project/FloorPlan3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  ),
});

// 도면 파일 → API → ParsedFloorPlan
async function parseDrawingFile(
  file: File,
  knownArea?: number
): Promise<{
  floorPlan: ParsedFloorPlan;
  confidence: number;
  warnings: string[];
  method: string;
  processingTimeMs: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  if (knownArea) formData.append("knownArea", String(knownArea));

  const res = await fetch("/api/project/parse-drawing", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
    throw new Error(err.error || `서버 오류 (${res.status})`);
  }

  return res.json();
}

export default function FloorPlanPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateStatus } = useProjectState(projectId);

  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseConfidence, setParseConfidence] = useState<number>(0);
  const [parseMethod, setParseMethod] = useState<string>("");
  const [parseTimeMs, setParseTimeMs] = useState<number>(0);
  const [pendingFloorPlan, setPendingFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [showParseResult, setShowParseResult] = useState(false);
  const [yoloAvailable, setYoloAvailable] = useState(false);
  const [yoloEnhancing, setYoloEnhancing] = useState(false);
  const [yoloStats, setYoloStats] = useState<{ added: number; corrected: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageRef = useRef<HTMLImageElement | null>(null);

  // 뷰어 제어 상태
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [showCeiling, setShowCeiling] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showEngInfo, setShowEngInfo] = useState(true);
  const floorPlan2DRef = useRef<FloorPlan2DHandle>(null);

  // YOLO 모델 로드 시도 (백그라운드, 동적 import)
  useEffect(() => {
    import("@/lib/services/yolo-floorplan-detector")
      .then((mod) => mod.loadModel())
      .then((ok) => setYoloAvailable(ok))
      .catch(() => setYoloAvailable(false));
  }, []);

  // 탭1에서 매칭된 도면 자동 로드
  useEffect(() => {
    if (project?.drawingId) {
      loadFloorPlan(project.drawingId).then((plan) => {
        if (plan) setFloorPlan(plan);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [project?.drawingId]);

  // 도면 파일 업로드
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일이면 미리보기 + YOLO용 이미지 준비
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setUploadedFile(dataUrl);
        // YOLO 추론용 이미지 엘리먼트 생성
        const img = new Image();
        img.onload = () => { uploadedImageRef.current = img; };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedFile(null);
      uploadedImageRef.current = null;
    }

    setAnalyzing(true);
    setParseWarnings([]);
    setParseConfidence(0);

    try {
      const knownArea = project?.address?.exclusiveArea;
      const result = await parseDrawingFile(file, knownArea);

      setPendingFloorPlan(result.floorPlan);
      setParseConfidence(result.confidence);
      setParseWarnings(result.warnings);
      setParseMethod(result.method);
      setParseTimeMs(result.processingTimeMs || 0);
      setShowParseResult(true);

      if (result.method === "mock") {
        toast({ type: "info", title: "AI 엔진 미연결", message: "Mock 데이터로 표시됩니다" });
      } else {
        toast({ type: "success", title: "도면 인식 완료", message: `${result.floorPlan.rooms.length}개 공간 감지` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast({ type: "error", title: "도면 분석 실패", message: msg });
    } finally {
      setAnalyzing(false);
    }
  }, [project?.address?.exclusiveArea]);

  // 카메라 3D 스캐닝 (향후 WebXR 연동)
  const handleCameraScan = useCallback(async () => {
    toast({ type: "info", title: "카메라 스캐닝", message: "향후 업데이트 예정입니다. 도면 파일을 업로드해주세요." });
  }, []);

  // YOLO 보강 실행 (동적 import로 서버사이드 빌드 에러 방지)
  const runYoloEnhancement = useCallback(async (plan: ParsedFloorPlan) => {
    if (!uploadedImageRef.current) return plan;

    setYoloEnhancing(true);
    try {
      const yolo = await import("@/lib/services/yolo-floorplan-detector");
      if (!yolo.isModelLoaded()) { setYoloEnhancing(false); return plan; }

      const img = uploadedImageRef.current;
      const detections = await yolo.detect(img);
      if (detections.length === 0) { setYoloEnhancing(false); return plan; }

      const { fuseDetections } = await import("@/lib/services/detection-fusion");
      const pixelsPerMeter = img.naturalWidth / Math.sqrt(plan.totalArea || 59);
      const { floorPlan: fused, addedByYolo, correctedByYolo } = fuseDetections(
        plan, detections, img.naturalWidth, img.naturalHeight, pixelsPerMeter, 0, 0
      );

      setYoloStats({ added: addedByYolo, corrected: correctedByYolo });
      if (addedByYolo > 0 || correctedByYolo > 0) {
        toast({ type: "success", title: "YOLO 보강 완료", message: `${addedByYolo}개 추가, ${correctedByYolo}개 보정` });
      }
      setYoloEnhancing(false);
      return fused;
    } catch (err) {
      console.warn("[yolo-enhance] Failed:", err);
      setYoloEnhancing(false);
      return plan;
    }
  }, []);

  // 인식 결과 수용
  const handleAcceptResult = useCallback(async () => {
    if (pendingFloorPlan) {
      const enhanced = yoloAvailable
        ? await runYoloEnhancement(pendingFloorPlan)
        : pendingFloorPlan;
      setFloorPlan(enhanced);
      setShowParseResult(false);
      setPendingFloorPlan(null);
    }
  }, [pendingFloorPlan, yoloAvailable, runYoloEnhancement]);

  // 다시 분석
  const handleRetry = useCallback(() => {
    setShowParseResult(false);
    setPendingFloorPlan(null);
    setUploadedFile(null);
    setParseWarnings([]);
    setParseConfidence(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // 실 타입 수정
  const handleRoomTypeChange = useCallback((roomId: string, newType: RoomType) => {
    if (!pendingFloorPlan) return;
    const updated = {
      ...pendingFloorPlan,
      rooms: pendingFloorPlan.rooms.map((r) =>
        r.id === roomId ? { ...r, type: newType } : r
      ),
    };
    setPendingFloorPlan(updated);
  }, [pendingFloorPlan]);

  // 다음 단계 (AI 디자인으로 이동)
  const handleNext = () => {
    if (floorPlan) {
      updateStatus("AI_DESIGN");
      router.push(`/project/${projectId}/ai-design`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">도면 / 3D 매스</h2>
          {floorPlan && (
            <span className="hidden sm:flex px-2 py-0.5 bg-slate-700 text-white text-xs font-medium rounded-full items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> INPICK 구조분석
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {floorPlan && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              AI 디자인 <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 min-h-0">
        {showParseResult && pendingFloorPlan ? (
          /* 인식 결과 확인 */
          <div className="h-full flex items-center justify-center bg-gray-50 p-8 overflow-y-auto">
            <div className="max-w-lg w-full">
              <DrawingParseResult
                floorPlan={pendingFloorPlan}
                confidence={parseConfidence}
                warnings={parseWarnings}
                method={parseMethod}
                processingTimeMs={parseTimeMs}
                onAccept={handleAcceptResult}
                onRetry={handleRetry}
                onRoomTypeChange={handleRoomTypeChange}
              />
            </div>
          </div>
        ) : !floorPlan && !analyzing ? (
          /* 도면 없음 → 업로드 UI */
          <div className="h-full flex items-center justify-center bg-gray-50 p-8">
            <div className="max-w-lg w-full">
              {project?.drawingId ? (
                <div className="text-center mb-8">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="text-gray-600">도면을 불러오는 중...</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileImage className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">도면을 등록해주세요</h2>
                    <p className="text-sm text-gray-500">
                      우리집 찾기에서 매칭된 도면이 없습니다.<br />
                      아래 방법으로 도면을 등록할 수 있습니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 도면 파일 업로드 */}
                    <label className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-colors">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">도면 파일 업로드</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {/* 카메라 3D 스캐닝 */}
                    <button
                      onClick={handleCameraScan}
                      className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <Camera className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">카메라 3D 스캐닝</p>
                        <p className="text-xs text-gray-400 mt-1">사진으로 공간 인식</p>
                      </div>
                    </button>
                  </div>

                  {/* 업로드된 파일 미리보기 */}
                  {uploadedFile && (
                    <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                      <img
                        src={uploadedFile}
                        alt="업로드된 도면"
                        className="w-full max-h-48 object-contain rounded-lg"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : analyzing ? (
          /* AI 분석 중 */
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">AI가 도면을 분석하고 있습니다</h3>
              <p className="text-sm text-gray-500">공간 구조를 인식하고 3D 매스 모델을 생성합니다...</p>
              {uploadedFile && (
                <div className="mt-6 max-w-xs mx-auto">
                  <img
                    src={uploadedFile}
                    alt="분석 중인 도면"
                    className="w-full rounded-lg opacity-50"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 도면/3D 뷰어 */
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {viewMode === "2d" ? (
                <div className="h-full p-4 bg-gray-50">
                  <div className="h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <FloorPlan2D
                      ref={floorPlan2DRef}
                      floorPlan={floorPlan!}
                      className="h-full"
                      showDimensions={showDimensions}
                    />
                  </div>
                </div>
              ) : (
                <FloorPlan3D
                  floorPlan={floorPlan!}
                  className="h-full"
                  cameraMode={cameraMode}
                  showCeiling={showCeiling}
                />
              )}
            </div>
            <ViewerToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
              showCeiling={showCeiling}
              onToggleCeiling={() => setShowCeiling((v) => !v)}
              onZoomIn={() => floorPlan2DRef.current?.zoomIn()}
              onZoomOut={() => floorPlan2DRef.current?.zoomOut()}
              onFitToScreen={() => floorPlan2DRef.current?.resetView()}
              showDimensions={showDimensions}
              onToggleDimensions={() => setShowDimensions((v) => !v)}
              showEngInfo={showEngInfo}
              onToggleEngInfo={() => setShowEngInfo((v) => !v)}
            />
          </div>
        )}
      </div>

      {/* 인식 경고 */}
      {parseWarnings.length > 0 && floorPlan && (
        <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-700 overflow-x-auto">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="whitespace-nowrap">{parseWarnings[0]}</span>
          {parseWarnings.length > 1 && (
            <span className="text-amber-500">외 {parseWarnings.length - 1}건</span>
          )}
        </div>
      )}

      {/* 하단 정보 바 */}
      {floorPlan && (
        <div className="px-4 py-2 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>전용면적: <strong className="text-gray-900">{floorPlan.totalArea}m²</strong></span>
            <span>방: <strong className="text-gray-900">{floorPlan.rooms.length}개</strong></span>
            <span className="hidden sm:inline">
              {floorPlan.rooms.map((r) => r.name).join(", ")}
            </span>
            {parseConfidence > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                parseConfidence >= 0.8
                  ? "bg-green-100 text-green-700"
                  : parseConfidence >= 0.5
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}>
                신뢰도 {Math.round(parseConfidence * 100)}%
              </span>
            )}
            {yoloEnhancing && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> YOLO 보강중
              </span>
            )}
            {yoloStats && (yoloStats.added > 0 || yoloStats.corrected > 0) && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 flex items-center gap-1">
                <Zap className="w-3 h-3" /> YOLO +{yoloStats.added} / ~{yoloStats.corrected}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate max-w-full">
            {project?.address?.roadAddress || "주소 미설정"}
          </div>
        </div>
      )}
    </div>
  );
}
