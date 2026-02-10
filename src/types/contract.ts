export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export type PaymentStatus = 'PENDING' | 'PAID';

export interface PaymentSchedule {
  phase: string;
  percentage: number;
  amount: number;
  dueDate?: string;
  paidAt?: string;
  status: PaymentStatus;
}

export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Contract {
  id: string;
  estimateId: string;
  bidId: string;
  consumerId: string;
  contractorId: string;
  projectName: string;
  address: string;
  totalAmount: number;
  depositAmount: number;
  progressPayments: PaymentSchedule[];
  finalPayment: number;
  startDate: string;
  expectedEndDate: string;
  consultSessionId: string;
  consultLogSnapshot: ChatMessage[];
  consumerSignature?: string;
  contractorSignature?: string;
  signedAt?: string;
  status: ContractStatus;
  createdAt: string;
}

// DB → 프론트엔드 변환
export function mapDbContract(db: Record<string, unknown>): Contract {
  const payments = (db.progress_payments as PaymentSchedule[]) || [];

  return {
    id: db.id as string,
    estimateId: db.estimate_id as string,
    bidId: db.bid_id as string,
    consumerId: (db.consumer_id as string) || '',
    contractorId: db.contractor_id as string,
    projectName: (db.project_name as string) || '',
    address: (db.address as string) || '',
    totalAmount: (db.total_amount as number) || 0,
    depositAmount: (db.deposit_amount as number) || 0,
    progressPayments: payments,
    finalPayment: (db.final_payment as number) || 0,
    startDate: (db.start_date as string) || '',
    expectedEndDate: (db.expected_end_date as string) || '',
    consultSessionId: (db.consult_session_id as string) || '',
    consultLogSnapshot: (db.consult_log_snapshot as ChatMessage[]) || [],
    consumerSignature: db.consumer_signature as string | undefined,
    contractorSignature: db.contractor_signature as string | undefined,
    signedAt: db.signed_at as string | undefined,
    status: mapContractStatus(db.status as string),
    createdAt: db.created_at as string,
  };
}

function mapContractStatus(s: string): ContractStatus {
  switch (s) {
    case 'pending_signature': return 'PENDING_SIGNATURE';
    case 'signed': return 'SIGNED';
    case 'in_progress': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    default: return 'DRAFT';
  }
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: '초안',
  PENDING_SIGNATURE: '서명 대기',
  SIGNED: '서명 완료',
  IN_PROGRESS: '시공중',
  COMPLETED: '완공',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_SIGNATURE: 'bg-amber-100 text-amber-700',
  SIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

// 기본 결제 스케줄 생성
export function createDefaultPaymentSchedule(totalAmount: number): {
  deposit: number;
  progressPayments: PaymentSchedule[];
  finalPayment: number;
} {
  const deposit = Math.round(totalAmount * 0.1);
  const progress1 = Math.round(totalAmount * 0.3);
  const progress2 = Math.round(totalAmount * 0.3);
  const finalPayment = totalAmount - deposit - progress1 - progress2;

  return {
    deposit,
    progressPayments: [
      { phase: '착공', percentage: 10, amount: deposit, status: 'PENDING' },
      { phase: '중도 1차 (철거/기초)', percentage: 30, amount: progress1, status: 'PENDING' },
      { phase: '중도 2차 (마감)', percentage: 30, amount: progress2, status: 'PENDING' },
      { phase: '잔금 (완공/검수)', percentage: 30, amount: finalPayment, status: 'PENDING' },
    ],
    finalPayment,
  };
}
