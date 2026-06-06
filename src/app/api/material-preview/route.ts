/**
 * GET    /api/material-preview        → 내가 저장한 자재 미리보기 목록
 * POST   /api/material-preview         → 미리보기 결과 저장 (생성은 /api/inpick/render-space-edit에서 1토큰 차감 후)
 * DELETE /api/material-preview?id=     → 저장한 미리보기 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any) {
  return {
    id: r.id,
    room: r.room,
    surface: r.surface,
    materialName: r.material_name,
    prompt: r.prompt,
    sourceUrl: r.source_url,
    resultUrl: r.result_url,
    model: r.model,
    createdAt: r.created_at,
  };
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ previews: [] });

  try {
    const { data, error } = await supabase
      .from("material_previews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ previews: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("[material-preview:GET]", err);
    return NextResponse.json({ previews: [] });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: {
    room?: string;
    surface?: string;
    materialName?: string;
    prompt?: string;
    sourceUrl?: string;
    resultUrl?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.resultUrl) {
    return NextResponse.json({ error: "resultUrl이 필요합니다." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("material_previews")
      .insert({
        user_id: user.id,
        room: body.room ?? null,
        surface: body.surface ?? null,
        material_name: body.materialName ?? null,
        prompt: body.prompt ?? null,
        source_url: body.sourceUrl ?? null,
        result_url: body.resultUrl,
        model: body.model ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ preview: mapRow(data) });
  } catch (err) {
    console.error("[material-preview:POST]", err);
    return NextResponse.json(
      { error: "저장에 실패했습니다. (마이그레이션 적용 여부 확인)" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  try {
    const { error } = await supabase.from("material_previews").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[material-preview:DELETE]", err);
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
