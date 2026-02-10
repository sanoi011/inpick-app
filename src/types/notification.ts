export type NotificationType = 'BID_NEW' | 'BID_DEADLINE' | 'PAYMENT_RECEIVED' | 'PAYMENT_OVERDUE' | 'PROJECT_DELAY' | 'COLLABORATION_REQUEST' | 'COLLABORATION_RESPONSE' | 'REVIEW_NEW' | 'SCHEDULE_CONFLICT' | 'SYSTEM';
export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: string;
  contractorId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriority, string> = {
  HIGH: 'border-l-red-500 bg-red-50',
  MEDIUM: 'border-l-amber-500 bg-amber-50',
  LOW: 'border-l-gray-300 bg-gray-50',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  BID_NEW: '새 입찰 공고',
  BID_DEADLINE: '입찰 마감 임박',
  PAYMENT_RECEIVED: '입금 확인',
  PAYMENT_OVERDUE: '미수금 연체',
  PROJECT_DELAY: '프로젝트 지연',
  COLLABORATION_REQUEST: '협업 요청',
  COLLABORATION_RESPONSE: '협업 응답',
  REVIEW_NEW: '새 리뷰',
  SCHEDULE_CONFLICT: '일정 충돌',
  SYSTEM: '시스템 알림',
};
