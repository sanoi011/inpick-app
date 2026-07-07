// src/app/api/admin/roadmap/route.ts
// 로드맵 데이터 CRUD (features, milestones, stats)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

type EntityType = "feature" | "milestone" | "stat";

// GET: 전체 로드맵 데이터 조회
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = createClient();

  const [featuresRes, milestonesRes, statsRes] = await Promise.all([
    supabase.from("roadmap_features").select("*").order("sort_order", { ascending: true }),
    supabase.from("roadmap_milestones").select("*").order("sort_order", { ascending: true }),
    supabase.from("roadmap_stats").select("*").order("sort_order", { ascending: true }),
  ]);

  return NextResponse.json({
    features: featuresRes.data || [],
    milestones: milestonesRes.data || [],
    stats: statsRes.data || [],
    fromDb: (featuresRes.data?.length || 0) > 0,
  });
}

// POST: 새 항목 생성 또는 초기 데이터 시드
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = createClient();
  const body = await request.json();

  // 시드 요청 (초기 데이터 일괄 삽입)
  if (body.action === "seed") {
    const { features, milestones, stats } = body;

    const results: string[] = [];

    if (features?.length > 0) {
      const { error } = await supabase.from("roadmap_features").insert(features);
      if (error) results.push(`features error: ${error.message}`);
      else results.push(`features: ${features.length} inserted`);
    }
    if (milestones?.length > 0) {
      const { error } = await supabase.from("roadmap_milestones").insert(milestones);
      if (error) results.push(`milestones error: ${error.message}`);
      else results.push(`milestones: ${milestones.length} inserted`);
    }
    if (stats?.length > 0) {
      const { error } = await supabase.from("roadmap_stats").insert(stats);
      if (error) results.push(`stats error: ${error.message}`);
      else results.push(`stats: ${stats.length} inserted`);
    }

    return NextResponse.json({ results });
  }

  // 단일 항목 생성
  const { type, ...data } = body as { type: EntityType } & Record<string, unknown>;
  const tableName = type === "feature" ? "roadmap_features" : type === "milestone" ? "roadmap_milestones" : "roadmap_stats";

  const { data: created, error } = await supabase
    .from(tableName)
    .insert(data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}

// PATCH: 항목 수정
export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = createClient();
  const body = await request.json();
  const { type, id, ...data } = body as { type: EntityType; id: string } & Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: "id 필수" }, { status: 400 });
  }

  const tableName = type === "feature" ? "roadmap_features" : type === "milestone" ? "roadmap_milestones" : "roadmap_stats";

  if (type === "feature") {
    (data as Record<string, unknown>).updated_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from(tableName)
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE: 항목 삭제
export async function DELETE(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = createClient();
  const type = request.nextUrl.searchParams.get("type") as EntityType;
  const id = request.nextUrl.searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "type과 id 필수" }, { status: 400 });
  }

  const tableName = type === "feature" ? "roadmap_features" : type === "milestone" ? "roadmap_milestones" : "roadmap_stats";

  const { error } = await supabase.from(tableName).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
