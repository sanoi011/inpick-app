import type { PublicContractor, SubscriptionTier } from "@/types/contractor-directory";

type EvidenceSource = Pick<
  PublicContractor,
  | "isVerified"
  | "isFeatured"
  | "subscriptionTier"
  | "totalReviews"
  | "completedProjects"
  | "portfolioThumbnails"
>;

const CONTRACTOR_REGION_LABELS: Record<string, string> = {
  all: "전국",
  seoul: "서울",
  gyeonggi: "경기",
  incheon: "인천",
  busan: "부산",
  daegu: "대구",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
  sejong: "세종",
  gangwon: "강원",
  chungbuk: "충북",
  chungnam: "충남",
  jeonbuk: "전북",
  jeonnam: "전남",
  gyeongbuk: "경북",
  gyeongnam: "경남",
  jeju: "제주",
};

export function formatContractorRegion(region?: string | null) {
  if (!region) return "지역 미등록";
  return CONTRACTOR_REGION_LABELS[region.toLowerCase()] || region;
}

export interface ContractorEvidence {
  kind: "verified" | "review" | "project" | "portfolio";
  label: string;
}

export interface PlacementDisclosure {
  label: "상단 노출";
  description: string;
}

export function getPlacementDisclosure(
  contractor: Pick<EvidenceSource, "isFeatured" | "subscriptionTier">,
): PlacementDisclosure | null {
  const paidTier: SubscriptionTier[] = ["premium", "enterprise"];
  if (!contractor.isFeatured && !paidTier.includes(contractor.subscriptionTier)) {
    return null;
  }
  return {
    label: "상단 노출",
    description: "노출 설정 또는 서비스 요금제에 따라 먼저 표시되며, 사업자 정보 확인·리뷰·시공 실적 검증 여부와는 별개입니다.",
  };
}

export function buildContractorEvidence(contractor: EvidenceSource): ContractorEvidence[] {
  const evidence: ContractorEvidence[] = [];
  if (contractor.isVerified) {
    evidence.push({ kind: "verified", label: "사업자 정보 확인" });
  }
  if (contractor.totalReviews > 0) {
    evidence.push({ kind: "review", label: `리뷰 ${contractor.totalReviews}개` });
  }
  if (contractor.completedProjects > 0) {
    evidence.push({ kind: "project", label: `완료 실적 ${contractor.completedProjects}건` });
  }
  if (contractor.portfolioThumbnails.length > 0) {
    evidence.push({ kind: "portfolio", label: "포트폴리오 있음" });
  }
  return evidence;
}

export interface ContractorProfileReadinessInput {
  companyName?: string | null;
  phone?: string | null;
  region?: string | null;
  introduction?: string | null;
  licenseNumber?: string | null;
  businessLicenseUrl?: string | null;
  tradesCount: number;
  portfolioCount: number;
  isPublic: boolean;
}

export interface ContractorProfileReadinessItem {
  id: "basic" | "documents" | "trades" | "introduction" | "portfolio" | "public";
  label: string;
  description: string;
  complete: boolean;
  href: string;
}

export interface ContractorProfileReadiness {
  label: "프로필 준비도";
  completed: number;
  total: number;
  percent: number;
  items: ContractorProfileReadinessItem[];
}

function present(value?: string | null) {
  return Boolean(value?.trim());
}

export function getContractorProfileReadiness(
  input: ContractorProfileReadinessInput,
): ContractorProfileReadiness {
  const items: ContractorProfileReadinessItem[] = [
    {
      id: "basic",
      label: "기본 연락 정보",
      description: "상호명·연락처·지역",
      complete: present(input.companyName) && present(input.phone) && present(input.region),
      href: "/contractor/profile?tab=info",
    },
    {
      id: "documents",
      label: "사업자 서류 등록",
      description: "등록번호와 서류 파일 등록 상태",
      complete: present(input.licenseNumber) && present(input.businessLicenseUrl),
      href: "/contractor/profile?tab=docs",
    },
    {
      id: "trades",
      label: "주력 공종 설정",
      description: "수행 공종과 경력",
      complete: input.tradesCount > 0,
      href: "/contractor/profile?tab=trades",
    },
    {
      id: "introduction",
      label: "업체 소개",
      description: "고객이 확인할 작업 방식",
      complete: present(input.introduction),
      href: "/contractor/profile?tab=info",
    },
    {
      id: "portfolio",
      label: "시공 사례",
      description: "실제 프로젝트 포트폴리오",
      complete: input.portfolioCount > 0,
      href: "/contractor/profile?tab=portfolio",
    },
    {
      id: "public",
      label: "업체 찾기 공개",
      description: "소비자 디렉터리 노출 설정",
      complete: input.isPublic,
      href: "/contractor/profile?tab=info",
    },
  ];
  const completed = items.filter((item) => item.complete).length;
  return {
    label: "프로필 준비도",
    completed,
    total: items.length,
    percent: Math.round((completed / items.length) * 100),
    items,
  };
}

export function canSubmitContractorInquiry(input: {
  consumerName: string;
  consumerPhone: string;
  sharingAccepted: boolean;
}) {
  return Boolean(
    input.consumerName.trim() &&
      input.consumerPhone.trim() &&
      input.sharingAccepted,
  );
}

export interface ConnectionJourneyStep {
  id: string;
  title: string;
  description: string;
}

const CONNECTION_JOURNEY: ConnectionJourneyStep[] = [
  {
    id: "brief",
    title: "요구조건 정리",
    description: "공간, 예산, 디자인, 실제 SKU와 현장 조건을 한 번 정리합니다.",
  },
  {
    id: "evidence",
    title: "근거 확인",
    description: "사업자 정보 확인, 공종, 포트폴리오와 등록된 리뷰를 따로 살펴봅니다.",
  },
  {
    id: "request",
    title: "조건 공유",
    description: "시·군·구와 프로젝트 조건을 전달하고 상세 주소는 방문 합의 뒤 공유합니다.",
  },
  {
    id: "compare",
    title: "동일 조건 비교",
    description: "같은 프로젝트 조건으로 요청하고 업체별 응답 차이를 비교합니다.",
  },
];

export function getConnectionJourney(): ConnectionJourneyStep[] {
  return CONNECTION_JOURNEY.map((step) => ({ ...step }));
}
