"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight, Upload, Camera, FileImage, CheckCircle2, Loader2,
  AlertTriangle, Zap, Smartphone, PenTool, ImagePlus, Info, Menu, X,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useProjectState } from "@/hooks/useProjectState";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import type { FloorPlan2DHandle } from "@/components/viewer/FloorPlan2D";
import ViewerToolbar from "@/components/viewer/ViewerToolbar";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { CameraMode } from "@/components/project/FloorPlan3D";
import { loadFloorPlan, getFloorPlanImageUrl } from "@/lib/services/drawing-service";
import type { RoomType } from "@/types/floorplan";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";
import type { ProjectAddress } from "@/types/consumer-project";
import dynamic from "next/dynamic";

// Sidebar components
import AddressSearchPanel from "@/components/workspace/AddressSearchPanel";
import BuildingInfoPanel from "@/components/workspace/BuildingInfoPanel";
import UploadOptionsPanel from "@/components/workspace/UploadOptionsPanel";
import DesignPromptBar from "@/components/workspace/DesignPromptBar";

const FloorPlanGenerationProgress = dynamic(
  () => import("@/components/workspace/FloorPlanGenerationProgress"),
  { ssr: false }
);

// Three.js SSR 불가 → dynamic import
const FloorPlan3D = dynamic(() => import("@/components/project/FloorPlan3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  ),
});

const DrawingParseResult = dynamic(() => import("@/components/project/DrawingParseResult"));
const WallDrawingCanvas = dynamic(() => import("@/components/wall-drawing/WallDrawingCanvas"), { ssr: false });

// 도면 파일 → API → ParsedFloorPlan
async function parseDrawingFile(
  file: File,
  knownArea?: number,
  sampleType?: string
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
  if (sampleType) formData.append("sampleType", sampleType);

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
  const { project, updateStatus, confirmBuilding } = useProjectState(projectId);

  // === Sidebar state ===
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"upload" | "lidar" | "photo" | "hand-drawing" | "draw" | null>(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);

  // === Viewer state ===
  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [floorPlanImageUrl, setFloorPlanImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
  const [, setMultiPhotos] = useState<File[]>([]);
  const [multiPhotoUrls, setMultiPhotoUrls] = useState<string[]>([]);

  // 실시간 도면 생성 상태
  const [generatingFloorPlan, setGeneratingFloorPlan] = useState<{
    complexNo: string;
    pyeongNo: number;
    grandPlanUrl: string;
    complexName?: string;
    pyeongName?: string;
    exclusiveArea?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageRef = useRef<HTMLImageElement | null>(null);

  // 뷰어 제어 상태
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [showCeiling, setShowCeiling] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showEngInfo, setShowEngInfo] = useState(true);
  const floorPlan2DRef = useRef<FloorPlan2DHandle>(null);

  // === Initialize sidebar from saved project ===
  const initializedRef = useRef(false);
  useEffect(() => {
    if (project?.address && !initializedRef.current) {
      initializedRef.current = true;
      setSelectedAddress({
        roadAddress: project.address.roadAddress,
        jibunAddress: "",
        zipCode: project.address.zipCode,
        buildingName: project.address.buildingName,
        sigunguCode: "",
        bcode: "",
      });
      setSelectedBuilding({
        id: "saved",
        address: project.address.roadAddress,
        buildingName: project.address.buildingName,
        dongName: project.address.dongName || "",
        hoName: project.address.hoName || "",
        buildingType: project.address.buildingType,
        totalFloor: project.address.totalFloor || 0,
        floor: project.address.floor || 0,
        exclusiveArea: project.address.exclusiveArea,
        supplyArea: project.address.supplyArea,
        roomCount: project.address.roomCount,
        bathroomCount: project.address.bathroomCount,
        floorPlanAvailable: !!project.drawingId,
      });
    }
  }, [project?.address]);

  // === Sidebar handlers ===
  const handleSelectAddress = useCallback((addr: AddressSearchResult) => {
    if (!addr) {
      setSelectedAddress(null);
      setSelectedBuilding(null);
      return;
    }
    setSelectedAddress(addr);
    setSelectedBuilding(null);
    setSidebarOpen(true); // Keep sidebar open on mobile
  }, []);

  const handleSelectBuilding = useCallback((building: BuildingInfo) => {
    if (!building || !selectedAddress) {
      setSelectedBuilding(null);
      return;
    }
    setSelectedBuilding(building);
    // Save to project
    const addressData: ProjectAddress = {
      roadAddress: selectedAddress.roadAddress,
      zipCode: selectedAddress.zipCode,
      buildingName: selectedAddress.buildingName,
      dongName: building.dongName,
      hoName: building.hoName,
      exclusiveArea: building.exclusiveArea,
      supplyArea: building.supplyArea,
      roomCount: building.roomCount || 3,
      bathroomCount: building.bathroomCount || 1,
      buildingType: building.buildingType,
      floor: building.floor,
      totalFloor: building.totalFloor,
    };
    confirmBuilding(addressData, building.sampleId);
    setSidebarOpen(false);

    // 실시간 도면 생성: grandPlanUrl이 있고 sampleId가 없는 경우
    if (building.grandPlanUrl && building.complexNo && building.pyeongNo && !building.sampleId) {
      // 먼저 이미 생성된 도면이 있는지 확인 (GET)
      fetch(`/api/project/generate-floorplan?complexNo=${building.complexNo}&pyeongNo=${building.pyeongNo}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            // 이미 생성된 도면이 있음 → 이미지 URL 설정
            setFloorPlanImageUrl(data.finalUrl);
            toast({ type: "success", title: "도면 로드 완료", message: "이전에 생성된 도면을 불러왔습니다" });
          } else {
            // 실시간 생성 시작
            setGeneratingFloorPlan({
              complexNo: building.complexNo!,
              pyeongNo: building.pyeongNo!,
              grandPlanUrl: building.grandPlanUrl!,
              complexName: building.complexName,
              pyeongName: building.typeName,
              exclusiveArea: building.exclusiveArea,
            });
          }
        })
        .catch(() => {
          // 조회 실패 → 바로 생성 시작
          setGeneratingFloorPlan({
            complexNo: building.complexNo!,
            pyeongNo: building.pyeongNo!,
            grandPlanUrl: building.grandPlanUrl!,
            complexName: building.complexName,
            pyeongName: building.typeName,
            exclusiveArea: building.exclusiveArea,
          });
        });
    } else {
      toast({ type: "success", title: "건물 선택 완료", message: `${building.dongName} ${building.hoName}` });
    }
  }, [selectedAddress, confirmBuilding]);

  const handleSelectUploadMode = useCallback((mode: "upload" | "lidar" | "photo" | "hand-drawing" | "draw") => {
    setUploadMode(mode);
    setSidebarOpen(false);
  }, []);

  // === Design prompt ===
  const handleDesignPromptSubmit = useCallback(async (prompt: string) => {
    setIsGeneratingDesign(true);
    try {
      const res = await fetch("/api/project/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          projectId,
          floorPlan: floorPlan ? { rooms: floorPlan.rooms.map(r => ({ name: r.name, type: r.type })) } : undefined,
        }),
      });
      if (!res.ok) throw new Error("생성 실패");
      toast({ type: "success", title: "디자인 생성 완료", message: prompt });
    } catch {
      toast({ type: "info", title: "디자인 생성", message: "AI 디자인 기능은 AI 디자인 탭에서 이용해주세요." });
    } finally {
      setIsGeneratingDesign(false);
    }
  }, [projectId, floorPlan]);

  // === YOLO model load ===
  useEffect(() => {
    import("@/lib/services/yolo-floorplan-detector")
      .then((mod) => mod.loadModel())
      .then((ok) => setYoloAvailable(ok))
      .catch(() => setYoloAvailable(false));
  }, []);

  // === Auto-load floor plan from project.drawingId ===
  useEffect(() => {
    if (project?.drawingId) {
      setLoadError(false);
      Promise.all([
        loadFloorPlan(project.drawingId),
        getFloorPlanImageUrl(project.drawingId),
      ])
        .then(([plan, imageUrl]) => {
          if (plan) {
            setFloorPlan(plan);
          } else {
            setLoadError(true);
          }
          if (imageUrl) {
            setFloorPlanImageUrl(imageUrl);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoadError(true);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [project?.drawingId]);

  // === File upload ===
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setUploadedFile(dataUrl);
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
      const sType = project?.drawingId?.startsWith("sample-") ? project.drawingId : undefined;
      const result = await parseDrawingFile(file, knownArea, sType);

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
  }, [project?.address?.exclusiveArea, project?.drawingId]);

  // 카메라 스캐닝 (향후)
  const handleCameraScan = useCallback(async () => {
    toast({ type: "info", title: "카메라 스캐닝", message: "향후 업데이트 예정입니다." });
  }, []);

  // 다중 사진 업로드
  const handleMultiPhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 20);
    if (fileArr.length < 3) {
      toast({ type: "error", title: "사진 부족", message: "최소 3장 이상의 사진이 필요합니다." });
      return;
    }

    setMultiPhotos(fileArr);
    const urls = fileArr.map(f => URL.createObjectURL(f));
    setMultiPhotoUrls(urls);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      fileArr.forEach(f => formData.append("photos", f));
      if (project?.address?.exclusiveArea) formData.append("approximateArea", String(project.address.exclusiveArea));
      if (project?.address?.roomCount) formData.append("roomCount", String(project.address.roomCount));

      const res = await fetch("/api/project/analyze-photos", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        throw new Error(err.error || `서버 오류 (${res.status})`);
      }
      const result = await res.json();
      setPendingFloorPlan(result.floorPlan);
      setParseConfidence(result.confidence);
      setParseWarnings(result.warnings || []);
      setParseMethod("photo_analysis");
      setParseTimeMs(result.processingTimeMs || 0);
      setShowParseResult(true);
      toast({ type: "success", title: "공간 분석 완료", message: `${result.floorPlan.rooms.length}개 공간 감지` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast({ type: "error", title: "사진 분석 실패", message: msg });
    } finally {
      setAnalyzing(false);
    }
  }, [project?.address?.exclusiveArea, project?.address?.roomCount]);

  // RoomPlan JSON
  const handleRoomPlanUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const res = await fetch("/api/project/convert-roomplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomPlanData: jsonData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        throw new Error(err.error || `서버 오류 (${res.status})`);
      }
      const result = await res.json();
      setPendingFloorPlan(result.floorPlan);
      setParseConfidence(result.confidence);
      setParseWarnings(result.warnings || []);
      setParseMethod("roomplan_json");
      setParseTimeMs(0);
      setShowParseResult(true);
      toast({ type: "success", title: "RoomPlan 변환 완료", message: `${result.floorPlan.rooms.length}개 공간 감지` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "JSON 파싱 오류";
      toast({ type: "error", title: "RoomPlan 변환 실패", message: msg });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // YOLO enhancement
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

  // Accept parse result
  const handleAcceptResult = useCallback(async () => {
    if (pendingFloorPlan) {
      const enhanced = yoloAvailable
        ? await runYoloEnhancement(pendingFloorPlan)
        : pendingFloorPlan;
      setFloorPlan(enhanced);
      setShowParseResult(false);
      setPendingFloorPlan(null);
      setUploadMode(null);
    }
  }, [pendingFloorPlan, yoloAvailable, runYoloEnhancement]);

  // Retry parse
  const handleRetry = useCallback(() => {
    setShowParseResult(false);
    setPendingFloorPlan(null);
    setUploadedFile(null);
    setParseWarnings([]);
    setParseConfidence(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Room type change
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

  // Next step
  const handleNext = () => {
    if (floorPlan) {
      updateStatus("AI_DESIGN");
      router.push(`/project/${projectId}/ai-design`);
    }
  };

  // === Render upload mode content ===
  const renderUploadContent = () => {
    if (uploadMode === "draw") {
      return (
        <div className="h-full">
          <WallDrawingCanvas
            knownArea={project?.address?.exclusiveArea}
            onComplete={(plan) => {
              setFloorPlan(plan);
              setUploadMode(null);
              toast({ type: "success", title: "도면 생성 완료", message: `${plan.rooms.length}개 공간, ${plan.walls.length}개 벽` });
            }}
            className="h-full"
          />
        </div>
      );
    }

    if (showParseResult && pendingFloorPlan) {
      return (
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
      );
    }

    if (analyzing) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">AI가 도면을 분석하고 있습니다</h3>
            <p className="text-sm text-gray-500">공간 구조를 인식하고 3D 매스 모델을 생성합니다...</p>
            {uploadedFile && (
              <div className="mt-6 max-w-xs mx-auto">
                <img src={uploadedFile} alt="분석 중인 도면" className="w-full rounded-lg opacity-50" />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (uploadMode === "lidar") {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 p-8 overflow-y-auto">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-10 h-10 text-violet-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">LiDAR 스캔 데이터 업로드</h2>
              <p className="text-sm text-gray-500">iPhone/iPad의 RoomPlan으로 스캔한 JSON 파일을 업로드하세요</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-violet-800">
                  <p className="font-medium mb-1">스캔 방법</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-violet-700">
                    <li>iPhone 12 Pro 이상 또는 iPad Pro에서 3D 스캔 앱 실행</li>
                    <li>방을 천천히 돌며 벽면, 문, 창문을 스캔</li>
                    <li>스캔 완료 후 JSON 내보내기</li>
                    <li>내보낸 JSON 파일을 아래에 업로드</li>
                  </ol>
                </div>
              </div>
            </div>
            <label className="flex flex-col items-center gap-3 p-8 bg-white border-2 border-dashed border-violet-300 rounded-xl hover:border-violet-500 hover:bg-violet-50/50 cursor-pointer transition-colors">
              <Upload className="w-10 h-10 text-violet-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">RoomPlan JSON 파일 업로드</p>
                <p className="text-xs text-gray-400 mt-1">.json 파일</p>
              </div>
              <input type="file" accept=".json" onChange={handleRoomPlanUpload} className="hidden" />
            </label>
          </div>
        </div>
      );
    }

    if (uploadMode === "photo") {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 p-8 overflow-y-auto">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ImagePlus className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">실내 사진으로 도면 생성</h2>
              <p className="text-sm text-gray-500">방 사진 3~20장을 업로드하면 AI가 도면을 추정합니다</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-medium mb-1">촬영 가이드</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-emerald-700">
                    <li>각 방의 전체 모습이 보이도록 촬영</li>
                    <li>벽면, 문, 창문이 잘 보이는 각도로</li>
                    <li>가능하면 방의 네 구석에서 각각 촬영</li>
                    <li>복도, 현관도 촬영하면 더 정확합니다</li>
                  </ul>
                </div>
              </div>
            </div>
            <label className="flex flex-col items-center gap-3 p-8 bg-white border-2 border-dashed border-emerald-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-colors">
              <Camera className="w-10 h-10 text-emerald-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">사진 선택 (3~20장)</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG</p>
              </div>
              <input ref={multiFileInputRef} type="file" accept="image/*" multiple onChange={handleMultiPhotoUpload} className="hidden" />
            </label>
            {multiPhotoUrls.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">{multiPhotoUrls.length}장 선택됨</p>
                <div className="grid grid-cols-5 gap-2">
                  {multiPhotoUrls.slice(0, 10).map((url, i) => (
                    <img key={i} src={url} alt={`사진 ${i + 1}`} className="w-full h-16 object-cover rounded-lg border border-gray-200" />
                  ))}
                  {multiPhotoUrls.length > 10 && (
                    <div className="w-full h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                      +{multiPhotoUrls.length - 10}장
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (uploadMode === "hand-drawing") {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 p-8 overflow-y-auto">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PenTool className="w-10 h-10 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">손도면 사진 업로드</h2>
              <p className="text-sm text-gray-500">종이에 그린 도면을 촬영하면 AI가 디지털 도면으로 변환합니다</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">손도면 작성 팁</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
                    <li>벽을 직선으로 그리고 문/창문 위치를 표시</li>
                    <li>각 방의 이름과 대략적인 치수(m)를 기입</li>
                    <li>밝은 곳에서 도면이 잘 보이게 촬영</li>
                    <li>그림자가 지지 않도록 주의</li>
                  </ul>
                </div>
              </div>
            </div>
            <label className="flex flex-col items-center gap-3 p-8 bg-white border-2 border-dashed border-amber-300 rounded-xl hover:border-amber-500 hover:bg-amber-50/50 cursor-pointer transition-colors">
              <Upload className="w-10 h-10 text-amber-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">손도면 사진 업로드</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            {uploadedFile && (
              <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                <img src={uploadedFile} alt="업로드된 손도면" className="w-full max-h-48 object-contain rounded-lg" />
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default upload mode or "upload"
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8 overflow-y-auto">
        <div className="max-w-lg w-full">
          {project?.drawingId && loadError ? (
            <div className="text-center mb-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">도면을 불러올 수 없습니다</h2>
              <p className="text-sm text-gray-500 mb-1">ID: {project.drawingId}</p>
              <p className="text-sm text-gray-400 mb-6">도면 파일이 존재하지 않거나 로드에 실패했습니다.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setLoadError(false);
                    setLoading(true);
                    loadFloorPlan(project.drawingId!).then((plan) => {
                      if (plan) setFloorPlan(plan);
                      else setLoadError(true);
                      setLoading(false);
                    }).catch(() => { setLoadError(true); setLoading(false); });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  다시 시도
                </button>
                <label className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 cursor-pointer">
                  도면 직접 업로드
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileImage className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">도면을 등록해주세요</h2>
                <p className="text-sm text-gray-500">좌측에서 주소를 검색하거나 도면 파일을 업로드하세요</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">도면 파일 업로드</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                </label>

                <button onClick={handleCameraScan}
                  className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">카메라 3D 스캐닝</p>
                    <p className="text-xs text-gray-400 mt-1">사진으로 공간 인식</p>
                  </div>
                </button>
              </div>

              {uploadedFile && (
                <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                  <img src={uploadedFile} alt="업로드된 도면" className="w-full max-h-48 object-contain rounded-lg" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-16 left-2 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        {sidebarOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar */}
      <aside className={`
        ${sidebarOpen ? "fixed inset-y-0 left-0 z-40 mt-14" : "hidden"}
        md:relative md:flex md:mt-0
        flex-col w-[380px] bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0
      `}>
        <AddressSearchPanel
          onSelectAddress={handleSelectAddress}
          selectedAddress={selectedAddress}
        />

        {selectedAddress && (
          <BuildingInfoPanel
            selectedAddress={selectedAddress}
            onSelectBuilding={handleSelectBuilding}
            selectedBuilding={selectedBuilding}
          />
        )}

        <UploadOptionsPanel onSelectMode={handleSelectUploadMode} />
      </aside>

      {/* Right canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-gray-200 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">디자인하기</h2>
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

        {/* Main viewer area */}
        <div className="flex-1 min-h-0">
          {generatingFloorPlan ? (
            <FloorPlanGenerationProgress
              complexNo={generatingFloorPlan.complexNo}
              pyeongNo={generatingFloorPlan.pyeongNo}
              grandPlanUrl={generatingFloorPlan.grandPlanUrl}
              complexName={generatingFloorPlan.complexName}
              pyeongName={generatingFloorPlan.pyeongName}
              exclusiveArea={generatingFloorPlan.exclusiveArea}
              onComplete={(result) => {
                setFloorPlanImageUrl(result.finalUrl);
                setGeneratingFloorPlan(null);
                toast({
                  type: "success",
                  title: "도면 생성 완료",
                  message: `${Math.round(result.processingTimeMs / 1000)}초 소요`,
                });
              }}
              onCancel={() => setGeneratingFloorPlan(null)}
            />
          ) : (uploadMode === "draw" && !floorPlan) || (uploadMode && !floorPlan && !analyzing) || (showParseResult && pendingFloorPlan) || analyzing ? (
            renderUploadContent()
          ) : !floorPlan && !floorPlanImageUrl && !uploadMode ? (
            renderUploadContent()
          ) : (floorPlan || floorPlanImageUrl) ? (
            /* 도면/3D 뷰어 */
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                {viewMode === "2d" ? (
                  <div className="h-full p-4 bg-gray-50">
                    <div className="h-full bg-white rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center">
                      {floorPlanImageUrl ? (
                        <img src={floorPlanImageUrl} alt="평면도" className="max-w-full max-h-full object-contain" />
                      ) : floorPlan ? (
                        <FloorPlan2D
                          ref={floorPlan2DRef}
                          floorPlan={floorPlan}
                          className="h-full w-full"
                          showDimensions={showDimensions}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : floorPlan ? (
                  <FloorPlan3D
                    floorPlan={floorPlan}
                    className="h-full"
                    cameraMode={cameraMode}
                    showCeiling={showCeiling}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <p className="text-sm text-gray-400">3D 뷰는 도면 데이터가 필요합니다</p>
                  </div>
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
          ) : (
            renderUploadContent()
          )}
        </div>

        {/* Parse warnings */}
        {parseWarnings.length > 0 && floorPlan && (
          <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-700 overflow-x-auto">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">{parseWarnings[0]}</span>
            {parseWarnings.length > 1 && (
              <span className="text-amber-500">외 {parseWarnings.length - 1}건</span>
            )}
          </div>
        )}

        {/* Bottom info for image-only view */}
        {!floorPlan && floorPlanImageUrl && (
          <div className="px-4 py-2 bg-white border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">
                AI 생성 도면
              </span>
              {project?.address?.exclusiveArea && (
                <span>전용면적: <strong className="text-gray-900">{project.address.exclusiveArea}m²</strong></span>
              )}
            </div>
            <div className="text-xs text-gray-400 truncate max-w-full">
              {project?.address?.roadAddress || ""}
            </div>
          </div>
        )}

        {/* Bottom info + prompt bar */}
        {floorPlan && (
          <>
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
            <DesignPromptBar
              onSubmit={handleDesignPromptSubmit}
              isGenerating={isGeneratingDesign}
            />
          </>
        )}
      </div>
    </div>
  );
}
