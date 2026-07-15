export const BUSINESS_INQUIRY_TYPES = [
  { value: "material_supplier", label: "자재 납품·유통업체", shortLabel: "납품업체" },
  { value: "material_manufacturer", label: "자재 제조업체", shortLabel: "제조업체" },
  { value: "regional_contractor", label: "지역별 인테리어 협력업체", shortLabel: "협력업체" },
] as const;

export type BusinessInquiryType = (typeof BUSINESS_INQUIRY_TYPES)[number]["value"];

export const BUSINESS_INQUIRY_STATUSES = ["new", "reviewing", "contacted", "approved", "rejected", "closed"] as const;
export type BusinessInquiryStatus = (typeof BUSINESS_INQUIRY_STATUSES)[number];

export const BUSINESS_MENU_ITEMS = [
  { label: "비즈니스 문의·협업 등록", description: "자재·제조·지역 시공 제휴", href: "/business" },
  { label: "사업자 입찰공고", description: "지역·예산별 맞춤 공고", href: "/contractor/bids" },
  { label: "사업자 대시보드", description: "공고·프로젝트·정산 관리", href: "/contractor" },
  { label: "사업자 AI 비서", description: "견적·시공 업무 AI 지원", href: "/contractor/ai" },
  { label: "사업자 등록", description: "시공·자재 파트너 계정 신청", href: "/contractor/register" },
  { label: "사업자 로그인", description: "InPick Business 접속", href: "/auth?type=contractor" },
] as const;

export const AD_BANNER_PLACEMENTS = [
  { value: "home_mid", label: "메인 · 앱 안내 아래" },
  { value: "business_home_hero", label: "비즈니스 문의 · 상단" },
  { value: "partial_ai_materials", label: "부분 AI · 공간 선택 위" },
  { value: "partial_install_results", label: "부분시공 · 검색 상단" },
  { value: "contractor_bids_top", label: "사업자 입찰공고 · 상단" },
  { value: "contractor_dashboard_top", label: "사업자 대시보드 · 상단" },
] as const;

export type AdBannerPlacement = (typeof AD_BANNER_PLACEMENTS)[number]["value"];

export const AD_PARTNER_STATUSES = ["lead", "active", "paused", "ended"] as const;
export type AdPartnerStatus = (typeof AD_PARTNER_STATUSES)[number];
