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

const EXTRACTION_INSTRUCTION = `당신은 인테리어 이미지 생성 prompt 추출 전문가입니다.

CRITICAL: 출력은 오직 valid JSON 객체 하나입니다.
절대 추가 설명/인사/마크다운/코드블록(\`\`\`)/주석 금지.
첫 글자는 반드시 \`{\` 마지막 글자는 \`}\` 입니다.

대화 히스토리가 빈약하거나 정보가 부족해도, 기본값을 사용해서 반드시 JSON을 출력하세요.
(예: room_type 추출 못하면 "living_room", style 못하면 "modern", tone 못하면 "warm wood")

JSON 스키마:
{
  "room_type": "living_room|bedroom|kitchen|bathroom|entrance|balcony|dressing_room",
  "area_sqm": <숫자, 추정값. 모르면 25>,
  "style": "minimal|modern|classic|natural|industrial|japandi|scandi",
  "tone": "warm wood|monotone|colorful|neutral|cool grey|beige",
  "image_prompt": "<영문 prompt — 아래 규칙 준수>"
}

image_prompt 작성 규칙 (반드시 영문):
- 첫 단어: "Photorealistic Korean apartment interior"
- 공간/스타일/톤/특별요구사항 포함
- "wide angle, eye level, natural daylight" 추가
- "clear visible floor, walls, ceiling" 추가 (segmentation 정확도)
- 가구 묘사 최소화 — 마감재(자재) 위주

다시 강조: JSON 외 어떤 텍스트도 출력 금지.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 사용자 채팅 텍스트 → 영문 image prompt (Claude 호출 실패 시 fallback).
 * 한국어 키워드를 영문 인테리어 키워드로 mapping.
 */
function buildFallbackPrompt(userText: string): string {
  const t = userText.toLowerCase();
  const styles: string[] = [];
  if (t.includes("모던") || t.includes("modern")) styles.push("modern minimal");
  else if (t.includes("내추럴") || t.includes("natural")) styles.push("natural warm");
  else if (t.includes("미니멀") || t.includes("minimal")) styles.push("minimal");
  else if (t.includes("클래식") || t.includes("classic")) styles.push("classic elegant");
  else if (t.includes("재팬디") || t.includes("japandi")) styles.push("japandi");
  else if (t.includes("스칸디") || t.includes("scandi")) styles.push("scandinavian");
  else styles.push("modern minimal");

  const tones: string[] = [];
  if (t.includes("우드") || t.includes("나무") || t.includes("wood")) tones.push("warm oak wood tone");
  else if (t.includes("화이트") || t.includes("white")) tones.push("clean white tone");
  else if (t.includes("그레이") || t.includes("gray") || t.includes("grey")) tones.push("warm grey tone");
  else if (t.includes("베이지") || t.includes("beige")) tones.push("beige tone");
  else tones.push("warm wood tone with white walls");

  const extras: string[] = [];
  if (t.includes("수납") || t.includes("storage")) extras.push("ample storage cabinets");
  if (t.includes("조명") || t.includes("lighting")) extras.push("layered warm lighting");
  if (t.includes("창") || t.includes("window")) extras.push("large window with natural light");

  return [
    "Photorealistic Korean apartment interior",
    styles.join(", "),
    tones.join(", "),
    extras.join(", "),
    "wide angle, eye level, natural daylight",
    "clear visible floor, walls, ceiling",
  ]
    .filter((s) => s && s.trim())
    .join(", ");
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

    // Anthropic은 messages가 user로 시작해야 함.
    // chatMessages 첫 항목이 assistant(정적 인사)면 제거.
    let cleaned = messages.filter((m) => m && typeof m.content === "string" && m.content.trim());
    while (cleaned.length > 0 && cleaned[0].role !== "user") {
      cleaned = cleaned.slice(1);
    }
    if (cleaned.length === 0) {
      return NextResponse.json(
        {
          error: "사용자 입력이 없습니다",
          hint: "AI와 1턴 이상 대화한 후 디자인 생성을 눌러주세요",
        },
        { status: 400 },
      );
    }
    // user/assistant 순서 강제 (연속 같은 role 합치기 — Anthropic 정책)
    const normalized: ChatMessage[] = [];
    for (const m of cleaned) {
      const last = normalized[normalized.length - 1];
      if (last && last.role === m.role) {
        last.content += "\n\n" + m.content;
      } else {
        normalized.push({ role: m.role, content: m.content });
      }
    }
    // 마지막에 직접 명령 추가 — Claude가 JSON 출력에 집중하도록
    normalized.push({
      role: "user",
      content:
        "위 대화를 기반으로 인테리어 이미지 생성용 영문 prompt를 추출해서 JSON만 출력하세요.",
    });

    // 가이드 v2 §5-3 — EXTRACTION_INSTRUCTION을 system으로 이동 + cache_control.
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200, // 800 → 1200 (영문 prompt가 길 때 잘림 방지)
        temperature: 0.3, // 낮춤 — JSON 일관성
        system: [
          {
            type: "text",
            text: EXTRACTION_INSTRUCTION,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: normalized,
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
    const text: string = data?.content?.[0]?.text || "";
    console.info(`[design-chat/extract] response length=${text.length}`);

    // 1차: 정확한 JSON 블록 (가장 외곽 {} 매칭)
    let parsed: {
      room_type?: string;
      area_sqm?: number;
      style?: string;
      tone?: string;
      image_prompt?: string;
    } | null = null;

    // 가능한 markdown 코드블록 제거
    const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 가장 외곽 JSON 추출 (greedy)
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // JSON.parse 실패 — 한 번 더 시도: trailing comma/garbage 제거
        try {
          const cleaned2 = jsonMatch[0]
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/\/\/[^\n]*/g, "");
          parsed = JSON.parse(cleaned2);
        } catch {
          /* 무시 — fallback 사용 */
        }
      }
    }

    // JSON 파싱 실패 시 — 대화 내용에서 직접 fallback prompt 생성
    if (!parsed || !parsed.image_prompt) {
      const userTexts = normalized
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");
      const fallbackPrompt = buildFallbackPrompt(userTexts);
      console.warn(
        `[design-chat/extract] JSON 파싱 실패 — fallback prompt 생성 (raw 일부: ${text.slice(0, 200)})`,
      );
      return NextResponse.json({
        room_type: "living_room",
        area_sqm: 25,
        style: "modern",
        tone: "warm wood",
        image_prompt: fallbackPrompt,
        notice: "AI 응답 파싱 실패 — 대화 내용 기반 기본 prompt 사용",
      });
    }

    return NextResponse.json({
      room_type: parsed.room_type || "living_room",
      area_sqm: typeof parsed.area_sqm === "number" ? parsed.area_sqm : 25,
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
