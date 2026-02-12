import type { ProjectAddress, ProjectEstimate } from "./consumer-project";

// 소비자 → Supabase 견적요청 제출 페이로드
export interface RfqSubmission {
  projectId: string;
  address: ProjectAddress;
  estimateData: ProjectEstimate;
  rfqPreferences: RfqPreferences;
}

export interface RfqPreferences {
  specialNotes: string;
  preferredStartDate?: string;
  preferredDuration?: string;
  budgetRange?: string;
  livingDuringWork: boolean;
  noiseRestriction?: string;
}

// API 응답
export interface RfqResponse {
  estimateId: string;
  status: string;
  notifiedContractors: number;
}

// DB에서 조회한 알림
export interface ContractorNotification {
  id: string;
  contractorId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  link?: string;
  referenceId?: string;
  createdAt: string;
}

export function mapDbNotification(row: Record<string, unknown>): ContractorNotification {
  return {
    id: row.id as string,
    contractorId: row.contractor_id as string,
    type: row.type as string,
    title: row.title as string,
    message: row.message as string || "",
    priority: row.priority as string,
    isRead: row.is_read as boolean,
    link: row.link as string | undefined,
    referenceId: row.reference_id as string | undefined,
    createdAt: row.created_at as string,
  };
}
