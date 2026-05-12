/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Hexagon,
  Loader2,
  Check,
  ChevronRight,
  AlertCircle,
  Send,
  ImageIcon,
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
  Paperclip,
} from "lucide-react";
import type { BasicInfoData } from "./BasicInfoCard";
import type { NormalizedFloorplan } from "./Step1Cards";
import { renderRoomViaClient, type RenderRoomBody } from "@/lib/inpick/render-room-client";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";
import MaterialEditor from "./MaterialEditor";
import VisionMaterialPicker from "./VisionMaterialPicker";
import type { VisionMaterialAnalyzeRequest } from "@/lib/vision-materials/types";
import type { SegmentationData } from "@/types/segmentation";

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

const RENDER_COUNT = 4;

export interface RenderItem {
  url: string;
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
}

type ConsumeFeature = "ai_render" | "drawing_option";

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
  onComplete: () => void;
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
  onComplete,
}: Props) {
  // 가이드: Step2 방 목록에서 베란다/드레스룸 제외 (이미지 생성 X). 단 견적 면적엔 포함.
  // 이유: 베란다/드레스룸은 일반적으로 Step2 인테리어 디자인 생성 대상이 아님.
  const RENDER_EXCLUDED = ["balcony", "dress"];

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

  void photoSpaceType; // 향후 세분화 hook

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

  const [activeRoom, setActiveRoom] = useState<string>(availableTabs[0]?.v ?? "living");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
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
  const [openRoomPopup, setOpenRoomPopup] = useState<string | null>(null);
  const [imageMinimized, setImageMinimized] = useState(false);
  // 채팅 모드 + 메시지는 local useState로 — 스트리밍 빈번 갱신 시 closure stale 회피
  // 정책 (대표 지시): default = chat 모드. 사용자는 AI와 대화 후 명시적으로
  // "이 컨셉으로 디자인 생성하기" 버튼을 눌러야 이미지 생성. 즉시생성은 토글로 옵션.
  const [chatMode, setChatModeLocal] = useState<boolean>(value.chatMode ?? true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(value.chatMessages ?? []);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [extractingPrompt, setExtractingPrompt] = useState(false);
  // 다음 user 메시지에 함께 보낼 첨부 이미지 (전송 후 초기화)
  const [pendingAttachments, setPendingAttachments] = useState<ChatImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 부모(value)와 sync — 페이지 이탈 후 복원용. 단, 매 chunk마다 X (debounce).
  useEffect(() => {
    const t = setTimeout(() => {
      onChange({ ...value, chatMessages, chatMode });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, chatMode]);

  const setChatMode = (m: boolean) => {
    setChatModeLocal(m);
    // 정책: AI 상담 토글 ON + 메시지 0건이면 정적 인사 1회 추가 (API 호출 X — UX 즉시 반응 + 비용 절약)
    // 이후 AI는 시스템 프롬프트에 따라 인사 생략하고 바로 답변.
    if (m && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "assistant",
          content:
            "안녕하세요! InPick 인테리어 상담 AI입니다 😊\n어떤 공간을 어떻게 꾸미고 싶으신가요? 자유롭게 말씀해 주세요.",
        },
      ]);
    }
  };

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

  // SAM warmup — Step2 마운트 시 1회 백그라운드 호출 (cold start 회피)
  // 자재 수정 모달 열 때 워커가 이미 warm 상태로 있게 — fire-and-forget, 실패해도 무시
  useEffect(() => {
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
  const currentPrompt = value.promptByRoom?.[activeRoom] || "";
  const selectedIdx =
    value.selectedByRoom[activeRoom] ?? (renders.length > 0 ? renders.length - 1 : null);
  const activeRender = selectedIdx != null ? renders[selectedIdx] : null;
  const hasGenerated = renders.length > 0;
  const allRoomsDecided = realRoomTabs.every((t) => (value.rendersByRoom[t.v] || []).length > 0);

  // 채팅 히스토리 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renders.length, generating, chatMessages.length, chatStreaming]);

  const setPrompt = (text: string) => {
    onChange({
      ...value,
      promptByRoom: { ...(value.promptByRoom || {}), [activeRoom]: text },
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

    const lines = [
      `Floor plan layout (exact reading from user's actual floor plan):`,
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
    if (tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }
    setGenerating(true);
    setProgress(0);
    setErrorMsg(null);
    try {
      const areaM2 = basicInfo.selectedPyeong?.exclusiveArea;
      const budgetTier =
        basicInfo.expansionType === "extended"
          ? "premium"
          : basicInfo.budget && basicInfo.budget >= 5000
            ? "standard"
            : "basic";
      const res = await fetch("/api/inpick/render-photo-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectMode: "photo_only",
          stylePrompt,
          areaM2,
          budgetTier,
          quality: "low",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.hint || data.error || "이미지 생성 실패");
      }
      // 결과를 현재 활성 탭(또는 "all")에 추가 — 기존 UI 호환
      const targetKey = activeRoom === "all" ? "living" : activeRoom;
      const item: RenderItem = {
        url: data.imageUrl,
        prompt: stylePrompt,
        revisedPrompt: data.prompt,
        costUsd: data.costUsd ?? 0.01,
        timestamp: new Date().toISOString(),
      };
      onChange({
        ...value,
        rendersByRoom: {
          ...value.rendersByRoom,
          [targetKey]: [...(value.rendersByRoom[targetKey] || []), item],
        },
      });
      setProgress(100);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleChatToImage = async () => {
    if (chatMessages.length === 0 || extractingPrompt || generating) return;
    setErrorMsg(null);
    setExtractingPrompt(true);
    try {
      const res = await fetch("/api/inpick/design-chat/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages }),
      });
      const data = await res.json();
      if (!res.ok || !data.image_prompt) {
        throw new Error(data.error || "상담 내용 정리 실패");
      }
      // 모드 분기 — workflowEntry 우선, 폴백으로 floorplan 유무
      // MD plan §0 — photo_only/commercial은 절대 render-room 호출 X
      const hasFloorplan =
        !!basicInfo.floorplanPropertyId ||
        !!basicInfo.normalizedImageUrl ||
        !!basicInfo.uploadedFloorplan?.dataUrl;
      const isPhotoMode =
        workflowEntry === "photo_residential" ||
        workflowEntry === "photo_commercial" ||
        !hasFloorplan;
      if (isPhotoMode) {
        await handlePhotoStyleGenerate(data.image_prompt);
        return;
      }
      // 아파트 도면 모드만 기존 방별 일괄 생성
      await handleBulkGenerate(data.image_prompt);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setExtractingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentPrompt.trim()) {
      setErrorMsg("프롬프트를 입력해주세요. 예: '모던 미니멀, 화이트 + 라이트 우드'");
      return;
    }
    // "전체" 탭에서는 모든 방에 일괄 생성
    if (activeRoom === "all") {
      const promptToUse = currentPrompt;
      setPrompt("");
      await handleBulkGenerate(promptToUse);
      return;
    }
    setErrorMsg(null);

    // 1차는 무료, 2차+(수정)은 1토큰
    const isFirstGen = renders.length === 0;
    if (!isFirstGen && tokenBalance < 1) {
      setInsufficientOpen(true);
      return;
    }

    setGenerating(true);
    try {
      const tab = ROOM_TABS.find((t) => t.v === activeRoom)!;
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
      const renderBody: RenderRoomBody = {
        roomName: tab.label,
        widthMm: dim.widthMm,
        depthMm: dim.depthMm,
        heightMm: dim.heightMm,
        style: currentPrompt,
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
        isFromFloorplan: !!normalizedFloorplan?.rooms?.length,
        // 가이드 §3 — propertyId로 Storage normalized.png 자동 로드
        propertyId: basicInfo.floorplanPropertyId,
        floorplanImageUrl: basicInfo.normalizedImageUrl
          || basicInfo.cleanedImageUrl
          || basicInfo.selectedPyeong?.grandPlanUrl,
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
        prompt: currentPrompt,
        revisedPrompt: result.revisedPrompt,
        costUsd: result.costUsd ?? 0.19,
        timestamp: new Date().toISOString(),
      };
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
      // 2차+ 시 토큰 차감 (성공 후에만 — 실패 시 차감 없음)
      if (!isFirstGen) {
        const ok = await onConsumeToken(1, "ai_render");
        if (!ok) {
          // 이미지는 생성됐지만 토큰 차감 실패 — 사용자에게 알림 (이미지는 그대로 표시)
          setErrorMsg("이미지 생성은 완료됐지만 토큰 차감에 실패했습니다. 관리자에게 문의해주세요.");
        }
      }
      const nextRenders = [...renders, item];
      onChange({
        ...value,
        rendersByRoom: { ...value.rendersByRoom, [activeRoom]: nextRenders },
        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: nextRenders.length - 1 },
        generations: {
          ...value.generations,
          [activeRoom]: (value.generations[activeRoom] ?? 0) + 1,
        },
        promptByRoom: { ...(value.promptByRoom || {}), [activeRoom]: "" },
      });
      setImageMinimized(false); // 생성 후 큰 이미지로
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async (conceptPrompt: string) => {
    // Step1 선택 방 중 비어있는 것만 (없으면 전체)
    const emptyTabs = realRoomTabs.filter((t) => (value.rendersByRoom[t.v] || []).length === 0);
    if (emptyTabs.length === 0) {
      setErrorMsg("이미 모든 방에 시안이 있습니다");
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
        setBulkProgress({ current: i + 1, total: emptyTabs.length, roomLabel: tab.label });
        try {
          const dim = roomDims[tab.dimKey] || roomDims["거실"];
          const struct = inferStructure(tab.label);
          const wallLayout = buildWallLayout(tab.label);  // Q1
          const ctrl = new AbortController();
          const timeoutId = setTimeout(() => ctrl.abort(), 320_000);
          const bulkBody: RenderRoomBody = {
            roomName: tab.label,
            widthMm: dim.widthMm,
            depthMm: dim.depthMm,
            heightMm: dim.heightMm,
            style: conceptPrompt,
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
            isFromFloorplan: !!normalizedFloorplan?.rooms?.length,
            furnishingOptions: roomFurnishings?.[tab.v] || [],
            propertyId: basicInfo.floorplanPropertyId,
            floorplanImageUrl: basicInfo.normalizedImageUrl
              || basicInfo.cleanedImageUrl
              || basicInfo.selectedPyeong?.grandPlanUrl,
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
                prompt: conceptPrompt,
                revisedPrompt: result.revisedPrompt,
                costUsd: result.costUsd ?? 0.01,            // low quality 기본 $0.01
                timestamp: new Date().toISOString(),
              } as RenderItem,
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
      if (failures.length > 0) {
        setErrorMsg(`일부 방 실패: ${failures.slice(0, 2).join(" / ")}`);
      }
    } finally {
      setGenerating(false);
      setBulkProgress(null);
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
    // 캡처 레퍼런스 레이아웃: 좌측 베이지 사이드바 + 메인 흰색(#F8F9F6) 캔버스
    // 채팅 무한 늘어남 X — 화면 높이 고정, 메시지 영역만 스크롤
    <div className="grid gap-3 lg:grid-cols-[260px_1fr] items-stretch min-h-[calc(100vh-180px)] rounded-2xl bg-[#EFE8DC] p-3">
      {/* ─── 좌측 툴바 (베이지 톤 — 대표 지시) ─── */}
      <aside className="flex flex-col gap-3">
        {/* 전체 인테리어 이미지 한번에 생성 — 좌측 상단 (방 선택 위) */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-amber-200/60 p-3 shadow-sm">
          <p className="text-xs font-bold text-primary-700 mb-2">
            전체 인테리어 이미지 한번에 생성
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
                className="rounded-lg border border-primary-100 bg-primary-50/50 px-2 py-1.5 text-[0.7rem] font-semibold text-primary-900 hover:bg-primary-100 hover:border-primary-300 disabled:opacity-30 transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.65rem] text-primary-900/50 leading-snug">
            클릭 시 프롬프트에 추가 → 입력 완료 후 [전체 일괄 생성] 클릭
          </p>
        </div>

        {/* 방 선택 */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-amber-200/60 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-bold text-primary-700">방 선택</p>
            <span className="text-[0.6rem] tabular text-primary-900/50">{pyeongLabel}</span>
          </div>
          <div className="space-y-1">
            {availableTabs.map((t) => {
              const isAll = t.v === "all";
              const sel = activeRoom === t.v;
              const count = (value.rendersByRoom[t.v] || []).length;
              const decided = !isAll && count > 0;
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
                      // "전체" 탭은 popup 비활성화 (전체 컨셉 입력용)
                      if (isAll) {
                        setOpenRoomPopup(null);
                      } else {
                        setOpenRoomPopup(openRoomPopup === t.v ? null : t.v);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all ${
                      isGeneratingThis
                        ? "bg-gradient-to-r from-primary-500 to-amber-500 text-white shadow-cta ring-2 ring-amber-300 ring-offset-1 animate-pulse"
                        : sel
                        ? isAll
                          ? "bg-gradient-to-r from-primary-500 to-amber-400 text-white shadow-cta"
                          : "bg-primary-500 text-white shadow-cta"
                        : isAll
                          ? "bg-gradient-to-r from-primary-50 to-amber-50 text-primary-900 border border-primary-200 hover:from-primary-100 hover:to-amber-100"
                          : isSelectedInStep1
                            ? "bg-primary-50/30 text-primary-900/70 hover:bg-primary-100 hover:text-primary-900"
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
                    ) : decided ? (
                      <span
                        className={`text-[0.6rem] font-bold tabular px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                          sel ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"
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
                      className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 shadow"
                      title="실 삭제"
                    >
                      <X className="h-2.5 w-2.5" />
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
                        className="absolute left-full top-0 ml-3 z-30 min-w-[220px] rounded-xl border border-primary-200 bg-white p-3 shadow-card-hover"
                      >
                        <div className="absolute left-0 top-3 -translate-x-1 h-2 w-2 rotate-45 bg-white border-l border-b border-primary-200" />
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-primary-700">{t.label}</p>
                          <button onClick={() => setOpenRoomPopup(null)}>
                            <X className="h-3 w-3 text-primary-900/40 hover:text-primary-900" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-primary-900">
                          {count > 0 ? (
                            <>
                              <span className="text-emerald-600">{count}</span>
                              <span className="text-primary-900/50 ml-1">장 생성됨</span>
                            </>
                          ) : (
                            <span className="text-primary-900/40">아직 미생성</span>
                          )}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-primary-900/60 tabular">
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
              <div className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50/40 px-2 py-1.5">
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
                  className="flex-1 rounded bg-white border border-primary-200 px-2 py-1 text-xs outline-none focus:border-primary-400"
                />
                <button
                  type="button"
                  onClick={addCustomTab}
                  className="rounded bg-primary-500 px-2 py-1 text-xs font-bold text-white hover:bg-primary-600"
                >
                  추가
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddTabInput(true)}
                className="w-full rounded-lg border border-dashed border-primary-300 bg-white/50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50 hover:border-primary-400"
              >
                + 실 추가
              </button>
            )}
          </div>
        </div>

        {/* 보유 토큰 */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-amber-200/60 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700">보유 토큰</p>
            <span className="text-lg tabular font-extrabold text-amber-700">
              ⬢ {tokenBalance}
            </span>
          </div>
          <p className="mt-1 text-[0.65rem] text-amber-700/70 leading-snug">
            1차 미리보기 무료 · 자재 분석 1 · 고화질 재렌더 2
          </p>
        </div>

        {/* 진행 상황 — 좌측 컬럼 하단으로 push (메인 캔버스 하단과 정렬) */}
        <div className="mt-auto rounded-2xl bg-white/80 backdrop-blur border border-amber-200/60 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-primary-700">진행 상황</p>
            <span className="text-[0.65rem] tabular font-bold text-primary-900">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-primary-50 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / Math.max(1, totalCount)) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary-500 to-amber-400"
            />
          </div>
          <a
            href="/workflow/estimate"
            onClick={(e) => {
              // sessionStorage에 step1/step2 저장 후 navigation 진행
              try {
                sessionStorage.setItem("workflow_step1", JSON.stringify({
                  basicInfo,
                  buildingType: rooms.includes("all") ? null : null, // 부모 state는 onComplete가 더 정확
                  rooms,
                  roomFurnishings,
                  normalizedFloorplan,
                }));
                sessionStorage.setItem("workflow_step2", JSON.stringify(value));
              } catch {
                /* private mode */
              }
              // onComplete (workflow page의 goBranch)도 호출 — sessionStorage 갱신 + router.push 백업
              onComplete();
              // a href 자체로도 navigation 발생 — JS 실패해도 보장
              if (e.defaultPrevented) return;
            }}
            className={`relative z-10 mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold shadow-cta transition-all cursor-pointer ${
              allRoomsDecided
                ? "bg-primary-500 text-white hover:bg-primary-600 ring-2 ring-primary-200"
                : "bg-primary-500 text-white hover:bg-primary-600"
            }`}
          >
            {allRoomsDecided ? "디자인 완료 → 견적 요청" : "디자인 완료 · 견적 요청 (계속)"}
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </aside>

      {/* ─── 메인 캔버스: 흰색 톤(#F8F9F6) — 대표 지시 ─── */}
      <section className="relative flex flex-col">
        <div className="relative rounded-3xl bg-[#F8F9F6] border border-amber-200/40 shadow-sm flex-1 min-h-[480px] max-h-[calc(100vh-220px)] flex flex-col overflow-hidden">
          {/* Step1 선택 정보 — 캔버스 최상단 (주소/단지/평형/면적/확장형/예산) */}
          {(basicInfo.selectedAddress || basicInfo.selectedComplex || basicInfo.selectedPyeong) && (
            <div className="px-5 py-2 bg-[#EFE8DC]/40 border-b border-amber-100/60 text-[0.7rem] text-primary-900/70 flex flex-wrap items-center gap-x-3 gap-y-1">
              {basicInfo.selectedAddress?.roadAddress && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-primary-900/40">주소</span>
                  <span className="font-medium text-primary-900">
                    {basicInfo.selectedAddress.roadAddress}
                  </span>
                </span>
              )}
              {basicInfo.selectedComplex?.complexName && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-primary-900/40">단지</span>
                  <span className="font-medium text-primary-900">
                    {basicInfo.selectedComplex.complexName}
                  </span>
                </span>
              )}
              {basicInfo.selectedPyeong && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-primary-900/40">평형</span>
                  <span className="font-medium text-primary-900">
                    {basicInfo.selectedPyeong.pyeongName}형 · {basicInfo.selectedPyeong.exclusiveArea}㎡
                  </span>
                </span>
              )}
              {basicInfo.expansionType && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-primary-900/40">발코니</span>
                  <span className="font-medium text-primary-900">
                    {basicInfo.expansionType === "extended" ? "확장형" : "기본형"}
                  </span>
                </span>
              )}
              {typeof basicInfo.budget === "number" && basicInfo.budget > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-primary-900/40">예산</span>
                  <span className="font-medium text-primary-900">
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
                    ? "bg-amber-50/80 border-amber-200/60 text-amber-900"
                    : "bg-emerald-50/60 border-emerald-200/60 text-emerald-900"
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
          <div className="px-5 py-3 border-b border-amber-100/60 flex items-center justify-between gap-3 flex-wrap bg-[#F8F9F6]/80">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary-500 shrink-0" />
              <p className="text-sm font-bold text-primary-900 truncate">
                {ROOM_TABS.find((t) => t.v === activeRoom)?.label} · AI 디자인 챗
              </p>
              <span className="hidden sm:inline text-[0.65rem] text-primary-900/50 tabular ml-1">
                {activeRoom === "all" ? `${realRoomTabs.length}개 방` : (
                  (() => {
                    const tab = ROOM_TABS.find((t) => t.v === activeRoom);
                    const d = tab ? roomDims[tab.dimKey] : null;
                    return d ? `${(d.widthMm/1000).toFixed(1)}×${(d.depthMm/1000).toFixed(1)}m` : "—";
                  })()
                )}
              </span>
            </div>
            {/* 모드 토글 — 크게 + 시각적 강조 */}
            <div className="inline-flex items-center gap-1 rounded-full border-2 border-primary-300 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setChatMode(false)}
                className={`px-4 py-2 rounded-full text-sm font-bold inline-flex items-center gap-1.5 transition-all ${
                  !chatMode
                    ? "bg-primary-500 text-white shadow-cta"
                    : "text-primary-900/60 hover:text-primary-900 hover:bg-primary-50"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                즉시 생성
              </button>
              <button
                type="button"
                onClick={() => setChatMode(true)}
                className={`px-4 py-2 rounded-full text-sm font-bold inline-flex items-center gap-1.5 transition-all ${
                  chatMode
                    ? "bg-gradient-to-r from-primary-500 to-amber-500 text-white shadow-cta"
                    : "text-primary-900/60 hover:text-primary-900 hover:bg-primary-50"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 상담
              </button>
            </div>
          </div>

          {/* 채팅 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!hasGenerated && !generating && !(chatMode && chatMessages.length > 0) && (
              <div className="h-full flex items-center justify-center min-h-[40vh]">
                <div className="text-center max-w-md">
                  <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-500 mb-4">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-primary-900">
                    {chatMode
                      ? "어떤 공간을 꾸미고 싶으세요?"
                      : activeRoom === "all"
                        ? "전체 컨셉을 한 번에 만들어볼까요?"
                        : "무엇을 만들고 싶으세요?"}
                  </h3>
                  <p className="mt-2 text-sm text-primary-900/60 leading-relaxed">
                    {chatMode ? (
                      <>
                        AI 상담사와 4~5턴 대화하면 핵심 정보를 모아
                        <br />
                        <span className="font-bold text-primary-700">한번에 디자인을 생성</span>해
                        드립니다.
                      </>
                    ) : activeRoom === "all" ? (
                      <>
                        하나의 컨셉으로 <span className="font-bold text-primary-700">모든 방</span>에
                        같은 스타일로 일괄 생성됩니다.
                        <br />
                        프롬프트 입력 또는 좌측 프리셋 클릭.
                      </>
                    ) : (
                      <>
                        스타일·자재·분위기를 자유롭게 적어주세요.
                        <br />
                        또는 좌측{" "}
                        <span className="font-bold text-primary-700">전체 인테리어 이미지 한번에 생성</span>{" "}
                        프리셋을 클릭하세요.
                      </>
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    {STYLE_PRESETS.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(currentPrompt ? `${currentPrompt}, ${p}` : p)}
                        className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 hover:border-primary-400"
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
                      ? "bg-primary-500 text-white rounded-tr-sm"
                      : "bg-primary-50 text-primary-900 rounded-tl-sm border border-primary-100"
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
                <div className="rounded-2xl rounded-tl-sm bg-primary-50 border border-primary-100 px-4 py-2.5 text-sm text-primary-900/70 inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI 상담 중…
                </div>
              </div>
            )}

            {/* 채팅 히스토리 — 사용자 prompt + AI 이미지 응답 */}
            {renders.map((r, i) => (
              <div key={i} className="space-y-2">
                {/* 사용자 메시지 */}
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl rounded-tr-sm bg-primary-500 text-white px-4 py-2.5 text-sm shadow-sm">
                    {r.prompt}
                  </div>
                </div>
                {/* AI 응답 (작은 미리보기) */}
                <div className="flex justify-start">
                  <button
                    onClick={() => {
                      onChange({
                        ...value,
                        selectedByRoom: { ...value.selectedByRoom, [activeRoom]: i },
                      });
                      setImageMinimized(false);
                    }}
                    className={`group relative rounded-2xl rounded-tl-sm overflow-hidden border-2 transition-all ${
                      i === selectedIdx
                        ? "border-primary-500 ring-2 ring-primary-200"
                        : "border-primary-100 hover:border-primary-300"
                    }`}
                  >
                    <img
                      src={r.refinedUrl || r.url}
                      alt={`design-${i}`}
                      className="block w-56 h-56 object-cover"
                    />
                    <div className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-bold tabular text-primary-900 backdrop-blur">
                      #{String(i + 1).padStart(2, "0")}
                    </div>
                    {r.refinedUrl && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
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
                <div className="rounded-2xl rounded-tl-sm bg-primary-50 border border-primary-100 px-5 py-4 max-w-md">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                    <p className="text-sm font-bold text-primary-900">
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
                      className="h-full bg-gradient-to-r from-primary-500 to-amber-400"
                    />
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-primary-900/60">
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
              <div className="px-4 py-3 border-t border-amber-200/60 bg-[#F8F9F6]">
                <button
                  type="button"
                  onClick={handleChatToImage}
                  disabled={!canGenerate}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-base font-bold shadow-cta transition-all ${
                    canGenerate
                      ? "bg-gradient-to-r from-primary-500 to-amber-500 text-white hover:opacity-95 ring-2 ring-amber-300"
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
                <p className="mt-1.5 text-[0.7rem] text-amber-900/70 text-center">
                  💡 {helperText}
                </p>
              </div>
            );
          })()}

          {/* 하단 sticky prompt bar — 캡처 레퍼런스 스타일 (둥근, 가운데, 단색) */}
          <div className="border-t border-amber-100/40 bg-[#F8F9F6] p-4">
            {/* 첨부 이미지 미리보기 (chat 모드에서만) */}
            {chatMode && pendingAttachments.length > 0 && (
              <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-amber-200 bg-white shadow-sm"
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
              <p className="mx-auto max-w-3xl mb-2 text-[0.7rem] text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {attachmentError}
              </p>
            )}
            <div className="mx-auto max-w-3xl flex items-end gap-2">
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
                    className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-700 shadow-sm hover:bg-amber-50 disabled:opacity-40 transition"
                    aria-label="사진 첨부"
                    title="사진 첨부 (최대 4장 · 8MB 이하)"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="flex-1 rounded-full border border-amber-200/70 bg-white px-5 py-3 shadow-sm focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-100">
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
                  placeholder={
                    chatMode
                      ? pendingAttachments.length > 0
                        ? "이 사진처럼 꾸며줘 — 원하는 분위기·요청사항을 적어주세요 (비워두고 전송도 OK)"
                        : "어떤 공간을 꾸미고 싶으세요? 사진을 첨부하면 더 정확해요"
                      : activeRoom === "all"
                        ? "전체 컨셉 입력 — 모든 방에 같은 스타일로 일괄 생성. 예) 모던 미니멀, 화이트 + 라이트 우드, 따뜻한 톤"
                        : hasGenerated
                          ? "수정 요청: 예) 소파를 회색 패브릭으로, TV 뒷벽 우드 패널..."
                          : "원하는 스타일·자재·분위기를 입력하세요. (Shift+Enter 줄바꿈)"
                  }
                  rows={hasGenerated || chatMode ? 1 : 2}
                  className="w-full resize-none bg-transparent text-sm text-primary-900 outline-none placeholder:text-primary-900/40"
                />
              </div>
              <button
                type="button"
                onClick={chatMode ? handleChatSend : handleGenerate}
                disabled={
                  chatMode
                    ? chatStreaming || (!currentPrompt.trim() && pendingAttachments.length === 0)
                    : generating || !currentPrompt.trim()
                }
                aria-label={chatMode ? "메시지 전송" : "이미지 생성"}
                className={`shrink-0 inline-flex items-center justify-center rounded-full text-white shadow-md hover:opacity-95 disabled:opacity-30 transition-all ${
                  chatMode
                    ? "h-12 w-12 bg-gradient-to-br from-amber-500 to-amber-700"
                    : "h-12 gap-1.5 bg-gradient-to-br from-primary-500 to-primary-700 px-5 text-sm font-bold"
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
                  // "전체" 탭은 항상 일괄 1차 생성 (비어있는 방만)
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>전체 일괄 생성</span>
                    <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[0.6rem] font-bold">
                      무료
                    </span>
                  </>
                ) : renders.length === 0 ? (
                  // 1차 생성 — 무료
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>1차 생성</span>
                    <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[0.6rem] font-bold">
                      무료
                    </span>
                  </>
                ) : (
                  // 2차+ 수정 — 1토큰
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>수정 생성</span>
                    <span className="rounded bg-amber-400/40 px-1.5 py-0.5 text-[0.6rem] font-bold inline-flex items-center gap-0.5">
                      <Hexagon className="h-2.5 w-2.5 fill-amber-600" />1
                    </span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-amber-700 leading-relaxed">
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
                className="absolute inset-3 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 via-white to-amber-50 border-2 border-primary-300 shadow-2xl pointer-events-auto"
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
                      className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-cta"
                    >
                      <Sparkles className="h-10 w-10" />
                    </motion.div>
                    <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-primary-900">
                      {bulkProgress
                        ? `${bulkProgress.roomLabel || "방"} AI 디자인 생성 중`
                        : "AI 디자인 생성 중"}
                    </h3>
                    <p className="mt-2 text-sm text-primary-900/70 leading-relaxed">
                      {bulkProgress ? (
                        <>
                          전체 방을 순차 생성하고 있습니다.
                          <br />
                          <span className="font-bold text-primary-700 tabular">
                            {bulkProgress.current}/{bulkProgress.total}
                          </span>
                          {" "}완료 — 잠시만 기다려주세요.
                        </>
                      ) : (
                        <>
                          평면도·자재·치수를 분석해서
                          <br />
                          <span className="font-bold text-primary-700">고해상도 인테리어 이미지</span>를 만들고 있어요.
                        </>
                      )}
                    </p>
                    <div className="mt-6 mx-auto max-w-xs">
                      <div className="h-2.5 rounded-full bg-white/80 overflow-hidden shadow-inner border border-primary-100">
                        <motion.div
                          animate={{
                            width: bulkProgress
                              ? `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%`
                              : `${progress}%`,
                          }}
                          transition={{ duration: 0.4 }}
                          className="h-full bg-gradient-to-r from-primary-500 to-amber-500"
                        />
                      </div>
                      <p className="mt-2 text-xs font-bold tabular text-primary-700">
                        {bulkProgress
                          ? `${Math.round((bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}%`
                          : `${Math.round(progress)}%`}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-center gap-1.5 text-[0.7rem] text-primary-900/60">
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
            {activeRender && !imageMinimized && hasGenerated && !generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="absolute inset-3 rounded-2xl overflow-hidden bg-white border border-primary-200 shadow-2xl pointer-events-auto"
                style={{ zIndex: 20 }}
              >
                <button
                  onClick={() => setImageMinimized(true)}
                  className="absolute top-3 right-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-primary-200 text-primary-700 hover:bg-primary-50 shadow"
                  title="우측으로 작게"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <img
                  src={activeRender.refinedUrl || activeRender.url}
                  alt="design"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {activeRender.refinedUrl && (
                  <div className="absolute top-3 left-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[0.7rem] font-bold text-white shadow">
                    ✓ 고화질 재렌더
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 우측 미니 thumbnail (minimized 상태) */}
        <AnimatePresence>
          {imageMinimized && activeRender && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => setImageMinimized(false)}
              className="fixed right-6 top-24 z-30 h-32 w-32 rounded-xl border-2 border-primary-500 overflow-hidden shadow-2xl bg-white hover:scale-105 transition-transform"
              title="중앙 큰 보기로"
            >
              <img
                src={activeRender.refinedUrl || activeRender.url}
                alt="mini"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-primary-700">
                <Maximize2 className="h-2.5 w-2.5" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[0.6rem] font-bold p-1 text-center">
                클릭해서 크게 보기
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 자재 수정 (세그멘테이션) — 선택된 시안 아래 */}
        {activeRender && selectedIdx != null && hasGenerated && (
          <div className="mt-4">
            {/* Phase 7 — Vision Material Picker trigger (이미지 전체 분석 → Top-3 후보) */}
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setVisionPickerRequest({
                    projectId: basicInfo.floorplanPropertyId || "current-project",
                    roomName: ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom,
                    roomType: activeRoom,
                    imageUrl: activeRender.url,
                    sourceImageKind: "ai_render",
                  });
                  setVisionPickerOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-primary-500 text-white text-xs font-bold px-4 py-2 shadow hover:opacity-95 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 자재 분석 (Top-3 후보)
              </button>
              <span className="text-[0.65rem] text-primary-900/60">
                이미지에서 자재를 자동 매칭하여 실제 브랜드/SKU/스펙 후보를 표시
              </span>
            </div>
            <MaterialEditor
              roomLabel={ROOM_TABS.find((t) => t.v === activeRoom)?.label || activeRoom}
              realWorldAreaSqm={basicInfo.selectedPyeong?.exclusiveArea}
              styleHint={activeRender.prompt}
              renderItem={activeRender}
              tokenBalance={tokenBalance}
              onConsumeToken={onConsumeToken}
              onUpdate={(updated) => updateRender(selectedIdx, updated)}
            />
          </div>
        )}
      </section>

      {/* Phase 7 — Vision Material Picker 모달 */}
      <VisionMaterialPicker
        open={visionPickerOpen}
        onClose={() => setVisionPickerOpen(false)}
        request={visionPickerRequest}
        onSelect={(cand) => {
          // 사용자가 후보 선택 — 토스트만, MaterialEditor에서 실제 적용
          console.info(
            `[step2/vision-picker] 선택: ${cand.brand} ${cand.productName} (SKU=${cand.sku || "-"}, ${Math.round(cand.confidence * 100)}%)`,
          );
        }}
      />

      {/* 토큰 부족 모달 */}
      <AnimatePresence>
        {insufficientOpen && (
          <Modal onClose={() => setInsufficientOpen(false)}>
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                <Hexagon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-primary-900">
                토큰이 부족합니다
              </h3>
              <p className="mt-2 text-sm text-primary-900/70">
                자재 영역 분석 1토큰 / 고화질 재렌더 2토큰이 필요합니다.
                <br />
                현재 보유: <span className="font-bold">{tokenBalance}</span>
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setInsufficientOpen(false)}
                  className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                >
                  나중에
                </button>
                <a
                  href="/account/tokens?return=/workflow"
                  className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-cta hover:bg-primary-600"
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

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover"
      >
        {children}
      </motion.div>
    </>
  );
}
