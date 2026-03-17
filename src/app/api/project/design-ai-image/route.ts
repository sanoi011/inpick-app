import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";

export const maxDuration = 120;

const IMAGE_GEN_MODEL = "gemini-3-pro-image-preview";

// 4컷 방별 렌더링 대상 + 구조 데이터 기본값
const ROOMS_TO_RENDER = [
  { key: "living", label: "거실", promptKR: "거실 (리빙룸)", defaultWindow: "One large window on the south wall (balcony side)", defaultDoor: "One closed door connecting to hallway" },
  { key: "kitchen", label: "부엌", promptKR: "주방 (키친)", defaultWindow: "No windows", defaultDoor: "Open passage connecting to living room" },
  { key: "bedroom", label: "침실", promptKR: "안방 (메인 침실)", defaultWindow: "One window on the exterior wall", defaultDoor: "One closed door on the hallway side" },
  { key: "bathroom", label: "욕실", promptKR: "욕실 (바스룸)", defaultWindow: "No windows", defaultDoor: "One closed door" },
] as const;

interface RoomImage {
  room: string;
  label: string;
  imageData: string | null;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      conversationSummary,
      designPreferences,
      floorPlanImageUrl,
      floorPlanContext,
      materialContext,
    } = await request.json();

    if (!isGeminiConfigured()) {
      return createMockResponse(designPreferences);
    }

    const client = getGeminiClient()!;

    // 도면 이미지 가져오기 (모든 방 프롬프트에 공통으로 첨부)
    let floorPlanParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    if (floorPlanImageUrl) {
      try {
        // 상대 URL이면 절대 URL로 변환 (서버사이드 fetch 필요)
        let fetchUrl = floorPlanImageUrl;
        if (fetchUrl.startsWith("/")) {
          const host = request.headers.get("host") || "localhost:3001";
          const protocol = request.headers.get("x-forwarded-proto") || "http";
          fetchUrl = `${protocol}://${host}${fetchUrl}`;
        }
        console.log("[design-ai-image] Fetching floor plan from:", fetchUrl);
        const imgRes = await fetch(fetchUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const mimeType = imgRes.headers.get("content-type") || "image/png";
          floorPlanParts = [
            { inlineData: { mimeType, data: buffer.toString("base64") } },
          ];
          console.log("[design-ai-image] Floor plan attached:", Math.round(buffer.length / 1024), "KB");
        } else {
          console.warn("[design-ai-image] Floor plan fetch failed:", imgRes.status, fetchUrl);
        }
      } catch (err) {
        console.warn("[design-ai-image] Failed to fetch floor plan:", err);
      }
    } else {
      console.warn("[design-ai-image] No floorPlanImageUrl provided - generating without floor plan reference");
    }

    // 디자인 옵션 텍스트 구성
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

    // 4개 방에 대해 병렬 이미지 생성
    const roomPromises = ROOMS_TO_RENDER.map(async (room): Promise<RoomImage> => {
      // 창문 유무 판단
      const isWindowless = room.defaultWindow === "No windows";
      const windowStatus = room.defaultWindow;
      const doorStatus = room.defaultDoor;

      // 네거티브 프롬프트 구성
      const negativeItems = [
        "missing walls", "broken layout", "incorrect structural proportions",
        "see-through walls", "extra doors", "open layout", "merged rooms", "hallway visible",
      ];
      if (isWindowless) {
        negativeItems.push("windows", "natural light", "sunlight", "daylight", "sun rays", "outdoor view", "glass wall to outside", "sky", "exterior");
      }

      const prompt = [
        // ── System Role & Strict Constraints ──
        "[System Role & Strict Constraints]",
        "You are a highly precise architectural visualizer. Your absolute priority is to obey the structural data provided. You must NOT alter, invent, or remove structural elements (walls, windows, doors) for aesthetic reasons.",
        "",
        "1. Structural Integrity: Maintain all solid walls. Do NOT create open layouts where walls exist. Do NOT show other rooms through walls. Doors must be clearly defined and closed.",
        "2. Strict Window Control: DO NOT add windows to the scene unless explicitly stated in the structural data.",
        isWindowless
          ? "3. Lighting Direction: This room is WINDOWLESS. Use exceptionally bright, studio-quality artificial lighting (LEDs, cove lighting, spotlights) to make the space look as bright and beautiful as natural light, but absolutely NO windows, NO sun rays, and NO outdoor views."
          : "3. Lighting Direction: This room has a window. Follow the exact window location provided. The camera should focus on the interior, and natural light can cast from off-screen if the window is not directly in the camera's view.",
        "",
        // ── Floor Plan Structural Data ──
        "[Floor Plan Structural Data]",
        `- Room Type: ${room.promptKR}`,
        `- Window Status: ${windowStatus}`,
        `- Door Status: ${doorStatus}`,
        floorPlanParts.length > 0
          ? "- Reference: See the attached floor plan image. Accurately reflect the spatial structure (room layout, size, circulation) shown in this drawing."
          : "",
        floorPlanContext
          ? `- Spatial Layout:\n${floorPlanContext}`
          : "",
        "",
        // ── User Design Request ──
        "[User Design Request]",
        prefsText ? prefsText : "",
        conversationSummary
          ? `[사용자와의 대화 요약]\n${conversationSummary}`
          : "",
        materialContext
          ? `[선택된 자재]\n${materialContext}`
          : "",
        "",
        // ── Render Instructions ──
        `Render in highly realistic, 8k resolution, architectural photography style.`,
        `Generate a perspective view rendering of this ${room.promptKR}.`,
        "- Must look like a real high-end Korean apartment model house photograph",
        "- Include furniture, accessories, and lighting for a complete design",
        "- Reflect current Korean apartment interior trends",
        "",
        `[Negative Prompt - AVOID these]: ${negativeItems.join(", ")}`,
        "",
        `${room.promptKR}에 사용된 자재, 가구, 색상 등을 한국어로 2~3문장으로 간단히 설명해주세요.`,
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

        return {
          room: room.key,
          label: room.label,
          imageData,
          description: description || `${room.label} 디자인이 생성되었습니다.`,
        };
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        console.error(`[design-ai-image] ${room.label} generation error:`, error.message);

        if (error.status === 429) {
          return {
            room: room.key,
            label: room.label,
            imageData: null,
            description: "API 요청 한도 초과. 잠시 후 다시 시도해주세요.",
          };
        }

        return {
          room: room.key,
          label: room.label,
          imageData: null,
          description: `${room.label} 이미지 생성에 실패했습니다.`,
        };
      }
    });

    try {
      const images = await Promise.all(roomPromises);

      // 하나라도 성공한 이미지가 있으면 반환
      const hasAnyImage = images.some((img) => img.imageData !== null);

      if (hasAnyImage) {
        return NextResponse.json({
          images,
          isMock: false,
        });
      }

      // 모두 실패한 경우 mock 폴백
      return createMockResponse(designPreferences);
    } catch {
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
  const colorMap: Record<string, string[]> = {
    "모던": ["#E8E0D4", "#B8A68F", "#6B5D4F"],
    "북유럽": ["#D4E6F1", "#A9CCE3", "#7FB3D8"],
    "클래식": ["#F5EEF8", "#D7BDE2", "#BB8FCE"],
    "미니멀": ["#F0F0F0", "#D0D0D0", "#A0A0A0"],
    "내추럴": ["#EAFAF1", "#A9DFBF", "#7DCEA0"],
  };

  const roomDescriptions: Record<string, string> = {
    living: `${style} 스타일의 거실입니다. 넓은 창으로 자연광이 들어오며, 편안한 소파와 미니멀한 가구 배치로 개방감을 극대화했습니다.`,
    kitchen: `${style} 스타일의 주방입니다. 효율적인 동선과 충분한 수납공간을 갖추고, 아일랜드 식탁으로 모던한 분위기를 연출했습니다.`,
    bedroom: `${style} 스타일의 침실입니다. 부드러운 조명과 따뜻한 톤의 침구류로 편안하고 아늑한 수면 공간을 만들었습니다.`,
    bathroom: `${style} 스타일의 욕실입니다. 고급 타일과 깔끔한 위생도기 배치로 호텔 같은 세련된 욕실 공간을 구현했습니다.`,
  };

  const images: RoomImage[] = ROOMS_TO_RENDER.map((room) => {
    const [c1, c2, c3] = colorMap[style] || colorMap["모던"];
    // 방마다 약간 다른 색상 변형
    const hueShift = { living: 0, kitchen: 20, bedroom: -20, bathroom: 40 }[room.key] || 0;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="bg-${room.key}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="floor-${room.key}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c3}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="768" fill="url(#bg-${room.key})" opacity="${1 - hueShift * 0.005}"/>
  <rect y="450" width="1024" height="318" fill="url(#floor-${room.key})" opacity="0.7"/>
  <rect x="${100 + hueShift}" y="200" width="350" height="260" rx="12" fill="${c2}" opacity="0.4"/>
  <rect x="${520 + hueShift}" y="250" width="220" height="210" rx="8" fill="${c3}" opacity="0.35"/>
  <rect x="${800 - hueShift}" y="300" width="140" height="160" rx="6" fill="${c1}" opacity="0.45"/>
  <circle cx="512" cy="100" r="60" fill="white" opacity="0.12"/>
  <text x="512" y="700" text-anchor="middle" font-family="system-ui" font-size="20" fill="white" opacity="0.8">${room.label}</text>
  <text x="512" y="730" text-anchor="middle" font-family="system-ui" font-size="14" fill="white" opacity="0.5">${style} Style · INPICK AI Preview (Mock)</text>
</svg>`;

    return {
      room: room.key,
      label: room.label,
      imageData: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      description: roomDescriptions[room.key] || `${room.label} 디자인 프리뷰입니다.`,
    };
  });

  return NextResponse.json({
    images,
    isMock: true,
  });
}
