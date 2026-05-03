/**
 * POST /api/inpick/render-room
 *
 * 입력: { roomName, widthMm, depthMm, heightMm, style, materialHints?, expansion?, feeling?, size? }
 * 출력: { imageUrl, revisedPrompt, model, costUsd }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateRoomRender, type RenderRoomInput } from "@/lib/inpick/openai-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RenderRoomInput;
    if (!body.roomName || !body.widthMm || !body.depthMm) {
      return NextResponse.json({ error: "roomName, widthMm, depthMm 필수" }, { status: 400 });
    }
    const result = await generateRoomRender({
      heightMm: 2400,
      style: "modern minimal",
      ...body,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
