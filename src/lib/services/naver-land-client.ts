/**
 * 네이버 부동산 내부 API 클라이언트
 * 아파트 단지 검색 및 평형 상세 정보 조회
 */

const NAVER_LAND_API = "https://new.land.naver.com/api";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://new.land.naver.com/",
};

// ─── Helpers ───

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

// ─── Types ───

export interface NaverComplex {
  complexNo: string;
  complexName: string;
  totalDongCount: number;
  totalHouseholdCount: number;
  approvalDate: string;
  address: string;
}

export interface NaverPyeongDetail {
  pyeongNo: number;
  pyeongName: string;
  exclusiveArea: number;
  supplyArea: number;
  roomCnt: number;
  bathroomCnt: number;
  entranceType: string;
  householdCountByPyeong: number;
}

export interface NaverComplexDetail {
  complex: NaverComplex;
  pyeongList: NaverPyeongDetail[];
}

// ─── API Functions ───

/**
 * 법정동 코드로 해당 지역의 아파트 단지 목록 조회
 */
export async function searchComplexByRegion(
  cortarNo: string
): Promise<NaverComplex[]> {
  try {
    const url = `${NAVER_LAND_API}/regions/complexes?cortarNo=${cortarNo}&realEstateType=APT&order=`;
    const res = await fetchWithRetry(url, { headers: HEADERS });

    if (!res.ok) return [];

    const data = await res.json();
    const list = data?.complexList || [];

    return list.map((c: Record<string, unknown>) => ({
      complexNo: String(c.complexNo || ""),
      complexName: String(c.complexName || ""),
      totalDongCount: Number(c.totalDongCount || 0),
      totalHouseholdCount: Number(c.totalHouseholdCount || 0),
      approvalDate: String(c.useApproveYmd || ""),
      address: String(c.address || ""),
    }));
  } catch (err) {
    console.error("Naver searchComplexByRegion error:", err);
    return [];
  }
}

/**
 * complexNo로 단지 상세 + 평형 목록 조회
 */
export async function getComplexDetail(
  complexNo: string
): Promise<NaverComplexDetail | null> {
  try {
    const url = `${NAVER_LAND_API}/complexes/${complexNo}?sameAddressGroup=false`;
    const res = await fetchWithRetry(url, {
      headers: {
        ...HEADERS,
        Referer: `https://new.land.naver.com/complexes/${complexNo}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const detail = data?.complexDetail;
    const pyeongList = data?.complexPyeongDetailList || [];

    if (!detail) return null;

    return {
      complex: {
        complexNo: String(detail.complexNo || complexNo),
        complexName: String(detail.complexName || ""),
        totalDongCount: Number(detail.totalDongCount || 0),
        totalHouseholdCount: Number(detail.totalHouseholdCount || 0),
        approvalDate: String(detail.useApproveYmd || ""),
        address: String(detail.address || ""),
      },
      pyeongList: pyeongList.map((p: Record<string, unknown>) => ({
        pyeongNo: Number(p.pyeongNo || 0),
        pyeongName: String(p.pyeongName || ""),
        exclusiveArea: Number(p.exclusiveArea || 0),
        supplyArea: Number(p.supplyArea || 0),
        roomCnt: Number(p.roomCnt || 0),
        bathroomCnt: Number(p.bathroomCnt || 0),
        entranceType: String(p.entranceTypeName || ""),
        householdCountByPyeong: Number(p.householdCountByPyeong || 0),
      })),
    };
  } catch (err) {
    console.error("Naver getComplexDetail error:", err);
    return null;
  }
}

/**
 * 주소 + 건물명으로 네이버 부동산 단지 검색 → 상세 반환
 * cortarNo: 법정동/행정동코드 10자리 (JUSO API의 admCd)
 */
export async function findComplexByAddress(
  cortarNo: string,
  buildingName?: string
): Promise<NaverComplexDetail | null> {
  if (!cortarNo || cortarNo.length < 5) return null;

  try {
    // 1. 해당 지역의 아파트 단지 목록
    const complexes = await searchComplexByRegion(cortarNo);
    if (complexes.length === 0) return null;

    // 2. 건물명으로 매칭
    let matched: NaverComplex | undefined;

    if (buildingName) {
      const name = buildingName.toLowerCase().replace(/\s/g, "");
      matched = complexes.find((c) => {
        const cName = c.complexName.toLowerCase().replace(/\s/g, "");
        return cName.includes(name) || name.includes(cName);
      });
    }

    // 건물명 매칭 실패 시 단지가 1개면 자동 선택
    if (!matched && complexes.length === 1) {
      matched = complexes[0];
    }

    if (!matched) return null;

    // 3. 상세 조회 (rate limit 방지 1초 딜레이)
    await new Promise((r) => setTimeout(r, 1000));
    return await getComplexDetail(matched.complexNo);
  } catch (err) {
    console.error("Naver findComplexByAddress error:", err);
    return null;
  }
}
