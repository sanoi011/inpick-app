/**
 * 네이버 부동산 내부 API 클라이언트
 * 아파트 단지 검색 및 평형 상세 정보 조회
 *
 * ── Rate Limit Bypass ──
 * Naver Land API returns 429 for requests without a valid session cookie.
 * The fix is a two-step approach:
 *   1. Visit the main page (https://new.land.naver.com/) to obtain
 *      server-set cookies: REALESTATE, PROP_TEST_KEY, PROP_TEST_ID
 *   2. Send the cookies (especially PROP_TEST_KEY) with every API call
 *
 * The PROP_TEST_KEY cookie is the critical one. It is set by the server
 * (not JavaScript), has a 30-day expiry, and Domain=.land.naver.com.
 * Additionally, browser-like headers (sec-ch-ua, sec-fetch-*, Referer)
 * must be present.
 *
 * Cookies are cached for 10 minutes and automatically refreshed.
 */

const NAVER_LAND_API = "https://new.land.naver.com/api";
const MAIN_PAGE_URL = "https://new.land.naver.com/";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

// ─── Cookie Session Manager ───

let _cachedCookies: string | null = null;
let _cookieExpiresAt = 0;

/**
 * Obtain session cookies by visiting the Naver Land main page.
 * Cookies are cached for 10 minutes to avoid unnecessary requests.
 */
async function ensureCookies(): Promise<string> {
  const now = Date.now();
  if (_cachedCookies && now < _cookieExpiresAt) {
    return _cachedCookies;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const res = await fetch(MAIN_PAGE_URL, {
    headers: {
      ...BROWSER_HEADERS,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: controller.signal,
  });
  clearTimeout(timeout);

  // Parse Set-Cookie headers (with fallback for environments where getSetCookie is unavailable)
  let rawCookies: string[] = [];
  if (typeof res.headers.getSetCookie === "function") {
    rawCookies = res.headers.getSetCookie();
  } else {
    // Fallback: parse from raw 'set-cookie' header (comma-separated)
    const setCookieHeader = res.headers.get("set-cookie") || "";
    if (setCookieHeader) {
      // Split on comma followed by space + cookie name pattern (not within expires date)
      rawCookies = setCookieHeader.split(/,(?=\s*[A-Za-z_]+=)/);
    }
  }
  _cachedCookies = rawCookies.map((c) => c.split(";")[0].trim()).join("; ");

  // Cache for 10 minutes
  _cookieExpiresAt = now + 10 * 60 * 1000;

  // Consume the response body to free the connection
  await res.text();

  console.log(
    `[naver-land] Cookie fetch: status=${res.status}, cookies=${_cachedCookies ? _cachedCookies.substring(0, 80) + "..." : "(empty)"}`
  );

  return _cachedCookies;
}

// ─── Helpers ───

async function naverFetch(url: string, retries = 1): Promise<Response> {
  const cookie = await ensureCookies();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json",
      Referer: MAIN_PAGE_URL,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      Cookie: cookie,
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (res.status === 429 && retries > 0) {
    // Force cookie refresh and retry
    _cachedCookies = null;
    _cookieExpiresAt = 0;
    await new Promise((r) => setTimeout(r, 500));
    return naverFetch(url, retries - 1);
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
  highFloor?: number;
  lowFloor?: number;
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
  grandPlanUrl?: string;
}

export interface NaverDong {
  dongNo: string;
  dongName: string;
}

export interface NaverComplexDetail {
  complex: NaverComplex;
  pyeongList: NaverPyeongDetail[];
  dongList?: NaverDong[];
  realEstateType?: string; // APT, VL, OPST
}

// ─── API Functions ───

/**
 * 법정동 코드로 해당 지역의 단지 목록 조회
 * @param realEstateType - APT(아파트), VL(빌라/연립), OPST(오피스텔)
 */
export async function searchComplexByRegion(
  cortarNo: string,
  realEstateType: string = "APT"
): Promise<NaverComplex[]> {
  try {
    const url = `${NAVER_LAND_API}/regions/complexes?cortarNo=${cortarNo}&realEstateType=${realEstateType}&order=`;
    const res = await naverFetch(url);

    if (!res.ok) return [];

    const data = await res.json();
    const list = data?.complexList || [];

    return list.map((c: Record<string, unknown>) => ({
      complexNo: String(c.complexNo || ""),
      complexName: String(c.complexName || ""),
      totalDongCount: Number(c.totalBuildingCount || c.totalDongCount || 0),
      totalHouseholdCount: Number(c.totalHouseholdCount || 0),
      approvalDate: String(c.useApproveYmd || ""),
      address: String(c.cortarAddress || c.address || ""),
      highFloor: c.highFloor ? Number(c.highFloor) : undefined,
      lowFloor: c.lowFloor ? Number(c.lowFloor) : undefined,
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
    const res = await naverFetch(url);

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
 * 건물명 퍼지 매칭
 * "반석마을아파트2단지" ↔ "반석2단지계룡리슈빌" 매칭 지원
 */
function matchesComplexName(searchName: string, complexName: string): boolean {
  const a = searchName.toLowerCase().replace(/\s/g, "");
  const b = complexName.toLowerCase().replace(/\s/g, "");

  // 1. Direct includes
  if (a.includes(b) || b.includes(a)) return true;

  // 2. "X단지" 패턴 매칭 + 공통 접두사
  const danjiA = a.match(/(\d+)\s*단지/);
  const danjiB = b.match(/(\d+)\s*단지/);

  if (danjiA && danjiB && danjiA[1] === danjiB[1]) {
    // Same 단지 number — check for shared prefix (2+ chars before digits)
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
 * 주소 + 건물명으로 네이버 부동산 단지 검색 → 상세 반환
 * cortarNo: 법정동/행정동코드 10자리 (JUSO API의 admCd)
 * 아파트 → 빌라 → 오피스텔 순서로 검색
 */
export async function findComplexByAddress(
  cortarNo: string,
  buildingName?: string
): Promise<NaverComplexDetail | null> {
  if (!cortarNo || cortarNo.length < 5) return null;

  // 아파트 → 빌라 → 오피스텔 순서로 검색
  const typesToSearch = ["APT", "VL", "OPST"];

  for (const realEstateType of typesToSearch) {
    try {
      const complexes = await searchComplexByRegion(cortarNo, realEstateType);
      if (complexes.length === 0) continue;

      // 건물명으로 매칭 (direct includes → fuzzy matching)
      let matched: NaverComplex | undefined;

      if (buildingName) {
        const name = buildingName.toLowerCase().replace(/\s/g, "");
        // Direct includes
        matched = complexes.find((c) => {
          const cName = c.complexName.toLowerCase().replace(/\s/g, "");
          return cName.includes(name) || name.includes(cName);
        });
        // Fuzzy matching (단지 number + prefix)
        if (!matched) {
          matched = complexes.find((c) =>
            matchesComplexName(buildingName, c.complexName)
          );
        }
      }

      // 건물명 매칭 실패 시 단지가 1개면 자동 선택 (첫 번째 타입만)
      if (!matched && complexes.length === 1 && realEstateType === "APT") {
        matched = complexes[0];
      }

      if (matched) {
        return {
          complex: matched,
          pyeongList: [],
        };
      }
    } catch (err) {
      console.error(`Naver findComplexByAddress error (${realEstateType}):`, err);
    }
  }

  return null;
}
