/**
 * POST /api/inpick/editable-render/material-preview
 *
 * 자재 변경 preview — texture warp (floor/wall/ceiling) 또는 mask inpainting (object).
 * 가이드: §6-4, §8
 *
 * 출시 v0/v1 — texture warp는 클라 측에서 처리 (canvas 합성),
 * 서버는 자재 정보만 반환 + (옵션) RunPod inpainting endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    editableRenderId?: string;
    layerId?: string;
    materialProductId?: string;
    previewMode?: "texture_warp" | "inpaint";
  };
  if (!body.editableRenderId || !body.layerId || !body.materialProductId) {
    return NextResponse.json(
      { error: "editableRenderId, layerId, materialProductId 필수" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  // 1. material 조회
  const { data: material } = await admin
    .from("material_products")
    .select(
      "id, brand, product_name, model_number, specification, retail_price, contractor_price, unit, thumbnail_url",
    )
    .eq("id", body.materialProductId)
    .maybeSingle();
  if (!material) {
    return NextResponse.json({ error: "Material not found", hint: "DB material_products row 없음" }, { status: 404 });
  }
  const m = material as Record<string, unknown>;

  // 2. layer 조회 — surface_type 확인
  const { data: layer } = await admin
    .from("editable_render_layers")
    .select("surface_type, plane, area_m2, material_product_id")
    .eq("id", body.layerId)
    .maybeSingle();
  if (!layer) return NextResponse.json({ error: "Layer not found" }, { status: 404 });
  const l = layer as { surface_type: string; plane?: string; area_m2?: number; material_product_id?: string };

  const isPlanar =
    ["floor", "wall", "ceiling", "tile_wall"].includes(l.surface_type) ||
    ["floor", "left_wall", "right_wall", "back_wall", "ceiling"].includes(l.plane || "");

  // method 결정
  const method: "texture_warp" | "inpaint" =
    body.previewMode || (isPlanar ? "texture_warp" : "inpaint");

  // 3. preview image — 출시 v1 minimal:
  //   - texture_warp: 클라이언트 측 canvas 합성 권장 (서버는 material thumbnail만 반환)
  //   - inpaint: RunPod 또는 OpenAI image edit (별도 구현 — 현재 placeholder)
  let previewImageUrl: string | undefined;
  if (method === "texture_warp") {
    previewImageUrl = (m.thumbnail_url as string) || undefined;
  }
  // inpaint는 출시 후 별도 작업 — 현재는 thumbnail로 대체

  // 4. estimate delta — 면적 × 단가
  const unitPrice = (m.contractor_price as number) || (m.retail_price as number) || 0;
  const areaM2 = l.area_m2 || 0;
  const afterWon = Math.round(unitPrice * areaM2);
  // beforeWon — 기존 materialProductId의 단가 (간단)
  let beforeWon = 0;
  if (l.material_product_id) {
    const { data: prev } = await admin
      .from("material_products")
      .select("contractor_price, retail_price")
      .eq("id", l.material_product_id)
      .maybeSingle();
    if (prev) {
      const p = prev as Record<string, unknown>;
      beforeWon = Math.round(
        ((p.contractor_price as number) || (p.retail_price as number) || 0) * areaM2,
      );
    }
  }

  return NextResponse.json({
    previewImageUrl,
    method,
    changedLayerId: body.layerId,
    material: {
      materialProductId: m.id,
      brand: m.brand,
      productName: m.product_name,
      sku: m.model_number,
      spec: m.specification,
      unitPrice,
      unit: m.unit,
      thumbnailUrl: m.thumbnail_url,
    },
    estimateDelta: {
      beforeWon,
      afterWon,
      diffWon: afterWon - beforeWon,
    },
    /** 출시 v1 minimal — texture_warp는 클라이언트가 canvas로 합성. */
    clientSideTextureWarp: method === "texture_warp",
  });
}
