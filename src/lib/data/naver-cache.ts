/**
 * 네이버 부동산 캐시 데이터 조회
 *
 * Vercel 클라우드 IP에서 네이버 API가 차단되므로,
 * 로컬에서 미리 캐시한 데이터를 사용하여 폴백 제공.
 *
 * 캐시 데이터 생성: node scripts/cache-naver-data.mjs <cortarNo>
 */

import type { NaverComplex } from "@/lib/services/naver-land-client";
import cacheData from "./naver-cache.json";

// ─── Types ───

interface CachedRegion {
  complexes: CachedComplex[];
  fetchedAt: string;
}

interface CachedComplex {
  complexNo: string;
  complexName: string;
  cortarNo?: string;
  totalDongCount: number;
  totalHouseholdCount: number;
  approvalDate: string;
  address: string;
  highFloor?: number;
  lowFloor?: number;
}

type CacheStore = Record<string, CachedRegion>;

// ─── Cache Access ───

const cache: CacheStore = cacheData as CacheStore;

/**
 * 건물명 퍼지 매칭 (naver-land-client.ts의 matchesComplexName과 동일 로직)
 */
function matchesComplexName(searchName: string, complexName: string): boolean {
  const a = searchName.toLowerCase().replace(/\s/g, "");
  const b = complexName.toLowerCase().replace(/\s/g, "");

  // 1. Direct includes
  if (a.includes(b) || b.includes(a)) return true;

  // 2. "X단지" pattern matching + common prefix
  const danjiA = a.match(/(\d+)\s*단지/);
  const danjiB = b.match(/(\d+)\s*단지/);

  if (danjiA && danjiB && danjiA[1] === danjiB[1]) {
    const prefixA = a.replace(/아파트|마을|단지.*$/g, "");
    const prefixB = b.replace(/아파트|마을|단지.*$/g, "");
    if (
      prefixA.length >= 2 &&
      prefixB.length >= 2 &&
      (prefixA.startsWith(prefixB.slice(0, 2)) ||
        prefixB.startsWith(prefixA.slice(0, 2)))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 캐시된 데이터에서 단지 검색
 *
 * @param cortarNo - 법정동 코드 (10자리)
 * @param buildingName - 건물명 (선택, 퍼지 매칭)
 * @returns 매칭된 NaverComplex 또는 null
 */
export function findCachedComplex(
  cortarNo: string,
  buildingName?: string
): NaverComplex | null {
  const region = cache[cortarNo];
  if (!region || !region.complexes || region.complexes.length === 0) {
    return null;
  }

  const complexes = region.complexes;

  // buildingName이 없으면 단지가 1개인 경우에만 반환
  if (!buildingName) {
    if (complexes.length === 1) {
      return toNaverComplex(complexes[0]);
    }
    return null;
  }

  // 1. Direct includes match
  const name = buildingName.toLowerCase().replace(/\s/g, "");
  let matched = complexes.find((c) => {
    const cName = c.complexName.toLowerCase().replace(/\s/g, "");
    return cName.includes(name) || name.includes(cName);
  });

  // 2. Fuzzy match (단지 number + prefix)
  if (!matched) {
    matched = complexes.find((c) =>
      matchesComplexName(buildingName, c.complexName)
    );
  }

  // 3. 매칭 실패, 단지가 1개면 자동 선택
  if (!matched && complexes.length === 1) {
    matched = complexes[0];
  }

  return matched ? toNaverComplex(matched) : null;
}

/**
 * 캐시된 데이터에서 특정 지역의 모든 단지 목록 반환
 */
export function getCachedComplexes(cortarNo: string): NaverComplex[] {
  const region = cache[cortarNo];
  if (!region || !region.complexes) return [];
  return region.complexes.map(toNaverComplex);
}

/**
 * 캐시된 지역 목록
 */
export function getCachedRegions(): string[] {
  return Object.keys(cache);
}

/**
 * 캐시 데이터의 fetchedAt 조회
 */
export function getCacheFetchedAt(cortarNo: string): string | null {
  return cache[cortarNo]?.fetchedAt || null;
}

// ─── Helpers ───

function toNaverComplex(c: CachedComplex): NaverComplex {
  return {
    complexNo: c.complexNo,
    complexName: c.complexName,
    totalDongCount: c.totalDongCount,
    totalHouseholdCount: c.totalHouseholdCount,
    approvalDate: c.approvalDate,
    address: c.address,
    highFloor: c.highFloor,
    lowFloor: c.lowFloor,
  };
}
