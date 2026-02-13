// src/app/api/project/design-recommend/route.ts
// POST /api/project/design-recommend - AI 디자인 추천 (스타일/예산/우선순위 → 방별 추천)

import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";
import type { ParsedFloorPlan } from "@/types/floorplan";

export const maxDuration = 60;

interface DesignPreferences {
  style: string;       // 모던, 북유럽, 클래식, 미니멀, 내추럴
  budget: string;      // economy, standard, premium
  priorities: string[]; // 채광, 수납, 동선, 개방감, 방음, 청소
}

interface RoomDesign {
  roomId: string;
  roomName: string;
  materials: { surface: string; recommendation: string; unitPrice: number; estimatedCost: number }[];
  furniture: { category: string; recommendation: string; estimatedPrice: number; reason: string }[];
  estimatedCost: number;
}

interface DesignRecommendation {
  designs: RoomDesign[];
  totalEstimate: number;
  designDescription: string;
}

const BUDGET_MAP: Record<string, { label: string; priceMultiplier: number }> = {
  economy: { label: "경제형 (1,500만원)", priceMultiplier: 0.6 },
  standard: { label: "표준형 (3,000만원)", priceMultiplier: 1.0 },
  premium: { label: "프리미엄 (5,000만원+)", priceMultiplier: 1.8 },
};

const DESIGN_PROMPT = `당신은 한국 인테리어 디자인 전문가입니다.
주어진 평면도 정보와 고객 선호도에 맞는 인테리어 디자인을 추천하세요.

## 출력 규칙
- 각 방별로 추천 자재(바닥/벽/천장)와 가구를 제안합니다
- 자재는 한국 시장에서 구할 수 있는 실제 제품/소재를 추천합니다
- 가격은 2025년 한국 시세 기준 원(₩) 단위입니다
- 추천 이유를 간단히 설명합니다
- 전체 디자인 컨셉을 2-3문장으로 설명합니다

반드시 아래 JSON 스키마에 맞춰 출력하세요.`;

const DESIGN_SCHEMA = {
  type: "object" as const,
  properties: {
    designs: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          roomId: { type: "string" as const },
          roomName: { type: "string" as const },
          materials: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                surface: { type: "string" as const },
                recommendation: { type: "string" as const },
                unitPrice: { type: "number" as const },
                estimatedCost: { type: "number" as const },
              },
              required: ["surface", "recommendation", "unitPrice", "estimatedCost"],
            },
          },
          furniture: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                category: { type: "string" as const },
                recommendation: { type: "string" as const },
                estimatedPrice: { type: "number" as const },
                reason: { type: "string" as const },
              },
              required: ["category", "recommendation", "estimatedPrice", "reason"],
            },
          },
          estimatedCost: { type: "number" as const },
        },
        required: ["roomId", "roomName", "materials", "furniture", "estimatedCost"],
      },
    },
    totalEstimate: { type: "number" as const },
    designDescription: { type: "string" as const },
  },
  required: ["designs", "totalEstimate", "designDescription"],
};

function getMockRecommendation(floorPlan: ParsedFloorPlan, prefs: DesignPreferences): DesignRecommendation {
  const multiplier = BUDGET_MAP[prefs.budget]?.priceMultiplier || 1.0;
  const designs: RoomDesign[] = floorPlan.rooms
    .filter(r => !["BALCONY", "CORRIDOR", "ENTRANCE"].includes(r.type))
    .map(room => {
      const baseCost = room.area * 300000 * multiplier;
      return {
        roomId: room.id,
        roomName: room.name,
        materials: [
          { surface: "바닥", recommendation: `${prefs.style === "모던" ? "폴리싱 타일" : "원목 마루"} 600x600`, unitPrice: Math.round(45000 * multiplier), estimatedCost: Math.round(room.area * 45000 * multiplier) },
          { surface: "벽면", recommendation: `${prefs.style === "미니멀" ? "화이트 벽지" : "실크 벽지"} (LG하우시스)`, unitPrice: Math.round(15000 * multiplier), estimatedCost: Math.round(room.area * 3.5 * 15000 * multiplier) },
          { surface: "천장", recommendation: "실크 도장 마감", unitPrice: Math.round(12000 * multiplier), estimatedCost: Math.round(room.area * 12000 * multiplier) },
        ],
        furniture: room.type === "LIVING" ? [
          { category: "소파", recommendation: `${prefs.style} 3인용 패브릭 소파`, estimatedPrice: Math.round(1200000 * multiplier), reason: `${prefs.style} 스타일에 맞는 깔끔한 라인` },
          { category: "TV 유닛", recommendation: "벽걸이 TV + 수납장", estimatedPrice: Math.round(800000 * multiplier), reason: "공간 효율 극대화" },
        ] : room.type === "MASTER_BED" || room.type === "BED" ? [
          { category: "침대", recommendation: `${prefs.style} 퀸사이즈 프레임`, estimatedPrice: Math.round(900000 * multiplier), reason: "편안한 수면 환경" },
        ] : [],
        estimatedCost: Math.round(baseCost),
      };
    });

  const totalEstimate = designs.reduce((s, d) => s + d.estimatedCost, 0);

  return {
    designs,
    totalEstimate,
    designDescription: `${prefs.style} 스타일의 ${BUDGET_MAP[prefs.budget]?.label || "표준형"} 인테리어 디자인입니다. ${prefs.priorities.slice(0, 2).join("과 ")}을 중심으로 설계되었습니다.`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { floorPlan, preferences } = body as {
      floorPlan: ParsedFloorPlan;
      preferences: DesignPreferences;
    };

    if (!floorPlan || !floorPlan.rooms || floorPlan.rooms.length === 0) {
      return NextResponse.json(
        { error: "평면도 데이터가 필요합니다." },
        { status: 400 }
      );
    }

    if (!preferences || !preferences.style) {
      return NextResponse.json(
        { error: "디자인 선호도(스타일)가 필요합니다." },
        { status: 400 }
      );
    }

    // Gemini 미설정 시 Mock
    if (!isGeminiConfigured()) {
      const result = getMockRecommendation(floorPlan, preferences);
      return NextResponse.json({
        ...result,
        method: "mock",
        warnings: ["AI 키 미설정 → Mock 추천"],
      });
    }

    const client = getGeminiClient();
    if (!client) {
      const result = getMockRecommendation(floorPlan, preferences);
      return NextResponse.json({
        ...result,
        method: "mock",
        warnings: ["AI 클라이언트 초기화 실패"],
      });
    }

    const budgetInfo = BUDGET_MAP[preferences.budget] || BUDGET_MAP.standard;
    const roomSummary = floorPlan.rooms
      .map(r => `- ${r.name} (${r.type}): ${r.area}㎡`)
      .join("\n");

    const startTime = Date.now();

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: DESIGN_PROMPT },
            {
              text: `## 평면도 정보
총 면적: ${floorPlan.totalArea}㎡
공간 목록:
${roomSummary}

## 고객 선호도
- 스타일: ${preferences.style}
- 예산: ${budgetInfo.label}
- 우선순위: ${preferences.priorities.join(", ")}

위 정보를 바탕으로 방별 인테리어 디자인을 추천하세요.
각 방의 roomId는 평면도의 room id를 그대로 사용하세요.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: DESIGN_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text || "";
    let result: DesignRecommendation;

    try {
      let jsonText = text;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      result = JSON.parse(jsonText);
    } catch {
      const mock = getMockRecommendation(floorPlan, preferences);
      return NextResponse.json({
        ...mock,
        method: "mock",
        warnings: ["AI 응답 파싱 실패, Mock 추천을 반환합니다"],
      });
    }

    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      method: "gemini_design",
      warnings: [],
      processingTimeMs,
    });
  } catch (error) {
    console.error("[design-recommend] Error:", error);
    return NextResponse.json(
      {
        error: "디자인 추천 생성 중 오류가 발생했습니다",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
