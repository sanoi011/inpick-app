import { NextResponse } from "next/server";
import { findComplexByAddress, searchComplexByRegion } from "@/lib/services/naver-land-client";

export const preferredRegion = "icn1";

export async function GET() {
  const cortarNo = "3020012000";
  const buildingName = "반석마을아파트2단지";
  const results: Record<string, unknown> = { cortarNo, buildingName, region: "icn1" };

  try {
    const complexes = await searchComplexByRegion(cortarNo);
    results.complexCount = complexes.length;
    results.complexNames = complexes.slice(0, 5).map(c => c.complexName);
    results.searchOk = true;
  } catch (err) {
    results.searchOk = false;
    results.searchError = String(err);
  }

  try {
    const detail = await findComplexByAddress(cortarNo, buildingName);
    results.detailFound = !!detail;
    results.complexName = detail?.complex?.complexName;
    results.dongCount = detail?.complex?.totalDongCount;
    results.pyeongCount = detail?.pyeongList?.length;
  } catch (err) {
    results.detailFound = false;
    results.detailError = String(err);
  }

  return NextResponse.json(results);
}
