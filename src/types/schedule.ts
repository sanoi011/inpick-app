export type ScheduleType = 'PROJECT' | 'MEETING' | 'INSPECTION' | 'DELIVERY' | 'PERSONAL' | 'OTHER';
export type ScheduleStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type CalendarView = 'monthly' | 'weekly' | 'daily';

export interface Worker {
  id: string;
  name: string;
  role: string;
  phone?: string;
}

export interface ScheduleItem {
  id: string;
  contractorId: string;
  projectId?: string;
  projectName?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  title: string;
  description?: string;
  location?: string;
  scheduleType: ScheduleType;
  status: ScheduleStatus;
  workers: Worker[];
  color?: string;
  createdAt: string;
}

export interface ScheduleConflict {
  date: string;
  itemA: ScheduleItem;
  itemB: ScheduleItem;
  severity: 'WARNING' | 'ERROR';
  suggestion?: string;
}

export interface DayAvailability {
  date: string;
  status: 'AVAILABLE' | 'PARTIAL' | 'BUSY';
  scheduledCount: number;
}

// DB → 프론트엔드 변환
export function mapDbSchedule(db: Record<string, unknown>): ScheduleItem {
  return {
    id: db.id as string,
    contractorId: db.contractor_id as string,
    projectId: db.project_id as string | undefined,
    projectName: db.project_name as string | undefined,
    date: db.date as string,
    startTime: db.start_time as string | undefined,
    endTime: db.end_time as string | undefined,
    isAllDay: db.start_time == null,
    title: (db.title as string) || (db.description as string) || '',
    description: db.description as string | undefined,
    location: db.location as string | undefined,
    scheduleType: mapScheduleType(db.schedule_type as string),
    status: mapScheduleStatus(db.status as string),
    workers: (db.workers as Worker[]) || (db.assigned_workers as Worker[]) || [],
    color: db.color as string | undefined,
    createdAt: db.created_at as string,
  };
}

function mapScheduleType(s: string): ScheduleType {
  switch (s) {
    case 'project': case 'CONSTRUCTION': case 'SITE_VISIT': return 'PROJECT';
    case 'meeting': case 'MEETING': return 'MEETING';
    case 'inspection': case 'INSPECTION': return 'INSPECTION';
    case 'delivery': case 'DELIVERY': return 'DELIVERY';
    case 'personal': return 'PERSONAL';
    default: return 'OTHER';
  }
}

function mapScheduleStatus(s: string): ScheduleStatus {
  switch (s) {
    case 'in_progress': case 'IN_PROGRESS': return 'IN_PROGRESS';
    case 'completed': case 'COMPLETED': return 'COMPLETED';
    case 'cancelled': case 'CANCELLED': return 'CANCELLED';
    default: return 'SCHEDULED';
  }
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  PROJECT: '현장 시공',
  MEETING: '미팅',
  INSPECTION: '검수',
  DELIVERY: '자재 입고',
  PERSONAL: '개인',
  OTHER: '기타',
};

export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  PROJECT: 'bg-blue-500',
  MEETING: 'bg-purple-500',
  INSPECTION: 'bg-amber-500',
  DELIVERY: 'bg-green-500',
  PERSONAL: 'bg-gray-400',
  OTHER: 'bg-gray-300',
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
};
