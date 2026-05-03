/**
 * POST /api/inpick/generate-elevation
 *
 * 입력: { roomName, widthMm, depthMm, heightMm, walls?, materials? }
 * 출력: SVG 파일 (Loom 스타일 입면전개도, 4면 + 치수)
 *   Content-Type: image/svg+xml
 *
 * GPT-Image 환각 회피 — deterministic SVG 직접 생성, 치수 100% 보장.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateElevationSVG, type ElevationInput } from "@/lib/inpick/openai-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ElevationInput;
    if (!body.roomName || !body.widthMm || !body.depthMm || !body.heightMm) {
      return NextResponse.json({ error: "roomName, widthMm, depthMm, heightMm 필수" }, { status: 400 });
    }
    const svg = generateElevationSVG(body);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="elevation_${body.roomName}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
