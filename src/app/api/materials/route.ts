import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/materials?roomType=LIVING
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const roomType = request.nextUrl.searchParams.get("roomType");

  const query = supabase
    .from("material_room_catalog")
    .select(`
      id, room_type, category, part, sort_order,
      material_options (
        id, name, spec, price, unit, sort_order,
        material_sub_items (
          id, name, specification, unit_price, unit, sort_order
        )
      )
    `)
    .order("sort_order", { ascending: true });

  if (roomType) {
    query.eq("room_type", roomType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "자재 카탈로그 조회 실패" }, { status: 500 });
  }

  // MATERIAL_CATALOG 구조와 동일한 형태로 변환
  const grouped: Record<string, { category: string; part: string; options: { name: string; spec: string; price: number; unit: string; subMaterials: { name: string; specification: string; unitPrice: number; unit: string }[] }[] }[]> = {};

  for (const cat of data || []) {
    const rt = cat.room_type;
    if (!grouped[rt]) grouped[rt] = [];

    const options = ((cat.material_options as unknown[]) || [])
      .sort((a: unknown, b: unknown) => ((a as { sort_order: number }).sort_order || 0) - ((b as { sort_order: number }).sort_order || 0))
      .map((opt: unknown) => {
        const o = opt as { name: string; spec: string; price: number; unit: string; material_sub_items: unknown[] };
        const subMaterials = (o.material_sub_items || [])
          .sort((a: unknown, b: unknown) => ((a as { sort_order: number }).sort_order || 0) - ((b as { sort_order: number }).sort_order || 0))
          .map((sub: unknown) => {
            const s = sub as { name: string; specification: string; unit_price: number; unit: string };
            return {
              name: s.name,
              specification: s.specification || "",
              unitPrice: s.unit_price,
              unit: s.unit,
            };
          });
        return {
          name: o.name,
          spec: o.spec || "",
          price: o.price,
          unit: o.unit,
          subMaterials,
        };
      });

    grouped[rt].push({
      category: cat.category,
      part: cat.part,
      options,
    });
  }

  // sort_order 기준 정렬
  for (const rt of Object.keys(grouped)) {
    grouped[rt].sort((a, b) => {
      const aIdx = (data || []).find((d) => d.room_type === rt && d.category === a.category)?.sort_order || 0;
      const bIdx = (data || []).find((d) => d.room_type === rt && d.category === b.category)?.sort_order || 0;
      return aIdx - bIdx;
    });
  }

  return NextResponse.json({ materials: grouped });
}
