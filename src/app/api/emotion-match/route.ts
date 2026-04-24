import { NextRequest, NextResponse } from "next/server";
import { matchEmotion } from "@/lib/emotion-match";

// GET/POST /api/emotion-match?q=아픈+사람+힐링[&space=침실&trade=ARCH_ELEV&drawing_type=elevation]
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });
  const limit = Math.min(parseInt(sp.get("limit") || "20", 10) || 20, 100);
  const filters = {
    trade:        sp.get("trade") || undefined,
    drawingType:  sp.get("drawing_type") || undefined,
    space:        sp.get("space") || undefined,
  };
  const result = await matchEmotion(q, limit, filters);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q = (body.query as string | undefined)?.trim();
  if (!q) return NextResponse.json({ error: "query 필드 필요" }, { status: 400 });
  const limit = Math.min(Number(body.limit) || 20, 100);
  const filters = {
    trade:        body.trade as string | undefined,
    drawingType:  body.drawingType as string | undefined,
    space:        body.space as string | undefined,
  };
  const result = await matchEmotion(q, limit, filters);
  return NextResponse.json(result);
}
