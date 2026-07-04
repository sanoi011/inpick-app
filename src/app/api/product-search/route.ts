/**
 * GET /api/product-search?query=&display=
 * 자재 상품 검색 — 두 소스 병합:
 *   1) 내부 자재 DB(material_products) — 브랜드/SKU/카탈로그가 + 우리 소유 자산 이미지 (우선 노출)
 *   2) 쇼핑몰(네이버 쇼핑 API, 검색 전용 키) — 실시간 실구매 상품 (사진·가격·구매링크)
 * 키/DB 미설정 또는 오류 시 각각 graceful (네이버 없으면 mock, 내부 없으면 생략).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProductResult {
  productId: string;
  title: string;
  image: string | null;
  price: number;
  mallName: string;
  link: string;
  brand?: string;
  sku?: string;
  spec?: string;
  source: "internal" | "naver" | "mock";
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
const shopSearchUrl = (q: string) =>
  `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;

const MOCK_MALLS = ["스마트스토어", "쿠팡", "11번가", "G마켓", "오늘의집", "롯데ON"];

function mockProducts(query: string): ProductResult[] {
  const base = 38000;
  return Array.from({ length: 9 }, (_, i) => ({
    productId: `mock-${i}`,
    title: `${query} 추천 상품 ${i + 1} · 인기 모델`,
    image: null,
    price: base + i * 14500 + (i % 3) * 5200,
    mallName: MOCK_MALLS[i % MOCK_MALLS.length],
    link: shopSearchUrl(query),
    brand: ["대림바스", "이누스", "아메리칸스탠다드", "로얄앤컴퍼니"][i % 4],
    source: "mock" as const,
  }));
}

// ─── 1) 내부 자재 DB (material_products) ───
async function fetchInternal(query: string, limit: number): Promise<ProductResult[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const admin = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const like = `%${query}%`;
    const { data, error } = await admin
      .from("material_products")
      .select("id, brand, product_name, model_number, specification, retail_price, thumbnail_url, sub_category, is_verified, popularity_score")
      .or(`product_name.ilike.${like},brand.ilike.${like},sub_category.ilike.${like}`)
      .not("thumbnail_url", "is", null)
      .order("is_verified", { ascending: false, nullsFirst: false })
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const brand = (r.brand as string) || "";
      const name = (r.product_name as string) || `${brand} 자재`;
      return {
        productId: `int-${r.id as string}`,
        title: [brand, name].filter(Boolean).join(" ").trim() || name,
        image: (r.thumbnail_url as string) ?? null,
        price: Number(r.retail_price) > 0 ? Number(r.retail_price) : 0,
        mallName: "인픽 카탈로그",
        link: shopSearchUrl([brand, name].filter(Boolean).join(" ")),
        brand: brand || undefined,
        sku: (r.model_number as string) || undefined,
        spec: (r.specification as string) || undefined,
        source: "internal" as const,
      };
    });
  } catch (err) {
    console.warn("[product-search] internal skip:", err);
    return [];
  }
}

// ─── 2) 네이버 쇼핑 (실구매) ───
async function fetchNaver(
  query: string,
  display: number,
  sort: string,
  start: number,
): Promise<{ products: ProductResult[]; total: number } | null> {
  const id = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
      query
    )}&display=${display}&sort=${sort}&start=${start}&exclude=used:rental:cbshop`;
    const res = await fetch(apiUrl, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!res.ok) throw new Error(`shop api ${res.status}`);
    const data = await res.json();
    const products = (data.items ?? [])
      .filter((it: { lprice?: string; image?: string }) => Number(it.lprice) > 0 && it.image)
      .map((it: Record<string, string>) => ({
        productId: it.productId ?? it.link,
        title: stripTags(it.title ?? ""),
        image: it.image ?? null,
        price: Number(it.lprice ?? 0),
        mallName: it.mallName || "스마트스토어",
        link: it.link,
        brand: it.brand || it.maker || undefined,
        source: "naver" as const,
      }));
    return { products, total: Number(data.total ?? products.length) };
  } catch (err) {
    console.error("[product-search] naver fallback to mock:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim();
  // NaN 가드 — 비숫자 파라미터가 네이버 API 400 → mock 폴백으로 이어지는 것 방지
  const toInt = (raw: string | null, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  // 기본값은 레거시 호출처(MaterialShopDrawer 등) 호환 유지 — 확장은 파라미터 명시 시에만
  const display = Math.min(100, Math.max(1, toInt(req.nextUrl.searchParams.get("display"), 12)));
  // asc=최저가(레거시 기본) | sim=관련도 | dsc=최고가 | date=최신
  const sortParam = req.nextUrl.searchParams.get("sort") ?? "asc";
  const sort = ["sim", "asc", "dsc", "date"].includes(sortParam) ? sortParam : "asc";
  // 페이지네이션 — 네이버 start 최대 1000
  const start = Math.min(1000, Math.max(1, toInt(req.nextUrl.searchParams.get("start"), 1)));
  if (!query) return NextResponse.json({ products: [], source: "empty" });

  const [internal, naver] = await Promise.all([
    // 내부 카탈로그는 첫 페이지에만 병합 (더보기 시 중복 방지)
    start === 1 ? fetchInternal(query, 4) : Promise.resolve([]),
    fetchNaver(query, display, sort, start),
  ]);

  const shop = naver?.products ?? mockProducts(query).slice(0, display);
  // 내부 카탈로그 우선 + 쇼핑몰, 중복(동일 링크) 제거
  const seen = new Set<string>();
  const products = [...internal, ...shop].filter((p) => {
    const dedupeKey = p.link || p.productId;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });

  const source = naver ? (internal.length ? "internal+naver" : "naver") : internal.length ? "internal+mock" : "mock";
  return NextResponse.json({
    products,
    source,
    internalCount: internal.length,
    total: naver?.total ?? products.length,
    start,
    display,
  });
}
