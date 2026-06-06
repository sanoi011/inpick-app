/**
 * GET /api/material-assets?queries=q1|q2|q3
 * 자산화된(우리 소유) 자재 이미지 조회 — material_products.search_query 기준 thumbnail_url 매핑.
 * 응답: { images: { [query]: url } }
 *
 * 하베스트 스크립트(scripts/harvest-material-assets.ts)로 적재된 우리 Storage 이미지를 사용.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("queries") ?? "";
  const queries = raw.split("|").map((q) => q.trim()).filter(Boolean).slice(0, 40);
  if (queries.length === 0) return NextResponse.json({ images: {} });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ images: {} });

  try {
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin
      .from("material_products")
      .select("sub_category, thumbnail_url")
      .in("sub_category", queries)
      .not("thumbnail_url", "is", null);
    if (error) throw error;

    const images: Record<string, string> = {};
    for (const row of data ?? []) {
      const q = (row as { sub_category?: string }).sub_category;
      const u = (row as { thumbnail_url?: string }).thumbnail_url;
      if (q && u && !images[q]) images[q] = u;
    }
    return NextResponse.json({ images });
  } catch (err) {
    console.error("[material-assets:GET]", err);
    return NextResponse.json({ images: {} });
  }
}
