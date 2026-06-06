// 사업자 디렉토리 타입

export type ContractorType = "general" | "specialty";
export type SubscriptionTier = "free" | "basic" | "premium" | "enterprise";
export type InquiryStatus = "pending" | "contacted" | "converted" | "closed";

export interface PublicContractor {
  id: string;
  companyName: string;
  contactName: string;
  region: string;
  contractorType: ContractorType;
  rating: number;
  totalReviews: number;
  completedProjects: number;
  isVerified: boolean;
  isFeatured: boolean;
  subscriptionTier: SubscriptionTier;
  introduction: string;
  logoUrl?: string;
  trades: TradeInfo[];
  portfolioThumbnails: string[];
  minProjectBudget?: number;
  maxProjectBudget?: number;
  createdAt: string;
}

export interface TradeInfo {
  code: string;
  name: string;
  experienceYears: number;
  isPrimary: boolean;
}

export interface ContractorInquiry {
  id: string;
  contractorId: string;
  consumerId?: string;
  consumerName: string;
  consumerPhone: string;
  consumerEmail: string;
  message: string;
  projectType: string;
  estimatedBudget: string;
  status: InquiryStatus;
  createdAt: string;
}

export interface DirectoryPageResponse {
  contractors: PublicContractor[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// DB → 프론트엔드 변환
export function mapDbContractorToPublic(
  row: Record<string, unknown>,
  trades?: Record<string, unknown>[],
  portfolioImages?: string[]
): PublicContractor {
  return {
    id: row.id as string,
    companyName: (row.company_name as string) || "",
    contactName: (row.contact_name as string) || "",
    region: (row.region as string) || "",
    contractorType: (row.contractor_type as ContractorType) || "specialty",
    rating: Number(row.rating) || 0,
    totalReviews: Number(row.total_reviews) || 0,
    completedProjects: Number(row.completed_projects) || 0,
    isVerified: (row.is_verified as boolean) || false,
    isFeatured: (row.is_featured as boolean) || false,
    subscriptionTier: (row.subscription_tier as SubscriptionTier) || "free",
    introduction: (row.introduction as string) || (row.metadata as Record<string, string>)?.introduction || "",
    logoUrl: row.logo_url as string | undefined,
    trades: (trades || []).map((t) => ({
      code: t.trade_code as string,
      name: t.trade_name as string,
      experienceYears: Number(t.experience_years) || 0,
      isPrimary: (t.is_primary as boolean) || false,
    })),
    portfolioThumbnails: portfolioImages || [],
    minProjectBudget: row.min_project_budget ? Number(row.min_project_budget) : undefined,
    maxProjectBudget: row.max_project_budget ? Number(row.max_project_budget) : undefined,
    createdAt: row.created_at as string,
  };
}

// 상수
export const CONTRACTOR_TYPE_LABELS: Record<ContractorType, string> = {
  general: "종합 인테리어",
  specialty: "전문공종",
};

export const CONTRACTOR_TYPE_COLORS: Record<ContractorType, string> = {
  general: "bg-purple-100 text-purple-700",
  specialty: "bg-blue-100 text-blue-700",
};

export const SORT_OPTIONS = [
  { value: "relevance", label: "추천순" },
  { value: "rating", label: "평점 높은순" },
  { value: "reviews", label: "리뷰 많은순" },
  { value: "newest", label: "최신 등록순" },
] as const;

export const TRADE_OPTIONS = [
  { code: "T01", label: "도배" },
  { code: "T02", label: "타일" },
  { code: "T03", label: "목공" },
  { code: "T04", label: "전기" },
  { code: "T05", label: "설비" },
  { code: "T06", label: "도장" },
  { code: "T07", label: "철거" },
  { code: "T08", label: "방수" },
  { code: "T09", label: "금속" },
  { code: "T10", label: "유리" },
  { code: "T15", label: "주방가구" },
  { code: "T16", label: "붙박이장" },
  { code: "T17", label: "바닥재" },
  { code: "T18", label: "조명" },
  { code: "T19", label: "욕실" },
  { code: "T22", label: "청소" },
] as const;

export const REGION_OPTIONS = [
  { value: "seoul", label: "서울" },
  { value: "gyeonggi", label: "경기" },
  { value: "incheon", label: "인천" },
  { value: "busan", label: "부산" },
  { value: "daegu", label: "대구" },
  { value: "daejeon", label: "대전" },
  { value: "gwangju", label: "광주" },
  { value: "ulsan", label: "울산" },
  { value: "sejong", label: "세종" },
  { value: "gangwon", label: "강원" },
  { value: "chungbuk", label: "충북" },
  { value: "chungnam", label: "충남" },
  { value: "jeonbuk", label: "전북" },
  { value: "jeonnam", label: "전남" },
  { value: "gyeongbuk", label: "경북" },
  { value: "gyeongnam", label: "경남" },
  { value: "jeju", label: "제주" },
] as const;
