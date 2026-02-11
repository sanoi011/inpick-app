import { NextRequest, NextResponse } from "next/server";

// Mock 이미지 생성 (Gemini API 키 없을 때)
function generateMockImage(): { imageData: string; description: string } {
  // 1x1 플레이스홀더 → 실제로는 Gemini가 생성한 이미지
  const colors = ["#E3F2FD", "#FFF3E0", "#F3E5F5", "#E8EAF6", "#E0F7FA", "#E8F5E9"];
  const styles = [
    "모던 미니멀 스타일로 디자인된 거실입니다. 화이트 톤의 벽면에 원목 마루, 그레이 패브릭 소파, 간접 조명을 배치했습니다.",
    "북유럽 스칸디나비안 스타일의 침실입니다. 밝은 자작나무 가구, 린넨 커튼, 따뜻한 조명으로 아늑한 분위기를 연출했습니다.",
    "동유럽풍 클래식 인테리어입니다. 몰딩 장식, 골드 포인트, 대리석 패턴 바닥으로 고급스러운 느낌을 더했습니다.",
    "내추럴 우드 톤의 주방입니다. 원목 수납장, 화이트 타일 백스플래시, 펜던트 조명으로 따뜻하면서도 기능적인 공간입니다.",
  ];

  const color = colors[Math.floor(Math.random() * colors.length)];
  const description = styles[Math.floor(Math.random() * styles.length)];

  // SVG 기반 Mock 이미지 생성
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${color}"/>
      <rect x="20" y="350" width="472" height="142" fill="#f5f5f5" rx="4"/>
      <rect x="30" y="200" width="200" height="150" fill="#e0e0e0" rx="4"/>
      <rect x="280" y="250" width="120" height="100" fill="#d0d0d0" rx="4"/>
      <rect x="420" y="280" width="60" height="70" fill="#c0c0c0" rx="4"/>
      <circle cx="440" cy="80" r="40" fill="#fff9c4" opacity="0.6"/>
      <rect x="50" y="360" width="180" height="60" fill="#bcaaa4" rx="2"/>
      <rect x="300" y="380" width="80" height="40" fill="#90a4ae" rx="2"/>
      <text x="256" y="480" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#666">AI Generated Interior Design</text>
    </svg>
  `.trim();

  const base64 = Buffer.from(svg).toString("base64");
  return {
    imageData: `data:image/svg+xml;base64,${base64}`,
    description,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, roomContext, floorPlanContext } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (apiKey) {
      try {
        // Gemini 이미지 생성 시도
        const systemPrompt = `당신은 INPICK의 AI 인테리어 디자이너입니다.
사용자의 요청에 맞는 인테리어 디자인 이미지를 생성하세요.
${roomContext ? `현재 공간 정보: ${roomContext}` : ""}
${floorPlanContext ? `평면도 정보: ${floorPlanContext}` : ""}
포토리얼리스틱한 인테리어 디자인 이미지를 생성해주세요.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${prompt}` }] },
              ],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                temperature: 0.8,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts || [];

          let imageData = "";
          let description = "";

          for (const part of parts) {
            if (part.inlineData) {
              imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
            if (part.text) {
              description += part.text;
            }
          }

          if (imageData) {
            return NextResponse.json({ imageData, description });
          }
          // 이미지 없으면 텍스트만 있을 수 있음 → Mock 폴백
        }
      } catch {
        // Gemini 실패 → Mock 폴백
      }
    }

    // Mock 폴백
    await new Promise((r) => setTimeout(r, 1500));
    const mock = generateMockImage();

    return NextResponse.json({
      imageData: mock.imageData,
      description: `**${prompt}** 요청에 대한 디자인입니다.\n\n${mock.description}\n\n*실제 서비스에서는 AI가 생성한 포토리얼리스틱 인테리어 이미지가 표시됩니다.*`,
    });
  } catch {
    return NextResponse.json(
      { error: "이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
