"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Upload, Camera, FileImage, Loader2,
  AlertTriangle, Smartphone, PenTool, ImagePlus, Info, Menu, X,
  Send, Sparkles, MessageSquare, Palette, ChevronRight, ChevronLeft,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useProjectState } from "@/hooks/useProjectState";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import type { FloorPlan2DHandle } from "@/components/viewer/FloorPlan2D";
import ViewerToolbar from "@/components/viewer/ViewerToolbar";
import type { ParsedFloorPlan } from "@/types/floorplan";
// CameraMode import removed - 3D viewer disabled
import { loadFloorPlan, getFloorPlanImageUrl } from "@/lib/services/drawing-service";
import type { RoomType } from "@/types/floorplan";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";
import type { ProjectAddress, DesignPreferences } from "@/types/consumer-project";
import dynamic from "next/dynamic";

// Sidebar components
import AddressSearchPanel from "@/components/workspace/AddressSearchPanel";
import BuildingInfoPanel from "@/components/workspace/BuildingInfoPanel";
import UploadOptionsPanel from "@/components/workspace/UploadOptionsPanel";
import DesignOptionsPanel from "@/components/workspace/DesignOptionsPanel";
// DesignPromptBar removed - AI chat integrated inline

const FloorPlanGenerationProgress = dynamic(
  () => import("@/components/workspace/FloorPlanGenerationProgress"),
  { ssr: false }
);

// 3D viewer disabled - 2D only

const DrawingParseResult = dynamic(() => import("@/components/project/DrawingParseResult"));
const WallDrawingCanvas = dynamic(() => import("@/components/wall-drawing/WallDrawingCanvas"), { ssr: false });
const DimensionEditorOverlay = dynamic(() => import("@/components/viewer/DimensionEditorOverlay"), { ssr: false });

import type { EditableDimension } from "@/components/viewer/DimensionEditorOverlay";
import { calcRoomSummaries } from "@/components/viewer/DimensionEditorOverlay";

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
  const { project, updateStatus, confirmBuilding, setEditedDimensions, setDesignPreferences, addGeneratedImage, setFloorPlanImageUrl: persistFloorPlanImageUrl, setFloorPlanMask } = useProjectState(projectId);

  // === Sidebar state ===
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"upload" | "lidar" | "photo" | "hand-drawing" | "draw" | null>(null);
  // AI 채팅 상태
  const [aiMessages, setAiMessages] = useState<{ id: string; role: "user" | "assistant"; content: string; images?: string[] }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // AI 디자인 이미지 생성 상태 (4컷 슬라이드)
  const [generatedDesigns, setGeneratedDesigns] = useState<{room: string; label: string; imageData: string | null; description: string}[]>([]);
  const [designSlideIndex, setDesignSlideIndex] = useState(0);
  const [generatingDesign, setGeneratingDesign] = useState(false);
  // 디자인 ↔ 도면 뷰 전환 (데이터 유지, 뷰만 전환)
  const [showingFloorPlan, setShowingFloorPlan] = useState(false);
  const [designPrefs, setDesignPrefs] = useState<DesignPreferences>(
    project?.designPreferences || { style: "", budget: "", priorities: [], specialNotes: [] }
  );

  // === Viewer state ===
  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [floorPlanImageUrl, _setFloorPlanImageUrl] = useState<string | null>(null);
  // 도면 이미지 URL 설정 시 프로젝트 상태에도 영속 저장
  const setFloorPlanImageUrl = useCallback((url: string | null) => {
    _setFloorPlanImageUrl(url);
    if (url) persistFloorPlanImageUrl(url);
  }, [persistFloorPlanImageUrl]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // viewMode removed - 2D only
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseConfidence, setParseConfidence] = useState<number>(0);
  const [parseMethod, setParseMethod] = useState<string>("");
  const [parseTimeMs, setParseTimeMs] = useState<number>(0);
  const [pendingFloorPlan, setPendingFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [showParseResult, setShowParseResult] = useState(false);
  const [yoloAvailable, setYoloAvailable] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_yoloEnhancing, setYoloEnhancing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_yoloStats, setYoloStats] = useState<{ added: number; corrected: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_multiPhotos, setMultiPhotos] = useState<File[]>([]);
  const [multiPhotoUrls, setMultiPhotoUrls] = useState<string[]>([]);

  // 확장형/기본형 선택 상태
  const [pendingBuildingForExpanded, setPendingBuildingForExpanded] = useState<BuildingInfo | null>(null);

  // 실시간 도면 생성 상태
  const [generatingFloorPlan, setGeneratingFloorPlan] = useState<{
    complexNo: string;
    pyeongNo: number;
    grandPlanUrl: string;
    complexName?: string;
    pyeongName?: string;
    exclusiveArea?: number;
    isExpanded?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageRef = useRef<HTMLImageElement | null>(null);

  // 뷰어 제어 상태
  const [showDimensions, setShowDimensions] = useState(true);
  const [showEngInfo, setShowEngInfo] = useState(true);
  const floorPlan2DRef = useRef<FloorPlan2DHandle>(null);

  // 좌우 대칭 상태
  const [mirrored, setMirrored] = useState(false);
  // 치수 편집 상태
  const [editingDimensions, setEditingDimensions] = useState(false);
  const [editableDimensions, setEditableDimensions] = useState<EditableDimension[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Load saved dimensions from project state
  useEffect(() => {
    if (project?.editedDimensions && project.editedDimensions.length > 0) {
      setEditableDimensions(project.editedDimensions as EditableDimension[]);
    }
  }, [project?.editedDimensions]);

  // Sync design preferences from project
  useEffect(() => {
    if (project?.designPreferences) {
      setDesignPrefs(project.designPreferences);
    }
  }, [project?.designPreferences]);

  // Save dimensions to project state when they change
  const handleDimensionsChange = useCallback((dims: EditableDimension[]) => {
    setEditableDimensions(dims);
    setEditedDimensions(dims);
  }, [setEditedDimensions]);

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
    setSidebarOpen(false);

    // grandPlanUrl이 있으면 확장형/기본형 선택을 먼저 요청
    if (building.complexNo && building.pyeongNo && building.grandPlanUrl) {
      setPendingBuildingForExpanded(building);
      // 선택 모달이 뜸 → 사용자가 선택하면 proceedWithBuilding 호출
      return;
    }

    // grandPlanUrl 없으면 바로 진행
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
    confirmBuilding(addressData);
    toast({ type: "success", title: "건물 선택 완료", message: `${building.dongName} ${building.hoName}` });
  }, [selectedAddress, confirmBuilding]);

  // 확장형/기본형 선택 후 도면 생성 진행
  const proceedWithBuilding = useCallback((building: BuildingInfo, expanded: boolean) => {
    if (!selectedAddress) return;
    setPendingBuildingForExpanded(null);

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
      isExpanded: expanded,
    };
    confirmBuilding(addressData);

    // 도면 로드 우선순위: ① manifest → ② DB 캐시 → ③ Gemini Pro 실시간 생성
    const manifestId = `naver-${building.complexNo}-${building.pyeongNo}`;

    getFloorPlanImageUrl(manifestId).then(manifestUrl => {
      if (manifestUrl) {
        setFloorPlanImageUrl(manifestUrl);
        toast({ type: "success", title: "도면 로드 완료", message: "배치 처리된 도면을 불러왔습니다" });
        return;
      }

      // ② DB 캐시 확인
      fetch(`/api/project/generate-floorplan?complexNo=${building.complexNo}&pyeongNo=${building.pyeongNo}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            setFloorPlanImageUrl(data.finalUrl);
            toast({ type: "success", title: "도면 로드 완료", message: "캐시된 도면을 불러왔습니다" });
          } else {
            // ③ Gemini Pro 실시간 생성
            setGeneratingFloorPlan({
              complexNo: building.complexNo!,
              pyeongNo: building.pyeongNo!,
              grandPlanUrl: building.grandPlanUrl!,
              complexName: building.complexName,
              pyeongName: building.typeName,
              exclusiveArea: building.exclusiveArea,
              isExpanded: expanded,
            });
          }
        })
        .catch(() => {
          setGeneratingFloorPlan({
            complexNo: building.complexNo!,
            pyeongNo: building.pyeongNo!,
            grandPlanUrl: building.grandPlanUrl!,
            complexName: building.complexName,
            pyeongName: building.typeName,
            exclusiveArea: building.exclusiveArea,
            isExpanded: expanded,
          });
        });
    });
  }, [selectedAddress, confirmBuilding, setFloorPlanImageUrl]);

  const handleSelectUploadMode = useCallback((mode: "upload" | "lidar" | "photo" | "hand-drawing" | "draw") => {
    setUploadMode(mode);
    setSidebarOpen(false);
  }, []);

  // 디자인 옵션 변경
  const handlePrefsChange = useCallback((prefs: DesignPreferences) => {
    setDesignPrefs(prefs);
    setDesignPreferences(prefs);
  }, [setDesignPreferences]);

  // === AI 채팅 (SSE 스트리밍) ===
  const AI_QUICK_PROMPTS = [
    "모던 미니멀 스타일로 추천해줘",
    "북유럽 스타일 인테리어 제안해줘",
    "화이트톤 깔끔한 디자인 추천",
    "우드톤 따뜻한 느낌으로 해줘",
  ];

  // AI 메시지 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSendAI = useCallback(async () => {
    if (!aiInput.trim() || aiGenerating) return;

    const userContent = aiInput.trim();
    setAiMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: userContent }]);
    setAiInput("");
    setAiGenerating(true);

    const assistantId = crypto.randomUUID();
    setAiMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      // 디자인 옵션 컨텍스트 구성
      const prefsContext = [
        designPrefs.style ? `스타일: ${designPrefs.style}` : "",
        designPrefs.budget ? `예산: ${designPrefs.budget === "economy" ? "경제형 1,500만원" : designPrefs.budget === "standard" ? "표준형 3,000만원" : "프리미엄 5,000만원+"}` : "",
        designPrefs.priorities.length > 0 ? `우선순위: ${designPrefs.priorities.join(", ")}` : "",
        designPrefs.specialNotes.length > 0 ? `특기사항: ${designPrefs.specialNotes.join(", ")}` : "",
      ].filter(Boolean).join(". ");

      // 전체 대화 이력 구성 (멀티턴 대화)
      const fullMessages = [
        ...aiMessages.map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: prefsContext ? `[디자인 옵션: ${prefsContext}]\n\n${userContent}` : userContent },
      ];

      const res = await fetch("/api/project/design-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullMessages,
          floorPlanContext: floorPlan
            ? floorPlan.rooms.map((r) => `${r.name}(${r.area}m²)`).join(", ")
            : "",
        }),
      });

      if (!res.ok) throw new Error("API error");

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        // SSE 스트리밍
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const d = line.slice(6).trim();
            if (d === "[DONE]") continue;
            try {
              const p = JSON.parse(d);
              if (p.text) fullText += p.text;
            } catch {
              /* skip */
            }
          }
          setAiMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
        }
      } else {
        // JSON 응답
        const data = await res.json();
        const text = data.response || data.text || "응답을 받았습니다.";
        setAiMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m))
        );
      }
    } catch {
      setAiMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "AI 응답 생성에 실패했습니다. 다시 시도해주세요." } : m
        )
      );
    }

    setAiGenerating(false);
  }, [aiInput, aiGenerating, floorPlan, designPrefs, aiMessages]);

  // === AI 디자인 이미지 생성 (4컷 병렬) ===
  const handleGenerateDesign = useCallback(async () => {
    if (generatingDesign) return;

    // 대화 내용 없으면 생성 차단 (크레딧 소모 방지)
    const userMessages = aiMessages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      toast({ type: "error", title: "입력 필요", message: "먼저 AI와 대화하여 원하는 디자인 방향을 알려주세요" });
      return;
    }

    setGeneratingDesign(true);

    try {
      // 대화 이력 요약
      const conversationSummary = aiMessages
        .map((m) =>
          `${m.role === "user" ? "사용자" : "AI"}: ${m.content.slice(0, 300)}`
        )
        .join("\n");

      const res = await fetch("/api/project/design-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationSummary,
          designPreferences: designPrefs,
          floorPlanImageUrl,
          floorPlanContext: floorPlan
            ? floorPlan.rooms.map((r) => `${r.name}(${r.area}m²)`).join(", ")
            : "",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.images && data.images.length > 0) {
        const successImages = data.images.filter((img: { imageData: string | null }) => img.imageData !== null);
        setGeneratedDesigns(data.images);
        setDesignSlideIndex(0);
        // project state에 저장 (Tab 2 렌더링 페이지 연동)
        const roomKeyToType: Record<string, string[]> = {
          living: ["LIVING"], kitchen: ["KITCHEN"],
          bedroom: ["BED", "MASTER_BED"], bathroom: ["BATHROOM"],
        };
        for (const img of data.images) {
          if (!img.imageData) continue;
          const matchTypes = roomKeyToType[img.room] || [];
          const matchRoom = floorPlan?.rooms.find((r: { type: string }) => matchTypes.includes(r.type));
          addGeneratedImage({
            id: crypto.randomUUID(),
            prompt: img.description || `${img.label} 디자인`,
            imageData: img.imageData,
            roomId: matchRoom?.id,
            roomName: img.label,
            description: img.description,
            createdAt: new Date().toISOString(),
          });
        }
        // AI 채팅에 결과 메시지 추가
        const successCount = successImages.length;
        const totalCount = data.images.length;
        setAiMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `${totalCount}개 공간 중 ${successCount}개 디자인 이미지가 생성되었습니다. 캔버스에서 좌우 화살표로 넘겨보세요.${data.isMock ? "\n\n*Mock 모드로 생성된 프리뷰입니다.*" : ""}`,
            images: successImages.map((img: { imageData: string }) => img.imageData),
          },
        ]);
        toast({ type: "success", title: "디자인 완성", message: `${successCount}컷 AI 디자인 이미지가 생성되었습니다` });
      } else {
        toast({ type: "error", title: "생성 실패", message: "이미지 생성에 실패했습니다" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast({ type: "error", title: "디자인 생성 실패", message: msg });
    } finally {
      setGeneratingDesign(false);
    }
  }, [generatingDesign, aiMessages, designPrefs, floorPlanImageUrl, floorPlan, addGeneratedImage]);

  // === YOLO model load ===
  useEffect(() => {
    import("@/lib/services/yolo-floorplan-detector")
      .then((mod) => mod.loadModel())
      .then((ok) => setYoloAvailable(ok))
      .catch(() => setYoloAvailable(false));
  }, []);

  // === Auto-load floor plan from project ===
  useEffect(() => {
    // 프로젝트에 저장된 도면 이미지 URL 복원 (Supabase Storage 등)
    if (project?.floorPlanImageUrl && !floorPlanImageUrl) {
      _setFloorPlanImageUrl(project.floorPlanImageUrl);
    }

    if (project?.drawingId) {
      setLoadError(false);
      loadFloorPlan(project.drawingId)
        .then((plan) => {
          if (plan) {
            setFloorPlan(plan);
          } else {
            setLoadError(true);
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
  }, [project?.drawingId, project?.floorPlanImageUrl]);

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
  }, [project?.address?.exclusiveArea, project?.drawingId]);

  // 카메라 스캐닝 (향후)
  const handleCameraScan = useCallback(async () => {
    toast({ type: "info", title: "카메라 스캐닝", message: "카메라 스캐닝 기능은 준비 중입니다" });
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
    } catch {
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

  // Next step → 자재 선택
  const handleNext = () => {
    if (floorPlan || floorPlanImageUrl) {
      updateStatus("RENDERING");
      router.push(`/project/${projectId}/rendering`);
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
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Palette className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">디자인 워크스페이스 로딩 중...</p>
        </div>
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
        flex-col w-[380px] bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0 shadow-sm
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

        {(floorPlan || floorPlanImageUrl) && (
          <DesignOptionsPanel
            preferences={designPrefs}
            onChange={handlePrefsChange}
          />
        )}
      </aside>

      {/* Right canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 leading-tight">디자인하기</h2>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {(floorPlan || floorPlanImageUrl) && (
                  <span className="text-[11px] text-gray-500">
                    {floorPlan?.totalArea || project?.address?.exclusiveArea || "—"}m²
                    {floorPlan && ` · ${floorPlan.rooms.length}개 공간`}
                  </span>
                )}
                {floorPlan && (
                  <span className="px-1.5 py-px bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                    구조분석 완료
                  </span>
                )}
                {floorPlanImageUrl && !floorPlan && (
                  <span className="px-1.5 py-px bg-blue-100 text-blue-700 text-[10px] font-semibold rounded">
                    AI 생성 도면
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(floorPlan || floorPlanImageUrl) && (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
              >
                자재 선택 <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main viewer area */}
        <div className="flex-1 min-h-0">
          {pendingBuildingForExpanded ? (
            /* ── 확장형/기본형 선택 ── */
            <div className="h-full flex items-center justify-center bg-gray-50/60">
              <div className="max-w-md w-full mx-4">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">발코니 타입 선택</h3>
                  <p className="text-sm text-gray-500 text-center mb-6">
                    도면에 적용할 발코니 타입을 선택해주세요
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => proceedWithBuilding(pendingBuildingForExpanded, true)}
                      className="group relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-blue-700">확장형</p>
                        <p className="text-[11px] text-blue-500 mt-0.5">발코니 벽 제거</p>
                      </div>
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded-full">추천</span>
                    </button>
                    <button
                      onClick={() => proceedWithBuilding(pendingBuildingForExpanded, false)}
                      className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-700">기본형</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">발코니 벽 유지</p>
                      </div>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-4">
                    대부분의 신축 아파트는 확장형으로 시공됩니다
                  </p>
                </div>
              </div>
            </div>
          ) : generatingFloorPlan ? (
            <FloorPlanGenerationProgress
              complexNo={generatingFloorPlan.complexNo}
              pyeongNo={generatingFloorPlan.pyeongNo}
              grandPlanUrl={generatingFloorPlan.grandPlanUrl}
              complexName={generatingFloorPlan.complexName}
              pyeongName={generatingFloorPlan.pyeongName}
              exclusiveArea={generatingFloorPlan.exclusiveArea}
              isExpanded={generatingFloorPlan.isExpanded}
              onComplete={(result) => {
                setFloorPlanImageUrl(result.finalUrl);
                if (result.maskUrl && result.roomColorMap) {
                  setFloorPlanMask(result.maskUrl, result.roomColorMap);
                }
                setGeneratingFloorPlan(null);
                toast({
                  type: "success",
                  title: "도면 생성 완료",
                  message: result.processingTimeMs > 0
                    ? `${Math.round(result.processingTimeMs / 1000)}초 소요`
                    : "캐시된 도면 로드 완료",
                });
              }}
              onCancel={() => setGeneratingFloorPlan(null)}
            />
          ) : (uploadMode === "draw" && !floorPlan) || (uploadMode && !floorPlan && !analyzing) || (showParseResult && pendingFloorPlan) || analyzing ? (
            renderUploadContent()
          ) : !floorPlan && !floorPlanImageUrl && !uploadMode ? (
            renderUploadContent()
          ) : (floorPlan || floorPlanImageUrl) ? (
            /* 도면 2D 뷰어 또는 AI 디자인 이미지 */
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <div className="h-full bg-gray-50/60 overflow-hidden flex items-center justify-center relative" ref={imageContainerRef}>
                    {/* AI 디자인 생성 중 로딩 */}
                    {generatingDesign && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-indigo-50/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg">
                          <Sparkles className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">AI 디자인 4컷 생성 중</h3>
                        <p className="text-sm text-gray-500">도면 + 대화 내용을 기반으로 거실·부엌·침실·욕실 디자인을 생성합니다...</p>
                        <div className="mt-4 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          <span className="text-xs text-indigo-600 font-medium">Gemini Pro 3.0 × 4컷 병렬 생성 중 · 약 1~2분</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {["거실", "부엌", "침실", "욕실"].map((label) => (
                            <span key={label} className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-medium rounded-full animate-pulse">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI 생성 디자인 4컷 슬라이드 뷰어 */}
                    {generatedDesigns.length > 0 && !showingFloorPlan ? (
                      <>
                        {/* 현재 슬라이드 이미지 */}
                        {generatedDesigns[designSlideIndex]?.imageData ? (
                          <img
                            src={generatedDesigns[designSlideIndex].imageData!}
                            alt={`AI 생성 디자인 - ${generatedDesigns[designSlideIndex].label}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                            <AlertTriangle className="w-8 h-8" />
                            <p className="text-sm">{generatedDesigns[designSlideIndex]?.label} 이미지 생성 실패</p>
                          </div>
                        )}

                        {/* 좌측 상단: AI 라벨 + 방 이름 */}
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold rounded-lg shadow-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI 생성 디자인
                          </div>
                          <div className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold rounded-lg shadow-md border border-gray-200">
                            {generatedDesigns[designSlideIndex]?.label}
                          </div>
                          <div className="px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium rounded-lg">
                            {designSlideIndex + 1} / {generatedDesigns.length}
                          </div>
                        </div>

                        {/* 좌우 화살표 네비게이션 */}
                        {generatedDesigns.length > 1 && (
                          <>
                            <button
                              onClick={() => setDesignSlideIndex((i) => (i - 1 + generatedDesigns.length) % generatedDesigns.length)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setDesignSlideIndex((i) => (i + 1) % generatedDesigns.length)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {/* 하단 도트 인디케이터 + 방 라벨 */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-full">
                          {generatedDesigns.map((d, i) => (
                            <button
                              key={d.room}
                              onClick={() => setDesignSlideIndex(i)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                                i === designSlideIndex
                                  ? "bg-white text-gray-900 shadow-sm"
                                  : "text-white/70 hover:text-white hover:bg-white/20"
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>

                        {/* 도면 썸네일 (우측 상단) → 도면 보기로 전환 */}
                        {floorPlanImageUrl && (
                          <button
                            onClick={() => setShowingFloorPlan(true)}
                            className="absolute top-3 right-3 z-20 group"
                            title="도면 보기로 전환"
                          >
                            <div className="w-20 h-20 rounded-xl border-2 border-white/80 shadow-xl overflow-hidden bg-white group-hover:border-blue-400 group-hover:scale-105 transition-all">
                              <img
                                src={floorPlanImageUrl}
                                alt="도면"
                                className="w-full h-full object-contain"
                                style={mirrored ? { transform: "scaleX(-1)" } : undefined}
                              />
                            </div>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] bg-gray-800/90 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              도면 보기
                            </span>
                          </button>
                        )}
                        {!floorPlanImageUrl && floorPlan && (
                          <button
                            onClick={() => setShowingFloorPlan(true)}
                            className="absolute top-3 right-3 z-20 w-20 h-20 rounded-xl border-2 border-white/80 shadow-xl overflow-hidden bg-white hover:border-blue-400 hover:scale-105 transition-all"
                            title="도면 보기로 전환"
                          >
                            <FloorPlan2D
                              floorPlan={floorPlan}
                              className="w-full h-full"
                              showDimensions={false}
                            />
                          </button>
                        )}
                      </>
                    ) : floorPlanImageUrl ? (
                      <>
                        <img
                          src={floorPlanImageUrl}
                          alt="평면도"
                          className="max-w-full max-h-full object-contain transition-transform duration-300"
                          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
                        />
                        <DimensionEditorOverlay
                          containerRef={imageContainerRef}
                          dimensions={editableDimensions}
                          onChange={handleDimensionsChange}
                          editable={editingDimensions}
                        />
                        {/* 도면 뷰에서 AI 디자인으로 돌아가기 썸네일 */}
                        {generatedDesigns.length > 0 && showingFloorPlan && (
                          <button
                            onClick={() => setShowingFloorPlan(false)}
                            className="absolute top-3 right-3 z-20 group"
                            title="AI 디자인 보기"
                          >
                            <div className="w-20 h-20 rounded-xl border-2 border-white/80 shadow-xl overflow-hidden bg-white group-hover:border-indigo-400 group-hover:scale-105 transition-all">
                              {generatedDesigns[designSlideIndex]?.imageData ? (
                                <img
                                  src={generatedDesigns[designSlideIndex].imageData!}
                                  alt="AI 디자인"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                                  <Sparkles className="w-6 h-6 text-indigo-400" />
                                </div>
                              )}
                            </div>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] bg-indigo-600/90 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              디자인 보기
                            </span>
                          </button>
                        )}
                      </>
                    ) : floorPlan ? (
                      <div
                        className="h-full w-full transition-transform duration-300 relative"
                        style={mirrored ? { transform: "scaleX(-1)" } : undefined}
                      >
                        <FloorPlan2D
                          ref={floorPlan2DRef}
                          floorPlan={floorPlan}
                          className="h-full w-full"
                          showDimensions={showDimensions}
                        />
                        {/* 도면 뷰에서 AI 디자인으로 돌아가기 썸네일 */}
                        {generatedDesigns.length > 0 && showingFloorPlan && (
                          <button
                            onClick={() => setShowingFloorPlan(false)}
                            className="absolute top-3 right-3 z-20 group"
                            title="AI 디자인 보기"
                            style={mirrored ? { transform: "scaleX(-1)" } : undefined}
                          >
                            <div className="w-20 h-20 rounded-xl border-2 border-white/80 shadow-xl overflow-hidden bg-white group-hover:border-indigo-400 group-hover:scale-105 transition-all">
                              {generatedDesigns[designSlideIndex]?.imageData ? (
                                <img
                                  src={generatedDesigns[designSlideIndex].imageData!}
                                  alt="AI 디자인"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                                  <Sparkles className="w-6 h-6 text-indigo-400" />
                                </div>
                              )}
                            </div>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] bg-indigo-600/90 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              디자인 보기
                            </span>
                          </button>
                        )}
                      </div>
                    ) : null}
                </div>
              </div>
              <div className="border-t border-gray-200 bg-white">
              <ViewerToolbar
                onZoomIn={() => floorPlan2DRef.current?.zoomIn()}
                onZoomOut={() => floorPlan2DRef.current?.zoomOut()}
                onFitToScreen={() => floorPlan2DRef.current?.resetView()}
                showDimensions={showDimensions}
                onToggleDimensions={floorPlan ? () => setShowDimensions((v) => !v) : undefined}
                showEngInfo={showEngInfo}
                onToggleEngInfo={floorPlan ? () => setShowEngInfo((v) => !v) : undefined}
                editingDimensions={editingDimensions}
                onToggleEditDimensions={floorPlanImageUrl ? () => setEditingDimensions((v) => !v) : undefined}
                mirrored={mirrored}
                onToggleMirror={() => setMirrored((v) => !v)}
              />
              </div>
            </div>
          ) : (
            renderUploadContent()
          )}
        </div>

        {/* Parse warnings */}
        {parseWarnings.length > 0 && floorPlan && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2.5 text-xs text-amber-700 overflow-x-auto">
            <div className="w-5 h-5 bg-amber-100 rounded flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
            </div>
            <span className="whitespace-nowrap font-medium">{parseWarnings[0]}</span>
            {parseWarnings.length > 1 && (
              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-700 text-[10px] font-semibold rounded-full">+{parseWarnings.length - 1}</span>
            )}
          </div>
        )}

        {/* Bottom: AI Chat Panel */}
        {(floorPlan || floorPlanImageUrl) && (
          <div className="border-t border-gray-200 bg-white flex flex-col">
            {/* Chat Panel Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-md flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-700">AI 인테리어 상담</span>
                {aiMessages.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-semibold rounded-full">
                    {aiMessages.filter(m => m.role === "user").length}회 대화
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                {(() => {
                  const dimSummaries = calcRoomSummaries(editableDimensions);
                  const dimTotal = dimSummaries.reduce((s, r) => s + (r.areaSqm || 0), 0);
                  return (
                    <span>
                      {dimTotal > 0 ? `${dimTotal.toFixed(1)}` : (floorPlan?.totalArea || project?.address?.exclusiveArea || "—")}m²
                      {dimTotal > 0 ? ` · ${dimSummaries.length}실` : (floorPlan ? ` · ${floorPlan.rooms.length}개 공간` : "")}
                    </span>
                  );
                })()}
                {project?.address?.roadAddress && (
                  <span className="hidden sm:inline truncate max-w-[150px]">{project.address.roadAddress}</span>
                )}
              </div>
            </div>

            {/* Design Generate Button */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border-b border-indigo-100/50">
              <button
                onClick={handleGenerateDesign}
                disabled={generatingDesign || aiGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-600 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {generatingDesign ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 디자인 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    도면 기반 4컷 디자인 완성하기
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
              {!generatingDesign && (
                <p className="text-center text-[10px] text-indigo-400 mt-1.5">
                  도면 + 채팅 내용 + 옵션을 종합하여 거실·부엌·침실·욕실 4컷 디자인을 생성합니다
                </p>
              )}
            </div>

            {/* AI Chat Messages */}
            {aiMessages.length === 0 && (
              <div className="px-4 py-3 bg-gray-50/30 border-t border-gray-100">
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-[13px] text-gray-600 leading-relaxed">
                    <p className="font-semibold text-gray-800 mb-1">안녕하세요! AI 인테리어 디자이너입니다</p>
                    <p>아래 빠른 질문을 선택하거나, 원하는 스타일을 자유롭게 말씀해 주세요. 대화를 나눈 뒤 <strong className="text-indigo-600">&quot;디자인 완성&quot;</strong> 버튼을 누르면 AI가 포토리얼리스틱 이미지를 생성합니다.</p>
                  </div>
                </div>
              </div>
            )}
            {aiMessages.length > 0 && (
              <div className="max-h-[240px] overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/30 border-t border-gray-100">
                {aiMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"
                          : "bg-white text-gray-800 border border-gray-200 shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content || "..."}</p>
                      {msg.images && msg.images.map((imgSrc, i) => (
                        <img
                          key={i}
                          src={imgSrc}
                          alt="AI 생성 디자인"
                          className="mt-2 rounded-lg max-w-full cursor-pointer hover:opacity-80 transition-opacity border border-white/20"
                          onClick={() => {
                            // 해당 이미지의 슬라이드 인덱스 찾기
                            const idx = generatedDesigns.findIndex((d) => d.imageData === imgSrc);
                            if (idx >= 0) setDesignSlideIndex(idx);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {aiGenerating && aiMessages[aiMessages.length - 1]?.content === "" && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl px-3.5 py-2 text-[13px] text-gray-400 border border-gray-200 shadow-sm flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI가 답변을 작성 중...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Quick Prompts + Input */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {AI_QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp}
                    onClick={() => setAiInput(qp)}
                    disabled={aiGenerating || generatingDesign}
                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all disabled:opacity-40 text-left"
                  >
                    <Sparkles className="w-3 h-3 text-blue-400 flex-shrink-0" />{qp}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendAI(); } }}
                    placeholder="인테리어 스타일, 자재, 디자인을 물어보세요..."
                    disabled={aiGenerating}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/80 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none disabled:bg-gray-100 disabled:text-gray-400 transition-all placeholder:text-gray-400"
                  />
                </div>
                <button
                  onClick={handleSendAI}
                  disabled={!aiInput.trim() || aiGenerating}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
