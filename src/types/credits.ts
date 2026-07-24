// 크레딧 시스템 타입 정의

export interface UserCredits {
  id: string;
  userId: string;
  balance: number;
  freeGenerationsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "CHARGE" | "USE" | "FREE" | "REFUND";
  description: string;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  discount?: string;
}

// v2 정책 (2026-05-14):
//   - 토큰 1개 = 500원 (부가세 포함)
//   - 이미지 1장 생성 = 토큰 1개
//   - 회원가입 시 토큰 10개 자동 지급 (DB 트리거 grant_signup_tokens)
//   - 패키지는 payment_products.code 와 1:1 매핑
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "ai_credit_10", credits: 10, price: 5000, label: "토큰 10개" },
  { id: "ai_credit_30", credits: 33, price: 15000, label: "토큰 30개 +3", discount: "보너스 3" },
  { id: "ai_credit_100", credits: 115, price: 50000, label: "토큰 100개 +15", discount: "보너스 15" },
  { id: "ai_credit_300", credits: 360, price: 150000, label: "토큰 300개 +60", discount: "보너스 60" },
];

export const CREDITS_PER_GENERATION = 1;
export const FREE_GENERATION_LIMIT = 0; // 회원가입 +10 보너스로 대체
export const TOKEN_UNIT_PRICE_KRW = 500;

// Step3 세부견적 + 견적서/공정표/계약서 통합 다운로드 영구 공개권.
// 토큰 1개 500원 기준 약 1만원 상당이며, 같은 견적 버전은 재차감하지 않는다.
export const ESTIMATE_BUNDLE_TOKEN_COST = 20;

// PDF 견적서 단발 다운로드 가격 (부가세 포함)
export const ESTIMATE_PDF_PRICE_KRW = 9900;
export const ESTIMATE_PDF_PRODUCT_CODE = "estimate_pdf_single";
