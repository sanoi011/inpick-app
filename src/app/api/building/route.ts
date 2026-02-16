import { NextRequest, NextResponse } from "next/server";
import type { BuildingInfo } from "@/types/address";
import { findKnownApartment, type KnownApartment } from "@/lib/data/apartment-seed";
import { findComplexByAddress, type NaverComplexDetail, type NaverComplex } from "@/lib/services/naver-land-client";
import { findCachedComplex } from "@/lib/data/naver-cache";
import { findFloorPlanId } from "@/lib/data/floor-plan-map";

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

  // 1. 알려진 아파트 매칭 시도 (최우선)
  const knownApt = findKnownApartment(address, buildingName || undefined);
  if (knownApt) {
    const buildings = generateKnownApartmentBuildings(knownApt, address);
    return NextResponse.json({
      buildings,
      source: "known_apartment",
      complexName: knownApt.complexName,
    });
  }

  // 2. 네이버 부동산 API (실제 평형 데이터) → 실패 시 캐시 폴백
  const cortarNo = bcode || (sigunguCd && bjdongCd ? sigunguCd + bjdongCd : "");
  if (cortarNo && cortarNo.length >= 5) {
    // 2a. Try live Naver API first
    try {
      const naverDetail = await findComplexByAddress(cortarNo, buildingName || undefined);
      if (naverDetail) {
        if (naverDetail.pyeongList.length > 0) {
          // Full Naver data: real pyeong types
          const buildings = generateNaverBuildings(naverDetail, address, buildingName || undefined);
          return NextResponse.json({
            buildings,
            source: "naver_land",
            complexName: naverDetail.complex.complexName,
          });
        } else {
          // Partial Naver data: real dong count + default pyeong types
          const buildings = generateNaverPartialBuildings(naverDetail.complex, address, buildingName || undefined);
          return NextResponse.json({
            buildings,
            source: "naver_land",
            complexName: naverDetail.complex.complexName,
          });
        }
      }
    } catch (err) {
      console.error("Naver Land API error (will try cache):", err instanceof Error ? err.message : err);
    }

    // 2b. Fallback to cached Naver data (for Vercel cloud IP blocking)
    try {
      const cachedComplex = findCachedComplex(cortarNo, buildingName || undefined);
      if (cachedComplex) {
        const buildings = generateNaverPartialBuildings(cachedComplex, address, buildingName || undefined);
        return NextResponse.json({
          buildings,
          source: "naver_land_cache",
          complexName: cachedComplex.complexName,
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

      if (items) {
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
  const simulated = generateSimulatedBuilding(address, buildingName || undefined);
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

/**
 * 알려진 아파트 → 실제 동/호/타입 BuildingInfo[] 생성
 */
function generateKnownApartmentBuildings(
  apt: KnownApartment,
  address: string
): BuildingInfo[] {
  const buildings: BuildingInfo[] = [];

  for (const unitType of apt.types) {
    for (const [dongName, floors] of Object.entries(unitType.dongFloors)) {
      for (const floor of floors) {
        const hoNum = String(floor).padStart(2, "0") + String(unitType.lineNum).padStart(2, "0");
        buildings.push({
          id: `known-${dongName}-${floor}-${unitType.lineNum}`,
          address,
          buildingName: apt.complexName,
          dongName,
          hoName: `${hoNum}호`,
          buildingType: "아파트",
          totalFloor: apt.totalFloor,
          floor,
          exclusiveArea: unitType.areaSqm,
          supplyArea: unitType.supplyAreaSqm,
          roomCount: unitType.roomCount,
          bathroomCount: unitType.bathroomCount,
          approvalDate: `${apt.completionYear}-01-01`,
          floorPlanAvailable: true,
          sampleId: unitType.sampleId,
          typeName: unitType.typeName,
          complexName: apt.complexName,
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
 * 네이버 부동산 데이터 → BuildingInfo[] 생성
 */
function generateNaverBuildings(
  detail: NaverComplexDetail,
  address: string,
  buildingName?: string
): BuildingInfo[] {
  const buildings: BuildingInfo[] = [];
  const { complex, pyeongList } = detail;

  // 동 번호 생성: 단지명 기반 베이스 + 실제 동 수
  const dongBase = parseDongBase(buildingName || complex.complexName);
  const dongCount = complex.totalDongCount || 3;
  const dongs: string[] = [];
  for (let i = 1; i <= dongCount; i++) {
    dongs.push(`${dongBase + i}동`);
  }

  // 대표 샘플 층수
  const maxFloor = complex.highFloor || 25;
  const sampleFloors = generateSampleFloors(maxFloor);

  for (const dong of dongs) {
    for (const pyeong of pyeongList) {
      const sampleId = matchSampleId(pyeong.exclusiveArea, pyeong.roomCnt, complex.complexNo);
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
          buildingType: "아파트",
          totalFloor: maxFloor,
          floor,
          exclusiveArea: pyeong.exclusiveArea,
          supplyArea: pyeong.supplyArea,
          roomCount: pyeong.roomCnt,
          bathroomCount: pyeong.bathroomCnt,
          approvalDate: complex.approvalDate || "",
          floorPlanAvailable: !!sampleId,
          sampleId,
          typeName,
          complexName: complex.complexName,
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
 * 네이버 목록 데이터 (pyeong 없음) → 실제 동 수 + 기본 평형 BuildingInfo[]
 */
function generateNaverPartialBuildings(
  complex: NaverComplex,
  address: string,
  buildingName?: string
): BuildingInfo[] {
  const buildings: BuildingInfo[] = [];

  const dongBase = parseDongBase(buildingName || complex.complexName);
  const dongCount = complex.totalDongCount || 3;
  const dongs: string[] = [];
  for (let i = 1; i <= dongCount; i++) {
    dongs.push(`${dongBase + i}동`);
  }

  const defaultTypes = [
    { typeName: "59A", area: 59, supply: 84.8, rooms: 3, baths: 2, lineNum: 1, sampleId: "sample-59" },
    { typeName: "84A", area: 84, supply: 114.5, rooms: 4, baths: 2, lineNum: 2, sampleId: "sample-84a" },
    { typeName: "84B", area: 84, supply: 114.5, rooms: 3, baths: 2, lineNum: 3, sampleId: "sample-84b" },
  ];

  const maxFloor = complex.highFloor || 25;
  const sampleFloors = generateSampleFloors(maxFloor);

  for (const dong of dongs) {
    for (const ut of defaultTypes) {
      for (const floor of sampleFloors) {
        const hoNum = String(floor).padStart(2, "0") + String(ut.lineNum).padStart(2, "0");
        buildings.push({
          id: `naver-${dong}-${floor}-${ut.lineNum}`,
          address,
          buildingName: buildingName || complex.complexName,
          dongName: dong,
          hoName: `${hoNum}호`,
          buildingType: "아파트",
          totalFloor: maxFloor,
          floor,
          exclusiveArea: ut.area,
          supplyArea: ut.supply,
          roomCount: ut.rooms,
          bathroomCount: ut.baths,
          approvalDate: complex.approvalDate || "",
          floorPlanAvailable: true,
          sampleId: ut.sampleId,
          typeName: ut.typeName,
          complexName: complex.complexName,
        });
      }
    }
  }

  buildings.sort((a, b) => {
    if (a.dongName !== b.dongName) return a.dongName.localeCompare(b.dongName);
    if (a.floor !== b.floor) return a.floor - b.floor;
    return (a.typeName || "").localeCompare(b.typeName || "");
  });

  return buildings;
}

/**
 * 최고층 기반 대표 샘플 층수 생성
 */
function generateSampleFloors(maxFloor: number): number[] {
  if (maxFloor <= 5) return [2, 3, 4];
  if (maxFloor <= 15) return [3, 7, 11, maxFloor];
  return [3, 7, 11, 15, 19, Math.min(23, maxFloor)].filter(f => f <= maxFloor);
}

/**
 * 전용면적 → 도면 ID 매칭 (floor-plan-map.json 기반)
 */
function matchSampleId(exclusiveArea: number, roomCount?: number, complexNo?: string): string | undefined {
  return findFloorPlanId(complexNo, exclusiveArea, roomCount);
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
 * 시뮬레이션 건물 데이터 (개선: 단지명 기반 동번호 + 59/84 면적 일치)
 */
function generateSimulatedBuilding(address: string, buildingName?: string): BuildingInfo[] {
  const dongBase = parseDongBase(buildingName);
  const dongs = [`${dongBase + 1}동`, `${dongBase + 2}동`, `${dongBase + 3}동`];
  const unitTypes = [
    { typeName: "59A", area: 59, supply: 84.8, rooms: 3, baths: 2, lineNum: 1, sampleId: "sample-59" },
    { typeName: "84A", area: 84, supply: 114.5, rooms: 4, baths: 2, lineNum: 2, sampleId: "sample-84a" },
    { typeName: "84B", area: 84, supply: 114.5, rooms: 3, baths: 2, lineNum: 3, sampleId: "sample-84b" },
  ];
  const sampleFloors = [3, 7, 11, 15, 19, 23];

  const buildings: BuildingInfo[] = [];

  for (const dong of dongs) {
    for (const ut of unitTypes) {
      for (const floor of sampleFloors) {
        const hoNum = String(floor).padStart(2, "0") + String(ut.lineNum).padStart(2, "0");
        buildings.push({
          id: `sim-${dong}-${floor}-${ut.lineNum}`,
          address,
          buildingName,
          dongName: dong,
          hoName: `${hoNum}호`,
          buildingType: "아파트",
          totalFloor: 25,
          floor,
          exclusiveArea: ut.area,
          supplyArea: ut.supply,
          roomCount: ut.rooms,
          bathroomCount: ut.baths,
          approvalDate: "2024-01-01",
          floorPlanAvailable: true,
          sampleId: ut.sampleId,
          typeName: ut.typeName,
        });
      }
    }
  }

  return buildings;
}
