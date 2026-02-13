// GET /api/admin/floor-plan-library - 도면 라이브러리 목록 조회
// POST /api/admin/floor-plan-library - 도면 등록 (파싱 결과 포함)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const apartmentId = searchParams.get("apartmentId");
    const verified = searchParams.get("verified");
    const minQuality = searchParams.get("minQuality");
    const search = searchParams.get("search");

    if (!supabase) {
      return NextResponse.json({ items: [], total: 0, page, limit });
    }

    let query = supabase
      .from("floor_plan_library")
      .select("*, apartments(complex_name, region), floor_plan_types(type_name, area_sqm)", { count: "exact" });

    if (apartmentId) query = query.eq("apartment_id", apartmentId);
    if (verified === "true") query = query.eq("is_verified", true);
    if (verified === "false") query = query.eq("is_verified", false);
    if (minQuality) query = query.gte("quality_score", parseFloat(minQuality));
    if (search) query = query.ilike("source_file_name", `%${search}%`);

    query = query
      .order("collected_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 통계 요약
    const { data: stats } = await supabase
      .from("floor_plan_library")
      .select("quality_score, is_verified, is_duplicate")
      .not("quality_score", "is", null);

    const totalItems = count || 0;
    const verifiedCount = stats?.filter((s) => s.is_verified).length || 0;
    const duplicateCount = stats?.filter((s) => s.is_duplicate).length || 0;
    const avgQuality = stats && stats.length > 0
      ? stats.reduce((sum, s) => sum + (s.quality_score || 0), 0) / stats.length
      : 0;

    return NextResponse.json({
      items: data || [],
      total: totalItems,
      page,
      limit,
      stats: {
        total: totalItems,
        verified: verifiedCount,
        duplicates: duplicateCount,
        avgQuality: Math.round(avgQuality * 100) / 100,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      apartmentId,
      floorPlanTypeId,
      sourceType,
      sourceUrl,
      sourceFileName,
      sourceFileSize,
      parsedData,
      parseMethod,
      confidence,
      qualityScore,
      qualityDetails,
      fingerprint,
      collectorType,
      collectionJobId,
    } = body;

    // 면적/방수 등 메타데이터 자동 추출
    const areaSqm = parsedData?.totalArea;
    const roomCount = parsedData?.rooms?.length;
    const wallCount = parsedData?.walls?.length;
    const doorCount = parsedData?.doors?.length;
    const windowCount = parsedData?.windows?.length;
    const fixtureCount = parsedData?.fixtures?.length || 0;

    // 핑거프린트 기반 중복 검사
    let isDuplicate = false;
    let duplicateOf: string | null = null;
    if (fingerprint) {
      const { data: existing } = await supabase
        .from("floor_plan_library")
        .select("id")
        .eq("fingerprint", fingerprint)
        .limit(1);

      if (existing && existing.length > 0) {
        isDuplicate = true;
        duplicateOf = existing[0].id;
      }
    }

    const { data, error } = await supabase
      .from("floor_plan_library")
      .insert({
        apartment_id: apartmentId || null,
        floor_plan_type_id: floorPlanTypeId || null,
        source_type: sourceType,
        source_url: sourceUrl || null,
        source_file_name: sourceFileName || null,
        source_file_size: sourceFileSize || null,
        parsed_data: parsedData || null,
        parse_method: parseMethod || null,
        confidence: confidence || 0,
        quality_score: qualityScore || 0,
        quality_details: qualityDetails || {},
        fingerprint: fingerprint || null,
        is_duplicate: isDuplicate,
        duplicate_of: duplicateOf,
        area_sqm: areaSqm || null,
        room_count: roomCount || null,
        wall_count: wallCount || null,
        door_count: doorCount || null,
        window_count: windowCount || null,
        fixture_count: fixtureCount,
        parsed_at: parsedData ? new Date().toISOString() : null,
        collector_type: collectorType || 'manual_upload',
        collection_job_id: collectionJobId || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data, isDuplicate, duplicateOf });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
