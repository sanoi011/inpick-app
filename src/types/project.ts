export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface PhasePhoto {
  url: string;
  fileName?: string;
  uploadedAt: string;
}

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  phaseOrder: number;
  status: PhaseStatus;
  startDate?: string;
  endDate?: string;
  dependencies: string[];
  checklist: ChecklistItem[];
  notes?: string;
  photos: PhasePhoto[];
  createdAt: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  assignedTo?: string;
  createdAt: string;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  activityType: string;
  description: string;
  actor?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  contractId?: string;
  estimateId?: string;
  contractorId: string;
  name: string;
  address?: string;
  status: ProjectStatus;
  totalBudget: number;
  startDate?: string;
  endDate?: string;
  progressPct: number;
  phases: ProjectPhase[];
  issues: ProjectIssue[];
  activities: ProjectActivity[];
  createdAt: string;
  updatedAt: string;
}

// DB → 프론트엔드 변환
export function mapDbProject(db: Record<string, unknown>): Project {
  const phases = (db.project_phases as Record<string, unknown>[] | undefined) || [];
  const issues = (db.project_issues as Record<string, unknown>[] | undefined) || [];
  const activities = (db.project_activities as Record<string, unknown>[] | undefined) || [];

  return {
    id: db.id as string,
    contractId: db.contract_id as string | undefined,
    estimateId: db.estimate_id as string | undefined,
    contractorId: db.contractor_id as string,
    name: (db.name as string) || '',
    address: db.address as string | undefined,
    status: mapProjectStatus(db.status as string),
    totalBudget: (db.total_budget as number) || 0,
    startDate: db.start_date as string | undefined,
    endDate: db.end_date as string | undefined,
    progressPct: (db.progress_pct as number) || 0,
    phases: phases.map(mapDbPhase),
    issues: issues.map(mapDbIssue),
    activities: activities.map(mapDbActivity),
    createdAt: db.created_at as string,
    updatedAt: db.updated_at as string,
  };
}

function mapDbPhase(db: Record<string, unknown>): ProjectPhase {
  return {
    id: db.id as string,
    projectId: db.project_id as string,
    name: (db.name as string) || '',
    phaseOrder: (db.phase_order as number) || 0,
    status: mapPhaseStatus(db.status as string),
    startDate: db.start_date as string | undefined,
    endDate: db.end_date as string | undefined,
    dependencies: (db.dependencies as string[]) || [],
    checklist: (db.checklist as ChecklistItem[]) || [],
    notes: db.notes as string | undefined,
    photos: (db.photos as PhasePhoto[]) || [],
    createdAt: db.created_at as string,
  };
}

function mapDbIssue(db: Record<string, unknown>): ProjectIssue {
  return {
    id: db.id as string,
    projectId: db.project_id as string,
    title: (db.title as string) || '',
    description: db.description as string | undefined,
    severity: mapSeverity(db.severity as string),
    status: mapIssueStatus(db.status as string),
    assignedTo: db.assigned_to as string | undefined,
    createdAt: db.created_at as string,
  };
}

function mapDbActivity(db: Record<string, unknown>): ProjectActivity {
  return {
    id: db.id as string,
    projectId: db.project_id as string,
    activityType: (db.activity_type as string) || '',
    description: (db.description as string) || '',
    actor: db.actor as string | undefined,
    createdAt: db.created_at as string,
  };
}

function mapProjectStatus(s: string): ProjectStatus {
  switch (s) {
    case 'in_progress': return 'IN_PROGRESS';
    case 'on_hold': return 'ON_HOLD';
    case 'completed': return 'COMPLETED';
    case 'cancelled': return 'CANCELLED';
    default: return 'PLANNING';
  }
}

function mapPhaseStatus(s: string): PhaseStatus {
  switch (s) {
    case 'in_progress': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'skipped': return 'SKIPPED';
    default: return 'PENDING';
  }
}

function mapSeverity(s: string): IssueSeverity {
  switch (s) {
    case 'high': return 'HIGH';
    case 'critical': return 'CRITICAL';
    case 'low': return 'LOW';
    default: return 'MEDIUM';
  }
}

function mapIssueStatus(s: string): IssueStatus {
  switch (s) {
    case 'in_progress': return 'IN_PROGRESS';
    case 'resolved': return 'RESOLVED';
    case 'closed': return 'CLOSED';
    default: return 'OPEN';
  }
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: '준비중',
  IN_PROGRESS: '진행중',
  ON_HOLD: '일시중지',
  COMPLETED: '완료',
  CANCELLED: '취소',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const PHASE_STATUS_COLORS: Record<PhaseStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SKIPPED: 'bg-gray-50 text-gray-400',
};

export const ISSUE_SEVERITY_COLORS: Record<IssueSeverity, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export const DEFAULT_PHASES = [
  '철거',
  '기초/설비 배관',
  '전기 배선',
  '목공',
  '타일/방수',
  '도배/도장',
  '마무리/검수',
];
