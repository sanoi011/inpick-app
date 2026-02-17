import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";

export const maxDuration = 120;

const IMAGE_GEN_MODEL = "gemini-3-pro-image-preview";

export async function POST(request: NextRequest) {
  try {
    const {
      conversationSummary,
      designPreferences,
      floorPlanImageUrl,
      floorPlanContext,
    } = await request.json();

    if (!isGeminiConfigured()) {
      return createMockResponse(designPreferences);
    }

    const client = getGeminiClient()!;

    // 도면 이미지 가져오기
    let floorPlanParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    if (floorPlanImageUrl) {
      try {
        const imgRes = await fetch(floorPlanImageUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const mimeType = imgRes.headers.get("content-type") || "image/png";
          floorPlanParts = [
            { inlineData: { mimeType, data: buffer.toString("base64") } },
          ];
        }
      } catch (err) {
        console.warn("[design-ai-image] Failed to fetch floor plan:", err);
      }
    }

    // 프롬프트 구성
    const prefs = designPreferences || {};
    const prefsText = [
      prefs.style ? `인테리어 스타일: ${prefs.style}` : "",
      prefs.budget
        ? `예산: ${prefs.budget === "economy" ? "경제형 1,500만원" : prefs.budget === "standard" ? "표준형 3,000만원" : "프리미엄 5,000만원+"}`
        : "",
      prefs.priorities?.length > 0
        ? `우선순위: ${prefs.priorities.join(", ")}`
        : "",
      prefs.specialNotes?.length > 0
        ? `특기사항: ${prefs.specialNotes.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = [
      "당신은 한국 아파트 인테리어 디자인 전문가입니다.",
      "첨부된 평면도를 기반으로 포토리얼리스틱 인테리어 디자인 이미지를 생성해주세요.",
      "",
      floorPlanParts.length > 0
        ? "첨부된 평면도의 공간 구조(방 배치, 거실 위치, 주방 위치)를 정확히 반영하세요."
        : "",
      floorPlanContext
        ? `[공간 구성]\n${floorPlanContext}`
        : "",
      prefsText ? `\n[디자인 옵션]\n${prefsText}` : "",
      conversationSummary
        ? `\n[사용자와의 대화 요약]\n${conversationSummary}`
        : "",
      "",
      "요구사항:",
      "- 거실을 중심으로 한 투시도(perspective view) 렌더링",
      "- 실제 고급 아파트 모델하우스 사진처럼 리얼하게",
      "- 자연광이 들어오는 밝고 따뜻한 느낌",
      "- 가구, 소품, 조명까지 포함한 완성된 디자인",
      "- 한국 아파트 인테리어 트렌드 반영",
      "",
      "이미지와 함께 디자인 설명(사용된 자재, 가구, 색상 등)을 한국어로 간단히 설명해주세요.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await client.models.generateContent({
        model: IMAGE_GEN_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              ...floorPlanParts,
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      let imageData: string | null = null;
      let description = "";

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          const mimeType = part.inlineData.mimeType;
          imageData = `data:${mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          description += part.text;
        }
      }

      if (imageData) {
        return NextResponse.json({
          imageData,
          description: description || "AI 디자인이 생성되었습니다.",
          isMock: false,
        });
      }

      // 이미지 없으면 텍스트만 반환
      return NextResponse.json({
        imageData: null,
        description: description || "이미지를 생성하지 못했습니다. 다시 시도해주세요.",
        isMock: false,
      });
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      console.error("[design-ai-image] Gemini error:", error.message);

      if (error.status === 429) {
        return NextResponse.json(
          { error: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." },
          { status: 429 }
        );
      }

      return createMockResponse(designPreferences);
    }
  } catch (err) {
    console.error("[design-ai-image] Error:", err);
    return NextResponse.json(
      { error: "디자인 이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

function createMockResponse(prefs?: { style?: string }) {
  const style = prefs?.style || "모던";
  const colors: Record<string, string[]> = {
    "모던": ["#E8E0D4", "#B8A68F", "#6B5D4F"],
    "북유럽": ["#D4E6F1", "#A9CCE3", "#7FB3D8"],
    "클래식": ["#F5EEF8", "#D7BDE2", "#BB8FCE"],
    "미니멀": ["#F0F0F0", "#D0D0D0", "#A0A0A0"],
    "내추럴": ["#EAFAF1", "#A9DFBF", "#7DCEA0"],
  };
  const [c1, c2, c3] = colors[style] || colors["모던"];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c3}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="768" fill="url(#bg)"/>
  <rect y="450" width="1024" height="318" fill="url(#floor)" opacity="0.7"/>
  <rect x="100" y="200" width="350" height="260" rx="12" fill="${c2}" opacity="0.4"/>
  <rect x="520" y="250" width="220" height="210" rx="8" fill="${c3}" opacity="0.35"/>
  <rect x="800" y="300" width="140" height="160" rx="6" fill="${c1}" opacity="0.45"/>
  <circle cx="512" cy="100" r="60" fill="white" opacity="0.12"/>
  <text x="512" y="720" text-anchor="middle" font-family="system-ui" font-size="16" fill="white" opacity="0.6">INPICK AI Design Preview (Mock)</text>
  <text x="512" y="745" text-anchor="middle" font-family="system-ui" font-size="12" fill="white" opacity="0.4">${style} Style</text>
</svg>`;

  return NextResponse.json({
    imageData: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    description: `**${style} 스타일** 인테리어 디자인 프리뷰입니다.\n\nGemini API 키가 설정되면 실제 포토리얼리스틱 렌더링 이미지가 생성됩니다.\n\n*Mock 모드*`,
    isMock: true,
  });
}
