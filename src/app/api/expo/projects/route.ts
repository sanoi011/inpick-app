import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isExpoBrandKit } from "@/lib/expo/brand-import";

export const dynamic = "force-dynamic";

/**
 * INPICK EXPO 프로젝트 저장 API — 소비자 세션(RLS) 기반.
 * 마이그레이션(20260726100000_expo_projects.sql)이 아직 적용되지 않은
 * 환경에서는 42P01을 EXPO_NOT_MIGRATED로 돌려 클라이언트가 로컬 임시
 * 저장으로 조용히 폴백한다.
 */

function tableMissing(message: string | undefined): boolean {
  return /expo_projects.*does not exist|42P01/i.test(message ?? "");
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("expo_projects")
    .select(
      "id, title, area_input, area_unit, footprint, confirmed_dimensions, scene, concept_image_url, brand, quick_fields, updated_at",
    )
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) {
    if (tableMissing(error.message)) {
      return NextResponse.json({ error: "EXPO_NOT_MIGRATED" }, { status: 503 });
    }
    console.error("[expo-projects] list failed:", error.message);
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: {
    id?: unknown;
    title?: unknown;
    areaInput?: unknown;
    areaUnit?: unknown;
    footprint?: unknown;
    confirmedDimensions?: unknown;
    scene?: unknown;
    conceptImageUrl?: unknown;
    brand?: unknown;
    quickFields?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const areaInput = Number(body.areaInput);
  if (!Number.isFinite(areaInput) || areaInput <= 0 || areaInput > 100000) {
    return NextResponse.json({ error: "AREA_INVALID" }, { status: 400 });
  }
  if (body.areaUnit !== "sqm" && body.areaUnit !== "sqft") {
    return NextResponse.json({ error: "UNIT_INVALID" }, { status: 400 });
  }
  if (!body.footprint || typeof body.footprint !== "object") {
    return NextResponse.json({ error: "FOOTPRINT_REQUIRED" }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : "새 부스 프로젝트",
    area_input: areaInput,
    area_unit: body.areaUnit,
    footprint: body.footprint,
    confirmed_dimensions:
      body.confirmedDimensions && typeof body.confirmedDimensions === "object"
        ? body.confirmedDimensions
        : null,
    scene: body.scene && typeof body.scene === "object" ? body.scene : null,
    // data URL은 저장하지 않는다 (행 비대 방지) — Storage URL만
    concept_image_url:
      typeof body.conceptImageUrl === "string" &&
      /^https:\/\//.test(body.conceptImageUrl)
        ? body.conceptImageUrl.slice(0, 2000)
        : null,
    brand: isExpoBrandKit(body.brand) ? body.brand : null,
    concept_generated_at:
      typeof body.conceptImageUrl === "string" &&
      /^https:\/\//.test(body.conceptImageUrl)
        ? new Date().toISOString()
        : null,
    quick_fields:
      body.quickFields && typeof body.quickFields === "object"
        ? body.quickFields
        : {},
  };

  const projectId = typeof body.id === "string" ? body.id : null;
  const query = projectId
    ? supabase
        .from("expo_projects")
        .update(row)
        .eq("id", projectId)
        .select("id, updated_at")
        .maybeSingle()
    : supabase
        .from("expo_projects")
        .insert(row)
        .select("id, updated_at")
        .single();

  const { data, error } = await query;
  if (error || !data) {
    if (tableMissing(error?.message)) {
      return NextResponse.json({ error: "EXPO_NOT_MIGRATED" }, { status: 503 });
    }
    console.error("[expo-projects] save failed:", error?.message);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ project: data }, { status: projectId ? 200 : 201 });
}
