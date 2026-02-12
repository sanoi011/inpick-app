export type ConsumerNotificationType =
  | "BID_RECEIVED"
  | "BID_SELECTED_CONFIRM"
  | "CONTRACT_CREATED"
  | "CONTRACT_SIGNED"
  | "PAYMENT_DUE"
  | "PAYMENT_CONFIRMED"
  | "PROJECT_UPDATE"
  | "PROJECT_COMPLETED"
  | "SYSTEM";

export type ConsumerNotificationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface ConsumerNotification {
  id: string;
  userId: string;
  type: ConsumerNotificationType;
  title: string;
  message: string;
  priority: ConsumerNotificationPriority;
  isRead: boolean;
  link?: string;
  referenceId?: string;
  createdAt: string;
}

export function mapDbConsumerNotification(row: Record<string, unknown>): ConsumerNotification {
  return {
    id: (row.id as string) || "",
    userId: (row.user_id as string) || "",
    type: ((row.type as string) || "SYSTEM") as ConsumerNotificationType,
    title: (row.title as string) || "",
    message: (row.message as string) || "",
    priority: ((row.priority as string) || "MEDIUM") as ConsumerNotificationPriority,
    isRead: (row.is_read as boolean) || false,
    link: (row.link as string) || undefined,
    referenceId: (row.reference_id as string) || undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

export const CONSUMER_NOTIFICATION_TYPE_LABELS: Record<ConsumerNotificationType, string> = {
  BID_RECEIVED: "새 입찰",
  BID_SELECTED_CONFIRM: "업체 선정",
  CONTRACT_CREATED: "계약서 생성",
  CONTRACT_SIGNED: "계약 체결",
  PAYMENT_DUE: "결제 예정",
  PAYMENT_CONFIRMED: "결제 확인",
  PROJECT_UPDATE: "프로젝트 업데이트",
  PROJECT_COMPLETED: "시공 완료",
  SYSTEM: "시스템",
};

export const CONSUMER_NOTIFICATION_PRIORITY_COLORS: Record<ConsumerNotificationPriority, string> = {
  HIGH: "border-l-red-500",
  MEDIUM: "border-l-amber-400",
  LOW: "border-l-gray-300",
};

export const CONSUMER_NOTIFICATION_TYPE_FILTER: Record<string, ConsumerNotificationType[]> = {
  입찰: ["BID_RECEIVED", "BID_SELECTED_CONFIRM"],
  계약: ["CONTRACT_CREATED", "CONTRACT_SIGNED"],
  결제: ["PAYMENT_DUE", "PAYMENT_CONFIRMED"],
  시스템: ["PROJECT_UPDATE", "PROJECT_COMPLETED", "SYSTEM"],
};
