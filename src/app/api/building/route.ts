import { NextRequest, NextResponse } from "next/server";
import type { BuildingInfo } from "@/types/address";

const DATA_API_KEY = process.env.DATA_API_KEY;
const BUILDING_API_URL = "http://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo";

export async function GET(request: NextRequest) {
  const sigunguCd = request.nextUrl.searchParams.get("sigunguCd");
  const bjdongCd = request.nextUrl.searchParams.get("bjdongCd");
  const bun = request.nextUrl.searchParams.get("bun");
  const ji = request.nextUrl.searchParams.get("ji");
  const address = request.nextUrl.searchParams.get("address") || "";
  const buildingName = request.nextUrl.searchParams.get("buildingName");

  // 건축물대장 API 키가 없으면 시뮬레이션 데이터 반환
  if (!DATA_API_KEY || !sigunguCd || !bjdongCd) {
    const simulated = generateSimulatedBuilding(address, buildingName || undefined);
    return NextResponse.json({ buildings: simulated, source: "simulated" });
  }

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

    if (!items) {
      const simulated = generateSimulatedBuilding(address, buildingName || undefined);
      return NextResponse.json({ buildings: simulated, source: "simulated" });
    }

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
  } catch (err) {
    console.error("Building API error:", err);
    const simulated = generateSimulatedBuilding(address, buildingName || undefined);
    return NextResponse.json({ buildings: simulated, source: "simulated" });
  }
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

function generateSimulatedBuilding(address: string, buildingName?: string): BuildingInfo[] {
  // 실제 API 연동 전 시뮬레이션 데이터
  const types = [
    { dong: "101동", floors: [[3, 84.9, 114.5, 3, 2], [7, 84.9, 114.5, 3, 2], [12, 59.9, 84.8, 2, 1]] },
    { dong: "102동", floors: [[5, 74.5, 99.2, 3, 2], [10, 59.9, 84.8, 2, 1], [15, 84.9, 114.5, 3, 2]] },
  ];

  const buildings: BuildingInfo[] = [];

  types.forEach((dong) => {
    dong.floors.forEach(([floor, exclusive, supply, rooms, baths], idx) => {
      buildings.push({
        id: `sim-${dong.dong}-${idx}`,
        address,
        buildingName,
        dongName: dong.dong,
        hoName: `${floor}0${idx + 1}호`,
        buildingType: "아파트",
        totalFloor: 20,
        floor: floor as number,
        exclusiveArea: exclusive as number,
        supplyArea: supply as number,
        roomCount: rooms as number,
        bathroomCount: baths as number,
        approvalDate: "2020-03-15",
        floorPlanAvailable: true,
      });
    });
  });

  return buildings;
}
