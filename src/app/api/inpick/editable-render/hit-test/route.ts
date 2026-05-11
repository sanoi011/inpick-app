/**
 * POST /api/inpick/editable-render/hit-test
 *
 * 클릭 좌표 → layer 후보 반환.
 * 가이드: §6-3
 */
import { NextRequest, NextResponse } from "next/server";
import { getEditableRender } from "@/lib/inpick/editable-render/repository";
import { hitTestLayers } from "@/lib/inpick/editable-render/hit-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    editableRenderId?: string;
    x?: number;
    y?: number;
  };
  if (!body.editableRenderId || typeof body.x !== "number" || typeof body.y !== "number") {
    return NextResponse.json({ error: "editableRenderId, x, y 필수" }, { status: 400 });
  }

  const render = await getEditableRender(body.editableRenderId);
  if (!render) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hits = hitTestLayers({ x: body.x, y: body.y }, render.layers);

  return NextResponse.json({
    selectedLayerId: hits[0]?.id,
    candidates: hits.map((l) => ({
      layerId: l.id,
      labelKo: l.labelKo,
      surfaceType: l.surfaceType,
      confidence: l.confidence,
      plane: l.plane,
    })),
  });
}
