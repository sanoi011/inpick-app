/**
 * 도면 매핑 서비스
 *
 * 아파트 단지(complexNo)나 전용면적 기반으로 적합한 도면을 자동 매칭.
 * 추후 단지별 실제 도면이 확보되면 complexMappings에 등록하여 정확도 향상.
 *
 * 매칭 우선순위:
 *   1. complexNo 단지 전용 매핑 (가장 정확)
 *   2. 전용면적 범위 매핑 (범용)
 *   3. null (매칭 불가)
 */

import mapData from "./floor-plan-map.json";

// ─── Types ───

export interface AreaMapping {
  id: string;
  label: string;
  areaMin: number;
  areaMax: number;
  floorPlanId: string;
  roomCount: number;
  bathroomCount: number;
  description: string;
}

export interface ComplexTypeMapping {
  typeName: string;       // "59A", "84A" 등
  areaMin: number;
  areaMax: number;
  floorPlanId: string;    // sample-59, sample-84a 등
  roomCount?: number;
  bathroomCount?: number;
}

export interface ComplexMapping {
  complexName: string;
  types: ComplexTypeMapping[];
}

interface FloorPlanMapData {
  areaMappings: AreaMapping[];
  complexMappings: {
    mappings: Record<string, ComplexMapping>;
  };
}

// ─── Data Access ───

const data = mapData as unknown as FloorPlanMapData;

/**
 * complexNo로 단지 전용 도면 매핑 조회
 */
export function getComplexMapping(complexNo: string): ComplexMapping | null {
  return data.complexMappings.mappings[complexNo] || null;
}

/**
 * complexNo + pyeongNo (또는 면적)으로 도면 ID 조회
 *
 * 매칭 우선순위:
 *   1. complexNo + pyeongNo 직접 매칭 (가장 정확, 100% 일치)
 *   2. complexNo + 면적 범위 매핑 (동일 면적 타입 다수 시 오차 가능)
 *   3. 면적 범위 범용 매핑 (폴백)
 */
export function findFloorPlanId(
  complexNo: string | undefined,
  exclusiveArea: number,
  roomCount?: number,
  pyeongNo?: number
): string | undefined {
  if (complexNo) {
    // 1. pyeongNo 직접 매칭 (최우선)
    if (pyeongNo !== undefined) {
      const directId = `naver-${complexNo}-${pyeongNo}`;
      const complexMap = getComplexMapping(complexNo);
      if (complexMap) {
        const exact = complexMap.types.find((t) => t.floorPlanId === directId);
        if (exact) return directId;
      }
    }

    // 2. 면적 범위 매핑
    const complexMap = getComplexMapping(complexNo);
    if (complexMap) {
      const matched = complexMap.types.find(
        (t) => exclusiveArea >= t.areaMin && exclusiveArea <= t.areaMax
      );
      if (matched) return matched.floorPlanId;
    }
  }

  // 3. 면적 범위 범용 매핑 (폴백)
  return findByArea(exclusiveArea, roomCount);
}

/**
 * 전용면적 기반 도면 ID 조회
 */
export function findByArea(
  exclusiveArea: number,
  roomCount?: number
): string | undefined {
  const candidates = data.areaMappings.filter(
    (m) => exclusiveArea >= m.areaMin && exclusiveArea <= m.areaMax
  );

  if (candidates.length === 1) return candidates[0].floorPlanId;

  if (candidates.length > 1) {
    // 여러 매핑이 겹치면 (예: 84A와 84B 모두 80-90) 방수로 구분
    if (roomCount !== undefined) {
      const byRoom = candidates.find((c) => c.roomCount === roomCount);
      if (byRoom) return byRoom.floorPlanId;
    }
    // 기본: 첫 번째 반환 (A타입 우선)
    return candidates[0].floorPlanId;
  }

  // 폴백: 가장 가까운 면적의 샘플 반환
  if (data.areaMappings.length > 0) {
    const closest = data.areaMappings.reduce((prev, curr) => {
      const prevDist = Math.min(Math.abs(exclusiveArea - prev.areaMin), Math.abs(exclusiveArea - prev.areaMax));
      const currDist = Math.min(Math.abs(exclusiveArea - curr.areaMin), Math.abs(exclusiveArea - curr.areaMax));
      return currDist < prevDist ? curr : prev;
    });
    return closest.floorPlanId;
  }

  return undefined;
}

/**
 * 모든 면적 매핑 목록 (UI에서 도면 타입 선택용)
 */
export function getAreaMappings(): AreaMapping[] {
  return data.areaMappings;
}

/**
 * 특정 도면 ID가 존재하는지 확인
 */
export function hasFloorPlan(floorPlanId: string): boolean {
  // areaMappings에 있거나 complexMappings에 있으면 true
  const inArea = data.areaMappings.some((m) => m.floorPlanId === floorPlanId);
  if (inArea) return true;

  for (const cm of Object.values(data.complexMappings.mappings)) {
    if (cm.types.some((t) => t.floorPlanId === floorPlanId)) return true;
  }

  return false;
}

/**
 * 단지 전용 도면 매핑 등록 (런타임용, JSON 파일은 수동 수정 필요)
 *
 * 추후 관리자 페이지에서 도면 업로드 → 이 함수로 매핑 등록
 */
export function registerComplexMapping(
  complexNo: string,
  mapping: ComplexMapping
): void {
  data.complexMappings.mappings[complexNo] = mapping;
}
