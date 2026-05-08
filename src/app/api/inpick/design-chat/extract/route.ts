/**
 * POST /api/inpick/design-chat/extract
 *
 * 가이드 §1 extract_image_prompt 동등 구현.
 * 대화 히스토리 → 이미지 생성용 영문 prompt + 메타 (room_type, area_sqm, style, tone)
 *
 * 입력: { messages: [{role, content}] }
 * 출력: { room_type, area_sqm, style, tone, image_prompt }
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const EXTRACTION_INSTRUCTION = `위 대화에서 인테리어 이미지 생성에 필요한 정보를 추출해서
GPT Image 모델용 영문 프롬프트로 변환해줘.

출력은 반드시 valid JSON 객체 (다른 텍스트 없이):
{
  "room_type": "living_room|bedroom|kitchen|bathroom|entrance|balcony|dressing_room",
  "area_sqm": <숫자, 추정값 가능>,
  "style": "minimal|modern|classic|natural|industrial|japandi|scandi",
  "tone": "warm wood|monotone|colorful|neutral|cool grey|beige",
  "image_prompt": "<영문 프롬프트>"
}

image_prompt 작성 규칙:
- "Photorealistic Korean apartment interior" 로 시작
- 공간/스타일/톤/특별요구사항 포함
- "wide angle, eye level, natural daylight" 추가
- "clear visible floor, walls, ceiling" 추가 (세그멘테이션 정확도 위해)
- 가구는 빼고 마감재 위주로 (사용자 정책)`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI 상담 서비스가 설정되지 않았습니다 (관리자 문의)" },
      { status: 503 },
    );
  }

  try {
    const { messages } = (await req.json()) as { messages?: ChatMessage[] };
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages 필수" }, { status: 400 });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: EXTRACTION_INSTRUCTION },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.warn("[design-chat/extract] upstream error:", upstream.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "프롬프트 추출 실패", hint: "잠시 후 재시도" },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    const text = data?.content?.[0]?.text || "";
    // JSON 추출 — 모델이 ```json ``` 포함하거나 앞뒤에 텍스트 붙일 수 있어 robust 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "프롬프트 추출 결과 파싱 실패", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }
    let parsed: {
      room_type?: string;
      area_sqm?: number;
      style?: string;
      tone?: string;
      image_prompt?: string;
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "프롬프트 JSON 파싱 실패", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }
    if (!parsed.image_prompt) {
      return NextResponse.json(
        { error: "image_prompt 누락", raw: parsed },
        { status: 502 },
      );
    }
    return NextResponse.json({
      room_type: parsed.room_type || "living_room",
      area_sqm: typeof parsed.area_sqm === "number" ? parsed.area_sqm : 0,
      style: parsed.style || "modern",
      tone: parsed.tone || "warm wood",
      image_prompt: parsed.image_prompt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[design-chat/extract] error:", msg);
    return NextResponse.json({ error: "프롬프트 추출 중 오류" }, { status: 500 });
  }
}
