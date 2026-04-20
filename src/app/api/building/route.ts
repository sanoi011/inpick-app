import { NextRequest, NextResponse } from "next/server";
import type { BuildingInfo } from "@/types/address";
import { findComplexByAddress, type NaverComplexDetail } from "@/lib/services/naver-land-client";
import { findCachedComplexDetail } from "@/lib/data/naver-cache";

export const preferredRegion = "icn1"; // Seoul — 네이버 API 한국 IP 필요

const DATA_API_KEY = process.env.DATA_API_KEY;
const BUILDING_API_URL = "http://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo";

export async function GET(request: NextRequest) {
  const sigunguCd = request.nextUrl.searchParams.get("sigunguCd");
  const bjdongCd = request.nextUrl.searchParams.get("bjdongCd");
  const bun = request.nextUrl.searchParams.get("bun");
  const ji = request.nextUrl.searchParams.get("ji");
  const bcode = request.nextUrl.searchParams.get("bcode");
  const address = request.nextUrl.searchParams.get("address") || "";
  const buildingName = request.nextUrl.searchParams.get("buildingName");
  const mode = request.nextUrl.searchParams.get("mode");

  // mode=manual: 수동 동/호 입력 → pyeongList 반환
  if (mode === "manual") {
    const cortarNo = bcode || "";
    const dong = request.nextUrl.searchParams.get("dong") || "";
    const ho = request.nextUrl.searchParams.get("ho") || "";

    if (!cortarNo || !buildingName) {
      return NextResponse.json({ error: "bcode와 buildingName이 필요합니다" }, { status: 400 });
    }

    // naver-cache에서 단지 검색
    const cachedDetail = findCachedComplexDetail(cortarNo, buildingName);
    if (!cachedDetail) {
      return NextResponse.json({ pyeongList: [], complexName: null, error: "단지 정보를 찾을 수 없습니다" });
    }

    const pyeongList = cachedDetail.pyeongList.map((p) => ({
      pyeongNo: p.pyeongNo,
      pyeongName: p.pyeongName,
      exclusiveArea: p.exclusiveArea,
      supplyArea: p.supplyArea,
      roomCnt: p.roomCnt,
      bathroomCnt: p.bathroomCnt,
      grandPlanUrl: p.grandPlanUrl || null,
      hasFloorPlan: !!p.grandPlanUrl,
    }));

    return NextResponse.json({
      pyeongList,
      complexNo: cachedDetail.complex.complexNo,
      complexName: cachedDetail.complex.complexName,
      dong,
      ho,
    });
  }

  console.log(`[building] bcode=${bcode}, buildingName=${buildingName}, address=${address?.slice(0, 30)}`);

  // 네이버 부동산 API (실제 평형 데이터) → 실패 시 캐시 폴백
  // 모든 아파트 동일 파이프라인: grandPlanUrl → Gemini Pro 실시간 도면 생성
  const cortarNo = bcode || (sigunguCd && bjdongCd ? sigunguCd + bjdongCd : "");
  if (cortarNo && cortarNo.length >= 5) {
    // 2a. Try live Naver API first (pyeongList 있을 때만 사용)
    try {
      const naverDetail = await findComplexByAddress(cortarNo, buildingName || undefined);
      if (naverDetail && naverDetail.pyeongList.length > 0) {
        console.log(`[building] matched=naver_land, complexName=${naverDetail.complex.complexName}, pyeongCount=${naverDetail.pyeongList.length}, type=${naverDetail.realEstateType || "APT"}`);
        const buildings = generateNaverBuildings(naverDetail, address, buildingName || undefined, naverDetail.realEstateType);
        return NextResponse.json({
          buildings,
          source: "naver_land",
          complexName: naverDetail.complex.complexName,
        });
      }
      // pyeongList 없으면 캐시로 폴백
    } catch (err) {
      console.error("Naver Land API error (will try cache):", err instanceof Error ? err.message : err);
    }

    // 2b. 캐시 폴백 (Live API 실패/부분 데이터/Vercel IP 차단 등)
    try {
      const cachedDetail = findCachedComplexDetail(cortarNo, buildingName || undefined);
      if (cachedDetail && cachedDetail.pyeongList.length > 0) {
        console.log(`[building] matched=naver_cache, complexName=${cachedDetail.complex.complexName}, pyeongCount=${cachedDetail.pyeongList.length}, type=${cachedDetail.realEstateType || "APT"}`);
        const buildings = generateNaverBuildings(cachedDetail, address, buildingName || undefined, cachedDetail.realEstateType);
        return NextResponse.json({
          buildings,
          source: "naver_land_cache",
          complexName: cachedDetail.complex.complexName,
        });
      }
    } catch (err) {
      console.error("Naver cache lookup error:", err instanceof Error ? err.message : err);
    }
  }

  // 3. 건축물대장 API (키가 있을 때)
  if (DATA_API_KEY && sigunguCd && bjdongCd) {
    try {
      const params = new URLSearchParams({
        serviceKey: DATA_API_KEY,
        sigunguCd,
        bjdongCd,
        numOfRows: "20",
        pageNo: "1",
        _type: "json",
      });

      if (bun) params.set("bun", bun.padStart(4, "0"));
      if (ji) params.set("ji", ji.padStart(4, "0"));

      const res = await fetch(`${BUILDING_API_URL}?${params}`);

      if (!res.ok) {
        throw new Error(`Building API responded with ${res.status}`);
      }

      const data = await res.json();
      const items = data?.response?.body?.items?.item;

      if (items && typeof items === "object") {
        const list = Array.isArray(items) ? items : [items];
        const buildings: BuildingInfo[] = list.map((item: Record<string, unknown>, idx: number) => ({
          id: `bld-${idx}`,
          address: address || String(item.platPlc || ""),
          buildingName: String(item.bldNm || buildingName || ""),
          dongName: String(item.dongNm || ""),
          hoName: String(item.hoNm || ""),
          buildingType: mapBuildingType(String(item.mainPurpsCdNm || "")),
          totalFloor: Number(item.grndFlrCnt || 0),
          floor: Number(item.flrNo || 0),
          exclusiveArea: Number(item.area || 0),
          supplyArea: Number(item.cnstrArea || 0) || undefined,
          approvalDate: String(item.crtnDay || ""),
          floorPlanAvailable: false,
        }));

        return NextResponse.json({ buildings, source: "api" });
      }
    } catch (err) {
      console.error("Building API error:", err);
    }
  }

  // 4. 시뮬레이션 폴백 (개선됨)
  console.log(`[building] matched=simulated (no naver/cache/api match)`);
  const simulated = generateSimulatedBuilding();
  return NextResponse.json({ buildings: simulated, source: "simulated" });
}

function mapBuildingType(purposeName: string): string {
  if (purposeName.includes("아파트") || purposeName.includes("공동주택")) return "아파트";
  if (purposeName.includes("다세대") || purposeName.includes("빌라")) return "빌라";
  if (purposeName.includes("오피스텔")) return "오피스텔";
  if (purposeName.includes("단독")) return "단독주택";
  if (purposeName.includes("상가") || purposeName.includes("근린")) return "상가";
  if (purposeName.includes("업무") || purposeName.includes("사무")) return "사무실";
  return purposeName || "기타";
}


/** realEstateType → 건물 유형 한글명 */
function mapRealEstateType(type?: string): string {
  switch (type) {
    case "VL": return "빌라";
    case "OPST": return "오피스텔";
    case "ABYG": return "아파트분양권";
    case "JGC": return "재건축";
    default: return "아파트";
  }
}

/**
 * 네이버 부동산 데이터 → BuildingInfo[] 생성
 */
function generateNaverBuildings(
  detail: NaverComplexDetail,
  address: string,
  buildingName?: string,
  realEstateType?: string
): BuildingInfo[] {
  const buildings: BuildingInfo[] = [];
  const { complex, pyeongList } = detail;
  const buildingType = mapRealEstateType(realEstateType);

  // 동 목록: 실제 동 데이터 → 생성 폴백
  let dongs: string[];
  if (detail.dongList && detail.dongList.length > 0) {
    dongs = detail.dongList.map((d) => `${d.dongName}동`);
  } else {
    const dongBase = parseDongBase(buildingName || complex.complexName);
    const dongCount = complex.totalDongCount || 3;
    dongs = [];
    for (let i = 1; i <= dongCount; i++) {
      dongs.push(`${dongBase + i}동`);
    }
  }

  // 대표 샘플 층수
  const maxFloor = complex.highFloor || 25;
  const sampleFloors = generateSampleFloors(maxFloor);

  for (const dong of dongs) {
    for (const pyeong of pyeongList) {
      const hasGrandPlanUrl = !!pyeong.grandPlanUrl;
      // 샘플 도면 매칭 제거 — grandPlanUrl이 있으면 Gemini Pro 파이프라인으로 실시간 생성
      // grandPlanUrl이 없으면 도면 없이 업로드/수동 입력 유도
      const typeName = `${pyeong.pyeongName}`;
      const lineNum = pyeong.pyeongNo || (pyeongList.indexOf(pyeong) + 1);

      for (const floor of sampleFloors) {
        const hoNum = String(floor).padStart(2, "0") + String(lineNum % 100).padStart(2, "0");
        buildings.push({
          id: `naver-${dong}-${floor}-${lineNum}`,
          address,
          buildingName: buildingName || complex.complexName,
          dongName: dong,
          hoName: `${hoNum}호`,
          buildingType,
          totalFloor: maxFloor,
          floor,
          exclusiveArea: pyeong.exclusiveArea,
          supplyArea: pyeong.supplyArea,
          roomCount: pyeong.roomCnt,
          bathroomCount: pyeong.bathroomCnt,
          approvalDate: complex.approvalDate || "",
          floorPlanAvailable: hasGrandPlanUrl,
          typeName,
          complexName: complex.complexName,
          complexNo: complex.complexNo,
          pyeongNo: pyeong.pyeongNo,
          grandPlanUrl: pyeong.grandPlanUrl || undefined,
        });
      }
    }
  }

  // 동 → 층수 순 정렬
  buildings.sort((a, b) => {
    if (a.dongName !== b.dongName) return a.dongName.localeCompare(b.dongName);
    if (a.floor !== b.floor) return a.floor - b.floor;
    return (a.typeName || "").localeCompare(b.typeName || "");
  });

  return buildings;
}

/**
 * 최고층 기반 대표 샘플 층수 생성 (저/중/고 3개층)
 */
function generateSampleFloors(maxFloor: number): number[] {
  if (maxFloor <= 3) return [2];
  if (maxFloor <= 10) return [3, Math.ceil(maxFloor / 2), maxFloor - 1];
  const low = Math.max(3, Math.ceil(maxFloor * 0.15));
  const mid = Math.ceil(maxFloor / 2);
  const high = Math.min(maxFloor - 1, Math.floor(maxFloor * 0.85));
  return [low, mid, high];
}

/**
 * 단지명에서 동 번호 베이스 추출
 * "반석마을2단지" → 200, "3단지" → 300, 기본 100
 */
function parseDongBase(buildingName?: string): number {
  if (!buildingName) return 100;
  const match = buildingName.match(/(\d+)\s*단지/);
  if (match) return parseInt(match[1]) * 100;
  return 100;
}

/**
 * 시뮬레이션 건물 데이터 — 가상 호수 생성 제거
 * 정확한 동/호수 정보 없이는 빈 배열 반환
 */
function generateSimulatedBuilding(): BuildingInfo[] {
  // 가상 호수 제거: 정확한 데이터 없으면 빈 배열 반환
  return [];
}
