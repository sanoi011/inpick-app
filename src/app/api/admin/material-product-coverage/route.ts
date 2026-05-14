/**
 * GET /api/admin/material-product-coverage
 *
 * P16-5: material_products 매칭 진단.
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §16-5
 *
 * construction_estimate_lines 최근 N건을 분석해서:
 *   - category_code별 매칭/미매칭 비율
 *   - 표준 fallback 라인 중 카테고리/품명/금액 top
 *   - material_products 테이블에서 해당 카테고리에 등록된 제품 수
 *
 * 관리자가 어느 카테고리에 seed를 우선 보강해야 하는지 한눈에 보기 위함.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (!auth || !expected) return false;
  return auth === `Bearer ${expected}`;
}

interface CategoryCoverage {
  categoryCode: string;
  totalLines: number;
  matchedLines: number;
  fallbackLines: number;
  highValueFallbackLines: number;
  matchRate: number;
  productsInDb: number;
  avgFallbackUnitPrice: number;
  sampleItems: Array<{ itemName: string; amount: number; subTrade: string }>;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "service not configured" }, { status: 503 });
  }
  const admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 2000);

  // 최근 라인들 조회 (created_at 없을 수 있어 id 역순)
  const { data: lines, error: linesErr } = await admin
    .from("construction_estimate_lines")
    .select(
      "material_category_code, sub_trade_code, item_name_ko, product_match_status, source, material_unit_price, total_amount",
    )
    .order("id", { ascending: false })
    .limit(limit);

  if (linesErr) {
    console.error("[material-product-coverage] lines:", linesErr.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const HIGH_VALUE = 500_000;
  const byCategory = new Map<
    string,
    {
      total: number;
      matched: number;
      fallback: number;
      highFallback: number;
      fallbackUnitPriceSum: number;
      fallbackUnitPriceCount: number;
      samples: Array<{ itemName: string; amount: number; subTrade: string }>;
    }
  >();

  for (const l of (lines ?? []) as Array<{
    material_category_code: string | null;
    sub_trade_code: string | null;
    item_name_ko: string;
    product_match_status: string | null;
    source: string;
    material_unit_price: number | string;
    total_amount: number | string;
  }>) {
    const code = l.material_category_code ?? "UNCATEGORIZED";
    const cur =
      byCategory.get(code) ??
      {
        total: 0,
        matched: 0,
        fallback: 0,
        highFallback: 0,
        fallbackUnitPriceSum: 0,
        fallbackUnitPriceCount: 0,
        samples: [] as Array<{ itemName: string; amount: number; subTrade: string }>,
      };
    cur.total += 1;
    const matchStatus = l.product_match_status ?? "";
    const isMatched = matchStatus === "confirmed" || matchStatus === "recommended";
    const isFallback =
      l.source === "standard_fallback_material" ||
      matchStatus === "standard_fallback" ||
      matchStatus === "category_default";
    if (isMatched) cur.matched += 1;
    if (isFallback) {
      cur.fallback += 1;
      const unitPrice = Number(l.material_unit_price) || 0;
      const totalAmt = Number(l.total_amount) || 0;
      cur.fallbackUnitPriceSum += unitPrice;
      cur.fallbackUnitPriceCount += 1;
      if (totalAmt >= HIGH_VALUE) cur.highFallback += 1;
      if (cur.samples.length < 5) {
        cur.samples.push({ itemName: l.item_name_ko, amount: totalAmt, subTrade: l.sub_trade_code ?? "" });
      }
    }
    byCategory.set(code, cur);
  }

  // material_products 등록 수 조회 (전체)
  const productCounts = new Map<string, number>();
  const { data: prodRows } = await admin
    .from("material_products")
    .select("category_code", { count: "exact", head: false });
  if (prodRows) {
    for (const p of prodRows as Array<{ category_code: string }>) {
      productCounts.set(p.category_code, (productCounts.get(p.category_code) ?? 0) + 1);
    }
  }

  const coverage: CategoryCoverage[] = Array.from(byCategory.entries()).map(([code, v]) => ({
    categoryCode: code,
    totalLines: v.total,
    matchedLines: v.matched,
    fallbackLines: v.fallback,
    highValueFallbackLines: v.highFallback,
    matchRate: v.total > 0 ? +(v.matched / v.total).toFixed(3) : 0,
    productsInDb: productCounts.get(code) ?? 0,
    avgFallbackUnitPrice:
      v.fallbackUnitPriceCount > 0 ? Math.round(v.fallbackUnitPriceSum / v.fallbackUnitPriceCount) : 0,
    sampleItems: v.samples,
  }));

  // 우선순위: 고액 fallback 많은 + DB에 제품 적은 카테고리부터
  coverage.sort((a, b) => {
    const ascore = a.highValueFallbackLines * 100 + a.fallbackLines - a.productsInDb;
    const bscore = b.highValueFallbackLines * 100 + b.fallbackLines - b.productsInDb;
    return bscore - ascore;
  });

  const summary = {
    totalLinesAnalyzed: lines?.length ?? 0,
    totalCategoriesObserved: byCategory.size,
    categoriesWithZeroProducts: coverage.filter((c) => c.productsInDb === 0 && c.categoryCode !== "UNCATEGORIZED")
      .length,
    totalFallbackLines: coverage.reduce((s, c) => s + c.fallbackLines, 0),
    totalHighValueFallback: coverage.reduce((s, c) => s + c.highValueFallbackLines, 0),
  };

  return NextResponse.json({ summary, coverage });
}
