// 소비자 프로젝트 워크플로우 타입 정의

export type ConsumerProjectStatus =
  | "ADDRESS_SELECTION"
  | "FLOOR_PLAN"
  | "AI_DESIGN"
  | "RENDERING"
  | "ESTIMATING"
  | "RFQ"
  | "CONTRACTED";

export const CONSUMER_PROJECT_STATUS_LABELS: Record<ConsumerProjectStatus, string> = {
  ADDRESS_SELECTION: "주소 선택",
  FLOOR_PLAN: "도면/3D 매스",
  AI_DESIGN: "AI 디자인",
  RENDERING: "자재 선택",
  ESTIMATING: "물량 산출",
  RFQ: "견적 요청",
  CONTRACTED: "계약 완료",
};

export const CONSUMER_PROJECT_STATUS_COLORS: Record<ConsumerProjectStatus, string> = {
  ADDRESS_SELECTION: "bg-gray-100 text-gray-700",
  FLOOR_PLAN: "bg-cyan-100 text-cyan-700",
  AI_DESIGN: "bg-blue-100 text-blue-700",
  RENDERING: "bg-indigo-100 text-indigo-700",
  ESTIMATING: "bg-amber-100 text-amber-700",
  RFQ: "bg-purple-100 text-purple-700",
  CONTRACTED: "bg-green-100 text-green-700",
};

export const STATUS_ORDER: Record<ConsumerProjectStatus, number> = {
  ADDRESS_SELECTION: 0,
  FLOOR_PLAN: 1,
  AI_DESIGN: 2,
  RENDERING: 3,
  ESTIMATING: 4,
  RFQ: 5,
  CONTRACTED: 6,
};

export function isStatusAtLeast(
  current: ConsumerProjectStatus,
  required: ConsumerProjectStatus
): boolean {
  return STATUS_ORDER[current] >= STATUS_ORDER[required];
}

// 캔버스 주석
export interface CanvasAnnotation {
  id: string;
  type: "rect" | "circle" | "arrow" | "freehand" | "text";
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  label?: string;
  linkedMessageId?: string;
  createdAt: string;
}

// 프로젝트 이미지 (도면 또는 사진)
export interface ProjectImage {
  id: string;
  url: string;
  type: "floorplan" | "photo" | "camera";
  name: string;
  roomId?: string;
  annotations: CanvasAnnotation[];
  createdAt: string;
}

// 디자인 결정 사항
export interface DesignDecision {
  id: string;
  roomId: string;
  roomName: string;
  category: string;
  itemName: string;
  specification?: string;
  estimatedCost?: number;
  aiRecommended: boolean;
  confirmedByUser: boolean;
}

// 채팅 메시지
export interface DesignChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageId?: string;
  annotationIds?: string[];
  createdAt: string;
}

// 주소 정보
export interface ProjectAddress {
  roadAddress: string;
  zipCode: string;
  buildingName?: string;
  dongName?: string;
  hoName?: string;
  exclusiveArea: number;
  supplyArea?: number;
  roomCount: number;
  bathroomCount: number;
  buildingType: string;
  floor?: number;
  totalFloor?: number;
}

// AI 생성 이미지
export interface GeneratedImage {
  id: string;
  prompt: string;
  imageData: string;
  roomId?: string;
  roomName?: string;
  description?: string;
  createdAt: string;
}

// 자재 선정
export interface SelectedMaterial {
  id: string;
  roomId: string;
  roomName: string;
  category: string; // 바닥, 벽, 천장, 가구 등
  categoryCode?: string; // v2 카테고리 코드 (FLOORING, WALLPAPER 등)
  part: string; // 부위명
  materialName: string;
  specification: string;
  unitPrice: number;
  laborPrice?: number; // 시공비 단가
  unit: string; // m², EA, SET 등
  quantity?: number;
  brand?: string; // 브랜드명
  productId?: string; // v2 카탈로그 제품 ID
  priceGrade?: "economy" | "standard" | "premium";
  priceSource?: string; // 가격 출처 (물가협회 2025 등)
  subMaterials?: SubMaterial[];
  confirmed: boolean;
}

export interface SubMaterial {
  name: string;
  specification: string;
  unitPrice: number;
  unit: string;
  quantity?: number;
}

// 3D 렌더링 뷰
export interface RenderView {
  id: string;
  roomId: string;
  roomName: string;
  imageData: string;
  prompt: string;
  confirmed: boolean;
  createdAt: string;
}

// 디자인 상태
export interface ProjectDesign {
  images: ProjectImage[];
  decisions: DesignDecision[];
  chatMessages: DesignChatMessage[];
  generatedImages: GeneratedImage[];
  activeImageId?: string;
}

// 렌더링 상태
export interface ProjectRendering {
  views: RenderView[];
  materials: SelectedMaterial[];
  allConfirmed: boolean;
}

// 견적 항목
export interface EstimateItem {
  id: string;
  roomId: string;
  roomName: string;
  category: string;
  part: string;
  materialName: string;
  specification: string;
  unit: string;
  quantity: number;
  materialCost: number;
  laborCost: number;
  expense: number;
  total: number;
}

// 견적서
export interface ProjectEstimate {
  items: EstimateItem[];
  totalMaterialCost: number;
  totalLaborCost: number;
  totalExpense: number;
  grandTotal: number;
  createdAt: string;
}

// RFQ (견적요청)
export interface ProjectRfq {
  specialNotes: string;
  preferredStartDate?: string;
  preferredDuration?: string;
  budgetRange?: string;
  livingDuringWork: boolean;
  noiseRestriction?: string;
  sentAt?: string;
  bidIds: string[];
  selectedBidId?: string;
}

// 디자인 선호도 (좌측 옵션 패널)
export interface DesignPreferences {
  style: string;           // 모던 | 북유럽 | 클래식 | 미니멀 | 내추럴
  budget: string;          // economy | standard | premium
  priorities: string[];    // 채광, 수납, 동선, 개방감, 방음, 청소용이
  specialNotes: string[];  // 반려동물, 어린이, 노약자, 홈오피스, 홈카페, 확장형
}

// 편집 가능 치수선 (이미지 오버레이)
export interface EditedDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  valueMm: number;
  roomName: string;
  direction: "width" | "height";
}

// 통합 프로젝트 상태
export interface ConsumerProject {
  id: string;
  status: ConsumerProjectStatus;
  address?: ProjectAddress;
  design?: ProjectDesign;
  rendering?: ProjectRendering;
  estimate?: ProjectEstimate;
  rfq?: ProjectRfq;
  designPreferences?: DesignPreferences;
  estimateId?: string;
  drawingId?: string;
  editedDimensions?: EditedDimension[];
  createdAt: string;
  updatedAt: string;
}

// 새 프로젝트 생성 헬퍼
export function createNewProject(id: string): ConsumerProject {
  const now = new Date().toISOString();
  return {
    id,
    status: "ADDRESS_SELECTION",
    design: {
      images: [],
      decisions: [],
      chatMessages: [],
      generatedImages: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}
