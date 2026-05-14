/**
 * POST /api/admin/taxonomy/seed
 *
 * 코드의 MATERIAL_CATEGORY_SEED + CATEGORY_ALIAS_SEED → DB upsert.
 * 관리자 1회 클릭으로 카테고리 베이스 70+개 + alias 80+개 적용.
 *
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §10
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  MATERIAL_CATEGORY_SEED,
  CATEGORY_ALIAS_SEED,
} from "@/lib/inpick/material-taxonomy/category-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function checkAdminAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  // 1) material_category_taxonomy upsert
  const taxonomyRows = MATERIAL_CATEGORY_SEED.map((c) => ({
    category_code: c.categoryCode,
    discipline: c.discipline,
    major_name_ko: c.majorNameKo,
    middle_name_ko: c.middleNameKo,
    minor_name_ko: c.minorNameKo,
    display_name_ko: c.displayNameKo,
    trade_codes: c.tradeCodes,
    default_unit: c.defaultUnit,
    spec_schema: c.specKeys.reduce<Record<string, string>>((acc, k) => {
      acc[k] = "string|number";
      return acc;
    }, {}),
    keywords: c.keywords,
    requires_product_match: c.requiresProductMatch,
    high_value: c.highValue,
    active: true,
  }));

  const { error: taxErr, count: taxCount } = await admin
    .from("material_category_taxonomy")
    .upsert(taxonomyRows, { onConflict: "category_code", count: "exact" });
  if (taxErr) {
    console.error("[taxonomy/seed] taxonomy upsert failed:", taxErr);
    return NextResponse.json(
      { error: "TAXONOMY_UPSERT_FAILED", details: taxErr.message },
      { status: 500 },
    );
  }

  // 2) material_category_aliases upsert (unique on alias+category_code)
  const aliasRows = CATEGORY_ALIAS_SEED.map((a) => ({
    alias: a.alias,
    category_code: a.categoryCode,
    weight: a.weight ?? 1.0,
    locale: "ko",
  }));

  const { error: aliasErr, count: aliasCount } = await admin
    .from("material_category_aliases")
    .upsert(aliasRows, { onConflict: "alias,category_code", count: "exact" });
  if (aliasErr) {
    console.error("[taxonomy/seed] alias upsert failed:", aliasErr);
    return NextResponse.json(
      { error: "ALIAS_UPSERT_FAILED", details: aliasErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    taxonomyInserted: taxCount ?? taxonomyRows.length,
    aliasInserted: aliasCount ?? aliasRows.length,
    message: `Taxonomy seed 완료 — ${taxonomyRows.length} 카테고리 + ${aliasRows.length} alias`,
  });
}
