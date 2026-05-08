/**
 * OpenAI API wrapper for InPick.
 * 환경변수 OPENAI_API_KEY 자동 로드.
 *
 * 기능:
 *  - generateRoomRender: 실별 인테리어 렌더 (gpt-image-1 또는 dall-e-3)
 *  - analyzeImageVision: 평면도/렌더 이미지 분석 (gpt-4o vision)
 *  - generateElevationSVG: 입면전개도 SVG 코드 생성 (gpt-4o)
 */

const OPENAI_BASE = "https://api.openai.com/v1";

function getKey(): string {
  // 대/소문자 변수명 둘 다 허용 (Vercel 환경변수가 소문자로 등록된 경우 호환)
  const key =
    process.env.OPENAI_API_KEY ||
    process.env.openai_api_key ||
    process.env.OPENAI_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 환경변수 미설정");
  return key;
}

export interface RenderRoomInput {
  roomName: string;          // "거실"
  widthMm: number;
  depthMm: number;
  heightMm: number;
  style: string;
  materialHints?: string[];
  expansion?: boolean;
  feeling?: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  // 평면도 신뢰성 — 창문·문·구조 context
  windows?: number;          // 창문 개수 (0이면 명시적으로 "창문 없음")
  windowSide?: string;       // "남측" | "북측" | "외벽" | "안쪽 (창문 없음)"
  doors?: number;            // 출입문 개수
  isInteriorRoom?: boolean;  // 내부방 (욕실/드레스룸/팬트리 등 — 창문 없는 게 일반적)
  // 사용자가 Step1에서 선택한 시공 옵션 (붙박이장·중문·싱크대 등) — 가구 금지 정책의 예외로 prompt 포함
  furnishingOptions?: string[];
}

export interface RenderRoomResult {
  imageUrl?: string;
  imageBase64?: string;
  revisedPrompt?: string;
  model: string;
  costUsd: number;
}

export async function generateRoomRender(input: RenderRoomInput): Promise<RenderRoomResult> {
  const sizes = {
    width: (input.widthMm / 1000).toFixed(2),
    depth: (input.depthMm / 1000).toFixed(2),
    height: (input.heightMm / 1000).toFixed(2),
  };
  const matStr = input.materialHints?.length
    ? `자재: ${input.materialHints.join(", ")}.`
    : "";
  const expStr = input.expansion ? "평면 확장 시공된 모습." : "";
  const feelStr = input.feeling ? `분위기: ${input.feeling}.` : "";

  // 창문·구조 명시 (도면 신뢰성)
  let structStr = "";
  if (input.isInteriorRoom || input.windows === 0) {
    structStr = "창문 없는 내부 공간 (외벽 없음, 자연광 들어오지 않음, 인공 조명만). ";
  } else if (input.windows && input.windows > 0) {
    structStr = `창문 ${input.windows}개 (${input.windowSide || "외벽측"}). `;
  }

  // 사용자 선택 시공 옵션 (가구 금지 정책의 예외 — 붙박이·중문·싱크대 등은 마감재로 취급)
  const FURNISHING_LABELS: Record<string, string> = {
    builtIn: "붙박이장 (벽면 시공형 wardrobe, 천장까지 닿는 매립형)",
    systemCloset: "시스템 옷장 (벽 매립형, 슬라이딩 도어)",
    doubleDoor: "현관 중문 (3연동 슬라이딩, 슬림 프레임)",
    shoeRack_keep: "기존 신발장 유지 (외관만 매핑)",
    shoeRack_replace: "신발장 전체 교체 (붙박이형, 천장까지)",
    partial: "부분 교체 (전체 X, 일부 자재만)",
    sinkUpper: "주방 싱크대 상부장",
    sinkLower: "주방 싱크대 하부장",
    sinkFull: "주방 싱크대 전체 교체 (상부장 + 하부장 일괄)",
    fridgeCabinet: "냉장고장 (붙박이형)",
    kimchiCabinet: "김치냉장고장 (붙박이형)",
  };
  let furnishingStr = "";
  if (input.furnishingOptions && input.furnishingOptions.length > 0) {
    const labels = input.furnishingOptions
      .map((o) => FURNISHING_LABELS[o] || o)
      .join(", ");
    furnishingStr = `시공 포함 항목 (필수 표현, 가구 금지 예외): ${labels}. `;
  }
  const lightStr = input.isInteriorRoom || input.windows === 0
    ? "조명: 천장 매입 LED만, 자연광 X."
    : "조명: 자연광 + 보조 조명.";

  const prompt =
    `Empty Korean apartment ${input.roomName} interior shell, just after construction completion, 2026 contemporary minimalist standard. ` +
    `한국 아파트 ${input.roomName} 빈 방 마감 사진 (시공 직후, 가구 입주 전 상태, 2026년 최신 인테리어 트렌드). ` +
    `공간 치수: 가로 ${sizes.width}m × 깊이 ${sizes.depth}m × 천장고 ${sizes.height}m. ` +
    `${structStr}` +
    `스타일: ${input.style}. ${matStr} ${feelStr} ${expStr} ` +
    `${lightStr} ` +
    `포토리얼리스틱, 사람 없음. ` +
    // 2026 트렌드 강제 (옛날 몰딩·체리목·꽃벽지 금지)
    `2026 트렌드 강제 — Modern Flat / Japandi / Warm Minimal / Quiet Luxury 톤. 깔끔한 미니멀 마감, 색감은 따뜻한 우드 + 화이트 + 그레이지 + 베이지 + 라이트 톤. ` +
    `필수 금지 (구식 인테리어 절대 X) — 두꺼운 천장 몰딩·금장 몰딩·체리목 몰딩 X, 꽃무늬 벽지 X, 무늬 자개·옛 현관 카펫 X, 어두운 체리·로즈우드 가구 마감 X, 화려한 샹들리에 X, 고전 유럽 클래식 장식 X, 코너 곡선 천장 몰딩 X. ` +
    `천장: 평평한 화이트 또는 아주 얇은 미니멀 라인 몰딩만 허용 (간접 조명 라인 OK). ` +
    `걸레받이: 얇고 직선형(슬림 베이스보드, 5–8mm)만 허용. ` +
    // 가구·소품 제외
    `중요 — 마감재만 표현: 바닥재(마루·타일), 벽지·페인트, 천장 마감, 슬림 걸레받이, 창호·도어, 붙박이장(주방 싱크·드레스룸 한정), 천장 매입 조명. ` +
    `${furnishingStr}` +
    `STRICT NO FURNITURE (사용자가 선택한 '시공 포함 항목'은 예외): NO sofa, NO chair, NO table, NO bed, NO mattress, NO rug, NO cushion, NO curtain (only blinds/roller-shade allowed), NO bookshelf, NO TV, NO appliance(except built-in kitchen), NO art, NO plant, NO flower, NO decoration, NO book, NO dish, NO clothing. ` +
    `절대 금지 (한글, 단 위 시공 포함 항목은 표현 필수): 소파·의자·테이블·침대·매트리스·러그·쿠션·커튼(블라인드만 가능)·책장·TV·가전(붙박이 주방 외)·그림·관엽식물·꽃·장식·책·식기·옷가지 모두 제외. ` +
    `평면도에 명시되지 않은 창문·문 임의 추가 금지. ` +
    `Result: 2026 modern empty Korean apartment shell, ready for furniture move-in. 빈 공간 그 자체.`;

  const size = input.size || "1024x1024";
  const apiKey = getKey();

  // dall-e-3 standard (15~25초 응답, Vercel 60초 한계 안전)
  // gpt-image-1/2는 40~80초 걸려 Vercel Pro에서도 timeout — 별도 refine-render endpoint에서만 사용
  // AbortSignal 50초로 명시 — 가능한 빠른 실패
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);
  try {
    const body = {
      model: "dall-e-3",
      prompt,
      size,
      n: 1,
      quality: "standard",
      response_format: "url",
    };
    const res = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI image gen failed: ${res.status} ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    return {
      imageUrl: data.data?.[0]?.url,
      revisedPrompt: data.data?.[0]?.revised_prompt,
      model: "dall-e-3",
      costUsd: size === "1024x1024" ? 0.04 : 0.08, // standard quality
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface VisionAnalyzeInput {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  prompt: string;
  responseFormat?: "json_object" | "text";
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export async function analyzeImageVision(
  input: VisionAnalyzeInput,
): Promise<{ content: string; usage: OpenAIUsage | undefined }> {
  const imageContent = input.imageUrl
    ? { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } }
    : {
        type: "image_url",
        image_url: {
          url: `data:${input.imageMimeType || "image/jpeg"};base64,${input.imageBase64}`,
          detail: "high",
        },
      };

  const body: Record<string, unknown> = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [imageContent, { type: "text", text: input.prompt }],
      },
    ],
    max_tokens: 2000,
  };
  if (input.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI vision failed: ${res.status} ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: data.usage,
  };
}

export interface ElevationInput {
  roomName: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  walls?: { name: string; openings?: { type: "door" | "window"; widthMm: number; heightMm: number; offsetMm: number }[] }[];
  materials?: { surface: string; name: string; colorHex?: string }[];
}

/** 입면전개도 SVG 직접 생성 (Loom 스타일, 치수 정확)
 *  GPT 안 쓰고 deterministic SVG — 치수 100% 보장 */
export function generateElevationSVG(input: ElevationInput): string {
  const scale = 0.05; // 1mm = 0.05px (5800mm → 290px)
  const margin = 80;
  const wallNames = ["남측벽 (정면)", "북측벽 (배면)", "동측벽 (우측)", "서측벽 (좌측)"];

  // 4면 입면 그리기 — 가로로 배치
  const wallW = input.widthMm * scale;
  const wallH = input.heightMm * scale;
  const totalW = (wallW + margin) * 2 + margin;
  const totalH = (wallH + margin) * 2 + margin + 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" font-family="Pretendard, Apple SD Gothic Neo, sans-serif">`;
  svg += `<style>
    .wall { fill: #fff; stroke: #333; stroke-width: 1.5; }
    .dim { stroke: #888; stroke-width: 0.5; }
    .dim-text { font-size: 10px; fill: #555; }
    .label { font-size: 12px; font-weight: 600; fill: #222; }
    .opening { fill: #e6f0ff; stroke: #4a7ec9; stroke-width: 0.8; }
  </style>`;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (wallW + margin);
    const y = margin + row * (wallH + margin) + 30;

    // 벽
    svg += `<rect class="wall" x="${x}" y="${y}" width="${wallW}" height="${wallH}"/>`;
    // 라벨
    svg += `<text class="label" x="${x}" y="${y - 8}">${wallNames[i]}</text>`;
    // 가로 치수
    const dimY = y + wallH + 20;
    svg += `<line class="dim" x1="${x}" y1="${dimY}" x2="${x + wallW}" y2="${dimY}"/>`;
    svg += `<text class="dim-text" x="${x + wallW / 2}" y="${dimY + 14}" text-anchor="middle">${input.widthMm.toLocaleString()} mm</text>`;
    // 세로 치수
    const dimX = x - 14;
    svg += `<line class="dim" x1="${dimX}" y1="${y}" x2="${dimX}" y2="${y + wallH}"/>`;
    svg += `<text class="dim-text" x="${dimX - 4}" y="${y + wallH / 2}" text-anchor="end" transform="rotate(-90 ${dimX - 4} ${y + wallH / 2})">${input.heightMm.toLocaleString()} mm</text>`;

    // 개구부 (벽별로 출입문/창호)
    const wall = input.walls?.[i];
    if (wall?.openings) {
      for (const op of wall.openings) {
        const opW = op.widthMm * scale;
        const opH = op.heightMm * scale;
        const opOff = op.offsetMm * scale;
        const opX = x + opOff;
        const opY = op.type === "door" ? y + wallH - opH : y + (wallH - opH) / 2;
        svg += `<rect class="opening" x="${opX}" y="${opY}" width="${opW}" height="${opH}"/>`;
        svg += `<text class="dim-text" x="${opX + opW / 2}" y="${opY + opH / 2}" text-anchor="middle">${op.type === "door" ? "DR" : "W"} ${op.widthMm}×${op.heightMm}</text>`;
      }
    }
  }

  // 제목
  svg += `<text x="${totalW / 2}" y="20" text-anchor="middle" font-size="16" font-weight="700" fill="#111">${input.roomName} 입면전개도 (${input.widthMm} × ${input.depthMm} × ${input.heightMm} mm)</text>`;

  svg += `</svg>`;
  return svg;
}
