import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 단일 또는 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");
  const userId = request.nextUrl.searchParams.get("userId");

  if (id) {
    const { data, error } = await supabase
      .from("consumer_projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ project: data });
  }

  if (userId) {
    const { data, error } = await supabase
      .from("consumer_projects")
      .select("id, user_id, status, address, drawing_id, estimate_id, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "프로젝트 목록 조회 실패" }, { status: 500 });
    }
    return NextResponse.json({ projects: data || [] });
  }

  return NextResponse.json({ error: "id 또는 userId가 필요합니다." }, { status: 400 });
}

// POST: upsert (id 기준)
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { id, userId, status, address, drawingId, estimateId, designState, renderingState, estimateState, rfqState } = body;

    if (!id || !userId) {
      return NextResponse.json({ error: "id와 userId가 필요합니다." }, { status: 400 });
    }

    const record: Record<string, unknown> = {
      id,
      user_id: userId,
      status: status || "ADDRESS_SELECTION",
      updated_at: new Date().toISOString(),
    };

    if (address !== undefined) record.address = address;
    if (drawingId !== undefined) record.drawing_id = drawingId;
    if (estimateId !== undefined) record.estimate_id = estimateId;
    if (designState !== undefined) record.design_state = designState;
    if (renderingState !== undefined) record.rendering_state = renderingState;
    if (estimateState !== undefined) record.estimate_state = estimateState;
    if (rfqState !== undefined) record.rfq_state = rfqState;

    const { data, error } = await supabase
      .from("consumer_projects")
      .upsert(record, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트 저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ project: data });
  } catch {
    return NextResponse.json({ error: "프로젝트 저장 중 오류" }, { status: 500 });
  }
}

// PATCH: 부분 업데이트
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    // snake_case 변환
    const record: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) record.status = updates.status;
    if (updates.address !== undefined) record.address = updates.address;
    if (updates.drawingId !== undefined) record.drawing_id = updates.drawingId;
    if (updates.estimateId !== undefined) record.estimate_id = updates.estimateId;
    if (updates.designState !== undefined) record.design_state = updates.designState;
    if (updates.renderingState !== undefined) record.rendering_state = updates.renderingState;
    if (updates.estimateState !== undefined) record.estimate_state = updates.estimateState;
    if (updates.rfqState !== undefined) record.rfq_state = updates.rfqState;

    const { data, error } = await supabase
      .from("consumer_projects")
      .update(record)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트 업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ project: data });
  } catch {
    return NextResponse.json({ error: "프로젝트 업데이트 중 오류" }, { status: 500 });
  }
}
