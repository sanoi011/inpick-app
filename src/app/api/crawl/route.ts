import { NextRequest, NextResponse } from "next/server";
import { crawlMaterialPrices, crawlLaborCosts, crawlOverheadRates } from "@/lib/crawlers";
import { isAdminAuthorized } from "@/lib/admin-auth";

// POST: 크롤러 실행 (관리자 전용)
export async function POST(request: NextRequest) {
  // 관리자 인증 (ADMIN_PASSWORD 직접 일치 또는 admin/login 발급 서명 토큰)
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const { type } = await request.json();

    switch (type) {
      case "material": {
        const result = await crawlMaterialPrices();
        return NextResponse.json({ result });
      }
      case "labor": {
        const result = await crawlLaborCosts();
        return NextResponse.json({ result });
      }
      case "overhead": {
        const result = await crawlOverheadRates();
        return NextResponse.json({ result });
      }
      case "all": {
        const [material, labor, overhead] = await Promise.all([
          crawlMaterialPrices(),
          crawlLaborCosts(),
          crawlOverheadRates(),
        ]);
        return NextResponse.json({ results: { material, labor, overhead } });
      }
      default:
        return NextResponse.json({ error: "유효하지 않은 크롤 타입입니다. (material, labor, overhead, all)" }, { status: 400 });
    }
  } catch (err) {
    console.error("Crawl API error:", err);
    return NextResponse.json({ error: "크롤러 실행 중 오류가 발생했습니다." }, { status: 500 });
  }
}
