/**
 * POST /api/inpick/editable-render/material-apply
 *
 * 자재 확정 — layer.materialProductId 업데이트 + audit log + 견적 라인 연결.
 * 가이드: §6-5
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  insertMaterialEdit,
  updateLayerMaterial,
} from "@/lib/inpick/editable-render/repository";

export const runtime = "nodejs";
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
    previewImageUrl?: string;
    method?: "texture_warp" | "inpaint" | "replace";
  };
  if (!body.editableRenderId || !body.layerId || !body.materialProductId) {
    return NextResponse.json(
      { error: "editableRenderId, layerId, materialProductId 필수" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  // 1. layer 조회 — previous materialProductId
  const { data: layer } = await admin
    .from("editable_render_layers")
    .select("id, project_id, material_product_id, surface_type, label_ko, area_m2")
    .eq("id", body.layerId)
    .maybeSingle();
  if (!layer) return NextResponse.json({ error: "Layer not found" }, { status: 404 });
  const l = layer as {
    id: string;
    project_id: string;
    material_product_id?: string;
    surface_type: string;
    label_ko: string;
    area_m2?: number;
  };

  // 2. material 조회
  const { data: material } = await admin
    .from("material_products")
    .select("brand, product_name, model_number, contractor_price, retail_price")
    .eq("id", body.materialProductId)
    .maybeSingle();
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  const m = material as Record<string, unknown>;
  const materialLabel = `${(m.brand as string) || ""} ${(m.product_name as string) || ""}${m.model_number ? ` / ${m.model_number}` : ""}`.trim();

  // 3. layer 업데이트
  const ok = await updateLayerMaterial({
    layerId: body.layerId,
    materialProductId: body.materialProductId,
    materialLabel,
  });
  if (!ok) {
    return NextResponse.json({ error: "Layer update failed" }, { status: 500 });
  }

  // 4. audit log
  const editId = await insertMaterialEdit({
    projectId: l.project_id,
    editableRenderId: body.editableRenderId,
    layerId: body.layerId,
    materialProductId: body.materialProductId,
    previousMaterialProductId: l.material_product_id,
    previewImageUrl: body.previewImageUrl,
    method: body.method || "texture_warp",
    estimateDelta: {
      surfaceType: l.surface_type,
      areaM2: l.area_m2,
    },
  });

  // 5. 견적 반영은 build-estimate가 다시 호출될 때 자동 통합 (matchMetaByRoom에서 layer 정보 활용)
  // 현재는 layer만 update — 호출자가 build-estimate를 재호출하여 견적 갱신
  return NextResponse.json({
    ok: true,
    layerId: body.layerId,
    renderMaterialEditId: editId,
    materialLabel,
    /** 호출자가 견적 갱신을 위해 build-estimate를 재호출하도록 안내 */
    rebuildEstimateRequired: true,
  });
}
