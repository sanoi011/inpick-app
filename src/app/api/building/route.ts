import { NextRequest, NextResponse } from "next/server";
import type { BuildingInfo } from "@/types/address";
import { findKnownApartment, type KnownApartment } from "@/lib/data/apartment-seed";

const DATA_API_KEY = process.env.DATA_API_KEY;
const BUILDING_API_URL = "http://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo";

export async function GET(request: NextRequest) {
  const sigunguCd = request.nextUrl.searchParams.get("sigunguCd");
  const bjdongCd = request.nextUrl.searchParams.get("bjdongCd");
  const bun = request.nextUrl.searchParams.get("bun");
  const ji = request.nextUrl.searchParams.get("ji");
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

  // 2. 건축물대장 API (키가 있을 때)
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

  // 3. 시뮬레이션 폴백 (개선됨)
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
 * 시뮬레이션 건물 데이터 (개선: 59/84 면적 일치)
 */
function generateSimulatedBuilding(address: string, buildingName?: string): BuildingInfo[] {
  const dongs = ["101동", "102동", "103동"];
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
