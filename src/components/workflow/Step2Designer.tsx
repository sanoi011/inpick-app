/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Hexagon,
  Loader2,
  Check,
  ChevronRight,
  AlertCircle,
  Send,
  Minimize2,
  Maximize2,
  Home,
  Bed,
  ChefHat,
  Bath,
  DoorOpen,
  Layers,
  X,
  Sparkles,
  Crosshair,
  Paperclip,
  ImagePlus,
  Lock,
  Eye,
} from "lucide-react";
import type { BasicInfoData } from "./BasicInfoCard";
import type { NormalizedFloorplan } from "./Step1Cards";
import { renderRoomViaClient, type RenderRoomBody } from "@/lib/inpick/render-room-client";
import { extractDesignPrompt } from "@/lib/inpick/design-chat-client";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";
import MaterialEditor from "./MaterialEditor";
import VisionMaterialPicker from "./VisionMaterialPicker";
import type {
  SurfaceType as VisionSurfaceType,
  VisionMaterialAnalyzeRequest,
} from "@/lib/vision-materials/types";
import type { SegmentationData } from "@/types/segmentation";
// P1: 이미지 생성 결과를 견적 evidence로 DB 저장 — workflow blocking 제거 핵심
import {
  getOrCreateWorkflowProjectId,
  saveDesignOutputAfterRender,
  lightenWorkflowStep2,
} from "@/lib/inpick/estimate-context/client";
import type {
  MaterialHint,
  ProjectMode,
} from "@/lib/inpick/estimate-context/types";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { routePromptToRoom } from "@/lib/inpick/workflow/prompt-room-router";
import { mapPhotoSourcesToRooms } from "@/lib/inpick/photo-source-mapping";
import { formatPhotoFurnishingRequirements } from "@/lib/inpick/photo-render-prompt";
import {
  buildKitchenAssemblyRenderPrompt,
  type KitchenAssembly,
} from "@/lib/inpick/kitchen-assembly";
import RoomProductImageSelector from "./RoomProductImageSelector";
import {
  bindRoomProductCustomizationToSource,
  buildRoomProductEstimateMapping,
  buildRoomProductPromptMarkdown,
  carryRoomProductCustomizationToSource,
  inferRoomProductKind,
  listTargetSurfaces,
  type RoomCatalogProduct,
  type RoomProductCustomization,
  type RoomProductPartCode,
} from "@/lib/inpick/room-product-customization";

// legacy compat — MaterialEditor가 더이상 export하지 않음
export type MaterialRegion = unknown;

// 아파트 도면 모드 — 9개 방 (기존)
const APARTMENT_ROOM_TABS: Array<{ v: string; label: string; dimKey: string; icon: typeof Home }> = [
  { v: "all", label: "전체", dimKey: "거실", icon: Layers },
  { v: "living", label: "거실", dimKey: "거실", icon: Home },
  { v: "master", label: "안방", dimKey: "안방", icon: Bed },
  { v: "kitchen", label: "부엌", dimKey: "주방", icon: ChefHat },
  { v: "bath", label: "욕실", dimKey: "욕실1", icon: Bath },
  { v: "bedroom", label: "침실", dimKey: "침실1", icon: Bed },
  { v: "entrance", label: "현관", dimKey: "현관", icon: DoorOpen },
  { v: "balcony", label: "베란다", dimKey: "발코니", icon: Layers },
  { v: "dress", label: "드레스룸", dimKey: "드레스룸", icon: Layers },
];

// 도면 없는 주거 모드 — 단순화된 공간 6개
const PHOTO_RESIDENTIAL_TABS: Array<{ v: string; label: string; dimKey: string; icon: typeof Home }> = [
  { v: "all", label: "전체", dimKey: "거실", icon: Layers },
  { v: "living", label: "거실/다이닝", dimKey: "거실", icon: Home },
  { v: "bedroom", label: "침실", dimKey: "안방", icon: Bed },
  { v: "kitchen", label: "주방", dimKey: "주방", icon: ChefHat },
  { v: "bath", label: "욕실", dimKey: "욕실1", icon: Bath },
  { v: "other", label: "기타", dimKey: "거실", icon: Layers },
];

// 상가/사무실 zone — 업종별로 동적 생성 (commercialBusiness prop 기반)
const COMMERCIAL_ZONE_TABS_BY_BUSINESS: Record<string, Array<{ v: string; label: string; dimKey: string; icon: typeof Home }>> = {
  cafe: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "메인 홀", dimKey: "홀", icon: Home },
    { v: "counter", label: "카운터", dimKey: "카운터", icon: ChefHat },
    { v: "kitchen", label: "주방", dimKey: "주방", icon: ChefHat },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
    { v: "facade", label: "파사드", dimKey: "외부", icon: DoorOpen },
  ],
  restaurant: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "홀", dimKey: "홀", icon: Home },
    { v: "kitchen", label: "주방", dimKey: "주방", icon: ChefHat },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
    { v: "facade", label: "파사드", dimKey: "외부", icon: DoorOpen },
  ],
  bakery: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "쇼룸", dimKey: "홀", icon: Home },
    { v: "counter", label: "카운터", dimKey: "카운터", icon: ChefHat },
    { v: "kitchen", label: "베이킹실", dimKey: "주방", icon: ChefHat },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  bar: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "홀", dimKey: "홀", icon: Home },
    { v: "counter", label: "바", dimKey: "카운터", icon: ChefHat },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  beauty_salon: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "메인 홀", dimKey: "홀", icon: Home },
    { v: "treatment_room", label: "시술실", dimKey: "시술실", icon: Bed },
    { v: "counter", label: "카운터", dimKey: "카운터", icon: DoorOpen },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  clinic: [
    { v: "all", label: "전체", dimKey: "대기실", icon: Layers },
    { v: "main_hall", label: "대기실", dimKey: "대기실", icon: Home },
    { v: "treatment_room", label: "진료실", dimKey: "진료실", icon: Bed },
    { v: "counter", label: "접수처", dimKey: "접수", icon: DoorOpen },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  academy: [
    { v: "all", label: "전체", dimKey: "강의실", icon: Layers },
    { v: "office_room", label: "강의실", dimKey: "강의실", icon: Home },
    { v: "main_hall", label: "로비", dimKey: "로비", icon: DoorOpen },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  office: [
    { v: "all", label: "전체", dimKey: "오피스", icon: Layers },
    { v: "office_room", label: "오픈 오피스", dimKey: "오피스", icon: Home },
    { v: "main_hall", label: "회의실", dimKey: "회의실", icon: Home },
    { v: "counter", label: "리셉션", dimKey: "리셉션", icon: DoorOpen },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
  gym: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "운동 공간", dimKey: "홀", icon: Home },
    { v: "treatment_room", label: "PT실", dimKey: "PT실", icon: Bed },
    { v: "restroom", label: "탈의실/샤워", dimKey: "탈의실", icon: Bath },
  ],
  retail: [
    { v: "all", label: "전체", dimKey: "매장", icon: Layers },
    { v: "main_hall", label: "매장 홀", dimKey: "매장", icon: Home },
    { v: "counter", label: "카운터", dimKey: "카운터", icon: DoorOpen },
    { v: "fitting_room", label: "피팅룸", dimKey: "피팅룸", icon: Bed },
    { v: "facade", label: "파사드", dimKey: "외부", icon: DoorOpen },
  ],
  studio_space: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "촬영존", dimKey: "홀", icon: Home },
    { v: "restroom", label: "탈의/화장실", dimKey: "화장실", icon: Bath },
  ],
  other_commercial: [
    { v: "all", label: "전체", dimKey: "홀", icon: Layers },
    { v: "main_hall", label: "메인 공간", dimKey: "홀", icon: Home },
    { v: "counter", label: "카운터", dimKey: "카운터", icon: DoorOpen },
    { v: "restroom", label: "화장실", dimKey: "화장실", icon: Bath },
  ],
};

const STYLE_PRESETS = [
  "모던 미니멀",
  "내추럴 우드 톤",
  "스칸디 화이트",
  "클래식 럭셔리",
  "재패니즈 미니멀",
  "인더스트리얼 로프트",
];

const RENDER_EXCLUDED = ["balcony", "dress"];
const GLOBAL_PROMPT_KEY = "__global__";

/**
 * 부위별 자재뷰(자재 수정 + 견적 산출) 공개 여부.
 * 2026-07-14 정밀 선택 UX + GPT Image 2 영역 편집 파이프라인으로 재공개.
 */
const PARTIAL_MATERIAL_VIEW_ENABLED = false;

/**
 * 내부 생성용 기술 프롬프트 감지 — 채팅 말풍선에 그대로 노출하지 않는다.
 * (AI 상담→일괄 생성 시 extract가 만든 영어 프롬프트가 r.prompt에 저장되는 케이스 포함)
 */
function isInternalRenderPrompt(p: string): boolean {
  if (!p) return false;
  if (/STRICTLY PRESERVE|structural reference|photorealistic|floor plan/i.test(p)) return true;
  // 길고(180자+) 대부분 ASCII면 사용자 입력이 아니라 내부 영어 프롬프트로 간주
  if (p.length > 180) {
    const asciiCount = p.replace(/[^\x20-\x7E]/g, "").length;
    if (asciiCount / p.length > 0.7) return true;
  }
  return false;
}

export interface RenderItem {
  url: string;
  /** 서버 private 원본을 가리키는 공개 불가능 ID */
  lockedAssetId?: string;
  accessState?: "free" | "locked" | "unlocked";
  /** 서버 access grant는 있으나 단기 URL 재발급이 필요한 상태 */
  entitlementGranted?: boolean;
  viewExpiresAt?: string;
  /** 최종 선택 모달에서 원래 render index를 보존 */
  selectionIndex?: number;
  prompt: string;
  revisedPrompt?: string;
  costUsd: number;
  timestamp: string;
  /** legacy — 이전 GPT-4o 기반 영역 (deprecated, segmentation 사용) */
  materialRegions?: MaterialRegion[];
  /** SAM 2.1 또는 GPT-4o Vision으로 추출한 세그멘테이션 + 자재 선택 */
  segmentation?: SegmentationData;
  refinedUrl?: string;
  refinedAt?: string;
  /** P6-4: 도면 기반 생성 메타 (render-room 응답에서 채워짐) */
  metadata?: {
    floorplanUsed?: boolean;
    floorplanImageUrl?: string;
    propertyId?: string;
    referenceMode?: "floorplan" | "area_average";
    renderSpecKind?: "RenderRoomSpec_v1" | "text_only";
    renderSpecConfidence?: number;
    roomName?: string;
  };
}

export interface ChatImageAttachment {
  /** 원본 dataURL (UI 미리보기) */
  dataUrl: string;
  /** Anthropic 전송용 순수 base64 (prefix 제외) */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  fileName?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: ChatImageAttachment[]; // user 메시지에만 의미 있음
}

export interface Step2Data {
  selectedByRoom: Record<string, number | null>;
  generations: Record<string, number>;
  rendersByRoom: Record<string, RenderItem[]>;
  promptByRoom: Record<string, string>;
  /** AI 상담 채팅 히스토리 (글로벌 — 가이드 §1: 4~5턴 안에 정보 수집) */
  chatMessages?: ChatMessage[];
  /** chat 모드 활성 여부 */
  chatMode?: boolean;
  /** 대표 거실 생성 시 확정된 전체 공간 컨셉 — 잠긴 공간 생성에 재사용 */
  conceptPrompt?: string;
  /** 거실 외 이미지별 공개 키(timestamp 우선). 기존 세션 이미지도 1장 단위로 잠근다. */
  unlockedRenderKeys?: Record<string, string[]>;
  /** 이미지 위에서 사용자가 직접 확정한 실제 material_products 제품 */
  materialSelections?: Record<string, SelectedEstimateMaterial>;
  /** 주방 조립체의 부품별 실제 SKU 스냅샷 */
  kitchenAssemblies?: Record<string, KitchenAssembly>;
  /** 실제 생성 이미지 위에서 확정한 실별·부위별 검증 SKU 스냅샷 */
  roomProductCustomizations?: Record<string, RoomProductCustomization>;
  /** 견적 직전 팝업에서 실별로 확정한 최종 이미지 URL */
  finalSelectedImageUrlsByRoom?: Record<string, string>;
  finalSelectionConfirmedAt?: string;
}

export interface SelectedEstimateMaterial {
  roomId: string;
  roomName: string;
  surfaceType: MaterialHint["surfaceType"];
  materialCategory: string;
  materialProductId: string;
  materialNameKo: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  observationId?: string;
  confidence: number;
  assemblyId?: string;
  partCode?: string;
  provenance?: { source: string; reference?: string; verifiedAt?: string };
}

type ConsumeFeature = "ai_render" | "image_unlock" | "drawing_option";

function mapVisionSurfaceToMaterialHint(
  surfaceType: VisionSurfaceType,
): MaterialHint["surfaceType"] {
  switch (surfaceType) {
    case "floor":
    case "wall":
    case "ceiling":
    case "door":
    case "window":
    case "lighting":
      return surfaceType;
    case "cabinet":
      return "built_in_furniture";
    case "countertop":
      return "counter";
    case "tile":
      return "wall";
    default:
      return "unknown";
  }
}

function isLivingRoom(roomKey: string, roomLabel?: string): boolean {
  return roomKey === "living" || /거실|living/i.test(roomLabel || "");
}

function renderUnlockKey(render: RenderItem, index: number): string {
  return render.timestamp || `render-${index}`;
}

function isRenderAccessible(
  roomKey: string,
  roomLabel: string | undefined,
  render: RenderItem | null | undefined,
  index: number,
  unlockedRenderKeys: Record<string, string[]> | undefined,
): boolean {
  if (!render) return false;
  if (isLivingRoom(roomKey, roomLabel) || render.accessState === "free") return true;
  if (render.accessState === "unlocked") return true;
  return (unlockedRenderKeys?.[roomKey] || []).includes(renderUnlockKey(render, index));
}

interface Props {
  rooms: string[];
  basicInfo: BasicInfoData;
  normalizedFloorplan?: NormalizedFloorplan;
  roomFurnishings?: Record<string, string[]>;
  /** 워크플로 진입 모드 — Step2 탭 분기 결정 */
  workflowEntry?: "apartment_drawing" | "photo_residential" | "photo_commercial";
  photoSpaceType?: string;
  commercialBusiness?: string;
  value: Step2Data;
  onChange: (next: Step2Data) => void;
  tokenBalance: number;
  onConsumeToken: (amount: number, feature: ConsumeFeature) => Promise<boolean>;
  onTokensChanged?: () => Promise<void> | void;
  onComplete: (finalValue?: Step2Data) => Promise<void> | void;
}

export default function Step2Designer({
  rooms,
  basicInfo,
  normalizedFloorplan,
  roomFurnishings,
  workflowEntry,
  photoSpaceType,
  commercialBusiness,
  value,
  onChange,
  tokenBalance,
  onConsumeToken,
  onTokensChanged,
  onComplete,
}: Props) {
  // 가이드: Step2 방 목록에서 베란다/드레스룸 제외 (이미지 생성 X). 단 견적 면적엔 포함.
  // 이유: 베란다/드레스룸은 일반적으로 Step2 인테리어 디자인 생성 대상이 아님.

  // P1: workflowEntry → projectMode 매핑 (design_outputs evidence 저장용)
  const currentProjectMode: ProjectMode =
    workflowEntry === "photo_residential"
      ? "photo_only"
      : workflowEntry === "photo_commercial"
        ? "commercial"
        : "apartment";

  // 사용자가 추가한 custom 실 (모드 무관, 모든 모드에서 +/- 가능)
  const [customTabs, setCustomTabs] = useState<Array<{ v: string; label: string; dimKey: string; icon: typeof Home }>>([]);
  const [showAddTabInput, setShowAddTabInput] = useState(false);
  const [newTabLabel, setNewTabLabel] = useState("");

  // ROOM_TABS — 진입 모드별 분기 + 사용자 custom 합산 (MD plan §3-3)
  const ROOM_TABS = useMemo(() => {
    const base = (() => {
      if (workflowEntry === "photo_commercial") {
        const key = commercialBusiness || "other_commercial";
        return COMMERCIAL_ZONE_TABS_BY_BUSINESS[key] || COMMERCIAL_ZONE_TABS_BY_BUSINESS.other_commercial;
      }
      if (workflowEntry === "photo_residential") {
        return PHOTO_RESIDENTIAL_TABS;
      }
      return APARTMENT_ROOM_TABS;
    })();
    return [...base, ...customTabs];
  }, [workflowEntry, commercialBusiness, customTabs]);

  const addCustomTab = () => {
    const label = newTabLabel.trim();
    if (!label) return;
    const v = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCustomTabs((prev) => [
      ...prev,
      { v, label, dimKey: "거실", icon: Layers },
    ]);
    setNewTabLabel("");
    setShowAddTabInput(false);
  };

  const removeCustomTab = (v: string) => {
    setCustomTabs((prev) => prev.filter((t) => t.v !== v));
  };

  const availableTabs = useMemo(
    () => ROOM_TABS.filter((t) => !RENDER_EXCLUDED.includes(t.v)),
    [ROOM_TABS],
  );
  // Step1에서 선택한 방 = 진행 카운트의 분모 (베란다/드레스룸 제외). 비어있거나 "all"이면 모든 렌더 대상.
  const selectedRoomKeys = useMemo(() => {
    const allRenderable = availableTabs
      .filter((t) => t.v !== "all")
      .map((t) => t.v);
    if (rooms.length === 0 || rooms.includes("all")) return allRenderable;
    return rooms.filter((r) => r !== "all" && !RENDER_EXCLUDED.includes(r));
  }, [rooms, availableTabs]);

  const [activeRoom, setActiveRoom] = useState<string>(() => {
    // 견적 화면에서 돌아왔거나 저장된 디자인을 복원한 경우, 빈 "전체" 탭보다
    // 생성 이미지가 있는 첫 실을 바로 열어 자재 수정 버튼이 즉시 보이게 한다.
    const generatedRoom = availableTabs.find(
      (tab) => tab.v !== "all" && (value.rendersByRoom[tab.v]?.length ?? 0) > 0,
    );
    return generatedRoom?.v ?? availableTabs[0]?.v ?? "living";
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimateTransitioning, setEstimateTransitioning] = useState(false);
  const [estimateTransitionProgress, setEstimateTransitionProgress] = useState(0);
  const [estimateTransitionError, setEstimateTransitionError] = useState<string | null>(null);
  const [finalSelectionOpen, setFinalSelectionOpen] = useState(false);
  const [finalSelectionDraft, setFinalSelectionDraft] = useState<Record<string, number>>({});
  // 가이드 STEP2-INPUT-ANALYSIS Q3 — 일괄 생성 직렬화 진행률
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; roomLabel: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Launch-critical (2026-05-11) — RenderRoomSpec 요약 (room별)
  const [renderSpecByRoom, setRenderSpecByRoom] = useState<
    Record<
      string,
      {
        explanationKo?: string;
        warnings: string[];
        confidence: number;
      }
    >
  >({});
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  // Phase 7 — Vision Material Picker 모달
  const [visionPickerOpen, setVisionPickerOpen] = useState(false);
  const [visionPickerRequest, setVisionPickerRequest] = useState<VisionMaterialAnalyzeRequest | null>(null);
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);
  const [openMaterialWhenReady, setOpenMaterialWhenReady] = useState(false);
  const [openRoomPopup, setOpenRoomPopup] = useState<string | null>(null);
  // 생성 결과는 상담 흐름을 가리지 않도록 기본적으로 우측 미니 썸네일로 연다.
  const [imageMinimized, setImageMinimized] = useState(true);
  const [unlockingImage, setUnlockingImage] = useState(false);
  // 채팅 모드 + 메시지는 local useState로 — 스트리밍 빈번 갱신 시 closure stale 회피
  // 정책 (대표 지시): default = chat 모드. 사용자는 AI와 대화 후 명시적으로
  // "이 컨셉으로 디자인 생성하기" 버튼을 눌러야 이미지 생성. 즉시생성은 토글로 옵션.
  // 상담과 이미지 수정은 하나의 공용 프롬프트가 문맥에 따라 자동 분기한다.
  const chatMode = true;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(value.chatMessages ?? []);
  const photoSourcesByRoom = useMemo(
    () =>
      mapPhotoSourcesToRooms({
        roomKeys: selectedRoomKeys,
        sourceImages: chatMessages
          .filter((message) => message.role === "user")
          .flatMap((message) => message.images || [])
          .map((image) => ({
            dataUrl: image.dataUrl,
            base64: image.base64,
            mediaType: image.mediaType === "image/gif" ? undefined : image.mediaType,
          })),
      }),
    [chatMessages, selectedRoomKeys],
  );
  const [chatStreaming, setChatStreaming] = useState(false);
  const [extractingPrompt, setExtractingPrompt] = useState(false);
  // 다음 user 메시지에 함께 보낼 첨부 이미지 (전송 후 초기화)
  const [pendingAttachments, setPendingAttachments] = useState<ChatImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const materialFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 부모(value)와 sync — 페이지 이탈 후 복원용. 단, 매 chunk마다 X (debounce).
  useEffect(() => {
    const t = setTimeout(() => {
      onChange({ ...value, chatMessages, chatMode });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, chatMode]);

  // chatMode가 default true(value.chatMode 미설정 시)로 시작될 때도 동일하게 인사
  // — 마운트 직후 1회 (chatMessages 비어있으면)
  useEffect(() => {
    if (chatMode && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "assistant",
          content:
            "안녕하세요! InPick 인테리어 상담 AI입니다 😊\n어떤 공간을 어떻게 꾸미고 싶으신가요? 자유롭게 말씀해 주세요.",
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 구형 자재 편집 화면을 다시 공개할 때만 SAM을 준비한다.
  useEffect(() => {
    if (!PARTIAL_MATERIAL_VIEW_ENABLED) return;
    fetch("/api/inpick/sam/warmup", { method: "POST" }).catch(() => {
      /* warmup은 사용자 차단 X */
    });
  }, []);

  // 진행률 게이지 — 0→90% 점진 증가, 응답 후 100%
  useEffect(() => {
    if (!generating) {
      if (progress > 0 && progress < 100) {
        setProgress(100);
        const t = setTimeout(() => setProgress(0), 800);
        return () => clearTimeout(t);
      }
      return;
    }
    setProgress(5);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      // 평균 응답 ~60s, 최악 280s 한도. 90% 도달 시점을 180s로 잡아 사용자 안심 유도
      const target = Math.min(90, (elapsed / 180) * 90);
      setProgress((p) => Math.max(p, target));
    }, 400);
    return () => clearInterval(interval);
  }, [generating, progress]);

  // 견적 화면 전환은 context finalize + 상태 저장으로 수 초가 걸릴 수 있다.
  // 즉시 피드백을 주고 92%에서 대기하다가 라우트 전환 시 unmount된다.
  useEffect(() => {
    if (!estimateTransitioning) {
      setEstimateTransitionProgress(0);
      return;
    }
    setEstimateTransitionProgress(8);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const target = elapsed < 900 ? 38 : elapsed < 2200 ? 68 : elapsed < 4200 ? 84 : 92;
      setEstimateTransitionProgress((current) => Math.max(current, target));
    }, 180);
    return () => window.clearInterval(timer);
  }, [estimateTransitioning]);

  const handleEstimateTransition = async (finalValue: Step2Data = value) => {
    if (estimateTransitioning) return;
    setEstimateTransitionError(null);
    setEstimateTransitioning(true);
    try {
      // 카드의 로딩 상태가 최소 한 프레임은 확실히 그려진 뒤 라우팅을 시작한다.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      try {
        sessionStorage.setItem("workflow_step2", JSON.stringify(lightenWorkflowStep2(finalValue)));
        sessionStorage.setItem("workflow_step", "2");
      } catch {
        /* private mode / quota */
      }
      await onComplete(finalValue);
      setEstimateTransitionProgress(100);
      // router.push 후 새 화면이 mount될 때까지 overlay를 유지한다.
    } catch (error) {
      setEstimateTransitioning(false);
      setEstimateTransitionError(
        error instanceof Error ? error.message : "견적 화면을 불러오지 못했습니다.",
      );
    }
  };

  // popup 외부 클릭 닫기
  useEffect(() => {
    if (!openRoomPopup) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-room-popup]") && !target.closest("[data-room-tab]")) {
        setOpenRoomPopup(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [openRoomPopup]);

  const roomDims: Record<string, RoomDim> = useMemo(() => {
    if (normalizedFloorplan?.rooms?.length) {
      const map: Record<string, RoomDim> = {};
      for (const r of normalizedFloorplan.rooms) {
        map[r.name] = {
          name: r.name,
          widthMm: r.widthMm,
          depthMm: r.depthMm,
          heightMm: r.heightMm,
        };
      }
      return map;
    }
    const area = basicInfo.selectedPyeong?.exclusiveArea;
    if (area) return estimateRoomDimsFromPyeong(area);
    return estimateRoomDimsFromPyeong("30평");
  }, [normalizedFloorplan, basicInfo.selectedPyeong?.exclusiveArea]);

  const pyeongLabel = useMemo(() => {
    const area = basicInfo.selectedPyeong?.exclusiveArea;
    return area ? classifyPyeong(area) : "30평";
  }, [basicInfo.selectedPyeong?.exclusiveArea]);

  // 진행 카운트 대상 — Step1 선택 방만 (없으면 전체)
  const realRoomTabs = useMemo(
    () => availableTabs.filter((t) => t.v !== "all" && selectedRoomKeys.includes(t.v)),
    [availableTabs, selectedRoomKeys],
  );
  const renders = value.rendersByRoom[activeRoom] || [];
  const currentPrompt =
    value.promptByRoom?.[GLOBAL_PROMPT_KEY] ?? value.promptByRoom?.[activeRoom] ?? "";
  const selectedIdx =
    value.selectedByRoom[activeRoom] ?? (renders.length > 0 ? renders.length - 1 : null);
  const activeRender = selectedIdx != null ? renders[selectedIdx] : null;
  const activeRenderKey =
    activeRender && selectedIdx != null ? renderUnlockKey(activeRender, selectedIdx) : null;
  const activeTab = availableTabs.find((tab) => tab.v === activeRoom);
  const promptWithKitchenSelections = (prompt: string, roomKey: string) => {
    const assembly = value.kitchenAssemblies?.[roomKey];
    const kitchenPrompt = assembly ? buildKitchenAssemblyRenderPrompt(assembly) : "";
    const roomCustomization = value.roomProductCustomizations?.[roomKey];
    const productPrompt = roomCustomization
      ? buildRoomProductPromptMarkdown(roomCustomization)
      : "";
    return [prompt, kitchenPrompt, productPrompt].filter(Boolean).join("\n\n");
  };
  const activeRoomName = activeTab?.label || activeRoom;
  const activeRoomProductKind = inferRoomProductKind(`${activeRoom} ${activeRoomName}`);
  const storedRoomProductCustomization: RoomProductCustomization =
    value.roomProductCustomizations?.[activeRoom] || {
      roomId: activeRoom,
      roomName: activeRoomName,
      roomKind: activeRoomProductKind,
      assemblyId: `room-products-${activeRoom}`,
      sourceRenderKey: activeRenderKey || undefined,
      selections: {},
    };
  const activeRoomProductCustomization: RoomProductCustomization = activeRenderKey
    ? bindRoomProductCustomizationToSource(storedRoomProductCustomization, activeRenderKey)
    : storedRoomProductCustomization;
  const searchRoomProductCatalog = async (
    partCode: RoomProductPartCode,
    query: string,
  ): Promise<readonly RoomCatalogProduct[]> => {
    const response = await fetch(
      `/api/inpick/room-product-catalog?roomKind=${encodeURIComponent(activeRoomProductCustomization.roomKind)}&partCode=${encodeURIComponent(partCode)}&q=${encodeURIComponent(query)}`,
    );
    const data = (await response.json()) as { products?: RoomCatalogProduct[]; error?: string };
    if (!response.ok) throw new Error(data.error || "CATALOG_QUERY_FAILED");
    return data.products || [];
  };
  const mapRoomProductSurface = (
    requirement: ReturnType<typeof buildRoomProductEstimateMapping>["requirements"][number],
  ): MaterialHint["surfaceType"] => {
    switch (requirement.targetSurface) {
      case "floor":
      case "wall":
      case "ceiling":
      case "window":
      case "door":
      case "counter":
        return requirement.targetSurface;
      case "cabinet":
        return "built_in_furniture";
      case "tile_wall":
        return "wall";
      case "fixture":
        return requirement.partCode === "main_lighting" ? "lighting" : "unknown";
      default:
        return "unknown";
    }
  };
  const updateRoomProductCustomization = (customization: RoomProductCustomization) => {
    const mapping = buildRoomProductEstimateMapping(customization);
    const roomProductPrefix = `${customization.roomId}::room-products-`;
    const materialSelections = Object.fromEntries(
      Object.entries(value.materialSelections || {}).filter(([key]) => !key.startsWith(roomProductPrefix)),
    ) as Record<string, SelectedEstimateMaterial>;
    for (const requirement of mapping.requirements) {
      materialSelections[requirement.selectionKey] = {
        roomId: requirement.roomId,
        roomName: requirement.roomName,
        surfaceType: mapRoomProductSurface(requirement),
        materialCategory: `room-product.${requirement.partCode}`,
        materialProductId: requirement.materialProductId,
        materialNameKo: requirement.materialNameKo,
        brand: requirement.brand,
        sku: requirement.sku,
        spec: requirement.spec,
        unit: requirement.unit,
        unitPrice: requirement.unitPrice,
        priceSource: requirement.provenance.reference,
        confidence: 1,
        assemblyId: requirement.assemblyId,
        partCode: requirement.partCode,
        provenance: requirement.provenance,
      };
    }
    onChange({
      ...value,
      roomProductCustomizations: {
        ...(value.roomProductCustomizations || {}),
        [customization.roomId]: customization,
      },
      materialSelections,
    });
  };

  useEffect(() => {
    const existing = value.roomProductCustomizations?.[activeRoom];
    if (!activeRenderKey || !existing || existing.sourceRenderKey === activeRenderKey) return;

    const rebound = bindRoomProductCustomizationToSource(existing, activeRenderKey);
    const mapping = buildRoomProductEstimateMapping(rebound);
    const roomProductPrefix = `${rebound.roomId}::room-products-`;
    const materialSelections = Object.fromEntries(
      Object.entries(value.materialSelections || {}).filter(([key]) => !key.startsWith(roomProductPrefix)),
    ) as Record<string, SelectedEstimateMaterial>;
    for (const requirement of mapping.requirements) {
      materialSelections[requirement.selectionKey] = {
        roomId: requirement.roomId,
        roomName: requirement.roomName,
        surfaceType: mapRoomProductSurface(requirement),
        materialCategory: `room-product.${requirement.partCode}`,
        materialProductId: requirement.materialProductId,
        materialNameKo: requirement.materialNameKo,
        brand: requirement.brand,
        sku: requirement.sku,
        spec: requirement.spec,
        unit: requirement.unit,
        unitPrice: requirement.unitPrice,
        priceSource: requirement.provenance.reference,
        confidence: 1,
        assemblyId: requirement.assemblyId,
        partCode: requirement.partCode,
        provenance: requirement.provenance,
      };
    }
    onChange({
      ...value,
      roomProductCustomizations: {
        ...(value.roomProductCustomizations || {}),
        [activeRoom]: rebound,
      },
      materialSelections,
    });
  }, [activeRenderKey, activeRoom, onChange, value]);
  const activeRoomIsLiving = isLivingRoom(activeRoom, activeTab?.label);
  const activeRenderUnlocked =
    activeRoomIsLiving ||
    (selectedIdx != null &&
      isRenderAccessible(
        activeRoom,
        activeTab?.label,
        activeRender,
        selectedIdx,
        value.unlockedRenderKeys,
      ));
  const hasGenerated = renders.length > 0;
  const allRoomsDecided = realRoomTabs.every((t) => (value.rendersByRoom[t.v] || []).length > 0);
  const firstGeneratedRoom = availableTabs.find(
    (tab) => tab.v !== "all" && (value.rendersByRoom[tab.v]?.length ?? 0) > 0,
  )?.v;
  const hasAnyGeneratedRender = !!firstGeneratedRoom;
  const finalSelectionRooms = useMemo(
    () =>
      availableTabs
        .filter((tab) => tab.v !== "all")
        .map((tab) => ({
          key: tab.v,
          label: tab.label,
          renders: (value.rendersByRoom[tab.v] || [])
            .map((render, index) => ({ ...render, selectionIndex: index }))
            .filter((render) =>
              isRenderAccessible(
                tab.v,
                tab.label,
                render,
                render.selectionIndex ?? 0,
                value.unlockedRenderKeys,
              ),
            ),
        }))
        .filter((room) => room.renders.length > 0),
    [availableTabs, value.rendersByRoom, value.unlockedRenderKeys],
  );

  const openFinalSelection = () => {
    if (finalSelectionRooms.length === 0) {
      setEstimateTransitionError("견적에 사용할 디자인 이미지를 먼저 생성해주세요.");
      return;
    }
    const draft: Record<string, number> = {};
    for (const room of finalSelectionRooms) {
      const selected = value.selectedByRoom[room.key];
      draft[room.key] =
        selected != null && room.renders[selected] ? selected : Math.max(0, room.renders.length - 1);
    }
    setFinalSelectionDraft(draft);
    setEstimateTransitionError(null);
    setFinalSelectionOpen(true);
  };

  const confirmFinalSelection = async (confirmedDraft: Record<string, number>) => {
    const selectedByRoom = { ...value.selectedByRoom };
    const finalSelectedImageUrlsByRoom: Record<string, string> = {};
    for (const room of finalSelectionRooms) {
      const selectedIndex = confirmedDraft[room.key];
      const render = room.renders[selectedIndex];
      if (!render) {
        setEstimateTransitionError(`${room.label}의 최종 이미지를 1장 선택해주세요.`);
        return;
      }
      selectedByRoom[room.key] = selectedIndex;
      finalSelectedImageUrlsByRoom[room.key] = render.refinedUrl || render.url;
    }
    const finalValue: Step2Data = {
      ...value,
      selectedByRoom,
      finalSelectedImageUrlsByRoom,
      finalSelectionConfirmedAt: new Date().toISOString(),
    };
    onChange(finalValue);
    setFinalSelectionOpen(false);
    await handleEstimateTransition(finalValue);
  };

  const openMaterialWorkspace = () => {
    if (activeRender && selectedIdx != null) {
      if (!activeRenderUnlocked) {
        setErrorMsg("잠긴 이미지를 먼저 1토큰으로 공개한 뒤 자재를 수정할 수 있습니다.");
        return;
      }
      setMaterialEditorOpen(true);
      return;
    }
    if (firstGeneratedRoom) {
      setOpenMaterialWhenReady(true);
      setActiveRoom(firstGeneratedRoom);
      setImageMinimized(false);
      return;
    }
    materialFileInputRef.current?.click();
  };

  const handleMaterialImageUpload = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg("자재 수정용 이미지는 12MB 이하로 올려주세요.");
      return;
    }
    const roomKey =
      activeRoom !== "all"
        ? activeRoom
        : realRoomTabs[0]?.v ?? availableTabs.find((tab) => tab.v !== "all")?.v ?? "living";
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const existing = value.rendersByRoom[roomKey] || [];
      const uploadedRender: RenderItem = {
        url: reader.result,
        prompt: "사용자가 부위별 자재 수정을 위해 업로드한 실내 이미지",
        costUsd: 0,
        timestamp: new Date().toISOString(),
      };
      setErrorMsg(null);
      setOpenMaterialWhenReady(true);
      setActiveRoom(roomKey);
      setImageMinimized(false);
      onChange({
        ...value,
        rendersByRoom: {
          ...value.rendersByRoom,
          [roomKey]: [...existing, uploadedRender],
        },
        selectedByRoom: {
          ...value.selectedByRoom,
          [roomKey]: existing.length,
        },
        unlockedRenderKeys: {
          ...(value.unlockedRenderKeys || {}),
          [roomKey]: [
            ...(value.unlockedRenderKeys?.[roomKey] || []),
            renderUnlockKey(uploadedRender, existing.length),
          ],
        },
      });
    };
    reader.onerror = () => setErrorMsg("이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.");
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (
      !openMaterialWhenReady ||
      !activeRender ||
      selectedIdx == null ||
      !activeRenderUnlocked
    ) return;
    setMaterialEditorOpen(true);
    setOpenMaterialWhenReady(false);
  }, [activeRender, activeRenderUnlocked, openMaterialWhenReady, selectedIdx]);

  // 채팅 히스토리 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renders.length, generating, chatMessages.length, chatStreaming]);

  const setPrompt = (text: string) => {
    onChange({
      ...value,
      promptByRoom: { ...(value.promptByRoom || {}), [GLOBAL_PROMPT_KEY]: text },
    });
  };

  // 평면도 정보 → 방별 창문/구조
  const inferStructure = (roomLabel: string) => {
    const interiorRooms = ["욕실", "드레스룸", "팬트리", "현관", "다용도실", "보일러실"];
    const exteriorRooms = ["거실", "안방", "침실", "주방", "발코니", "베란다", "다이닝"];
    const isInterior = interiorRooms.some((k) => roomLabel.includes(k));
    const isExterior = exteriorRooms.some((k) => roomLabel.includes(k));

    // 창문 + 문 통계 + wall 위치 정보
    let windows = 0;
    let doors = 0;
    const windowWalls: string[] = [];
    const doorWalls: string[] = [];
    if (normalizedFloorplan?.openings) {
      for (const op of normalizedFloorplan.openings) {
        if (!op.wall || !op.wall.includes(roomLabel)) continue;
        if (op.type === "window" || op.type === "sliding") {
          windows++;
          if (op.wall) windowWalls.push(op.wall);
        } else if (op.type === "door") {
          doors++;
          if (op.wall) doorWalls.push(op.wall);
        }
      }
    }
    if (windows === 0 && isExterior) windows = 1;

    // 인접 방 추출 — Vision 좌표 기반 단순 매칭
    const adjacentRooms: string[] = [];
    if (normalizedFloorplan?.rooms) {
      const me = normalizedFloorplan.rooms.find((r) => r.name === roomLabel);
      if (me) {
        for (const other of normalizedFloorplan.rooms) {
          if (other.name === me.name) continue;
          // openings.wall 텍스트에 두 방 이름이 같이 있으면 인접
          const sharedDoor = (normalizedFloorplan.openings || []).some(
            (op) => op.wall?.includes(me.name) && op.wall?.includes(other.name),
          );
          if (sharedDoor) adjacentRooms.push(other.name);
        }
      }
    }

    return {
      windows,
      doors,
      isInteriorRoom: isInterior,
      windowWalls,
      doorWalls,
      adjacentRooms,
    };
  };

  // 가이드 STEP2-INPUT-ANALYSIS §3-1 — 평면도 자연어 wall layout 빌더
  // 모델이 평면도 이미지 외에도 정확한 형태/벽 위치를 텍스트로 받아 보존률 ↑
  const buildWallLayout = (roomLabel: string): string => {
    if (!normalizedFloorplan?.rooms?.length) return "";
    const me = normalizedFloorplan.rooms.find((r) => r.name === roomLabel);
    if (!me) return "";

    const w = (me.widthMm / 1000).toFixed(2);
    const d = (me.depthMm / 1000).toFixed(2);
    const area = ((me.widthMm * me.depthMm) / 1_000_000).toFixed(1);
    const xMm = (me as { xMm?: number }).xMm;
    const yMm = (me as { yMm?: number }).yMm;

    // 벽별 opening 매핑 (남/북/동/서 또는 wall 이름 텍스트)
    const wallOpenings: Record<"north" | "south" | "east" | "west" | "other", string[]> = {
      north: [], south: [], east: [], west: [], other: [],
    };
    (normalizedFloorplan.openings || []).forEach((op) => {
      if (!op.wall || !op.wall.includes(roomLabel)) return;
      const wallText = op.wall;
      const opType = op.type === "window" || op.type === "sliding"
        ? `${op.type === "sliding" ? "sliding" : "fixed"} window`
        : "door";
      const widthM = op.widthMm ? `${(op.widthMm / 1000).toFixed(1)}m wide` : "";
      const desc = `${opType} (${widthM})`.trim();
      if (wallText.includes("남") || wallText.toLowerCase().includes("south")) wallOpenings.south.push(desc);
      else if (wallText.includes("북") || wallText.toLowerCase().includes("north")) wallOpenings.north.push(desc);
      else if (wallText.includes("동") || wallText.toLowerCase().includes("east")) wallOpenings.east.push(desc);
      else if (wallText.includes("서") || wallText.toLowerCase().includes("west")) wallOpenings.west.push(desc);
      else wallOpenings.other.push(`${desc} on ${wallText}`);
    });

    const wallLine = (dir: "north" | "south" | "east" | "west", length: string, isExterior: boolean) => {
      const ops = wallOpenings[dir];
      const opsText = ops.length > 0 ? `: ${ops.join(", ")}` : ": solid wall";
      const tag = isExterior ? " (EXTERIOR — windows allowed)" : " (interior partition)";
      return `  - ${dir.charAt(0).toUpperCase() + dir.slice(1)} wall (${length}m)${tag}${opsText}`;
    };

    // exterior 추정: 발코니/거실/안방/침실 = 외벽 가능, 욕실/드레스룸/현관 = 내벽
    const exteriorRooms = ["거실", "안방", "침실", "주방", "발코니", "베란다", "다이닝"];
    const isExterior = exteriorRooms.some((k) => roomLabel.includes(k));

    const hasExactFloorplanReference = Boolean(
      basicInfo.normalizedImageUrl ||
      basicInfo.cleanedImageUrl ||
      basicInfo.uploadedFloorplan?.dataUrl,
    );
    const lines = [
      hasExactFloorplanReference
        ? `Floor plan layout (reading from the user's floor-plan reference):`
        : `Estimated room layout (Korean apartment average derived from selected floor area; not a measured plan):`,
      `- Room shape: rectangular, ${w}m × ${d}m (${area}m² floor area)`,
      ...(xMm != null && yMm != null
        ? [`- Position in apartment: xMm=${xMm}, yMm=${yMm} (top-left corner)`]
        : []),
      `- Wall layout (4 walls clockwise from north):`,
      wallLine("north", w, false),
      wallLine("east", d, false),
      wallLine("south", w, isExterior),
      wallLine("west", d, false),
    ];

    return lines.join("\n");
  };

  // ── 채팅 첨부 이미지 핸들러 ──
  const readFileAsBase64 = (file: File) =>
    new Promise<{ base64: string; dataUrl: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("파일 읽기 실패"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return reject(new Error("이미지 형식이 올바르지 않습니다"));
        resolve({ base64: m[2], dataUrl });
      };
      reader.readAsDataURL(file);
    });

  const handlePickChatFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError(null);
    const MAX = 4;
    const MAX_BYTES = 8 * 1024 * 1024; // 8MB/장 (Anthropic 권장 한도)
    const accepted: ChatImageAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      if (pendingAttachments.length + accepted.length >= MAX) {
        setAttachmentError(`이미지는 최대 ${MAX}장까지 첨부할 수 있어요`);
        break;
      }
      const f = files[i];
      if (!f.type.startsWith("image/")) {
        setAttachmentError("이미지 파일만 첨부할 수 있어요");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setAttachmentError("8MB 이하의 이미지만 첨부할 수 있어요");
        continue;
      }
      const mt: ChatImageAttachment["mediaType"] =
        f.type === "image/png"
          ? "image/png"
          : f.type === "image/webp"
            ? "image/webp"
            : f.type === "image/gif"
              ? "image/gif"
              : "image/jpeg";
      try {
        const { base64, dataUrl } = await readFileAsBase64(f);
        accepted.push({ dataUrl, base64, mediaType: mt, fileName: f.name });
      } catch (e) {
        setAttachmentError(e instanceof Error ? e.message : "이미지 첨부 실패");
      }
    }
    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
    // 같은 파일 재선택 가능하게 input 초기화
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePromptImageEdit = async (
    editPrompt: string,
    roomKey: string,
    roomLabel: string,
    targetSurfaces: ReturnType<typeof routePromptToRoom>["targetSurfaces"],
  ) => {
    if (generating || chatStreaming) return;
    const roomRenders = value.rendersByRoom[roomKey] || [];
    const roomSelectedIndex =
      value.selectedByRoom[roomKey] ?? (roomRenders.length > 0 ? roomRenders.length - 1 : null);
    const sourceRender = roomSelectedIndex != null ? roomRenders[roomSelectedIndex] : null;
    if (!sourceRender) return;
    if (tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: editPrompt };
    const workingMessage: ChatMessage = {
      role: "assistant",
      content: `${roomLabel}의 현재 선택 이미지에서 요청한 부분만 수정하고 있어요.`,
    };
    setActiveRoom(roomKey);
    setImageMinimized(true);
    setErrorMsg(null);
    setPendingAttachments([]);
    setChatMessages([...chatMessages, userMessage, workingMessage]);
    setGenerating(true);
    setChatStreaming(true);

    try {
      const sourceUrl = sourceRender.refinedUrl || sourceRender.url;
      const response = await fetch("/api/inpick/render-space-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage: sourceUrl.startsWith("data:") ? { dataUrl: sourceUrl } : { url: sourceUrl },
          editPrompt,
          preserveGeometry: true,
          targetSurfaces: targetSurfaces.length > 0 ? targetSurfaces : undefined,
          analyzeSurfaces: false,
          quality: "low",
          projectId: getOrCreateWorkflowProjectId(),
          targetId: roomKey,
          targetNameKo: roomLabel,
          spaceType: roomLabel,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.hint || data.error || "이미지 수정에 실패했습니다.");
      }

      const editedRender: RenderItem = {
        url: data.imageUrl,
        prompt: editPrompt,
        revisedPrompt: data.prompt,
        costUsd: data.costUsd ?? 0.01,
        timestamp: new Date().toISOString(),
        metadata: sourceRender.metadata,
      };
      const nextRenders = [...roomRenders, editedRender];
      const nextIndex = nextRenders.length - 1;
      const nextMessages: ChatMessage[] = [
        ...chatMessages,
        userMessage,
        {
          role: "assistant",
          content: `${roomLabel} 수정 시안을 만들었습니다. 새 이미지는 왼쪽 ${roomLabel} 카테고리에 추가했어요.`,
        },
      ];
      const sourceCustomization = value.roomProductCustomizations?.[roomKey];
      const sourceRenderKey = renderUnlockKey(sourceRender, roomSelectedIndex as number);
      const editedRenderKey = renderUnlockKey(editedRender, nextIndex);
      const carriedCustomization = sourceCustomization
        ? carryRoomProductCustomizationToSource(
            bindRoomProductCustomizationToSource(sourceCustomization, sourceRenderKey),
            editedRenderKey,
          )
        : undefined;
      const nextValue: Step2Data = {
        ...value,
        rendersByRoom: { ...value.rendersByRoom, [roomKey]: nextRenders },
        selectedByRoom: { ...value.selectedByRoom, [roomKey]: nextIndex },
        roomProductCustomizations: {
          ...(value.roomProductCustomizations || {}),
          ...(carriedCustomization ? { [roomKey]: carriedCustomization } : {}),
        },
        generations: {
          ...value.generations,
          [roomKey]: (value.generations[roomKey] ?? 0) + 1,
        },
        promptByRoom: { ...(value.promptByRoom || {}), [GLOBAL_PROMPT_KEY]: "" },
        unlockedRenderKeys: {
          ...(value.unlockedRenderKeys || {}),
          [roomKey]: [
            ...(value.unlockedRenderKeys?.[roomKey] || []),
            renderUnlockKey(editedRender, nextIndex),
          ],
        },
        chatMessages: nextMessages,
        chatMode: true,
      };
      setChatMessages(nextMessages);
      onChange(nextValue);
      void saveDesignOutputAfterRender({
        projectMode: currentProjectMode,
        targetType: currentProjectMode === "commercial" ? "zone" : "room",
        targetId: roomKey,
        targetName: roomLabel,
        renderKind: "space_edit",
        imageUrl: data.imageUrl,
        prompt: data.prompt || editPrompt,
      });
      void onTokensChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMsg(message);
      setChatMessages([
        ...chatMessages,
        userMessage,
        { role: "assistant", content: `${roomLabel} 이미지 수정에 실패했습니다. ${message}` },
      ]);
    } finally {
      setGenerating(false);
      setChatStreaming(false);
    }
  };

  // ── 채팅 모드 핸들러 ──
  const handleChatSend = async () => {
    const hasText = !!currentPrompt.trim();
    const hasImages = pendingAttachments.length > 0;
    if ((!hasText && !hasImages) || chatStreaming) return;
    setErrorMsg(null);
    setAttachmentError(null);
    // 텍스트가 비어있는데 이미지만 있으면 기본 안내 텍스트 자동 삽입
    const userText = hasText
      ? currentPrompt.trim()
      : hasImages
        ? "이 사진처럼 꾸미고 싶어요. 어떻게 추천해주실래요?"
        : "";
    const promptRoute = routePromptToRoom(
      userText,
      availableTabs.map((tab) => ({ key: tab.v, label: tab.label })),
      activeRoom,
      new Set(
        Object.entries(value.rendersByRoom)
          .filter(([, roomRenders]) => roomRenders.length > 0)
          .map(([roomKey]) => roomKey),
      ),
    );
    if (!hasImages && promptRoute.shouldEditExistingImage) {
      await handlePromptImageEdit(
        userText,
        promptRoute.roomKey,
        promptRoute.roomLabel,
        promptRoute.targetSurfaces,
      );
      return;
    }
    const userMsg: ChatMessage = {
      role: "user",
      content: userText,
      images: hasImages ? [...pendingAttachments] : undefined,
    };
    const next = [...chatMessages, userMsg];
    setChatMessages([...next, { role: "assistant", content: "" }]);
    setPrompt("");
    setPendingAttachments([]);
    setChatStreaming(true);
    try {
      const res = await fetch("/api/inpick/design-chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images?.map((img) => ({
              data: img.base64,
              mediaType: img.mediaType,
            })),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error + (err.hint ? ` → ${err.hint}` : ""));
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("스트리밍 응답 없음");
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(chunk, { stream: true });
        // SSE event delimiter는 빈 줄 (\n\n) — 그 단위로 자르고 안에서 data: 라인만 추출.
        // 텍스트 안에 \n이 들어와도 split("\n")로 깨지지 않도록 서버가 JSON으로 인코딩해서 보냄.
        const events = buf.split("\n\n");
        buf = events.pop() || "";
        for (const ev of events) {
          // 한 event 내 여러 data: 라인이 있을 수 있음 (Anthropic 표준)
          for (const line of ev.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            // 신규 형식: JSON {text: "..."} (줄바꿈 안전)
            // 호환: 옛 raw 텍스트도 fallback (JSON.parse 실패 시 그대로)
            let txt = "";
            try {
              const j = JSON.parse(data);
              txt = typeof j.text === "string" ? j.text : "";
            } catch {
              txt = data;
            }
            if (!txt) continue;
            acc += txt;
            setChatMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = { role: "assistant", content: acc };
              return u;
            });
          }
        }
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      // 빈 placeholder 제거
      setChatMessages((prev) => {
        const u = [...prev];
        if (u[u.length - 1]?.role === "assistant" && !u[u.length - 1].content) u.pop();
        return u;
      });
    } finally {
      setChatStreaming(false);
    }
  };

  // 사진/상가 모드: 도면 없을 때 단일 이미지 생성 (render-photo-style)
  // MD plan §5-1, §6 — propertyId 없는 사용자가 render-room에 잘못 태워지는 것 차단
  const handlePhotoStyleGenerate = async (stylePrompt: string) => {
    const fallbackKey = activeRoom === "all" ? "living" : activeRoom;
    const fallbackTab = ROOM_TABS.find((tab) => tab.v === fallbackKey);
    const targets = currentProjectMode === "photo_only" && activeRoom === "all"
      ? realRoomTabs.filter((tab) => (value.rendersByRoom[tab.v] || []).length === 0)
      : fallbackTab
        ? [fallbackTab]
        : [];
    if (targets.length === 0) {
      setErrorMsg("선택한 모든 공간의 디자인이 이미 생성되어 있습니다.");
      return;
    }
    const requiresLivingCharge = targets.some((tab) => isLivingRoom(tab.v, tab.label));
    if (requiresLivingCharge && tokenBalance < 5) {
      setInsufficientOpen(true);
      return;
    }

    setGenerating(true);
    setProgress(0);
    setErrorMsg(null);
    setBulkProgress(targets.length > 1 ? { current: 0, total: targets.length, roomLabel: "" } : null);
    try {
      const areaM2 = basicInfo.selectedPyeong?.exclusiveArea;
      const budgetTier =
        basicInfo.expansionType === "extended"
          ? "premium"
          : basicInfo.budget && basicInfo.budget >= 5000
            ? "standard"
            : "basic";
      const projectId = getOrCreateWorkflowProjectId();
      const next: Step2Data = {
        ...value,
        rendersByRoom: { ...value.rendersByRoom },
        selectedByRoom: { ...value.selectedByRoom },
        generations: { ...value.generations },
        conceptPrompt: value.conceptPrompt || stylePrompt,
      };
      const failures: string[] = [];

      for (let index = 0; index < targets.length; index += 1) {
        const targetTab = targets[index];
        const targetKey = targetTab.v;
        const roomStylePrompt = promptWithKitchenSelections(stylePrompt, targetKey);
        const targetIsLiving = isLivingRoom(targetKey, targetTab.label);
        setBulkProgress(targets.length > 1
          ? { current: index + 1, total: targets.length, roomLabel: targetTab.label }
          : null);
        const photoSource = currentProjectMode === "photo_only" ? photoSourcesByRoom[targetKey] : undefined;
        const residentialGuard = photoSpaceType
          ? `${photoSpaceType} 주거 유형과 원본 사진의 구조·개구부·시점·면적감을 유지하고 더 큰 아파트로 바꾸지 마세요. `
          : "";
        const furnishingOptions = roomFurnishings?.[targetKey] || [];
        const furnishingText = formatPhotoFurnishingRequirements(furnishingOptions).join(", ");
        const requiredPartsPrompt = furnishingText
          ? `필수 부품을 서로 구분해서 보존하세요: ${furnishingText}. `
          : "";
        const lockedDelivery = targetIsLiving
          ? undefined
          : {
              projectId,
              projectMode: currentProjectMode === "commercial" ? "commercial" as const : "photo_only" as const,
              targetType: currentProjectMode === "commercial" ? "zone" as const : "room" as const,
              targetId: targetKey,
              targetName: targetTab.label,
              renderKind: photoSource ? "space_edit" as const : "room_render" as const,
              unlockCost: 1 as const,
              prompt: roomStylePrompt,
            };
        try {
          const response = await fetch(
            photoSource ? "/api/inpick/render-space-edit" : "/api/inpick/render-photo-style",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                photoSource
                  ? {
                      sourceImage: photoSource,
                      editPrompt: `${residentialGuard}${requiredPartsPrompt}${targetTab.label}: ${roomStylePrompt}`,
                      preserveGeometry: true,
                      analyzeSurfaces: false,
                      projectId,
                      targetId: targetKey,
                      targetNameKo: targetTab.label,
                      spaceType: targetTab.label,
                      budgetTier,
                      quality: "low",
                      lockedDelivery,
                    }
                  : {
                      projectMode: currentProjectMode === "commercial" ? "commercial" : "photo_only",
                      stylePrompt: roomStylePrompt,
                      spaceType: targetTab.label,
                      residentialType: currentProjectMode === "photo_only" ? photoSpaceType : undefined,
                      businessType: commercialBusiness,
                      zoneName: currentProjectMode === "commercial" ? targetTab.label : undefined,
                      areaM2,
                      budgetTier,
                      furnishingOptions,
                      quality: "low",
                      lockedDelivery,
                    },
              ),
            },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.hint || data.error || "이미지 생성 실패");
          const item: RenderItem = {
            url: typeof data.imageUrl === "string" ? data.imageUrl : "",
            lockedAssetId: data.asset?.id,
            accessState: data.asset ? "locked" : "free",
            prompt: roomStylePrompt,
            revisedPrompt: data.prompt,
            costUsd: data.costUsd ?? 0.01,
            timestamp: new Date().toISOString(),
          };
          const roomRenders = [...(next.rendersByRoom[targetKey] || []), item];
          next.rendersByRoom[targetKey] = roomRenders;
          next.selectedByRoom[targetKey] = roomRenders.length - 1;
          next.generations[targetKey] = (next.generations[targetKey] ?? 0) + 1;
          if (!data.asset && data.imageUrl) {
            void saveDesignOutputAfterRender({
              projectMode: currentProjectMode,
              targetType: currentProjectMode === "commercial" ? "zone" : "room",
              targetId: targetKey,
              targetName: targetTab.label,
              renderKind: currentProjectMode === "commercial" ? "zone_render" : "room_render",
              imageUrl: data.imageUrl,
              prompt: data.prompt || roomStylePrompt,
            });
          }
        } catch (error) {
          failures.push(`${targetTab.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      onChange(next);
      if (targets.some((target) => (next.rendersByRoom[target.v] || []).length > 0)) {
        setImageMinimized(true);
      }
      setProgress(100);
      await onTokensChanged?.();
      if (failures.length > 0) {
        setErrorMsg(`일부 공간 실패: ${failures.slice(0, 2).join(" / ")}`);
      }
    } finally {
      setBulkProgress(null);
      setGenerating(false);
    }
  };

  const handleChatToImage = async () => {
    if (chatMessages.length === 0 || extractingPrompt || generating) return;
    setErrorMsg(null);
    setExtractingPrompt(true);
    try {
      // 이미지 attachment의 base64/data URL은 prompt 추출에 필요하지 않다.
      // text-only로 제한해 Vercel 413 plain-text 응답과 JSON parse crash를 방지한다.
      const data = await extractDesignPrompt(chatMessages);
      // 모드 분기 — workflowEntry 명시적으로만 결정 (MD §3 silent fallback 금지)
      // MD plan §0 — photo_only/commercial은 절대 render-room 호출 X
      const hasSpatialBasis =
        !!basicInfo.floorplanPropertyId ||
        !!basicInfo.normalizedImageUrl ||
        !!basicInfo.uploadedFloorplan?.dataUrl ||
        Number(basicInfo.selectedPyeong?.exclusiveArea || 0) > 0;
      const explicitPhotoMode =
        workflowEntry === "photo_residential" || workflowEntry === "photo_commercial";

      if (explicitPhotoMode) {
        await handlePhotoStyleGenerate(data.image_prompt);
        return;
      }
      // 주소·평형 또는 업로드 도면 중 최소 하나는 있어야 공간 크기를 정할 수 있다.
      if (!hasSpatialBasis) {
        setErrorMsg(
          "아파트 디자인에는 주소·평형 또는 업로드 도면이 필요합니다.\n" +
            "Step1로 돌아가 평형을 선택하거나 직접 입력해주세요.",
        );
        return;
      }
      // 아파트 도면 모드 — 방별 일괄 생성
      await handleBulkGenerate(data.image_prompt);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setExtractingPrompt(false);
    }
  };

  const handleGenerate = async (promptOverride?: string) => {
    const promptToUse = (promptOverride ?? currentPrompt).trim();
    if (!promptToUse) {
      setErrorMsg("프롬프트를 입력해주세요. 예: '모던 미니멀, 화이트 + 라이트 우드'");
      return;
    }
    // "전체" 탭에서는 모든 방에 일괄 생성
    if (activeRoom === "all") {
      setPrompt("");
      await handleBulkGenerate(promptToUse);
      return;
    }
    setErrorMsg(null);

    const isFirstGen = renders.length === 0;
    const tab = ROOM_TABS.find((t) => t.v === activeRoom)!;
    const roomIsLiving = isLivingRoom(activeRoom, tab?.label);
    const roomPromptToUse = promptWithKitchenSelections(promptToUse, activeRoom);
    const requiredTokens = roomIsLiving ? 5 : 1;
    if (tokenBalance < requiredTokens) {
      setInsufficientOpen(true);
      return;
    }

    setGenerating(true);
    try {
      const dim = roomDims[tab.dimKey] || roomDims["거실"];
      const struct = inferStructure(tab.label);
      const wallLayout = buildWallLayout(tab.label);  // 가이드 Q1 — 자연어 wall layout
      // 2차+ 시 이전 생성의 revisedPrompt를 reference로 — 같은 방 형태 유지 유도
      const previousRender = renders[renders.length - 1];
      const previousReference =
        !isFirstGen && previousRender
          ? previousRender.revisedPrompt || previousRender.prompt
          : undefined;
      // 가이드 Q2 — 1차 low (빠름 + 저비용 1차 미리보기). 고화질은 별도 재렌더 버튼(refine-render)에서 처리.
      const quality: "low" | "medium" | "high" = "low";
      // 클라 측 AbortController — Vercel 300초 + 여유 20초
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 320_000);
      const floorplanReferenceUrl =
        basicInfo.normalizedImageUrl ||
        basicInfo.cleanedImageUrl ||
        basicInfo.uploadedFloorplan?.dataUrl;
      const renderBody: RenderRoomBody = {
        roomName: tab.label,
        widthMm: dim.widthMm,
        depthMm: dim.depthMm,
        heightMm: dim.heightMm,
        style: roomPromptToUse,
        expansion: basicInfo.expansionType === "extended",
        size: "1024x1024",
        quality,                                          // Q2 — 1차 low / 재생성 high
        windows: struct.windows,
        doors: struct.doors,
        isInteriorRoom: struct.isInteriorRoom,
        windowWalls: struct.windowWalls,
        doorWalls: struct.doorWalls,
        adjacentRooms: struct.adjacentRooms,
        wallLayout,                                       // Q1 — 자연어 도면 묘사
        furnishingOptions: roomFurnishings?.[activeRoom] || [],
        // 도면 기반 정보 강화
        aspectRatio: dim.widthMm / dim.depthMm,
        isFromFloorplan: !!floorplanReferenceUrl,
        // 가이드 §3 — propertyId로 Storage normalized.png 자동 로드
        propertyId: basicInfo.floorplanPropertyId,
        floorplanImageUrl: floorplanReferenceUrl,
        previousReference,
      };
      // Phase 9 — sync/async 자동 처리 (jobId 응답 시 polling)
      const result = await renderRoomViaClient(renderBody, {
        signal: ctrl.signal,
        postTimeoutMs: 320_000,
      });
      clearTimeout(timeoutId);
      if ("error" in result) {
        const baseMsg = result.error || "이미지 생성 실패";
        const hintMsg = result.hint ? `\n→ ${result.hint}` : "";
        throw new Error(`${baseMsg}${hintMsg}\n(요금이 발생하지 않았습니다)`);
      }
      const item: RenderItem = {
        url: result.imageUrl,
        prompt: roomPromptToUse,
        revisedPrompt: result.revisedPrompt,
        costUsd: result.costUsd ?? 0.19,
        timestamp: new Date().toISOString(),
        // P6-4: render-room이 채워준 도면 기반 메타 그대로 RenderItem에 저장
        metadata: result.metadata,
      };
      // P1: 견적 evidence 저장 (실패해도 워크플로 막지 않음)
      void saveDesignOutputAfterRender({
        projectMode: currentProjectMode,
        targetType: currentProjectMode === "commercial" ? "zone" : "room",
        targetId: activeRoom,
        targetName: tab.label,
        renderKind:
          currentProjectMode === "commercial" ? "zone_render" : "room_render",
        imageUrl: result.imageUrl,
        prompt: result.revisedPrompt || roomPromptToUse,
      });
      // Launch-critical: renderSpec 응답 저장
      if (result.renderSpec) {
        setRenderSpecByRoom((prev) => ({
          ...prev,
          [activeRoom]: {
            explanationKo: result.renderSpec!.explanationKo,
            warnings: result.renderSpec!.warnings || [],
            confidence: result.renderSpec!.confidence,
          },
        }));
      }
      const nextRenders = [...renders, item];
      const nextRenderKey = renderUnlockKey(item, nextRenders.length - 1);
      onChange({
        ...value,
        rendersByRoom: { ...value.rendersByRoom, [activeRoom]: nextRenders },
        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: nextRenders.length - 1 },
        generations: {
          ...value.generations,
          [activeRoom]: (value.generations[activeRoom] ?? 0) + 1,
        },
        conceptPrompt: value.conceptPrompt || promptToUse,
        unlockedRenderKeys: roomIsLiving
          ? value.unlockedRenderKeys
          : {
              ...(value.unlockedRenderKeys || {}),
              [activeRoom]: [
                ...(value.unlockedRenderKeys?.[activeRoom] || []),
                nextRenderKey,
              ],
            },
        promptByRoom: { ...(value.promptByRoom || {}), [GLOBAL_PROMPT_KEY]: "" },
      });
      await onTokensChanged?.();
      setImageMinimized(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async (conceptPrompt: string) => {
    const emptyTabs = realRoomTabs
      .filter((tab) => (value.rendersByRoom[tab.v] || []).length === 0)
      .sort((left, right) => Number(isLivingRoom(right.v, right.label)) - Number(isLivingRoom(left.v, left.label)));
    if (emptyTabs.length === 0) {
      setErrorMsg("선택한 모든 공간의 디자인이 이미 생성되어 있습니다.");
      return;
    }
    const requiresLivingCharge = emptyTabs.some((tab) => isLivingRoom(tab.v, tab.label));
    if (requiresLivingCharge && tokenBalance < 5) {
      setInsufficientOpen(true);
      return;
    }
    setErrorMsg(null);
    setGenerating(true);
    setBulkProgress({ current: 0, total: emptyTabs.length, roomLabel: "" });
    try {
      // 가이드 Q3 — 직렬 호출 (Promise.allSettled 동시 호출 → rate limit 위험 → 직렬화)
      // 가이드 Q2 — 일괄은 quality "low" (1차 미리보기 — 빠름 + 저비용)
      const results: Array<
        | { tabKey: string; ok: true; item: RenderItem }
        | { tabKey: string; ok: false; error: string; label: string }
      > = [];

      for (let i = 0; i < emptyTabs.length; i++) {
        const tab = emptyTabs[i];
        const roomConceptPrompt = promptWithKitchenSelections(conceptPrompt, tab.v);
        setBulkProgress({ current: i + 1, total: emptyTabs.length, roomLabel: tab.label });
        try {
          const dim = roomDims[tab.dimKey] || roomDims["거실"];
          const struct = inferStructure(tab.label);
          const wallLayout = buildWallLayout(tab.label);  // Q1
          const ctrl = new AbortController();
          const timeoutId = setTimeout(() => ctrl.abort(), 320_000);
          const floorplanReferenceUrl =
            basicInfo.normalizedImageUrl ||
            basicInfo.cleanedImageUrl ||
            basicInfo.uploadedFloorplan?.dataUrl;
          const tabIsLiving = isLivingRoom(tab.v, tab.label);
          const bulkBody: RenderRoomBody = {
            roomName: tab.label,
            widthMm: dim.widthMm,
            depthMm: dim.depthMm,
            heightMm: dim.heightMm,
            style: roomConceptPrompt,
            expansion: basicInfo.expansionType === "extended",
            size: "1024x1024",
            quality: "low",                              // Q2 — 1차 low
            windows: struct.windows,
            doors: struct.doors,
            isInteriorRoom: struct.isInteriorRoom,
            windowWalls: struct.windowWalls,
            doorWalls: struct.doorWalls,
            adjacentRooms: struct.adjacentRooms,
            wallLayout,                                  // Q1
            aspectRatio: dim.widthMm / dim.depthMm,
            isFromFloorplan: !!floorplanReferenceUrl,
            furnishingOptions: roomFurnishings?.[tab.v] || [],
            propertyId: basicInfo.floorplanPropertyId,
            floorplanImageUrl: floorplanReferenceUrl,
            lockedDelivery: tabIsLiving
              ? undefined
              : {
                  projectId: getOrCreateWorkflowProjectId(),
                  projectMode: "apartment",
                  targetType: "room",
                  targetId: tab.v,
                  targetName: tab.label,
                  renderKind: "room_render",
                  unlockCost: 1,
                  prompt: roomConceptPrompt,
                },
          };
          // Phase 9 — sync/async 자동 처리 (jobId 응답 시 polling)
          const result = await renderRoomViaClient(bulkBody, {
            signal: ctrl.signal,
            postTimeoutMs: 320_000,
          });
          clearTimeout(timeoutId);
          if ("error" in result) {
            results.push({
              tabKey: tab.v,
              ok: false,
              error: `${result.error || "이미지 생성 실패"}${result.hint ? ` → ${result.hint}` : ""}`,
              label: tab.label,
            });
          } else {
            results.push({
              tabKey: tab.v,
              ok: true,
              item: {
                url: result.imageUrl,
                lockedAssetId: result.lockedAsset?.id,
                accessState: result.lockedAsset ? "locked" : "free",
                prompt: roomConceptPrompt,
                revisedPrompt: result.revisedPrompt,
                costUsd: result.costUsd ?? 0.01,            // low quality 기본 $0.01
                timestamp: new Date().toISOString(),
                // P6-4: 도면 기반 생성 메타 패스스루
                metadata: result.metadata,
              } as RenderItem,
            });
            // 잠긴 결과는 private 등록 과정에서 design_output도 함께 생성된다.
            if (!result.lockedAsset) void saveDesignOutputAfterRender({
              projectMode: currentProjectMode,
              targetType: currentProjectMode === "commercial" ? "zone" : "room",
              targetId: tab.v,
              targetName: tab.label,
              renderKind:
                currentProjectMode === "commercial" ? "zone_render" : "room_render",
              imageUrl: result.imageUrl,
              prompt: result.revisedPrompt || roomConceptPrompt,
            });
          }
        } catch (e) {
          results.push({
            tabKey: tab.v,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            label: tab.label,
          });
        }
      }
      setBulkProgress(null);
      // ─── 결과 누적 ───
      const next = { ...value };
      next.rendersByRoom = { ...next.rendersByRoom };
      next.selectedByRoom = { ...next.selectedByRoom };
      next.generations = { ...next.generations };
      next.promptByRoom = { ...(next.promptByRoom || {}) };
      next.conceptPrompt = conceptPrompt;
      const failures: string[] = [];
      for (const r of results) {
        if (r.ok) {
          const list = [...(next.rendersByRoom[r.tabKey] || []), r.item];
          next.rendersByRoom[r.tabKey] = list;
          next.selectedByRoom[r.tabKey] = list.length - 1;
          next.generations[r.tabKey] = (next.generations[r.tabKey] ?? 0) + 1;
        } else {
          failures.push(`${r.label}: ${r.error}`);
        }
      }
      onChange(next);
      if (results.some((result) => result.ok)) setImageMinimized(true);
      await onTokensChanged?.();
      if (failures.length > 0) {
        setErrorMsg(`일부 방 실패: ${failures.slice(0, 2).join(" / ")}`);
      }
    } finally {
      setGenerating(false);
      setBulkProgress(null);
    }
  };

  const handleUnlockActiveImage = async () => {
    if (activeRoom === "all" || activeRoomIsLiving || unlockingImage) return;
    // 서버 자산은 기존 grant가 있으면 charged=false로 URL만 재발급한다.
    // 로컬 잔액으로 먼저 막으면 이미 결제한 사용자가 이미지를 복원할 수 없다.
    if (!activeRender?.lockedAssetId && tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }

    setUnlockingImage(true);
    setErrorMsg(null);
    try {
      if (!activeRender || selectedIdx == null || !activeRenderKey) {
        const prompt =
          value.conceptPrompt ||
          currentPrompt.trim() ||
          "거실과 동일한 2026 컨템포러리 인테리어 컨셉";
        await handleGenerate(prompt);
        return;
      }

      if (activeRender.lockedAssetId) {
        const unlockResponse = await fetch(
          `/api/inpick/locked-design/assets/${encodeURIComponent(activeRender.lockedAssetId)}/unlock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotencyKey: `unlock:${activeRender.lockedAssetId}`,
            }),
          },
        );
        const unlockData = (await unlockResponse.json().catch(() => ({}))) as {
          url?: string;
          expiresAt?: string;
          error?: string;
          hint?: string;
        };
        if (!unlockResponse.ok || !unlockData.url) {
          if (unlockResponse.status === 402) setInsufficientOpen(true);
          throw new Error(unlockData.hint || unlockData.error || "이미지 잠금 해제에 실패했습니다.");
        }
        const nextRenders = [...renders];
        nextRenders[selectedIdx] = {
          ...activeRender,
          url: unlockData.url,
          accessState: "unlocked",
          entitlementGranted: true,
          viewExpiresAt: unlockData.expiresAt,
        };
        onChange({
          ...value,
          rendersByRoom: { ...value.rendersByRoom, [activeRoom]: nextRenders },
        });
        setImageMinimized(true);
        await onTokensChanged?.();
        return;
      }

      const ok = await onConsumeToken(1, "image_unlock");
      if (!ok) {
        setInsufficientOpen(true);
        return;
      }
      const currentKeys = value.unlockedRenderKeys?.[activeRoom] || [];
      onChange({
        ...value,
        unlockedRenderKeys: {
          ...(value.unlockedRenderKeys || {}),
          [activeRoom]: currentKeys.includes(activeRenderKey)
            ? currentKeys
            : [...currentKeys, activeRenderKey],
        },
      });
      setImageMinimized(true);
      await onTokensChanged?.();
    } finally {
      setUnlockingImage(false);
    }
  };

  const updateRender = (idx: number, updated: RenderItem) => {
    const next = [...renders];
    next[idx] = updated;
    onChange({
      ...value,
      rendersByRoom: { ...value.rendersByRoom, [activeRoom]: next },
    });
  };

  const completedCount = realRoomTabs.filter(
    (t) => (value.rendersByRoom[t.v] || []).length > 0,
  ).length;
  const totalCount = realRoomTabs.length;

  return (
    // 기존 InPick 순백색 레이아웃: 사이드바와 메인 캔버스 모두 white
    // 채팅 무한 늘어남 X — 화면 높이 고정, 메시지 영역만 스크롤
    <div className="grid min-h-[calc(100vh-180px)] items-stretch gap-3 rounded-[26px] bg-white p-3 lg:grid-cols-[268px_1fr]">
      {/* ─── 좌측 툴바 (순백색) ─── */}
      <aside className="flex flex-col gap-3">
        {/* 대표 거실 디자인 생성 — 좌측 상단 (방 선택 위) */}
        <div className="rounded-2xl border border-black/[0.07] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-black">
            대표 거실 디자인 생성
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  // 가이드: 자동 생성 X — 프리셋 클릭 시 프롬프트에만 추가, 사용자가 직접 생성 클릭
                  setPrompt(
                    currentPrompt ? `${currentPrompt}, ${preset}` : preset,
                  );
                }}
                disabled={generating}
                className="rounded-lg border border-black/[0.07] bg-white px-2 py-1.5 text-[0.7rem] font-semibold text-black/60 transition hover:bg-zinc-50 hover:text-black disabled:opacity-30"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.65rem] leading-snug text-black/38">
            컨셉 선택 후 거실 1장을 먼저 생성 · 5토큰
          </p>
        </div>

        {/* 방 선택 */}
        <div className="rounded-2xl border border-black/[0.07] bg-white p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-black">방 선택</p>
            <span className="text-[0.6rem] tabular text-black/38">{pyeongLabel}</span>
          </div>
          <div className="space-y-1">
            {availableTabs.map((t) => {
              const isAll = t.v === "all";
              const sel = activeRoom === t.v;
              const count = (value.rendersByRoom[t.v] || []).length;
              const decided = !isAll && count > 0;
              const tabIsLiving = isLivingRoom(t.v, t.label);
              const tabSelectedIndex =
                value.selectedByRoom[t.v] ?? (count > 0 ? count - 1 : null);
              const tabSelectedRender =
                tabSelectedIndex != null ? value.rendersByRoom[t.v]?.[tabSelectedIndex] : null;
              const tabUnlocked =
                tabIsLiving ||
                (!!tabSelectedRender &&
                  (value.unlockedRenderKeys?.[t.v] || []).includes(
                    renderUnlockKey(tabSelectedRender, tabSelectedIndex ?? 0),
                  ));
              // Step1에서 선택한 방인지
              const isSelectedInStep1 = isAll || selectedRoomKeys.includes(t.v);
              const Icon = t.icon;
              // 현재 생성 중인 방인지 — bulk면 진행중 방, 단건이면 active room
              const isGeneratingThis = generating && (
                bulkProgress
                  ? bulkProgress.roomLabel === t.label
                  : sel
              );
              return (
                <div key={t.v} className="relative group">
                  <button
                    data-room-tab
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRoom(t.v);
                      setImageMinimized(true);
                      // "전체" 탭은 popup 비활성화 (전체 컨셉 입력용)
                      if (isAll) {
                        setOpenRoomPopup(null);
                      } else {
                        setOpenRoomPopup(openRoomPopup === t.v ? null : t.v);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all ${
                      isGeneratingThis
                        ? "animate-pulse bg-black text-white ring-2 ring-black/10 ring-offset-1"
                        : sel
                        ? isAll
                          ? "bg-black text-white"
                          : "bg-black text-white"
                        : isAll
                          ? "border border-black/[0.08] bg-white text-black hover:bg-zinc-50"
                          : isSelectedInStep1
                            ? "bg-white text-black/58 hover:bg-black/[0.035] hover:text-black"
                            : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </span>
                    {isGeneratingThis ? (
                      <span className="inline-flex items-center gap-1 rounded bg-white/25 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        생성중
                      </span>
                    ) : !isAll && !tabUnlocked ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] font-bold ${
                          sel ? "bg-white/20 text-white" : "bg-black/[0.05] text-black/45"
                        }`}
                      >
                        <Lock className="h-2.5 w-2.5" /> 1
                      </span>
                    ) : decided ? (
                      <span
                        className={`text-[0.6rem] font-bold tabular px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                          sel ? "bg-white/25 text-white" : "bg-white text-black"
                        }`}
                      >
                        <Check className="h-2 w-2" strokeWidth={3} />
                        {count}
                      </span>
                    ) : null}
                  </button>
                  {/* custom 탭은 삭제 X 버튼 표시 */}
                  {t.v.startsWith("custom_") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomTab(t.v);
                        if (sel) setActiveRoom(availableTabs[0]?.v ?? "living");
                      }}
                      className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black shadow"
                      title="실 삭제"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {/* popup — 클릭 토글만, "전체" 제외 */}
                  <AnimatePresence>
                    {!isAll && openRoomPopup === t.v && (
                      <motion.div
                        data-room-popup
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="absolute left-0 top-full mt-2 sm:left-full sm:top-0 sm:ml-3 sm:mt-0 z-30 min-w-[200px] max-w-[80vw] rounded-xl border border-black/10 bg-white p-3 shadow-card-hover"
                      >
                        <div className="hidden sm:block absolute left-0 top-3 -translate-x-1 h-2 w-2 rotate-45 bg-white border-l border-b border-black/10" />
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-black">{t.label}</p>
                          <button onClick={() => setOpenRoomPopup(null)}>
                            <X className="h-3 w-3 text-black/40 hover:text-black" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-black">
                          {count > 0 ? (
                            <>
                              <span className="text-black">{count}</span>
                              <span className="text-black/50 ml-1">장 생성됨</span>
                            </>
                          ) : (
                            <span className="text-black/40">아직 미생성</span>
                          )}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-black/60 tabular">
                          치수 ·{" "}
                          {(() => {
                            const d = roomDims[t.dimKey];
                            return d ? `${d.widthMm}×${d.depthMm}×${d.heightMm}mm` : "—";
                          })()}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {/* 사용자 실 추가 — 모든 모드 공통 */}
            {showAddTabInput ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1.5">
                <input
                  type="text"
                  value={newTabLabel}
                  onChange={(e) => setNewTabLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomTab();
                    if (e.key === "Escape") {
                      setShowAddTabInput(false);
                      setNewTabLabel("");
                    }
                  }}
                  placeholder="실 이름 입력 (예: 서재, 다용도실)"
                  autoFocus
                  className="flex-1 rounded border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-black/30"
                />
                <button
                  type="button"
                  onClick={addCustomTab}
                  className="rounded bg-black px-2 py-1 text-xs font-bold text-white hover:bg-black/75"
                >
                  추가
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTabInput(true)}
                className="w-full rounded-lg border border-dashed border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/48 hover:bg-black/[0.035] hover:text-black"
              >
                + 실 추가
              </button>
            )}
          </div>
        </div>

        {/* 보유 토큰 */}
        <div className="rounded-2xl border border-black/[0.07] bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-black">보유 토큰</p>
            <span className="text-lg tabular font-semibold text-black">
              ⬢ {tokenBalance}
            </span>
          </div>
          <p className="mt-1 text-[0.65rem] leading-snug text-black/38">
            거실 5 · 추가 공간/부분 수정 1토큰
          </p>
        </div>

        {/* 생성 결과 유무와 관계없이 항상 보이는 자재 수정 진입점 */}
        {PARTIAL_MATERIAL_VIEW_ENABLED && <div className="rounded-2xl border border-black/[0.07] bg-white p-3">
          <input
            ref={materialFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              handleMaterialImageUpload(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <div className="flex items-start gap-2">
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-black">
              <Crosshair className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-black">부위별 자재 선택·수정</p>
              <p className="mt-0.5 text-[0.64rem] leading-snug text-black/42">
                바닥·벽을 클릭해 경계를 확인하고 원하는 자재로 변경
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openMaterialWorkspace}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-extrabold text-black shadow-sm transition hover:bg-zinc-50"
          >
            {hasAnyGeneratedRender ? (
              <>
                <Crosshair className="h-3.5 w-3.5" /> 자재 수정 화면 열기
              </>
            ) : (
              <>
                <ImagePlus className="h-3.5 w-3.5" /> 사진 올려서 바로 테스트
              </>
            )}
          </button>
          {hasAnyGeneratedRender && (
            <button
              type="button"
              onClick={() => materialFileInputRef.current?.click()}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[0.65rem] font-bold text-black hover:bg-zinc-50"
            >
              다른 사진 업로드
            </button>
          )}
          <p className="mt-2 text-center text-[0.58rem] font-medium text-black/35">
            영역 선택 무료 · 실제 자재 재렌더 2토큰
          </p>
        </div>}

        {/* 진행 상황 — 견적 요청 시 카드 전체가 전환 상태로 바뀐다. */}
        <motion.div
          layout
          className={`relative mt-auto min-h-[154px] overflow-hidden rounded-2xl border p-3 shadow-sm transition-colors duration-300 ${
            estimateTransitioning
              ? "border-black bg-black text-white shadow-[0_14px_35px_rgba(0,0,0,0.16)]"
              : "border-black/[0.07] bg-white"
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {estimateTransitioning ? (
              <motion.div
                key="estimate-loading"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[128px] flex-col items-center justify-center text-center"
              >
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-4 border-white/25" />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-white border-r-white"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-sm font-extrabold">견적 화면으로 이동 중</p>
                <p className="mt-1 text-[0.67rem] font-medium text-white/80">
                  실별 최종 선택 이미지를 견적에 연결하고 있어요
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    animate={{ width: `${estimateTransitionProgress}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="estimate-ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-black">진행 상황</p>
                  <span className="text-[0.65rem] tabular font-bold text-black">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedCount / Math.max(1, totalCount)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-black"
                  />
                </div>
                <button
                  type="button"
                  onClick={openFinalSelection}
                  disabled={!hasAnyGeneratedRender}
                  className={`relative z-10 mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-full bg-black px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-black/75 ${
                    allRoomsDecided ? "ring-2 ring-black/10" : ""
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  {allRoomsDecided ? "최종 이미지 선택 → 견적" : "생성한 실만 선택 → 견적"}
                  <ChevronRight className="h-3 w-3" />
                </button>
                {estimateTransitionError && (
                  <p className="mt-2 text-center text-[0.68rem] font-semibold text-danger-text">
                    {estimateTransitionError} 다시 시도해 주세요.
                  </p>
                )}
                <p className="mt-1.5 text-center text-[0.62rem] leading-snug text-black/35">
                  실마다 최종 시안 1장을 고른 뒤 견적서로 이동합니다.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </aside>

      {/* ─── 메인 캔버스: 순백색 ─── */}
      <section className="relative flex flex-col">
        <div className="relative flex max-h-[calc(100vh-220px)] min-h-[480px] flex-1 flex-col overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          {/* Step1 선택 정보 — 캔버스 최상단 (주소/단지/평형/면적/확장형/예산) */}
          {(basicInfo.selectedAddress || basicInfo.selectedComplex || basicInfo.selectedPyeong) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/[0.06] bg-white px-5 py-2 text-[0.7rem] text-black/55">
              {basicInfo.selectedAddress?.roadAddress && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-black/40">주소</span>
                  <span className="font-medium text-black">
                    {basicInfo.selectedAddress.roadAddress}
                  </span>
                </span>
              )}
              {basicInfo.selectedComplex?.complexName && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-black/40">단지</span>
                  <span className="font-medium text-black">
                    {basicInfo.selectedComplex.complexName}
                  </span>
                </span>
              )}
              {basicInfo.selectedPyeong && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-black/40">평형</span>
                  <span className="font-medium text-black">
                    {basicInfo.selectedPyeong.pyeongName}형 · {basicInfo.selectedPyeong.exclusiveArea}㎡
                  </span>
                </span>
              )}
              {basicInfo.expansionType && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-black/40">발코니</span>
                  <span className="font-medium text-black">
                    {basicInfo.expansionType === "extended" ? "확장형" : "기본형"}
                  </span>
                </span>
              )}
              {typeof basicInfo.budget === "number" && basicInfo.budget > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-black/40">예산</span>
                  <span className="font-medium text-black">
                    {basicInfo.budget.toLocaleString()}만원
                  </span>
                </span>
              )}
            </div>
          )}
          {/* Launch-critical: RenderRoomSpec 요약 (active room 기준) */}
          {(() => {
            const spec = renderSpecByRoom[activeRoom];
            if (!spec) return null;
            const lowConf = spec.confidence < 0.7;
            return (
              <div
                className={`px-5 py-2 border-b text-[0.7rem] ${
                  lowConf
                    ? "bg-white border-black/10 text-black"
                    : "bg-white border-black/10 text-black"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded bg-white/70 border border-current/20 px-1.5 py-0.5 font-bold">
                    도면 인식 {Math.round(spec.confidence * 100)}%
                  </span>
                  {spec.explanationKo && (
                    <span className="font-medium">{spec.explanationKo}</span>
                  )}
                </div>
                {spec.warnings.length > 0 && (
                  <div className="mt-1 text-[0.65rem] opacity-80">
                    ⚠ {spec.warnings.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>
            );
          })()}
          {/* 채팅 헤더 (단조롭게 — 캡처 레퍼런스 스타일) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] bg-white px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-black shrink-0" />
              <p className="truncate text-sm font-semibold text-black">
                전체 공간 · AI 디자인 프롬프트
              </p>
              <span className="hidden sm:inline text-[0.65rem] text-black/50 tabular ml-1">
                {activeRoom === "all" ? `${realRoomTabs.length}개 방` : (
                  (() => {
                    const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                    const d = tab ? roomDims[tab.dimKey] : null;
                    return d ? `${(d.widthMm/1000).toFixed(1)}×${(d.depthMm/1000).toFixed(1)}m` : "—";
                  })()
                )}
              </span>
            </div>
            <p className="text-[0.68rem] text-black/45">
              실 이름을 적으면 해당 이미지로 자동 연결 · 예) 안방 문을 오크로 바꿔줘
            </p>
          </div>

          {/* 채팅 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!hasGenerated && !generating && !(chatMode && chatMessages.length > 0) && (
              <div className="h-full flex items-center justify-center min-h-[40vh]">
                <div className="text-center max-w-md">
                  <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black mb-4">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-black">
                    {chatMode
                      ? "어떤 공간을 꾸미고 싶으세요?"
                      : activeRoom === "all"
                        ? "전체 컨셉을 한 번에 만들어볼까요?"
                        : "무엇을 만들고 싶으세요?"}
                  </h3>
                  <p className="mt-2 text-sm text-black/60 leading-relaxed">
                    {chatMode ? (
                      <>
                        AI 상담사와 4~5턴 대화하면 핵심 정보를 모아
                        <br />
                        <span className="font-bold text-black">한번에 디자인을 생성</span>해
                        드립니다.
                      </>
                    ) : activeRoom === "all" ? (
                      <>
                        먼저 <span className="font-bold text-black">거실 대표 이미지 1장</span>을
                        생성합니다.
                        <br />
                        다른 공간은 원하는 이미지만 1토큰으로 열 수 있어요.
                      </>
                    ) : (
                      <>
                        스타일·자재·분위기를 자유롭게 적어주세요.
                        <br />
                        또는 좌측{" "}
                        <span className="font-bold text-black">전체 인테리어 이미지 한번에 생성</span>{" "}
                        프리셋을 클릭하세요.
                      </>
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    {STYLE_PRESETS.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(currentPrompt ? `${currentPrompt}, ${p}` : p)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-50 hover:border-black/10"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI 상담 메시지 (chatMode 일 때, 텍스트 + 이미지 첨부 대화) */}
            {chatMode && chatMessages.map((m, i) => (
              <div
                key={`chat-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-md rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden ${
                    m.role === "user"
                      ? "bg-black text-white rounded-tr-sm"
                      : "bg-white text-black rounded-tl-sm border border-black/10"
                  }`}
                >
                  {/* 첨부 이미지 (user 메시지) */}
                  {m.role === "user" && m.images && m.images.length > 0 && (
                    <div
                      className={`flex flex-wrap gap-1.5 px-2 pt-2 ${
                        m.content ? "" : "pb-2"
                      }`}
                    >
                      {m.images.map((img, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={img.dataUrl}
                          alt={img.fileName || `attached-${idx}`}
                          className="h-28 w-28 object-cover rounded-lg border border-white/40"
                        />
                      ))}
                    </div>
                  )}
                  {/* 텍스트 본문 */}
                  {(m.content || (chatStreaming && i === chatMessages.length - 1)) && (
                    <div className="whitespace-pre-wrap px-4 py-2.5">
                      {m.content || "…"}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMode && chatStreaming && chatMessages[chatMessages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white border border-black/10 px-4 py-2.5 text-sm text-black/70 inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI 상담 중…
                </div>
              </div>
            )}

            {/* 채팅 히스토리 — 사용자 prompt + AI 이미지 응답 */}
            {renders.map((r, i) => (
              <div key={i} className="space-y-2">
                {/* 사용자 메시지 — 내부 기술 프롬프트는 숨기고 친화적 라벨로 대체 */}
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl rounded-tr-sm bg-black text-white px-4 py-2.5 text-sm shadow-sm">
                    {isInternalRenderPrompt(r.prompt) ? "AI 추천 스타일로 디자인 생성" : r.prompt}
                  </div>
                </div>
                {/* AI 응답 (작은 미리보기) */}
                <div className="flex justify-start">
                  <button
                    onClick={() => {
                      const prev = value.selectedByRoom[activeRoom];
                      onChange({
                        ...value,
                        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: i },
                      });
                      setImageMinimized(false);
                      // 연구용 행동 데이터 — 시안 선택/변경 (개인정보 없음)
                      trackClientEvent(AnalyticsEvents.DesignConceptSelected, {
                        props: {
                          room_type: activeRoom,
                          selected_index: i,
                          total_options: renders.length,
                          changed_from: typeof prev === "number" ? prev : null,
                          is_change: typeof prev === "number" && prev !== i,
                        },
                      });
                    }}
                    className={`group relative rounded-2xl rounded-tl-sm overflow-hidden border-2 transition-all ${
                      i === selectedIdx
                        ? "border-black/10 ring-2 ring-black/10"
                        : "border-black/10 hover:border-black/10"
                    }`}
                  >
                    <img
                      src={r.refinedUrl || r.url}
                      alt={`design-${i}`}
                      className="block w-56 h-56 object-cover"
                    />
                    <div className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-bold tabular text-black backdrop-blur">
                      #{String(i + 1).padStart(2, "0")}
                    </div>
                    {r.refinedUrl && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-black px-2 py-0.5 text-[0.6rem] font-bold text-white">
                        ✓ HD
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* 생성 중 — 게이지 */}
            {generating && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white border border-black/10 px-5 py-4 max-w-md">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    <p className="text-sm font-bold text-black">
                      {bulkProgress
                        ? `${bulkProgress.roomLabel || "방"} 생성 중… (${bulkProgress.current}/${bulkProgress.total})`
                        : "AI 디자인 생성 중…"}
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                    <motion.div
                      animate={{
                        width: bulkProgress
                          ? `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%`
                          : `${progress}%`,
                      }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-black to-black"
                    />
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-black/60">
                    {bulkProgress ? (
                      <>
                        <span className="tabular font-bold">{bulkProgress.current}/{bulkProgress.total}</span> 방 완료
                      </>
                    ) : (
                      <>
                        <span className="tabular font-bold">{Math.round(progress)}%</span> · 인테리어 이미지 생성 중
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* AI 상담 모드 — '디자인 생성' 액션 영역 (chatMode 진입 시 항상 노출) */}
          {chatMode && (() => {
            const userTurns = chatMessages.filter((m) => m.role === "user").length;
            const canGenerate = userTurns >= 1 && !extractingPrompt && !generating && !chatStreaming;
            const helperText = userTurns === 0
              ? "AI와 1턴 이상 대화한 뒤 활성화됩니다"
              : userTurns < 3
                ? `대화 ${userTurns}/3턴 진행 — 더 대화하면 정확도 ↑ (지금 생성도 가능)`
                : "대화 충분 — 언제든 디자인 생성 가능";
            return (
              <div className="px-4 py-3 border-t border-black/10 bg-white">
                <button
                  type="button"
                  onClick={handleChatToImage}
                  disabled={!canGenerate}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-base font-bold shadow-cta transition-all ${
                    canGenerate
                      ? "bg-gradient-to-r from-black to-black text-white hover:opacity-95 ring-2 ring-black/10"
                      : "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {extractingPrompt ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      상담 내용 정리 중…
                    </>
                  ) : generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      이미지 생성 중…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      이 컨셉으로 디자인 생성하기
                      {userTurns > 0 && (
                        <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">
                          {userTurns}턴
                        </span>
                      )}
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-[0.7rem] text-black/70 text-center">
                  💡 {helperText}
                </p>
              </div>
            );
          })()}

          {/* 하단 sticky prompt bar — 캡처 레퍼런스 스타일 (둥근, 가운데, 단색) */}
          <div className="border-t border-black/10 bg-white p-4">
            {/* 첨부 이미지 미리보기 (chat 모드에서만) */}
            {chatMode && pendingAttachments.length > 0 && (
              <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-black/10 bg-white shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={img.fileName || `pending-${idx}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(idx)}
                      className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white shadow ring-2 ring-white"
                      aria-label="첨부 제거"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {chatMode && attachmentError && (
              <p className="mx-auto max-w-3xl mb-2 text-[0.7rem] text-black flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {attachmentError}
              </p>
            )}
            {/* 참고 사진 첨부 안내 (chat 모드, 첨부 없을 때) — 업로드 가능함을 명확히 */}
            {chatMode && pendingAttachments.length === 0 && (
              <p className="mx-auto max-w-3xl mb-1.5 flex items-center gap-1.5 text-[0.7rem] text-black/50">
                <ImagePlus className="h-3.5 w-3.5 text-black" />
                마음에 드는 인테리어 사진을 첨부하면 AI가 더 정확하게 추천해요 — 클립을 누르거나 여기로 끌어다 놓으세요
              </p>
            )}
            <div
              className={`mx-auto max-w-3xl flex items-end gap-2 rounded-2xl transition ${
                isDraggingFile && chatMode ? "ring-2 ring-black/10 ring-offset-2 bg-white" : ""
              }`}
              onDragOver={(e) => {
                if (!chatMode) return;
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                if (!chatMode) return;
                e.preventDefault();
                setIsDraggingFile(false);
                if (e.dataTransfer.files?.length) void handlePickChatFiles(e.dataTransfer.files);
              }}
            >
              {/* 이미지 첨부 (chat 모드 전용) */}
              {chatMode && (
                <>
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePickChatFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    disabled={chatStreaming || pendingAttachments.length >= 4}
                    className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm hover:bg-zinc-50 disabled:opacity-40 transition"
                    aria-label="사진 첨부"
                    title="사진 첨부 (최대 4장 · 8MB 이하)"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="flex-1 rounded-full border border-black/10 bg-white px-5 py-3 shadow-sm focus-within:border-black/10 focus-within:ring-2 focus-within:ring-black/10">
                <textarea
                  value={currentPrompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (chatMode) handleChatSend();
                      else handleGenerate();
                    }
                  }}
                  placeholder={pendingAttachments.length > 0
                    ? "이 사진처럼 꾸며줘 — 원하는 분위기·요청사항을 적어주세요"
                    : "상담 또는 수정 요청 — 예) 안방 문만 밝은 오크로 바꿔줘"}
                  rows={hasGenerated || chatMode ? 1 : 2}
                  className="w-full resize-none bg-transparent text-sm text-black outline-none placeholder:text-black/40"
                />
              </div>
              <button
                type="button"
                onClick={chatMode ? handleChatSend : () => void handleGenerate()}
                disabled={
                  chatMode
                    ? generating || chatStreaming || (!currentPrompt.trim() && pendingAttachments.length === 0)
                    : generating || !currentPrompt.trim()
                }
                aria-label={chatMode ? "메시지 전송" : "이미지 생성"}
                className={`shrink-0 inline-flex items-center justify-center rounded-full text-white shadow-md hover:opacity-95 disabled:opacity-30 transition-all ${
                  chatMode
                    ? "h-12 w-12 bg-gradient-to-br from-black to-black"
                    : "h-12 gap-1.5 bg-gradient-to-br from-black to-black px-5 text-sm font-bold"
                }`}
              >
                {chatMode ? (
                  chatStreaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )
                ) : generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeRoom === "all" ? (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>거실 생성</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[0.6rem] font-bold inline-flex items-center gap-0.5">
                      <Hexagon className="h-2.5 w-2.5 fill-white/30" />5
                    </span>
                  </>
                ) : renders.length === 0 ? (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>{activeRoomIsLiving ? "거실 생성" : "이미지 열기"}</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[0.6rem] font-bold inline-flex items-center gap-0.5">
                      <Hexagon className="h-2.5 w-2.5 fill-white/30" />{activeRoomIsLiving ? 5 : 1}
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>새 이미지 생성</span>
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[0.6rem] font-bold inline-flex items-center gap-0.5">
                      <Hexagon className="h-2.5 w-2.5 fill-black" />{activeRoomIsLiving ? 5 : 1}
                    </span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-black leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* 생성 중 캔버스 오버레이 — 큰 placeholder + 진행률 + 이전 이미지 흐림 */}
          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-3 rounded-2xl overflow-hidden bg-white border-2 border-black/10 shadow-2xl pointer-events-auto"
                style={{ zIndex: 25 }}
              >
                {/* 이전 이미지 (있으면 흐림 배경으로) */}
                {activeRender && (
                  <img
                    src={activeRender.refinedUrl || activeRender.url}
                    alt="previous"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-110"
                  />
                )}
                {/* shimmer 오버레이 */}
                <div className="absolute inset-0 pointer-events-none">
                  <motion.div
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                </div>
                {/* 중앙 카드 */}
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-black to-black text-white shadow-cta"
                    >
                      <Sparkles className="h-10 w-10" />
                    </motion.div>
                    <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-black">
                      {bulkProgress
                        ? `${bulkProgress.roomLabel || "방"} AI 디자인 생성 중`
                        : "AI 디자인 생성 중"}
                    </h3>
                    <p className="mt-2 text-sm text-black/70 leading-relaxed">
                      {bulkProgress ? (
                        <>
                          대표 거실 이미지를 생성하고 있습니다.
                          <br />
                          <span className="font-bold text-black tabular">
                            {bulkProgress.current}/{bulkProgress.total}
                          </span>
                          {" "}완료 — 잠시만 기다려주세요.
                        </>
                      ) : (
                        <>
                          평면도·자재·치수를 분석해서
                          <br />
                          <span className="font-bold text-black">고해상도 인테리어 이미지</span>를 만들고 있어요.
                        </>
                      )}
                    </p>
                    <div className="mt-6 mx-auto max-w-xs">
                      <div className="h-2.5 rounded-full bg-white/80 overflow-hidden shadow-inner border border-black/10">
                        <motion.div
                          animate={{
                            width: bulkProgress
                              ? `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%`
                              : `${progress}%`,
                          }}
                          transition={{ duration: 0.4 }}
                          className="h-full bg-gradient-to-r from-black to-black"
                        />
                      </div>
                      <p className="mt-2 text-xs font-bold tabular text-black">
                        {bulkProgress
                          ? `${Math.round((bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}%`
                          : `${Math.round(progress)}%`}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-center gap-1.5 text-[0.7rem] text-black/60">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>보통 20~40초 소요</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 풀스크린 이미지 오버랩 (선택된 시안 큰 보기) */}
          <AnimatePresence>
            {activeRender && activeRenderUnlocked && !imageMinimized && hasGenerated && !generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="absolute inset-3 rounded-2xl overflow-hidden bg-white border border-black/10 shadow-2xl pointer-events-auto"
                style={{ zIndex: 20 }}
              >
                <button
                  onClick={() => setImageMinimized(true)}
                  className="absolute top-3 right-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-black/10 text-black hover:bg-zinc-50 shadow"
                  title="우측으로 작게"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                {PARTIAL_MATERIAL_VIEW_ENABLED && <button
                  type="button"
                  onClick={() => setMaterialEditorOpen(true)}
                  className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-extrabold text-black shadow-xl ring-2 ring-white/80 transition hover:bg-zinc-50 hover:scale-[1.02]"
                >
                  <Crosshair className="h-4 w-4" />
                  부위별 자재 수정
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[0.62rem] text-black">재렌더 2토큰</span>
                </button>}
                <img
                  src={activeRender.refinedUrl || activeRender.url}
                  alt="design"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {activeRender.refinedUrl && (
                  <div className="absolute top-3 left-3 rounded-full bg-black px-2.5 py-1 text-[0.7rem] font-bold text-white shadow">
                    ✓ 고화질 재렌더
                  </div>
                )}
                {/* P6-4: 도면 기반 생성됨 배지 — 사용자가 신뢰도 확인 가능 */}
                {activeRender.metadata?.floorplanUsed && (
                  <div
                    className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[0.7rem] font-bold text-white shadow"
                    title={`도면 기반 생성 (${activeRender.metadata.renderSpecKind ?? "spec"}${
                      activeRender.metadata.renderSpecConfidence
                        ? ` · 신뢰도 ${Math.round(activeRender.metadata.renderSpecConfidence * 100)}%`
                        : ""
                    })`}
                  >
                    🏗️ 도면 기반
                    {activeRender.metadata.renderSpecConfidence && (
                      <span className="ml-0.5 opacity-80">
                        · {Math.round(activeRender.metadata.renderSpecConfidence * 100)}%
                      </span>
                    )}
                  </div>
                )}
                {activeRender.metadata?.renderSpecKind === "text_only" &&
                  !activeRender.metadata?.floorplanUsed && (
                    <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[0.7rem] font-bold text-white shadow">
                      ⚠️ 도면 없이 생성됨
                    </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 거실 외 이미지는 1장 단위로 불투명 블라인드 처리 후 1토큰으로 공개 */}
          <AnimatePresence>
            {activeRoom !== "all" &&
              !activeRoomIsLiving &&
              (!activeRender || !activeRenderUnlocked) &&
              !generating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-3 z-40 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
                >
                  <div className="absolute inset-0 opacity-50">
                    <div className="absolute left-[8%] top-[12%] h-[50%] w-[55%] rounded-[32px] bg-white blur-xl" />
                    <div className="absolute bottom-[10%] right-[8%] h-[42%] w-[48%] rounded-full bg-black/10 blur-2xl" />
                  </div>
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-md" />
                  <div className="relative flex h-full items-center justify-center p-6 text-center">
                    <div className="w-full max-w-sm rounded-[24px] border border-black/10 bg-white/95 p-6 shadow-xl">
                      <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
                        <Lock className="h-4 w-4" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-black">
                        {activeTab?.label || "추가 공간"} 디자인
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-black/52">
                        {activeRender?.entitlementGranted
                          ? "이미 결제한 이미지입니다. 추가 과금 없이 다시 불러옵니다."
                          : activeRender
                          ? "이미지가 준비되어 있습니다. 1토큰으로 선명하게 공개할 수 있어요."
                          : "거실과 같은 컨셉으로 이 공간 이미지를 만들고 바로 공개합니다."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleUnlockActiveImage()}
                        disabled={unlockingImage}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/75 disabled:opacity-50"
                      >
                        {unlockingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        {activeRender?.entitlementGranted
                          ? "결제한 이미지 다시 보기"
                          : activeRender
                            ? "1토큰으로 이미지 보기"
                            : "1토큰으로 생성하고 보기"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>

        {/* 우측 미니 thumbnail (minimized 상태) */}
        <AnimatePresence>
          {imageMinimized && activeRender && activeRenderUnlocked && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => setImageMinimized(false)}
              className="fixed right-6 top-24 z-30 h-32 w-32 rounded-xl border-2 border-black/10 overflow-hidden shadow-2xl bg-white hover:scale-105 transition-transform"
              title="중앙 큰 보기로"
            >
              <img
                src={activeRender.refinedUrl || activeRender.url}
                alt="mini"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-black">
                <Maximize2 className="h-2.5 w-2.5" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[0.6rem] font-bold p-1 text-center">
                클릭해서 크게 보기
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 자재 수정 (세그멘테이션) — 선택된 시안 아래. 잠금 시 준비 중 안내로 대체 */}
        {PARTIAL_MATERIAL_VIEW_ENABLED && activeRender && selectedIdx != null && hasGenerated && activeRenderUnlocked && (
          PARTIAL_MATERIAL_VIEW_ENABLED ? (
            <div className="mt-4">
              {/* Phase 7 — Vision Material Picker trigger (이미지 전체 분석 → Top-3 후보) */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVisionPickerRequest({
                      projectId: getOrCreateWorkflowProjectId(),
                      roomId: activeRoom,
                      roomName: ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom,
                      roomType: activeRoom,
                      imageUrl: activeRender.url,
                      sourceImageKind: "ai_render",
                    });
                    setVisionPickerOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-black to-black text-white text-xs font-bold px-4 py-2 shadow hover:opacity-95 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  부위별 자재 분석 재실행
                </button>
                <span className="text-[0.65rem] text-black/60">
                  이미지 생성 시 자동 분석이 진행됩니다. 결과를 다시 보거나 특정 부위를 재분석할 때 사용하세요.
                </span>
              </div>
              {Object.values(value.materialSelections || {}).some(
                (selection) => selection.roomId === activeRoom,
              ) && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {Object.values(value.materialSelections || {})
                    .filter((selection) => selection.roomId === activeRoom)
                    .map((selection) => (
                      <span
                        key={`${selection.roomId}:${selection.surfaceType}`}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800"
                      >
                        확정 · {selection.brand ? `${selection.brand} ` : ""}{selection.materialNameKo}
                        {selection.sku ? ` · ${selection.sku}` : ""}
                      </span>
                    ))}
                </div>
              )}
              <MaterialEditor
                roomLabel={ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom}
                realWorldAreaSqm={basicInfo.selectedPyeong?.exclusiveArea}
                styleHint={activeRender.prompt}
                renderItem={activeRender}
                tokenBalance={tokenBalance}
                onTokensChanged={onTokensChanged}
                onUpdate={(updated) => updateRender(selectedIdx, updated)}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-5 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[0.65rem] font-bold tracking-widest text-black border border-black/10">
                <Sparkles className="h-3 w-3" />
                서비스 준비 중
              </span>
              <p className="mt-3 text-sm font-bold text-black">부위별 자재 수정 · 견적 산출</p>
              <p className="mt-1 text-xs leading-relaxed text-black/60">
                더 정확한 부위 인식과 자재 매칭을 위해 개선 작업 중이에요.
                <br />
                준비가 끝나면 이 자리에서 바로 사용하실 수 있습니다.
              </p>
            </div>
          )
        )}
      </section>

      {activeRoom !== "all" && activeRender && activeRenderUnlocked && (
        <div className="lg:col-span-2">
          <RoomProductImageSelector
            imageUrl={activeRender.refinedUrl || activeRender.url}
            value={activeRoomProductCustomization}
            onChange={updateRoomProductCustomization}
            searchCatalog={searchRoomProductCatalog}
            disabled={generating}
            onRegenerate={async () => {
              const promptMarkdown = buildRoomProductPromptMarkdown(activeRoomProductCustomization);
              if (!promptMarkdown) throw new Error("재생성할 실제 SKU를 먼저 선택해주세요.");
              await handlePromptImageEdit(
                promptMarkdown,
                activeRoom,
                activeRoomName,
                listTargetSurfaces(activeRoomProductCustomization),
              );
            }}
          />
        </div>
      )}

      {/* Phase 7 — Vision Material Picker 모달 */}
      {PARTIAL_MATERIAL_VIEW_ENABLED && <VisionMaterialPicker
        open={visionPickerOpen}
        onClose={() => setVisionPickerOpen(false)}
        request={visionPickerRequest}
        onSelect={(cand, analyzed) => {
          const roomName = ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom;
          const surfaceType = mapVisionSurfaceToMaterialHint(analyzed.observation.surfaceType);
          const key = `${activeRoom}::${surfaceType}`;
          onChange({
            ...value,
            materialSelections: {
              ...(value.materialSelections || {}),
              [key]: {
                roomId: activeRoom,
                roomName,
                surfaceType,
                materialCategory: cand.category || analyzed.observation.surfaceType,
                materialProductId: cand.materialProductId,
                materialNameKo: cand.productName,
                brand: cand.brand,
                sku: cand.sku,
                spec: cand.spec,
                unit: cand.unit,
                unitPrice: cand.unitPrice,
                priceSource: cand.priceSource,
                observationId: analyzed.observation.id,
                confidence: cand.confidence,
              },
            },
          });
        }}
      />}

      {/* 생성 이미지가 없는 계정에서도 기능 위치를 놓치지 않는 고정 진입 버튼 */}
      {PARTIAL_MATERIAL_VIEW_ENABLED && !activeRender && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={openMaterialWorkspace}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-extrabold text-black shadow-2xl ring-2 ring-white transition hover:bg-zinc-50 sm:bottom-7 sm:right-7"
        >
          <Crosshair className="h-4 w-4" />
          부위별 자재 선택·수정
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[0.65rem] text-black">사진으로 테스트</span>
        </motion.button>
      )}

      {/* 생성 이미지 위 버튼으로 여는 부위별 자재 수정 작업실 */}
      {PARTIAL_MATERIAL_VIEW_ENABLED && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {materialEditorOpen && activeRender && selectedIdx != null && activeRenderUnlocked && (
            <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMaterialEditorOpen(false)}
              className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-md"
            />
            <motion.section
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 18 }}
              className="fixed inset-2 z-[71] overflow-y-auto rounded-[24px] border border-white/30 bg-white shadow-2xl sm:inset-5 lg:inset-8"
            >
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/95 px-5 py-4 backdrop-blur">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black">Material edit</p>
                  <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-black">
                    {ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom} · 부위별 자재 수정
                  </h2>
                  <p className="mt-1 text-xs text-black/55">이미지에서 바닥·벽을 클릭하고 경계를 확인한 뒤 자재를 선택하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaterialEditorOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black hover:bg-zinc-50"
                  aria-label="자재 수정 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="mx-auto max-w-6xl p-4 pb-10 sm:p-6">
                <MaterialEditor
                  roomLabel={ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom}
                  realWorldAreaSqm={basicInfo.selectedPyeong?.exclusiveArea}
                  styleHint={activeRender.prompt}
                  renderItem={activeRender}
                  tokenBalance={tokenBalance}
                  onTokensChanged={onTokensChanged}
                  onUpdate={(updated) => updateRender(selectedIdx, updated)}
                />
              </div>
            </motion.section>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {finalSelectionOpen && (
        <FinalDesignSelectionModal
          rooms={finalSelectionRooms}
          selectedByRoom={finalSelectionDraft}
          onSelect={(roomKey, renderIndex) =>
            setFinalSelectionDraft((current) => ({ ...current, [roomKey]: renderIndex }))
          }
          onClose={() => setFinalSelectionOpen(false)}
          onConfirm={(confirmedDraft) => void confirmFinalSelection(confirmedDraft)}
        />
      )}

      {/* 토큰 부족 모달 */}
      <AnimatePresence>
        {insufficientOpen && (
          <Modal onClose={() => setInsufficientOpen(false)}>
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                <Hexagon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-black">
                토큰이 부족합니다
              </h3>
              <p className="mt-2 text-sm text-black/70">
                이미지 생성 또는 부분 수정에 필요한 토큰이 부족합니다.
                <br />
                현재 보유: <span className="font-bold">{tokenBalance}</span>
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setInsufficientOpen(false)}
                  className="flex-1 rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-black/70 hover:bg-zinc-50"
                >
                  나중에
                </button>
                <a
                  href="/account/tokens?return=/workflow"
                  className="flex-1 rounded-full bg-black px-4 py-2.5 text-center text-sm font-semibold text-white shadow-cta hover:bg-black"
                >
                  토큰 충전하기
                </a>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function FinalDesignSelectionModal({
  rooms,
  selectedByRoom,
  onSelect,
  onClose,
  onConfirm,
}: {
  rooms: Array<{ key: string; label: string; renders: RenderItem[] }>;
  selectedByRoom: Record<string, number>;
  onSelect: (roomKey: string, renderIndex: number) => void;
  onClose: () => void;
  onConfirm: (selectedByRoom: Record<string, number>) => void;
}) {
  if (typeof document === "undefined") return null;
  const ready = rooms.every((room) => room.renders[selectedByRoom[room.key]]);

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
      />
      <div className="pointer-events-none fixed inset-0 z-[91] flex items-center justify-center p-4">
      <motion.section
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="pointer-events-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/[0.07] bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/38">
              Final design selection
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-black">
              견적에 사용할 실별 최종 이미지
            </h2>
            <p className="mt-1 text-xs text-black/48">
              각 실에서 1장씩 선택하세요. 선택한 이미지만 다음 견적 단계로 전달됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 hover:bg-black/[0.04] hover:text-black"
            aria-label="최종 이미지 선택 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          {rooms.map((room) => (
            <section key={room.key}>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-black">{room.label}</h3>
                <span className="text-[0.68rem] text-black/38">{room.renders.length}개 시안 · 1장 선택</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {room.renders.map((render, renderIndex) => {
                  const selected = selectedByRoom[room.key] === (render.selectionIndex ?? renderIndex);
                  return (
                    <button
                      type="button"
                      key={`${render.timestamp}-${renderIndex}`}
                      onClick={() => onSelect(room.key, render.selectionIndex ?? renderIndex)}
                      aria-pressed={selected}
                      data-testid={`final-design-option-${room.key}-${renderIndex}`}
                      className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
                        selected
                          ? "border-black ring-2 ring-black/10"
                          : "border-transparent hover:border-black/25"
                      }`}
                    >
                      <img
                        src={render.refinedUrl || render.url}
                        alt={`${room.label} 시안 ${renderIndex + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[0.65rem] font-semibold text-white backdrop-blur-sm">
                        시안 {renderIndex + 1}
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-lg">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-black/[0.07] bg-white px-5 py-4 sm:px-7">
          <p className="hidden text-xs text-black/45 sm:block">
            {rooms.length}개 실 · 최종 {rooms.length}장
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/65 hover:bg-black/[0.035]"
            >
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedByRoom)}
              disabled={!ready}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35"
            >
              선택 완료 · 견적 받기
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </motion.section>
      </div>
    </>,
    document.body,
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // body 포털 — 조상 transform(framer-motion)이 fixed 기준을 바꿔 화면 이탈하는 것 방지
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
      />
      <div className="pointer-events-none fixed inset-0 z-[81] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="pointer-events-auto max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-[28px] border border-black/10 bg-white p-7 shadow-card-hover"
        >
          {children}
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
