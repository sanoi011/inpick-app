import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contractor_portfolio")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "포트폴리오 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ portfolio: data || [] });
  } catch (err) {
    console.error("Portfolio GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, title, description, projectType, completionDate, images, tags, workScope, features } = body;

    if (!contractorId || !title) {
      return NextResponse.json({ error: "contractorId, title 필수" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("contractor_portfolio")
      .insert({
        contractor_id: contractorId,
        title,
        description: description || null,
        project_type: projectType || null,
        completion_date: completionDate || null,
        images: images || [],
        tags: tags || [],
        work_scope: workScope || [],
        features: features || [],
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Portfolio insert error:", error);
      return NextResponse.json({ error: "포트폴리오 등록 실패" }, { status: 500 });
    }

    return NextResponse.json({ portfolio: data }, { status: 201 });
  } catch (err) {
    console.error("Portfolio POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, contractorId, ...updateFields } = body;

    if (!id || !contractorId) {
      return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 소유권 검증
    const { data: existing } = await supabase
      .from("contractor_portfolio")
      .select("contractor_id")
      .eq("id", id)
      .single();

    if (!existing || existing.contractor_id !== contractorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const dbUpdate: Record<string, unknown> = {};
    if (updateFields.title !== undefined) dbUpdate.title = updateFields.title;
    if (updateFields.description !== undefined) dbUpdate.description = updateFields.description;
    if (updateFields.projectType !== undefined) dbUpdate.project_type = updateFields.projectType;
    if (updateFields.completionDate !== undefined) dbUpdate.completion_date = updateFields.completionDate;
    if (updateFields.images !== undefined) dbUpdate.images = updateFields.images;
    if (updateFields.tags !== undefined) dbUpdate.tags = updateFields.tags;
    dbUpdate.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("contractor_portfolio")
      .update(dbUpdate)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "포트폴리오 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Portfolio PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const contractorId = req.nextUrl.searchParams.get("contractorId");

  if (!id || !contractorId) {
    return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
  }

  try {
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("contractor_portfolio")
      .select("contractor_id")
      .eq("id", id)
      .single();

    if (!existing || existing.contractor_id !== contractorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { error } = await supabase
      .from("contractor_portfolio")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "포트폴리오 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Portfolio DELETE error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
