import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini-client";

// ─── Mock 이미지 생성 ───

function generateMockImage(): { imageData: string; description: string } {
  const themes = [
    {
      gradient: ["#E8D5B7", "#B8926A", "#8B6F47"],
      description:
        "모던 미니멀 스타일로 디자인된 거실입니다. 화이트 톤의 벽면에 원목 마루, 그레이 패브릭 소파, 간접 조명을 배치했습니다.",
    },
    {
      gradient: ["#D4E6F1", "#A9CCE3", "#7FB3D8"],
      description:
        "북유럽 스칸디나비안 스타일의 침실입니다. 밝은 자작나무 가구, 린넨 커튼, 따뜻한 조명으로 아늑한 분위기를 연출했습니다.",
    },
    {
      gradient: ["#F5EEF8", "#D7BDE2", "#BB8FCE"],
      description:
        "동유럽풍 클래식 인테리어입니다. 몰딩 장식, 골드 포인트, 대리석 패턴 바닥으로 고급스러운 느낌을 더했습니다.",
    },
    {
      gradient: ["#EAFAF1", "#A9DFBF", "#7DCEA0"],
      description:
        "내추럴 우드 톤의 주방입니다. 원목 수납장, 화이트 타일 백스플래시, 펜던트 조명으로 따뜻하면서도 기능적인 공간입니다.",
    },
  ];

  const theme = themes[Math.floor(Math.random() * themes.length)];
  const [c1, c2, c3] = theme.gradient;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="576" viewBox="0 0 768 576">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c3}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="light" cx="0.5" cy="0.2" r="0.6">
      <stop offset="0%" stop-color="white" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="768" height="576" fill="url(#bg)"/>
  <rect y="340" width="768" height="236" fill="url(#floor)" opacity="0.8"/>
  <rect fill="url(#light)" width="768" height="576"/>
  <rect x="80" y="180" width="250" height="170" rx="8" fill="${c2}" opacity="0.5"/>
  <rect x="400" y="220" width="160" height="130" rx="6" fill="${c3}" opacity="0.4"/>
  <rect x="600" y="260" width="100" height="90" rx="4" fill="${c1}" opacity="0.5"/>
  <circle cx="384" cy="80" r="50" fill="white" opacity="0.15"/>
  <text x="384" y="540" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="white" opacity="0.7">INPICK AI Design Preview (Mock)</text>
</svg>`.trim();

  const base64 = Buffer.from(svg).toString("base64");
  return {
    imageData: `data:image/svg+xml;base64,${base64}`,
    description: theme.description,
  };
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, roomContext, floorPlanContext } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const client = getGeminiClient();

    if (client) {
      try {
        const systemPrompt = `당신은 INPICK의 AI 인테리어 디자이너입니다.
사용자의 요청에 맞는 인테리어 디자인 이미지를 생성하세요.
${roomContext ? `현재 공간 정보: ${roomContext}` : ""}
${floorPlanContext ? `평면도 정보: ${floorPlanContext}` : ""}
포토리얼리스틱한 인테리어 디자인 이미지를 생성해주세요.`;

        const response = await client.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: `${systemPrompt}\n\n사용자 요청: ${prompt}`,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.8,
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        let imageData = "";
        let description = "";

        for (const part of parts) {
          if (part.inlineData) {
            imageData = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          }
          if (part.text) {
            description += part.text;
          }
        }

        if (imageData) {
          return NextResponse.json({ imageData, description, isMock: false });
        }
        // 이미지 없으면 텍스트만 반환된 경우 → Mock 폴백
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        console.error("Gemini image generation error:", error.message);

        if (error.status === 429) {
          return NextResponse.json(
            { error: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", code: "RATE_LIMIT" },
            { status: 429 }
          );
        }
        if (error.status === 403) {
          return NextResponse.json(
            { error: "API 할당량이 초과되었습니다.", code: "QUOTA_EXCEEDED" },
            { status: 403 }
          );
        }
        // 기타 에러 → Mock 폴백
      }
    }

    // Mock 폴백
    await new Promise((r) => setTimeout(r, 1500));
    const mock = generateMockImage();

    return NextResponse.json({
      imageData: mock.imageData,
      description: `**${prompt}** 요청에 대한 디자인입니다.\n\n${mock.description}\n\n*실제 서비스에서는 AI가 생성한 포토리얼리스틱 인테리어 이미지가 표시됩니다.*`,
      isMock: true,
    });
  } catch {
    return NextResponse.json(
      { error: "이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
