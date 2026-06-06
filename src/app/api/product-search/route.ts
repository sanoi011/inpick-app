/**
 * GET /api/product-search?query=&display=
 * 자재 상품 검색 — 서버에서 네이버 쇼핑 API 호출(키 있을 때), 응답은 쇼핑몰명/가격/이미지/구매링크만 정규화.
 * 클라이언트에는 "네이버 쇼핑" 브랜딩을 노출하지 않고 상품 카드(사진+가격+쇼핑몰별)로만 표시한다.
 * 키(NAVER_CLIENT_ID/SECRET) 미설정 또는 오류 시 mock 폴백.
 */
import { NextRequest, NextResponse } from "next/server";

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
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();

const MOCK_MALLS = ["스마트스토어", "쿠팡", "11번가", "G마켓", "오늘의집", "롯데ON"];

function mockProducts(query: string): ProductResult[] {
  const base = 38000;
  return Array.from({ length: 9 }, (_, i) => ({
    productId: `mock-${i}`,
    title: `${query} 추천 상품 ${i + 1} · 인기 모델`,
    image: null,
    price: base + i * 14500 + (i % 3) * 5200,
    mallName: MOCK_MALLS[i % MOCK_MALLS.length],
    link: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`,
    brand: ["대림바스", "이누스", "아메리칸스탠다드", "로얄앤컴퍼니"][i % 4],
  }));
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim();
  const display = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("display") ?? 12)));
  if (!query) {
    return NextResponse.json({ products: [], source: "empty" });
  }

  // 검색(쇼핑) 전용 키 — 네이버 소셜 로그인용 NAVER_CLIENT_ID와 분리(다른 앱일 수 있음)
  const id = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!id || !secret) {
    return NextResponse.json({ products: mockProducts(query).slice(0, display), source: "mock" });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
      query
    )}&display=${display}&sort=asc&exclude=used:rental:cbshop`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
      // 12시간 캐시
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!res.ok) throw new Error(`shop api ${res.status}`);
    const data = await res.json();
    const products: ProductResult[] = (data.items ?? [])
      .filter((it: { lprice?: string; image?: string }) => Number(it.lprice) > 0 && it.image)
      .map((it: Record<string, string>) => ({
        productId: it.productId ?? it.link,
        title: stripTags(it.title ?? ""),
        image: it.image ?? null,
        price: Number(it.lprice ?? 0),
        mallName: it.mallName || "스마트스토어",
        link: it.link,
        brand: it.brand || it.maker || undefined,
      }));
    return NextResponse.json({ products, source: "naver" });
  } catch (err) {
    console.error("[product-search] fallback to mock:", err);
    return NextResponse.json({ products: mockProducts(query).slice(0, display), source: "mock" });
  }
}
