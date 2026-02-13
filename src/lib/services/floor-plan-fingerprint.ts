/**
 * 도면 핑거프린트 + 중복 검사 서비스
 * 구조적 특징을 해시하여 유사 도면 감지
 */
import type { ParsedFloorPlan } from '@/types/floorplan';

/**
 * 도면의 구조적 핑거프린트 생성
 * - 방 수, 방 타입 분포, 면적 분포를 기반으로 해시
 * - 좌표와 무관하게 구조가 같으면 같은 핑거프린트
 */
export function generateFloorPlanFingerprint(floorPlan: ParsedFloorPlan): string {
  const parts: string[] = [];

  // 1. 전체 면적 (1m² 단위 버림)
  parts.push(`A${Math.floor(floorPlan.totalArea)}`);

  // 2. 방 수
  parts.push(`R${floorPlan.rooms.length}`);

  // 3. 방 타입 분포 (정렬)
  const typeCounts = new Map<string, number>();
  for (const room of floorPlan.rooms) {
    typeCounts.set(room.type, (typeCounts.get(room.type) || 0) + 1);
  }
  const sortedTypes = Array.from(typeCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}:${count}`)
    .join(',');
  parts.push(`T[${sortedTypes}]`);

  // 4. 면적 분포 시그니처 (크기순 정렬, 1m² 단위)
  const sortedAreas = floorPlan.rooms
    .map((r) => Math.floor(r.area))
    .sort((a, b) => b - a);
  parts.push(`S[${sortedAreas.join(',')}]`);

  // 5. 벽/문/창 수
  parts.push(`W${floorPlan.walls.length}`);
  parts.push(`D${floorPlan.doors.length}`);
  parts.push(`WN${floorPlan.windows.length}`);

  // 6. 설비 타입 분포
  if (floorPlan.fixtures && floorPlan.fixtures.length > 0) {
    const fixCounts = new Map<string, number>();
    for (const f of floorPlan.fixtures) {
      fixCounts.set(f.type, (fixCounts.get(f.type) || 0) + 1);
    }
    const sortedFix = Array.from(fixCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => `${type}:${count}`)
      .join(',');
    parts.push(`F[${sortedFix}]`);
  }

  return parts.join('|');
}

/**
 * 두 도면의 구조적 유사도 계산 (0~1)
 */
export function calculateStructuralSimilarity(
  a: ParsedFloorPlan,
  b: ParsedFloorPlan
): number {
  let score = 0;
  let weight = 0;

  // 1. 면적 유사도 (25%)
  const areaDiff = Math.abs(a.totalArea - b.totalArea);
  const areaMax = Math.max(a.totalArea, b.totalArea);
  if (areaMax > 0) {
    score += (1 - areaDiff / areaMax) * 0.25;
  }
  weight += 0.25;

  // 2. 방 수 유사도 (20%)
  const roomDiff = Math.abs(a.rooms.length - b.rooms.length);
  const roomMax = Math.max(a.rooms.length, b.rooms.length);
  if (roomMax > 0) {
    score += (1 - roomDiff / roomMax) * 0.2;
  }
  weight += 0.2;

  // 3. 방 타입 분포 유사도 (Jaccard, 25%)
  const aTypes = new Set(a.rooms.map((r) => r.type));
  const bTypes = new Set(b.rooms.map((r) => r.type));
  const intersection = Array.from(aTypes).filter((t) => bTypes.has(t)).length;
  const union = new Set([...Array.from(aTypes), ...Array.from(bTypes)]).size;
  if (union > 0) {
    score += (intersection / union) * 0.25;
  }
  weight += 0.25;

  // 4. 면적 분포 유사도 (30%)
  const aAreas = a.rooms.map((r) => r.area).sort((x, y) => y - x);
  const bAreas = b.rooms.map((r) => r.area).sort((x, y) => y - x);
  const minLen = Math.min(aAreas.length, bAreas.length);
  const maxLen = Math.max(aAreas.length, bAreas.length);

  if (minLen > 0) {
    let areaDistScore = 0;
    for (let i = 0; i < minLen; i++) {
      const diff = Math.abs(aAreas[i] - bAreas[i]);
      const max = Math.max(aAreas[i], bAreas[i]);
      areaDistScore += max > 0 ? 1 - diff / max : 1;
    }
    score += (areaDistScore / maxLen) * 0.3;
  }
  weight += 0.3;

  return weight > 0 ? score / weight * weight : 0;
}

/**
 * 핑거프린트 기반 빠른 중복 검사
 * - 정확히 같은 핑거프린트 = 높은 확률로 같은 도면
 */
export function isLikelyDuplicate(
  fingerprint: string,
  existingFingerprints: string[]
): boolean {
  return existingFingerprints.includes(fingerprint);
}

/**
 * 구조적 유사도 기반 중복 후보 탐색
 * - 유사도 > threshold인 항목 반환
 */
export function findSimilarFloorPlans(
  target: ParsedFloorPlan,
  candidates: { id: string; parsedData: ParsedFloorPlan }[],
  threshold: number = 0.85
): { id: string; similarity: number }[] {
  return candidates
    .map((c) => ({
      id: c.id,
      similarity: calculateStructuralSimilarity(target, c.parsedData),
    }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
