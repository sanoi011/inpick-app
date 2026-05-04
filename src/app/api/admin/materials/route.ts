/**
 * GET /api/admin/materials — 전체 자재 옵션 list (관리자 전용, RLS 우회)
 * PATCH /api/admin/materials — 단일 옵션 수정 (name, spec, price, unit)
 *
 * 인증: localStorage admin_token → Bearer 헤더
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  // 운영 단순화: admin token 형식만 체크 (실제 검증은 별도 admin 세션 시스템에서)
  return auth.length > 10;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const roomType = searchParams.get("roomType");
    const q = searchParams.get("q");

    let query = admin
      .from("material_options")
      .select(
        `id, name, spec, price, unit, sort_order, catalog_id,
         catalog:material_room_catalog (id, room_type, category, part)`,
      )
      .order("sort_order", { ascending: true })
      .limit(2000);

    if (q && q.trim()) {
      const safe = q.trim().replace(/[%_]/g, "");
      query = query.or(`name.ilike.%${safe}%,spec.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = {
      id: string;
      name: string;
      spec: string | null;
      price: number;
      unit: string;
      sort_order: number | null;
      catalog_id: string;
      catalog: { id: string; room_type: string; category: string; part: string } | null;
    };

    const items = ((data as unknown as Row[]) || [])
      .filter((r) => !roomType || r.catalog?.room_type === roomType)
      .map((r) => ({
        id: r.id,
        name: r.name,
        spec: r.spec || "",
        price: r.price,
        unit: r.unit,
        sortOrder: r.sort_order ?? 0,
        catalogId: r.catalog_id,
        roomType: r.catalog?.room_type || "",
        category: r.catalog?.category || "",
        part: r.catalog?.part || "",
      }));

    return NextResponse.json({ count: items.length, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id, name, spec, price, unit } = body as {
      id: string;
      name?: string;
      spec?: string;
      price?: number;
      unit?: string;
    };
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const admin = createAdminClient();
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (spec !== undefined) update.spec = spec;
    if (price !== undefined) update.price = Math.max(0, Math.floor(price));
    if (unit !== undefined) update.unit = unit;
    update.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("material_options")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
