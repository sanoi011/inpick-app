import { NextResponse } from "next/server";
import { getCachedRegions, getCachedComplexes, getCacheFetchedAt } from "@/lib/data/naver-cache";

const ESTIMATED_NATIONWIDE_COMPLEXES = 50000;

// 시도 코드 → 이름 매핑 (cortarNo 앞 2자리)
const SIDO_NAMES: Record<string, string> = {
  "11": "서울특별시",
  "26": "부산광역시",
  "27": "대구광역시",
  "28": "인천광역시",
  "29": "광주광역시",
  "30": "대전광역시",
  "31": "울산광역시",
  "36": "세종특별자치시",
  "41": "경기도",
  "42": "강원도",
  "43": "충청북도",
  "44": "충청남도",
  "45": "전북특별자치도",
  "46": "전라남도",
  "47": "경상북도",
  "48": "경상남도",
  "50": "제주특별자치도",
  "51": "강원특별자치도",
  "52": "전북특별자치도",
};

export async function GET() {
  try {
    const regionKeys = getCachedRegions();

    let totalComplexes = 0;
    let totalHouseholds = 0;

    // 지역별 상세
    const regions = regionKeys.map((cortarNo) => {
      const complexes = getCachedComplexes(cortarNo);
      const complexCount = complexes.length;
      const householdCount = complexes.reduce(
        (sum, c) => sum + (c.totalHouseholdCount || 0),
        0
      );
      const fetchedAt = getCacheFetchedAt(cortarNo) || "";
      const address = complexes[0]?.address || "";

      totalComplexes += complexCount;
      totalHouseholds += householdCount;

      return { cortarNo, complexCount, householdCount, fetchedAt, address };
    });

    // 시도별 집계
    const sidoStats: Record<string, { name: string; regions: number; complexes: number; households: number }> = {};
    for (const r of regions) {
      const sidoCode = r.cortarNo.substring(0, 2);
      const sidoName = SIDO_NAMES[sidoCode] || `기타(${sidoCode})`;
      if (!sidoStats[sidoCode]) {
        sidoStats[sidoCode] = { name: sidoName, regions: 0, complexes: 0, households: 0 };
      }
      sidoStats[sidoCode].regions++;
      sidoStats[sidoCode].complexes += r.complexCount;
      sidoStats[sidoCode].households += r.householdCount;
    }

    const coveragePercent = Math.min(
      100,
      Number(((totalComplexes / ESTIMATED_NATIONWIDE_COMPLEXES) * 100).toFixed(2))
    );

    return NextResponse.json({
      totalRegions: regionKeys.length,
      totalComplexes,
      totalHouseholds,
      coveragePercent,
      estimatedNationwide: ESTIMATED_NATIONWIDE_COMPLEXES,
      sidoStats: Object.values(sidoStats).sort((a, b) => b.complexes - a.complexes),
      regions: regions
        .filter((r) => r.complexCount > 0)
        .sort((a, b) => b.complexCount - a.complexCount),
    });
  } catch (err) {
    console.error("Coverage API error:", err);
    return NextResponse.json({ error: "Failed to load coverage data" }, { status: 500 });
  }
}
