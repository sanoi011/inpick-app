import { NextRequest, NextResponse } from "next/server";
import { matchEmotion } from "@/lib/emotion-match";

// GET/POST /api/emotion-match?q=아픈+사람+힐링
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20, 100);
  const result = await matchEmotion(q, limit);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q = (body.query as string | undefined)?.trim();
  if (!q) return NextResponse.json({ error: "query 필드 필요" }, { status: 400 });
  const limit = Math.min(Number(body.limit) || 20, 100);
  const result = await matchEmotion(q, limit);
  return NextResponse.json(result);
}
