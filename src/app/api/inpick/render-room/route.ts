/**
 * POST /api/inpick/render-room
 *
 * 입력: { roomName, widthMm, depthMm, heightMm, style, materialHints?, expansion?, feeling?, size? }
 * 출력: { imageUrl, revisedPrompt, model, costUsd }
 *
 * Mock fallback: OPENAI_API_KEY 미설정 또는 INPICK_FORCE_MOCK_RENDER=true 또는 OpenAI 호출 실패 시
 * picsum 이미지를 반환해서 UI/UX 검증을 막지 않습니다.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateRoomRender, type RenderRoomInput } from "@/lib/inpick/openai-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const MOCK_BY_ROOM: Record<string, string> = {
  거실: "living-room",
  안방: "bedroom",
  주방: "kitchen",
  부엌: "kitchen",
  욕실: "bathroom",
  욕실1: "bathroom",
  욕실2: "bathroom",
  침실: "bedroom",
  침실1: "bedroom",
  침실2: "bedroom",
  현관: "entrance",
  발코니: "balcony",
  드레스룸: "closet",
};

function buildMockImage(seed: string): string {
  const hash = Array.from(seed).reduce((s, c) => s + c.charCodeAt(0), 0);
  const id = (hash % 200) + 1;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}-${id}/1024/1024`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RenderRoomInput;
    if (!body.roomName || !body.widthMm || !body.depthMm) {
      return NextResponse.json(
        { error: "roomName, widthMm, depthMm 필수" },
        { status: 400 },
      );
    }

    const forceMock =
      process.env.INPICK_FORCE_MOCK_RENDER === "true" || !process.env.OPENAI_API_KEY;

    if (forceMock) {
      const seed = `${body.roomName}-${body.style || "default"}-${Date.now()}-${Math.random()}`;
      return NextResponse.json({
        imageUrl: buildMockImage(seed),
        revisedPrompt: `[MOCK] ${body.roomName} ${body.style || ""} ${body.widthMm}×${body.depthMm}×${body.heightMm}mm`,
        model: "mock-picsum",
        costUsd: 0,
        mock: true,
        mockReason: process.env.OPENAI_API_KEY ? "INPICK_FORCE_MOCK_RENDER=true" : "OPENAI_API_KEY 미설정",
      });
    }

    try {
      const result = await generateRoomRender({
        ...body,
        heightMm: body.heightMm || 2400,
        style: body.style || "modern minimal",
      });
      return NextResponse.json(result);
    } catch (e) {
      // OpenAI 호출 실패 시 mock fallback (UI 막힘 방지)
      const seed = `${body.roomName}-fallback-${Date.now()}`;
      return NextResponse.json({
        imageUrl: buildMockImage(seed),
        revisedPrompt: `[MOCK FALLBACK] ${body.roomName} — OpenAI 호출 실패: ${e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100)}`,
        model: "mock-picsum-fallback",
        costUsd: 0,
        mock: true,
        mockReason: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
