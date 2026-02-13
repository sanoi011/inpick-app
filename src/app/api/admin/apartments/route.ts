// GET /api/admin/apartments - 아파트 단지 목록
// POST /api/admin/apartments - 아파트 단지 등록

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
    const region = searchParams.get("region");
    const search = searchParams.get("search");

    if (!supabase) {
      return NextResponse.json({ apartments: [] });
    }

    let query = supabase
      .from("apartments")
      .select("*, floor_plan_types(id, type_name, area_sqm, room_count, bathroom_count)")
      .order("created_at", { ascending: false });

    if (region) query = query.eq("region", region);
    if (search) query = query.ilike("complex_name", `%${search}%`);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ apartments: data || [] });
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
      complexName, address, region, dongCount,
      householdCount, completionYear, developer, constructor,
      types, // FloorPlanType[] 옵션
    } = body;

    if (!complexName) {
      return NextResponse.json({ error: "단지명이 필요합니다" }, { status: 400 });
    }

    // 아파트 단지 생성
    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .upsert({
        complex_name: complexName,
        address: address || null,
        region: region || null,
        dong_count: dongCount || null,
        household_count: householdCount || null,
        completion_year: completionYear || null,
        developer: developer || null,
        constructor: constructor || null,
        source: 'manual',
      }, { onConflict: "complex_name,region" })
      .select()
      .single();

    if (aptError) {
      return NextResponse.json({ error: aptError.message }, { status: 500 });
    }

    // 타입 등록 (선택)
    if (types && Array.isArray(types) && types.length > 0) {
      const typeRows = types.map((t: {
        typeName: string;
        areaSqm?: number;
        supplyAreaSqm?: number;
        roomCount?: number;
        bathroomCount?: number;
        isExpanded?: boolean;
      }) => ({
        apartment_id: apartment.id,
        type_name: t.typeName,
        area_sqm: t.areaSqm || null,
        supply_area_sqm: t.supplyAreaSqm || null,
        room_count: t.roomCount || null,
        bathroom_count: t.bathroomCount || null,
        is_expanded: t.isExpanded || false,
      }));

      await supabase.from("floor_plan_types").insert(typeRows);
    }

    return NextResponse.json({ apartment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
