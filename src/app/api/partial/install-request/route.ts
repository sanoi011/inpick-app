/**
 * POST /api/partial/install-request
 * 부분 시공 설치 요청(리드) 생성. 로그인 선택(비로그인 시 연락처 필수).
 * body: { surface, materialQuery, productTitle?, productPrice?, productLink?, region, contact?, note?, estimateTotal?, estimateLines? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const region = String(body.region ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const materialQuery = String(body.materialQuery ?? "").trim();
  if (!region) return NextResponse.json({ error: "지역을 입력해주세요." }, { status: 400 });
  if (!user && !contact) {
    return NextResponse.json({ error: "비로그인 시 연락처를 입력해주세요." }, { status: 400 });
  }

  const row = {
    user_id: user?.id ?? null,
    surface: (body.surface as string) ?? null,
    material_query: materialQuery || null,
    product_title: (body.productTitle as string) ?? null,
    product_price: Number.isFinite(Number(body.productPrice)) ? Number(body.productPrice) : null,
    product_link: (body.productLink as string) ?? null,
    region,
    contact: contact || null,
    note: (body.note as string) ?? null,
    estimate_total: Number.isFinite(Number(body.estimateTotal)) ? Number(body.estimateTotal) : null,
    estimate_lines: Array.isArray(body.estimateLines) ? body.estimateLines : [],
    status: "new",
  };

  try {
    const { data, error } = await supabase
      .from("partial_install_requests")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as { id: string }).id });
  } catch (err) {
    console.error("[partial/install-request:POST]", err);
    return NextResponse.json(
      { error: "요청 저장에 실패했습니다. (마이그레이션 적용 여부 확인)" },
      { status: 500 }
    );
  }
}
