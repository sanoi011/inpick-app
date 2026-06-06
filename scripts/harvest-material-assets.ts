/**
 * 자재 이미지 자산화(B) — 네이버 쇼핑에서 자재별 대표 제품 이미지를 가져와
 * 우리 Supabase Storage("material-assets" 버킷)에 저장하고 material_products에 적재한다.
 *
 * 실행: (유효한 NAVER_CLIENT_ID/SECRET + SUPABASE 키 필요)
 *   npx tsx scripts/harvest-material-assets.ts
 *
 * 매핑: material_products.search_query = 자재 미리보기 카드의 query
 *  → /api/material-assets 가 이 컬럼으로 우리 소유 이미지를 조회.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "material-assets";

// 자재 미리보기 카드(MATERIALS)의 query와 정확히 일치해야 카드에 매핑됨.
const CATALOG: Array<{ query: string; surface: "floor" | "wall" | "ceiling"; category: string }> = [
  // 바닥
  { query: "광폭 오크 강마루", surface: "floor", category: "ARCH_FLOOR" },
  { query: "헤링본 강마루", surface: "floor", category: "ARCH_FLOOR" },
  { query: "원목마루", surface: "floor", category: "ARCH_FLOOR" },
  { query: "포세린 바닥타일 600x600", surface: "floor", category: "ARCH_TILE" },
  { query: "폴리싱 타일 바닥", surface: "floor", category: "ARCH_TILE" },
  { query: "LVT 바닥재", surface: "floor", category: "ARCH_FLOOR" },
  { query: "에폭시 노출 콘크리트 바닥", surface: "floor", category: "ARCH_FLOOR" },
  // 벽
  { query: "실크벽지 화이트", surface: "wall", category: "ARCH_WALL" },
  { query: "포인트 벽지 그레이", surface: "wall", category: "ARCH_WALL" },
  { query: "템바보드", surface: "wall", category: "ARCH_WALL" },
  { query: "대형 포세린 벽타일", surface: "wall", category: "ARCH_TILE" },
  { query: "베네시안 스타코", surface: "wall", category: "ARCH_PAINT" },
  { query: "우드 월패널", surface: "wall", category: "ARCH_WALL" },
  { query: "대리석 아트월", surface: "wall", category: "ARCH_TILE" },
  // 천정
  { query: "무몰딩 천장", surface: "ceiling", category: "ARCH_CEIL" },
  { query: "우물천장 간접조명", surface: "ceiling", category: "ARCH_CEIL" },
  { query: "우드 루버 천장", surface: "ceiling", category: "ARCH_CEIL" },
  { query: "욕실 천장재 SMC", surface: "ceiling", category: "ARCH_CEIL" },
  { query: "노출 천장 트랙조명", surface: "ceiling", category: "ARCH_CEIL" },
];

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
const slug = (s: string) => s.replace(/[^a-zA-Z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");

async function naverTop(query: string) {
  const id = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
    query
  )}&display=5&sort=sim&exclude=used:rental:cbshop`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
  });
  if (!res.ok) throw new Error(`naver ${res.status} (${await res.text().catch(() => "")})`);
  const data = await res.json();
  const item = (data.items ?? []).find((it: { image?: string; lprice?: string }) => it.image && Number(it.lprice) > 0);
  if (!item) return null;
  return {
    title: stripTags(item.title ?? query),
    image: item.image as string,
    price: Number(item.lprice ?? 0),
    brand: (item.brand || item.maker || "INPICK") as string,
    mall: (item.mallName || "") as string,
  };
}

async function main() {
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA || !KEY) throw new Error("SUPABASE 키 미설정");
  const admin = createClient(SUPA, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // 버킷 보장 (public)
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
    console.log(`[harvest] bucket "${BUCKET}" 생성`);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < CATALOG.length; i++) {
    const m = CATALOG[i];
    try {
      const top = await naverTop(m.query);
      if (!top) {
        console.warn(`  · 결과 없음: ${m.query}`);
        fail++;
        continue;
      }
      // 이미지 다운로드 → Storage 업로드
      const imgRes = await fetch(top.image);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const path = `${m.surface}/m${i}.jpg`; // Storage 키는 ASCII만 (한글 불가)
      const up = await admin.storage.from(BUCKET).upload(path, buf, {
        contentType: imgRes.headers.get("content-type") || "image/jpeg",
        upsert: true,
      });
      if (up.error) throw up.error;
      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      // material_products upsert (search_query 기준)
      const row = {
        category_code: m.category,
        brand: top.brand,
        product_name: top.title.slice(0, 120),
        retail_price: top.price || null,
        unit: "EA",
        price_grade: "standard",
        thumbnail_url: publicUrl,
        sub_category: m.query, // 자재 미리보기 카드 query 매핑 (search_query 컬럼 마이그레이션 불필요)
        is_verified: false,
      };
      const { data: existing } = await admin
        .from("material_products")
        .select("id")
        .eq("sub_category", m.query)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await admin.from("material_products").update(row).eq("id", existing.id);
        if (error) throw new Error(`DB update: ${error.message}`);
      } else {
        const { error } = await admin.from("material_products").insert(row);
        if (error) throw new Error(`DB insert: ${error.message}`);
      }
      console.log(`  ✓ ${m.query} → ${top.mall} ${top.price.toLocaleString()}원`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${m.query}:`, (e as Error).message);
      fail++;
    }
  }
  console.log(`\n[harvest] 완료 — 성공 ${ok} / 실패 ${fail} (총 ${CATALOG.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
