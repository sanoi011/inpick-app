/**
 * Track A 도면확보시스템 타입 정의
 */
import type { ParsedFloorPlan } from './floorplan';

// ─── 아파트 단지 ───

export interface Apartment {
  id: string;
  complexName: string;
  address?: string;
  region?: string;
  dongCount?: number;
  householdCount?: number;
  completionYear?: number;
  developer?: string;
  constructor?: string;
  source: 'manual' | 'crawl' | 'api';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── 평면도 타입 ───

export interface FloorPlanType {
  id: string;
  apartmentId: string;
  typeName: string;
  areaSqm?: number;
  supplyAreaSqm?: number;
  roomCount?: number;
  bathroomCount?: number;
  isExpanded: boolean;
  createdAt: string;
}

// ─── 도면 라이브러리 ───

export type SourceType = 'pdf' | 'image' | 'dwg' | 'dxf' | 'roomplan' | 'photo' | 'hand_drawing';
export type ParseMethod = 'gemini_vision' | 'pymupdf_hybrid' | 'dxf_parser' | 'roomplan' | 'photo_analysis' | 'mock';
export type CollectorType = 'manual_upload' | 'crawl' | 'api' | 'batch';

export interface QualityDetails {
  wallClosure: number;        // 벽체 폐합률 (0~1)
  areaAccuracy: number;       // 면적 정확도 (0~1)
  roomDetection: number;      // 방 감지 정확도 (0~1)
  fixtureDetection: number;   // 설비 감지 정확도 (0~1)
  overallScore: number;       // 종합 점수 (0~1)
}

export interface FloorPlanLibraryItem {
  id: string;
  floorPlanTypeId?: string;
  apartmentId?: string;

  sourceType: SourceType;
  sourceUrl?: string;
  sourceFileName?: string;
  sourceFileSize?: number;

  parsedData?: ParsedFloorPlan;
  parseMethod?: ParseMethod;
  confidence: number;

  qualityScore: number;
  qualityDetails: QualityDetails;
  isVerified: boolean;

  areaSqm?: number;
  roomCount?: number;
  wallCount?: number;
  doorCount?: number;
  windowCount?: number;
  fixtureCount?: number;

  fingerprint?: string;
  isDuplicate: boolean;
  duplicateOf?: string;

  collectedAt: string;
  parsedAt?: string;
  verifiedAt?: string;
  collectionJobId?: string;
  collectorType?: CollectorType;
}

// ─── 수집 작업 ───

export type JobType = 'manual_upload' | 'batch_parse' | 'crawl' | 'api_fetch';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CollectionJob {
  id: string;
  jobType: JobType;
  status: JobStatus;
  config: Record<string, unknown>;
  targetApartmentId?: string;

  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;

  resultSummary: Record<string, unknown>;
  errorMessage?: string;
  logs: string[];

  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy?: string;
}

// ─── DB ↔ 타입 변환 ───

export function mapDbToApartment(row: Record<string, unknown>): Apartment {
  return {
    id: row.id as string,
    complexName: row.complex_name as string,
    address: row.address as string | undefined,
    region: row.region as string | undefined,
    dongCount: row.dong_count as number | undefined,
    householdCount: row.household_count as number | undefined,
    completionYear: row.completion_year as number | undefined,
    developer: row.developer as string | undefined,
    constructor: (row as Record<string, unknown>)['constructor'] as string | undefined,
    source: (row.source as Apartment['source']) || 'manual',
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapDbToFloorPlanLibraryItem(row: Record<string, unknown>): FloorPlanLibraryItem {
  return {
    id: row.id as string,
    floorPlanTypeId: row.floor_plan_type_id as string | undefined,
    apartmentId: row.apartment_id as string | undefined,
    sourceType: row.source_type as SourceType,
    sourceUrl: row.source_url as string | undefined,
    sourceFileName: row.source_file_name as string | undefined,
    sourceFileSize: row.source_file_size as number | undefined,
    parsedData: row.parsed_data as ParsedFloorPlan | undefined,
    parseMethod: row.parse_method as ParseMethod | undefined,
    confidence: (row.confidence as number) || 0,
    qualityScore: (row.quality_score as number) || 0,
    qualityDetails: (row.quality_details as QualityDetails) || {
      wallClosure: 0, areaAccuracy: 0, roomDetection: 0, fixtureDetection: 0, overallScore: 0,
    },
    isVerified: (row.is_verified as boolean) || false,
    areaSqm: row.area_sqm as number | undefined,
    roomCount: row.room_count as number | undefined,
    wallCount: row.wall_count as number | undefined,
    doorCount: row.door_count as number | undefined,
    windowCount: row.window_count as number | undefined,
    fixtureCount: row.fixture_count as number | undefined,
    fingerprint: row.fingerprint as string | undefined,
    isDuplicate: (row.is_duplicate as boolean) || false,
    duplicateOf: row.duplicate_of as string | undefined,
    collectedAt: row.collected_at as string,
    parsedAt: row.parsed_at as string | undefined,
    verifiedAt: row.verified_at as string | undefined,
    collectionJobId: row.collection_job_id as string | undefined,
    collectorType: row.collector_type as CollectorType | undefined,
  };
}

export function mapDbToCollectionJob(row: Record<string, unknown>): CollectionJob {
  return {
    id: row.id as string,
    jobType: row.job_type as JobType,
    status: row.status as JobStatus,
    config: (row.config as Record<string, unknown>) || {},
    targetApartmentId: row.target_apartment_id as string | undefined,
    totalItems: (row.total_items as number) || 0,
    processedItems: (row.processed_items as number) || 0,
    successItems: (row.success_items as number) || 0,
    failedItems: (row.failed_items as number) || 0,
    resultSummary: (row.result_summary as Record<string, unknown>) || {},
    errorMessage: row.error_message as string | undefined,
    logs: (row.logs as string[]) || [],
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string | undefined,
  };
}
