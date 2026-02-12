"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Upload, Camera, FileImage, CheckCircle2, Loader2 } from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import type { FloorPlan2DHandle } from "@/components/viewer/FloorPlan2D";
import ViewerToolbar from "@/components/viewer/ViewerToolbar";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { CameraMode } from "@/components/project/FloorPlan3D";
import { loadFloorPlan } from "@/lib/services/drawing-service";
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

// 이미지→도면 분석 Mock (향후 Gemini Vision 연동)
function analyzeMockFloorPlan(): ParsedFloorPlan {
  return {
    totalArea: 84,
    rooms: [
      { id: "r1", type: "LIVING", name: "거실", area: 28, position: { x: 0, y: 0, width: 7, height: 4 } },
      { id: "r2", type: "KITCHEN", name: "주방", area: 10, position: { x: 7, y: 0, width: 4, height: 2.5 } },
      { id: "r3", type: "MASTER_BED", name: "안방", area: 16, position: { x: 0, y: 4, width: 4, height: 4 } },
      { id: "r4", type: "BED", name: "침실", area: 12, position: { x: 4, y: 4, width: 3, height: 4 } },
      { id: "r5", type: "BATHROOM", name: "욕실", area: 6, position: { x: 7, y: 2.5, width: 3, height: 2 } },
      { id: "r6", type: "ENTRANCE", name: "현관", area: 4, position: { x: 7, y: 4.5, width: 2, height: 2 } },
      { id: "r7", type: "BALCONY", name: "발코니", area: 8, position: { x: 0, y: -1.5, width: 7, height: 1.5 } },
    ],
    walls: [],
    doors: [],
    windows: [],
  };
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

  // 뷰어 제어 상태
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [showCeiling, setShowCeiling] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showEngInfo, setShowEngInfo] = useState(true);
  const floorPlan2DRef = useRef<FloorPlan2DHandle>(null);

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

    // 파일 미리보기
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedFile(dataUrl);
      setAnalyzing(true);

      // AI 도면 분석 (Mock → 향후 Gemini Vision 연동)
      await new Promise((r) => setTimeout(r, 2000));
      const analyzed = analyzeMockFloorPlan();
      setFloorPlan(analyzed);
      setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  }, []);

  // 카메라 3D 스캐닝 (Mock)
  const handleCameraScan = useCallback(async () => {
    setAnalyzing(true);
    // 향후: WebXR/ARKit 연동
    await new Promise((r) => setTimeout(r, 2500));
    const mockPlan = analyzeMockFloorPlan();
    setFloorPlan(mockPlan);
    setAnalyzing(false);
  }, []);

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
        {!floorPlan && !analyzing ? (
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

      {/* 하단 정보 바 */}
      {floorPlan && (
        <div className="px-4 py-2 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>전용면적: <strong className="text-gray-900">{floorPlan.totalArea}m²</strong></span>
            <span>방: <strong className="text-gray-900">{floorPlan.rooms.length}개</strong></span>
            <span className="hidden sm:inline">
              {floorPlan.rooms.map((r) => r.name).join(", ")}
            </span>
          </div>
          <div className="text-xs text-gray-400 truncate max-w-full">
            {project?.address?.roadAddress || "주소 미설정"}
          </div>
        </div>
      )}
    </div>
  );
}
