// src/app/api/project/estimate-materials/route.ts
// POST /api/project/estimate-materials
// 도면 이미지 + 디자인 선호도 → GPT-5.6 Sol → 견적용 SelectedMaterial[] 자동 추천

import { NextRequest, NextResponse } from "next/server";
import { analyzeImageVision } from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";

export const maxDuration = 60;

// 자재 카테고리 코드 (estimate-calculator의 CATEGORY_TO_ITEM_MAP과 일치)
const MATERIAL_CATEGORIES = [
  "FLOORING",       // 바닥재
  "WALLPAPER",      // 벽지
  "PAINT",          // 도장
  "CEILING",        // 천장재
  "DOOR_ROOM",      // 방문
  "ENTRY_DOOR",     // 현관문
  "TOILET",         // 양변기
  "VANITY",         // 세면대
  "SHOWER_BATH",    // 샤워/욕조
  "BATH_TILE",      // 욕실타일
  "KITCHEN_SINK",   // 주방싱크
  "KITCHEN_CABINET", // 주방수납장
  "BASEBOARD",      // 걸레받이
  "LIGHTING",       // 조명
] as const;

const MATERIAL_PROMPT = `당신은 한국 인테리어 자재 전문가입니다.
첨부된 아파트 평면도 이미지와 고객의 디자인 선호도를 분석하여,
각 자재 카테고리별로 적합한 제품을 추천하세요.

## 자재 카테고리 (모두 추천 필수)
- FLOORING: 바닥재 (강마루/강화마루/원목마루/타일 등)
- WALLPAPER: 벽지 (실크벽지/합지벽지/페인트벽지 등)
- PAINT: 도장 (수성페인트/친환경 등)
- CEILING: 천장재 (석고보드/텍스/도장 등)
- DOOR_ROOM: 방문 (ABS방문/원목방문 등)
- ENTRY_DOOR: 현관문 (방화문/디지털도어록 등)
- TOILET: 양변기 (TOTO/대림/아메리칸스탠다드 등)
- VANITY: 세면대 (하부장세트/일체형 등)
- SHOWER_BATH: 샤워부스/욕조 (유리파티션/시스템바스 등)
- BATH_TILE: 욕실타일 (포세린/세라믹 등)
- KITCHEN_SINK: 주방싱크대 (인조대리석/스테인리스 등)
- KITCHEN_CABINET: 주방수납장 (상/하부장, 래핑/UV 등)
- BASEBOARD: 걸레받이 (PVC/MDF/알루미늄 등)
- LIGHTING: 조명 (LED매입등/거실등/방등 등)

## 출력 규칙
- 한국 시장에서 구매 가능한 실제 브랜드/제품 추천
- 단가는 2025-2026년 한국 시세 기준 (원)
- 자재 단가(unitPrice)와 시공비 단가(laborPrice) 구분
- 규격(specification) 구체적으로 기재
- 예산 등급에 맞는 가격대 선택
- priceGrade는 economy/standard/premium 중 하나

반드시 아래 JSON 스키마에 맞춰 출력하세요.`;

const MATERIAL_SCHEMA = {
  type: "object" as const,
  properties: {
    materials: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          categoryCode: { type: "string" as const },
          category: { type: "string" as const },
          materialName: { type: "string" as const },
          brand: { type: "string" as const },
          specification: { type: "string" as const },
          unitPrice: { type: "number" as const },
          laborPrice: { type: "number" as const },
          unit: { type: "string" as const },
          priceGrade: { type: "string" as const },
          reason: { type: "string" as const },
        },
        required: [
          "categoryCode", "category", "materialName", "brand",
          "specification", "unitPrice", "laborPrice", "unit",
          "priceGrade", "reason",
        ],
      },
    },
    designConcept: { type: "string" as const },
  },
  required: ["materials", "designConcept"],
};

interface AIMaterial {
  categoryCode: string;
  category: string;
  materialName: string;
  brand: string;
  specification: string;
  unitPrice: number;
  laborPrice: number;
  unit: string;
  priceGrade: string;
  reason: string;
}

function getMockMaterials(budget: string): AIMaterial[] {
  const mult = budget === "premium" ? 1.5 : budget === "economy" ? 0.7 : 1.0;
  const grade = budget === "premium" ? "premium" : budget === "economy" ? "economy" : "standard";
  return [
    { categoryCode: "FLOORING", category: "바닥재", materialName: "LG하우시스 강마루", brand: "LG하우시스", specification: "1210x150x12mm 원목무늬", unitPrice: Math.round(45000 * mult), laborPrice: 20000, unit: "m²", priceGrade: grade, reason: "내구성 좋고 관리 용이" },
    { categoryCode: "WALLPAPER", category: "벽지", materialName: "신한실크벽지", brand: "신한", specification: "합지 1080mm 폭", unitPrice: Math.round(8000 * mult), laborPrice: 10000, unit: "m²", priceGrade: grade, reason: "실크 질감, 오염 방지" },
    { categoryCode: "PAINT", category: "도장", materialName: "노루 수성페인트", brand: "노루", specification: "친환경 1급 백색", unitPrice: Math.round(5000 * mult), laborPrice: 12000, unit: "m²", priceGrade: grade, reason: "친환경 저VOC" },
    { categoryCode: "CEILING", category: "천장재", materialName: "석고보드 + 도장마감", brand: "KCC", specification: "9.5T 석고보드 + 수성페인트", unitPrice: Math.round(15000 * mult), laborPrice: 25000, unit: "m²", priceGrade: grade, reason: "일반적 천장 마감" },
    { categoryCode: "DOOR_ROOM", category: "방문", materialName: "ABS 방문", brand: "영림도어", specification: "900x2100mm 잠금장치 포함", unitPrice: Math.round(250000 * mult), laborPrice: 80000, unit: "EA", priceGrade: grade, reason: "내구성과 방음 우수" },
    { categoryCode: "ENTRY_DOOR", category: "현관문", materialName: "방화문 + 디지털도어록", brand: "게이트맨", specification: "갑종 방화문 950x2100mm", unitPrice: Math.round(600000 * mult), laborPrice: 200000, unit: "EA", priceGrade: grade, reason: "보안성 우수" },
    { categoryCode: "TOILET", category: "양변기", materialName: "TOTO 투피스", brand: "TOTO", specification: "CW764 절수형", unitPrice: Math.round(350000 * mult), laborPrice: 100000, unit: "EA", priceGrade: grade, reason: "절수형 고효율" },
    { categoryCode: "VANITY", category: "세면대", materialName: "세면대 하부장 세트", brand: "대림", specification: "800mm 하부장+세면기+수전", unitPrice: Math.round(280000 * mult), laborPrice: 80000, unit: "SET", priceGrade: grade, reason: "수납 일체형" },
    { categoryCode: "SHOWER_BATH", category: "샤워부스", materialName: "유리 샤워부스", brand: "대림", specification: "강화유리 8T 900x900mm", unitPrice: Math.round(500000 * mult), laborPrice: 150000, unit: "EA", priceGrade: grade, reason: "깔끔한 건습 분리" },
    { categoryCode: "BATH_TILE", category: "욕실타일", materialName: "포세린 타일", brand: "동서타일", specification: "300x600mm 무광 포세린", unitPrice: Math.round(50000 * mult), laborPrice: 35000, unit: "m²", priceGrade: grade, reason: "미끄럼 방지, 관리 용이" },
    { categoryCode: "KITCHEN_SINK", category: "주방싱크", materialName: "인조대리석 싱크대", brand: "한샘", specification: "인조대리석 상판 + 2볼", unitPrice: Math.round(350000 * mult), laborPrice: 80000, unit: "EA", priceGrade: grade, reason: "위생적, 스크래치 복원" },
    { categoryCode: "KITCHEN_CABINET", category: "주방수납장", materialName: "래핑 수납장", brand: "한샘", specification: "상/하부장 래핑 중급", unitPrice: Math.round(400000 * mult), laborPrice: 100000, unit: "m", priceGrade: grade, reason: "내구성 좋은 래핑 마감" },
    { categoryCode: "BASEBOARD", category: "걸레받이", materialName: "PVC 걸레받이", brand: "LG하우시스", specification: "높이 80mm PVC", unitPrice: Math.round(5000 * mult), laborPrice: 4000, unit: "m", priceGrade: grade, reason: "관리 용이, 방습" },
    { categoryCode: "LIGHTING", category: "조명", materialName: "LED 매입등 + 방등", brand: "필립스", specification: "LED 12W 매입등 + 방등 세트", unitPrice: Math.round(50000 * mult), laborPrice: 30000, unit: "EA", priceGrade: grade, reason: "에너지 절약, 밝기 조절" },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      floorPlanImageUrl,
      designPreferences,
      area,
      roomCount,
    } = body as {
      floorPlanImageUrl?: string;
      designPreferences?: { style?: string; budget?: string; priorities?: string[]; specialNotes?: string[] };
      area?: number;
      roomCount?: number;
    };

    const budget = designPreferences?.budget || "standard";
    const style = designPreferences?.style || "모던";
    const priorities = designPreferences?.priorities || [];
    const specialNotes = designPreferences?.specialNotes || [];

    // OpenAI 미설정 시 표준 추천으로 안전 폴백
    if (!hasOpenAIKey()) {
      const materials = getMockMaterials(budget);
      return NextResponse.json({
        materials,
        designConcept: `${style} 스타일의 ${budget === "premium" ? "프리미엄" : budget === "economy" ? "경제형" : "표준형"} 인테리어 자재 추천입니다.`,
        method: "mock",
        warnings: ["AI API 키가 설정되지 않아 기본 추천 데이터를 반환합니다"],
      });
    }

    // 도면 이미지 가져오기
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    if (floorPlanImageUrl) {
      try {
        let fetchUrl = floorPlanImageUrl;
        if (fetchUrl.startsWith("/")) {
          const host = request.headers.get("host") || "localhost:3001";
          const protocol = request.headers.get("x-forwarded-proto") || "http";
          fetchUrl = `${protocol}://${host}${fetchUrl}`;
        }
        const imgRes = await fetch(fetchUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const mimeType = imgRes.headers.get("content-type") || "image/png";
          imageBase64 = buffer.toString("base64");
          imageMimeType = mimeType;
        }
      } catch (err) {
        console.warn("[estimate-materials] Failed to fetch image:", err);
      }
    }

    const budgetLabel = budget === "premium" ? "프리미엄 (5,000만원+)" :
                        budget === "economy" ? "경제형 (1,500만원)" :
                        "표준형 (3,000만원)";

    const userPrompt = `## 프로젝트 정보
- 전용면적: ${area || 84}㎡
- 방 수: ${roomCount || 3}개
${imageBase64 ? "- 첨부된 평면도 이미지를 참고하여 공간별 특성에 맞게 자재를 추천하세요" : "- 일반적인 한국 아파트 구조를 기준으로 추천하세요"}

## 고객 선호도
- 스타일: ${style}
- 예산: ${budgetLabel}
${priorities.length > 0 ? `- 우선순위: ${priorities.join(", ")}` : ""}
${specialNotes.length > 0 ? `- 특이사항: ${specialNotes.join(", ")}` : ""}

위 정보에 맞는 14개 카테고리 전체의 자재를 추천하세요.
${MATERIAL_CATEGORIES.map(c => `- ${c}`).join("\n")}`;

    const startTime = Date.now();

    let response: Awaited<ReturnType<typeof analyzeImageVision>>;
    try {
      response = await analyzeImageVision({
        imageBase64,
        imageMimeType,
        prompt: MATERIAL_PROMPT + "\n\nJSON 스키마:\n" + JSON.stringify(MATERIAL_SCHEMA, null, 2) + "\n\n" + userPrompt,
        responseFormat: "json_object",
        maxOutputTokens: 12_000,
      });
    } catch (apiError) {
      console.error("[estimate-materials] GPT-5.6 API error:", apiError);
      const materials = getMockMaterials(budget);
      return NextResponse.json({
        materials,
        designConcept: `${style} 스타일 기본 추천 (AI 모델 호출 실패)`,
        method: "mock",
        warnings: ["AI 모델 호출 실패 - 기본 추천 데이터 반환"],
      });
    }

    const text = response.content || "";
    let parsed: { materials?: AIMaterial[]; designConcept?: string };

    try {
      let jsonText = text;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      const materials = getMockMaterials(budget);
      return NextResponse.json({
        materials,
        designConcept: "AI 응답 파싱 실패 - 기본 추천",
        method: "mock",
        warnings: ["AI 응답 파싱 실패"],
      });
    }

    if (!parsed.materials || parsed.materials.length === 0) {
      const materials = getMockMaterials(budget);
      return NextResponse.json({
        materials,
        designConcept: "자재 추천 결과 없음 - 기본 추천",
        method: "mock",
        warnings: ["AI가 자재를 추천하지 않았습니다"],
      });
    }

    // 누락된 카테고리 보충 (Mock으로 채움)
    const existingCodes = new Set(parsed.materials.map(m => m.categoryCode));
    const mockMaterials = getMockMaterials(budget);
    const supplemented = [...parsed.materials];
    for (const mock of mockMaterials) {
      if (!existingCodes.has(mock.categoryCode)) {
        supplemented.push(mock);
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      materials: supplemented,
      designConcept: parsed.designConcept || `${style} 스타일 인테리어 자재 추천`,
      method: "ai_recommend",
      warnings: [],
      processingTimeMs,
      imageAnalyzed: Boolean(imageBase64),
      model: response.model,
    });
  } catch (error) {
    console.error("[estimate-materials] Error:", error);
    return NextResponse.json(
      { error: "자재 추천 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
