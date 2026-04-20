import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";

export const maxDuration = 60;

const VISION_MODEL = "gemini-2.0-flash";

/**
 * AI 생성 인테리어 이미지를 Vision으로 분석하여
 * 자재/마감재를 구조화 JSON으로 추출하는 API
 *
 * POST: { imageData: string (base64 data URL), roomType?: string, roomName?: string }
 * → { materials: AnalyzedMaterial[], summary: string }
 */

// Vision 분석 결과 타입
export interface AnalyzedMaterial {
  categoryCode: string;       // FLOORING, WALLPAPER, PAINT, CEILING, BATH_TILE 등
  categoryName: string;       // 바닥재, 벽지, 페인트 등
  materialName: string;       // 헤링본 원목마루, 실크벽지 등
  specification: string;      // 규격 설명
  colorHex: string;           // 추정 색상 코드
  priceGrade: "economy" | "standard" | "premium";
  estimatedUnitPrice: number; // 추정 자재 단가 (원/m² or 원/EA)
  estimatedLaborPrice: number; // 추정 시공비 단가
  unit: string;               // m², EA, SET, LM
  confidence: number;         // 인식 신뢰도 0~1
  reason: string;             // 판단 근거 (한국어)
}

export interface VisionAnalysisResult {
  roomType: string;
  roomName: string;
  materials: AnalyzedMaterial[];
  furniture: AnalyzedFurniture[];
  lightingDescription: string;
  overallStyle: string;
  summary: string;
}

export interface AnalyzedFurniture {
  name: string;               // 3인 소파, 원형 다이닝 테이블 등
  estimatedSize: string;      // 2400x900x850mm
  material: string;           // 패브릭, 원목 등
  estimatedPrice: number;     // 추정 가격 (원)
  isBuiltIn: boolean;         // 붙박이/빌트인 여부 (견적 포함 대상)
}

const SYSTEM_PROMPT = `당신은 한국 아파트 인테리어 자재 전문 분석가입니다.
인테리어 렌더링 이미지를 분석하여 사용된 모든 자재와 마감재를 정확하게 식별합니다.

## 분석 범위
1. **바닥**: 마루 종류(강마루/강화마루/원목마루/대리석/타일), 패턴(헤링본/직선/대각선), 색상
2. **벽**: 벽지 종류(실크/합지/포인트/타일), 페인트(수성/젤리/벽돌노출), 색상
3. **천장**: 평천장/우물천장/간접조명박스, 몰딩 유무
4. **문/창호**: 문 종류(ABS/PVC/원목), 색상, 손잡이 스타일
5. **욕실**: 타일 종류/크기, 위생도기 등급, 수전 종류
6. **주방**: 싱크대/상하부장 소재, 상판 종류(인조대리석/천연석/엔지니어드스톤)
7. **조명**: 매입등/간접등/펜던트/레일등
8. **가구**: 붙박이장, 신발장, 붙박이 수납 (시공에 포함되는 빌트인만)

## 카테고리 코드 (반드시 이 코드 사용)
- FLOORING: 바닥재 (unit: m²)
- WALLPAPER: 벽지 (unit: m²)
- PAINT: 페인트 (unit: m²)
- CEILING: 천장재 (unit: m²)
- DOOR_ROOM: 방문 (unit: SET)
- ENTRY_DOOR: 현관문 (unit: SET)
- BASEBOARD: 걸레받이 (unit: LM)
- LIGHTING: 조명 (unit: EA)
- BATH_TILE: 욕실 타일 (unit: m²)
- TOILET: 양변기 (unit: EA)
- VANITY: 세면대 (unit: EA)
- SHOWER_BATH: 샤워/욕조 (unit: EA)
- KITCHEN_SINK: 주방 싱크대 (unit: EA)
- KITCHEN_CABINET: 주방 캐비넷 (unit: LM)
- KITCHEN_TILE: 주방 타일 (unit: m²)
- WINDOW: 창호 (unit: SET)

## 등급 기준 (priceGrade)
- economy: 기본형 (평당 150만원 이하 수준)
- standard: 중급형 (평당 150~250만원 수준)
- premium: 고급형 (평당 250만원 이상 수준)

## 단가 참조 (2025 한국물가정보 기준, 자재+시공 분리)
- 강마루 standard: 자재 42,000 + 시공 23,000 = 65,000원/m²
- 원목마루 premium: 자재 120,000 + 시공 35,000 = 155,000원/m²
- 실크벽지 standard: 자재 7,000 + 시공 11,000 = 18,000원/m²
- 수성페인트 standard: 자재 5,000 + 시공 10,000 = 15,000원/m²
- 포세린타일 600x600 standard: 자재 40,000 + 시공 45,000 = 85,000원/m²
- ABS 방문 standard: 자재 250,000 + 시공 130,000 = 380,000원/SET
- LED 매입등 standard: 자재 25,000 + 시공 45,000 = 70,000원/EA
- 양변기 standard: 자재 320,000 + 시공 130,000 = 450,000원/EA
- 주방 하부장 standard: 자재 430,000 + 시공 170,000 = 600,000원/LM

이미지에서 보이는 자재의 질감, 광택, 패턴, 색상을 분석하여 가장 가까운 한국 시장 제품으로 매칭하세요.
이미지에 보이지 않는 자재는 포함하지 마세요. 보이는 것만 정확히 분석하세요.`;

export async function POST(request: NextRequest) {
  try {
    const { imageData, roomType, roomName } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: "imageData가 필요합니다." },
        { status: 400 }
      );
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "Gemini API 키가 설정되지 않았습니다. GOOGLE_GEMINI_API_KEY 환경변수를 확인하세요." },
        { status: 503 }
      );
    }

    const client = getGeminiClient()!;

    // base64 data URL에서 실제 데이터 추출
    let mimeType = "image/png";
    let base64Data = imageData;

    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const userPrompt = [
      `이 인테리어 이미지를 분석해주세요.`,
      roomType ? `방 타입: ${roomType}` : "",
      roomName ? `방 이름: ${roomName}` : "",
      "",
      `다음 JSON 형식으로 응답해주세요:`,
      `{`,
      `  "roomType": "분석된 방 타입",`,
      `  "roomName": "방 이름",`,
      `  "materials": [`,
      `    {`,
      `      "categoryCode": "FLOORING",`,
      `      "categoryName": "바닥재",`,
      `      "materialName": "헤링본 원목마루",`,
      `      "specification": "오크 원목 150x900mm 헤링본 패턴",`,
      `      "colorHex": "#8B6F47",`,
      `      "priceGrade": "premium",`,
      `      "estimatedUnitPrice": 120000,`,
      `      "estimatedLaborPrice": 35000,`,
      `      "unit": "m²",`,
      `      "confidence": 0.9,`,
      `      "reason": "이미지에서 오크 톤의 헤링본 패턴 마루가 확인됨"`,
      `    }`,
      `  ],`,
      `  "furniture": [`,
      `    {`,
      `      "name": "3인 소파",`,
      `      "estimatedSize": "2400x900x850mm",`,
      `      "material": "패브릭",`,
      `      "estimatedPrice": 1500000,`,
      `      "isBuiltIn": false`,
      `    }`,
      `  ],`,
      `  "lightingDescription": "LED 매입등 6개 + 간접조명 둘레",`,
      `  "overallStyle": "모던 내추럴",`,
      `  "summary": "전체 분석 요약 (한국어 2~3문장)"`,
      `}`,
    ].filter(Boolean).join("\n");

    const response = await client.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: userPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      const result: VisionAnalysisResult = JSON.parse(text);

      // 유효성 검증 및 보정
      if (result.materials) {
        for (const mat of result.materials) {
          // 단가가 비정상적으로 낮거나 높으면 보정
          if (mat.estimatedUnitPrice < 0) mat.estimatedUnitPrice = 0;
          if (mat.estimatedLaborPrice < 0) mat.estimatedLaborPrice = 0;
          if (!mat.confidence || mat.confidence < 0) mat.confidence = 0.5;
          if (mat.confidence > 1) mat.confidence = 1;
        }
      }

      return NextResponse.json(result);
    } catch {
      console.error("[analyze-design-image] JSON parse failed:", text.slice(0, 500));
      return NextResponse.json(
        { error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요.", rawText: text.slice(0, 300) },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[analyze-design-image] Error:", err);
    return NextResponse.json(
      { error: "이미지 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

