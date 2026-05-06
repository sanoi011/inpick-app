/**
 * InPick 입찰·계약 파이프라인 — 정부기관(나라장터) + 하도급지킴이 + NICEDocu 패턴
 *
 * 7단계 + 명확한 status 코드 (state machine)
 */

export type BidStage =
  | "draft"           // 1. 견적 작성 중 (workflow Step1~3)
  | "rfq_published"   // 2. 견적 요청 등록 (사업자 풀 노출)
  | "bidding_open"    // 3. 입찰 진행 중 (사업자 입찰서 제출 가능)
  | "bidding_closed"  // 4. 입찰 마감 (소비자 비교·선정)
  | "selected"        // 5. 낙찰 (단일 사업자 선정 완료)
  | "contract_pending"// 6. 표준계약서 작성 중 (양측 서명 대기)
  | "contract_signed" // 7. 계약 체결 완료 (착공 가능)
  | "in_progress"     // 8. 시공 진행 중 (기성·검사 단계)
  | "completed"       // 9. 준공 완료
  | "warranty"        // 10. 하자보수 기간 (보통 1년)
  | "cancelled";      // 취소·유찰

export const STAGE_LABEL: Record<BidStage, string> = {
  draft: "견적 작성",
  rfq_published: "견적 요청 등록",
  bidding_open: "입찰 진행 중",
  bidding_closed: "입찰 마감",
  selected: "낙찰 완료",
  contract_pending: "계약 작성",
  contract_signed: "계약 체결",
  in_progress: "시공 진행",
  completed: "준공 완료",
  warranty: "하자보수 기간",
  cancelled: "취소·유찰",
};

export const STAGE_COLOR: Record<BidStage, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  rfq_published: "bg-blue-100 text-blue-700",
  bidding_open: "bg-amber-100 text-amber-700",
  bidding_closed: "bg-purple-100 text-purple-700",
  selected: "bg-emerald-100 text-emerald-700",
  contract_pending: "bg-indigo-100 text-indigo-700",
  contract_signed: "bg-cyan-100 text-cyan-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  warranty: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export const STAGE_ORDER: BidStage[] = [
  "draft",
  "rfq_published",
  "bidding_open",
  "bidding_closed",
  "selected",
  "contract_pending",
  "contract_signed",
  "in_progress",
  "completed",
  "warranty",
];

/** 기성지급 단계 (하도급지킴이 패턴) */
export interface PaymentMilestone {
  id: string;
  label: string;          // "착수금" | "기성 1차" | "준공금"
  ratio: number;          // 0.3 (30%)
  trigger: string;        // "계약 체결 시" | "골조 50% 완료" | "준공 검사 통과"
  protected: boolean;     // 하도급대금 지급보증 적용 여부
}

export const DEFAULT_PAYMENT_MILESTONES: PaymentMilestone[] = [
  {
    id: "deposit",
    label: "착수금",
    ratio: 0.3,
    trigger: "계약 체결 + 착공계 등록 시",
    protected: true,
  },
  {
    id: "interim_1",
    label: "기성 1차",
    ratio: 0.3,
    trigger: "철거·설비 완료 (공정률 40%)",
    protected: true,
  },
  {
    id: "interim_2",
    label: "기성 2차",
    ratio: 0.3,
    trigger: "마감재 시공 완료 (공정률 80%)",
    protected: true,
  },
  {
    id: "final",
    label: "준공금",
    ratio: 0.1,
    trigger: "준공 검사 통과 + 사용승인",
    protected: false,
  },
];

/** 표준계약서 필수 조항 (실내건축 표준계약서 — 국토부 고시) */
export interface ContractClause {
  id: string;
  title: string;
  category: "scope" | "payment" | "schedule" | "quality" | "warranty" | "dispute";
  required: boolean;
}

export const STANDARD_CLAUSES: ContractClause[] = [
  { id: "scope", title: "공사범위 명세 (자재·공정·면적)", category: "scope", required: true },
  { id: "amount", title: "총 도급금액 (VAT 포함)", category: "payment", required: true },
  { id: "milestones", title: "기성지급 단계 + 지급일", category: "payment", required: true },
  { id: "schedule", title: "착공일 + 준공일 + 공기", category: "schedule", required: true },
  { id: "delay", title: "지연배상금 (지연 1일당 0.1%)", category: "schedule", required: true },
  { id: "quality", title: "품질 기준 (KS·KCS·국토부 표준품셈)", category: "quality", required: true },
  { id: "warranty_period", title: "하자보수 기간 (방수 5년·구조 10년·기타 1년)", category: "warranty", required: true },
  { id: "warranty_bond", title: "하자보수 보증금 (총액 3%)", category: "warranty", required: true },
  { id: "subcontract_pay", title: "하도급대금 직접지급 (지급보증)", category: "payment", required: true },
  { id: "dispute", title: "분쟁 해결 (한국공정거래조정원 → 건설분쟁조정위)", category: "dispute", required: true },
  { id: "safety", title: "안전관리비 (총액 1.5%) + 산재보험 가입 의무", category: "scope", required: true },
];

/** RFQ(견적요청) 메타 — 나라장터 입찰공고 양식 참고 */
export interface RfqMeta {
  noticeNo: string;                    // 공고번호 INPICK-YYYYMMDD-XXXX
  publishedAt: string;
  deadlineAt: string;                  // 입찰 마감
  awardAt: string;                     // 낙찰 발표 예정
  region: { sido: string; gugun: string; fullAddress: string };
  spaceType: "주거" | "상업" | "주택" | "기타";
  exclusiveAreaM2: number;
  budgetWon: number;
  expansionType: "basic" | "extended" | null;
  rooms: string[];
  furnishings: Record<string, string[]>;
  noiseRestriction?: string;           // 거주중·평일오후만 등
  livingDuringWork?: boolean;
  preferredStartDate?: string;
  attachments: string[];               // 첨부 자료명 (자동)
  bidQualifications?: {
    minRating?: number;                // 최소 평점
    minTrustScore?: number;            // 최소 AI 신뢰도
    requiredLicenses?: string[];       // 필수 면허
    regionRestricted?: boolean;        // 지역 제한 여부
  };
}

/** 견적 진행 상태 + 다음 액션 추천 */
export function getNextAction(stage: BidStage): {
  actor: "consumer" | "contractor" | "system";
  action: string;
  cta?: string;
  href?: string;
} {
  switch (stage) {
    case "draft":
      return {
        actor: "consumer",
        action: "디자인·자재 선택을 마치고 견적을 등록해주세요",
        cta: "견적 등록",
        href: "/workflow/bidding",
      };
    case "rfq_published":
      return {
        actor: "system",
        action: "지역 사업자에게 공고 노출 중 — 보통 24~72시간 내 첫 입찰 도착",
      };
    case "bidding_open":
      return {
        actor: "consumer",
        action: "사업자별 입찰서를 비교하고 마감 후 선정해주세요",
        cta: "입찰 비교",
        href: "/mypage/contracts/progress",
      };
    case "bidding_closed":
      return {
        actor: "consumer",
        action: "입찰 마감 — 최저가·평점·메시지를 보고 사업자 선정",
        cta: "사업자 선정",
        href: "/mypage/contracts/progress",
      };
    case "selected":
      return {
        actor: "consumer",
        action: "낙찰 사업자와 표준계약서를 작성해주세요",
        cta: "계약서 작성",
        href: "/contract/consumer",
      };
    case "contract_pending":
      return {
        actor: "consumer",
        action: "계약 조항·기성지급 단계 합의 후 양측 서명",
        cta: "전자서명",
        href: "/contract/consumer",
      };
    case "contract_signed":
      return {
        actor: "contractor",
        action: "착공계 등록 + 시공 시작 (계약 후 14일 내)",
      };
    case "in_progress":
      return {
        actor: "system",
        action: "시공 진행 중 — 기성지급 단계 도달 시 알림",
      };
    case "completed":
      return {
        actor: "consumer",
        action: "준공 검사 + 잔금 지급 + 하자보수 보증서 수령",
      };
    case "warranty":
      return {
        actor: "consumer",
        action: "하자 발견 시 사업자에게 보수 요청 가능 (1년)",
      };
    case "cancelled":
      return {
        actor: "consumer",
        action: "취소된 입찰 — 새 견적을 등록할 수 있습니다",
        cta: "새 견적",
        href: "/workflow",
      };
  }
}
