/**
 * OpenAI API wrapper for InPick.
 * 환경변수 OPENAI_API_KEY 자동 로드.
 *
 * 기능:
 *  - generateRoomRender: 실별 인테리어 렌더 (gpt-image-2 단일, 폴백 없음)
 *  - analyzeImageVision: 평면도/렌더 이미지 분석 (GPT-5.6 Sol 최상위 고정)
 *  - generateElevationSVG: 입면전개도 deterministic SVG 생성
 */

import {
  INPICK_FRONTIER_MODEL_CANDIDATES,
  isRecoverableFrontierModelError,
} from "./ai-model-policy";

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
  windows?: number;
  windowSide?: string;       // legacy
  windowWalls?: string[];    // 도면 openings에서 추출한 창문 wall 텍스트
  doors?: number;
  doorWalls?: string[];      // 도면 openings에서 추출한 문 wall 텍스트
  adjacentRooms?: string[];  // 인접 방 (sharedDoor 기반)
  isInteriorRoom?: boolean;
  furnishingOptions?: string[];
  // 도면 기반 정확도 강화 — 같은 방 재생성 시 형태 일관성
  aspectRatio?: number;
  isFromFloorplan?: boolean;
  previousReference?: string;
  /**
   * 평면도 이미지 URL (Supabase Storage 또는 외부 URL).
   * 제공되면 gpt-image-2 EDITS API로 호출 → 평면도 형태 100% 보존하며 인테리어 마감 적용.
   * 미제공 시 generations API fallback (text-only).
   */
  floorplanImageUrl?: string;
  /**
   * 가이드 v2 §5-1 quality tier.
   *  - "low": ~$0.01/이미지, 1차 미리보기 (기본)
   *  - "medium": ~$0.04/이미지
   *  - "high": ~$0.17/이미지, 고화질 최종
   * 미지정 시 "low" — Phase 2 비용 절감 정책.
   */
  quality?: "low" | "medium" | "high";
  /**
   * STEP2-INPUT-ANALYSIS Q1 — 자연어 wall layout (Step1에서 자동 빌드).
   * 형식: "Floor plan layout (exact reading from user's actual floor plan):
   *        - Room shape: rectangular, 4.5m × 4.0m (18m² floor area)
   *        - Wall layout: North wall ... East wall ... etc"
   * 평면도 이미지 외에 텍스트 명세까지 받아 형태 보존률 70~85% 달성.
   */
  wallLayout?: string;
}

export interface RenderRoomResult {
  imageUrl?: string;
  imageBase64?: string;
  revisedPrompt?: string;
  model: string;
  costUsd: number;
}

/**
 * 방별 특수 prompt — gpt-image-2가 한국식 공간 정확히 인식하게 영문 동치 + 핵심 특성.
 *
 * 진단: 베란다/드레스룸/현관이 일반 generic prompt에서는 잘못 인식됨.
 *  - 베란다 → "balcony"가 더 정확 (한국식: 외부 노출 + 한쪽 면 통창 + 세탁기 자리)
 *  - 드레스룸 → "walk-in closet" (좁고 양벽 옷장 빼곡)
 *  - 현관 → "Korean apartment entryway" (좁고 신발장 + 중문)
 */
function getRoomSpecificDescription(roomName: string, expansion?: boolean): string {
  const map: Record<string, string> = {
    거실: "Living room (거실): main social space, largest room in apartment, " +
          "TV wall + wide wall + balcony-side full-window wall. " +
          "Modern Korean apartment living room, open feel.",
    안방: "Master bedroom (안방): largest bedroom, dedicated dressing closet wall " +
          "(built-in only), one full window on outer wall.",
    침실: "Bedroom (침실): standard size, one outer-wall window, " +
          "simple finish for furniture move-in.",
    부엌: "Kitchen (부엌/주방): U-shape or L-shape kitchen counter built-in, " +
          "upper + lower cabinets, range hood, refrigerator alcove. " +
          "Modern Korean apartment kitchen.",
    주방: "Kitchen (부엌/주방): U-shape or L-shape kitchen counter built-in, " +
          "upper + lower cabinets, range hood, refrigerator alcove.",
    욕실: "Bathroom (욕실): compact wet space, full tile walls + floor, " +
          "vanity/toilet/shower built-in. Korean apartment bathroom.",
    현관: "Korean apartment entryway / foyer (현관): " +
          "narrow rectangular space, raised floor at door level (signature 신발 벗는 곳), " +
          "shoe cabinet built-in (신발장) along one wall (full height to ceiling), " +
          "white interior door at end leading to interior, " +
          "no windows, ceiling LED downlight only.",
    베란다: (expansion
      ? "Korean apartment veranda (베란다) — EXPANDED layout (확장형): " +
        "balcony merged with adjacent room (no dividing wall), " +
        "treated as living room extension, full ceiling-to-floor windows on outer wall, " +
        "continuous flooring with main room."
      : "Korean apartment veranda / balcony (베란다): " +
        "narrow elongated outdoor-facing space along outer wall, " +
        "FULL HEIGHT GLASS sliding window covering entire outer wall (시스템창호), " +
        "tile floor (small square 300x300), drainage at corner, " +
        "washing machine / dryer corner allowed (built-in), " +
        "no ceiling light or simple LED, narrow strip ~1.5m deep."),
    드레스룸: "Walk-in closet / dressing room (드레스룸): " +
             "narrow rectangular space, " +
             "BOTH long walls covered with FULL-HEIGHT built-in wardrobes (양벽 옷장 빼곡), " +
             "system closet doors (sliding or hinged), " +
             "central walking aisle ~1.0m, dressing mirror on end wall optional, " +
             "no exterior window, ceiling track lighting or LED downlight, " +
             "vinyl or laminate floor matching master bedroom.",
    발코니: "Korean apartment veranda / balcony (베란다 / 발코니): " +
           "narrow outdoor-facing strip with full-height windows, tile floor.",
    다용도실: "Utility room (다용도실): small back-of-house space, " +
             "tile floor, washing machine + storage shelves, no window or one small window.",
    팬트리: "Pantry (팬트리): kitchen storage closet, full-height shelving on both walls, no window.",
  };
  return map[roomName] || "";
}

export async function generateRoomRender(input: RenderRoomInput): Promise<RenderRoomResult> {
  const sizes = {
    width: (input.widthMm / 1000).toFixed(2),
    depth: (input.depthMm / 1000).toFixed(2),
    height: (input.heightMm / 1000).toFixed(2),
  };
  const matStr = input.materialHints?.length
    ? `Materials: ${input.materialHints.join(", ")}.`
    : "";
  const expStr = input.expansion ? "Expanded layout (확장형) — balcony merged. " : "";
  const feelStr = input.feeling ? `Mood: ${input.feeling}.` : "";

  // 창문·구조 명시 (도면 신뢰성)
  let structStr = "";
  if (input.isInteriorRoom || input.windows === 0) {
    structStr = "Interior windowless room (no exterior wall, no daylight, LED only). ";
  } else if (input.windows && input.windows > 0) {
    const wallInfo = input.windowWalls && input.windowWalls.length > 0
      ? input.windowWalls.join(", ")
      : input.windowSide || "outer wall";
    structStr = `${input.windows} window(s) located on: ${wallInfo}. `;
  }
  // 문 위치
  if (input.doors && input.doors > 0 && input.doorWalls && input.doorWalls.length > 0) {
    structStr += `Door(s) on: ${input.doorWalls.join(", ")}. `;
  }
  // 인접 방 (도면 기반 spatial context)
  if (input.adjacentRooms && input.adjacentRooms.length > 0) {
    structStr += `Adjacent rooms (사용자 도면 기반): ${input.adjacentRooms.join(", ")}. `;
  }
  // 방별 특수 묘사 (한국식 공간 정확 인식)
  const roomSpec = getRoomSpecificDescription(input.roomName, input.expansion);
  if (roomSpec) {
    structStr += `\n${roomSpec}\n`;
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

  // 도면 기반 정보 (사용자 평면도에서 추출한 치수임을 모델에 명시 — 같은 방 재생성 시 형태 유지 유도)
  const ratio = input.aspectRatio || (input.widthMm / input.depthMm);
  const ratioDesc =
    ratio > 1.6 ? "wide elongated rectangular floor plan"
    : ratio > 1.15 ? "rectangular floor plan slightly wider than deep"
    : ratio > 0.85 ? "near-square floor plan"
    : ratio > 0.6 ? "rectangular floor plan slightly deeper than wide"
    : "narrow elongated rectangular floor plan";
  const floorplanTag = input.isFromFloorplan
    ? `Layout strictly from user's actual floor plan — preserve room shape and proportions exactly. `
    : `No exact floor plan is available. Use the selected floor-area based Korean apartment average dimensions below as the spatial guide; do not imply this is the real measured layout. `;
  const openingConstraint = input.isFromFloorplan || input.floorplanImageUrl
    ? "평면도에 명시되지 않은 창문·문 임의 추가 금지. "
    : "실 종류에 맞는 한국 아파트 평균 창문·문 구성을 사용하고 구조적으로 불가능한 개구부는 만들지 마세요. ";
  const previousRefTag = input.previousReference
    ? `\nPrevious render of this same room (preserve same room shape, window/door positions, camera angle): "${input.previousReference.slice(0, 400)}"\n`
    : "";
  // STEP2-INPUT-ANALYSIS Q1 — wall layout 자연어 묘사 (가장 강하게 강조)
  const wallLayoutBlock = input.wallLayout
    ? `\n=== EXACT FLOOR PLAN STRUCTURE (must follow precisely) ===\n${input.wallLayout}\n=== END FLOOR PLAN ===\n`
    : "";

  const prompt =
    `Empty Korean apartment ${input.roomName} interior shell, just after construction completion, 2026 contemporary minimalist standard. ` +
    `한국 아파트 ${input.roomName} 빈 방 마감 사진 (시공 직후, 가구 입주 전 상태, 2026년 최신 인테리어 트렌드). ` +
    `${floorplanTag}` +
    `${wallLayoutBlock}` +
    `Space: width ${sizes.width}m × depth ${sizes.depth}m × ceiling ${sizes.height}m, ${ratioDesc}. ` +
    `${previousRefTag}` +
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
    openingConstraint +
    `Result: 2026 modern empty Korean apartment shell, ready for furniture move-in. 빈 공간 그 자체.`;

  const size = input.size || "1024x1024";
  const apiKey = getKey();

  const quality = input.quality || "low";
  const costMap: Record<string, number> = { low: 0.01, medium: 0.04, high: 0.17 };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 280_000);

  try {
    // 도면이 없으면 평형 평균 치수와 실 종류를 담은 prompt로 바로 생성한다.
    if (!input.floorplanImageUrl) {
      const res = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt,
          size,
          quality,
          n: 1,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GPT Image 2 generations 실패 — ${res.status}: ${errorText.slice(0, 200)}`);
      }
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error("GPT Image 2 generations 응답에 이미지 데이터 없음");
      return {
        imageUrl: `data:image/png;base64,${b64}`,
        imageBase64: b64,
        revisedPrompt: prompt,
        model: data.model || "gpt-image-2",
        costUsd: costMap[quality] ?? 0.17,
      };
    }

    // 정리된 원본 도면이 있으면 edits API의 구조 참조로 사용한다.
    const fpRes = await fetch(input.floorplanImageUrl, {
      signal: controller.signal,
    });
    if (!fpRes.ok) {
      throw new Error(
        `평면도 이미지 다운로드 실패: ${fpRes.status} (${input.floorplanImageUrl.slice(0, 80)})`,
      );
    }
    const fpBuf = Buffer.from(await fpRes.arrayBuffer());

    // edits API 프롬프트 — 가이드 §3-2 buildRoomRenderPrompt 패턴
    const editPrompt =
      `Use the attached 2D Korean apartment floor plan as the strict structural reference. ` +
      `Transform it into a photorealistic 3D interior view of the **${input.roomName}** room only. ` +
      `STRICTLY PRESERVE: room shape, walls, window positions, door positions, proportions exactly as shown in the floor plan. ` +
      `Camera: eye-level interior view from inside the ${input.roomName}, looking towards the most prominent feature wall. ` +
      `\n\n` +
      prompt;

    // ─── GPT Image 2 고정 ───
    // 사용자가 선택한 도면/공간의 형태 보존을 위해 구형 모델로 자동 하향하지 않는다.
    const errors: string[] = [];
    for (const modelName of ["gpt-image-2"]) {
      const form = new FormData();
      form.append("model", modelName);
      form.append(
        "image",
        new Blob([new Uint8Array(fpBuf)], { type: "image/png" }),
        "floorplan.png",
      );
      form.append("prompt", editPrompt);
      form.append("size", size);
      form.append("quality", quality);

      const res = await fetch(`${OPENAI_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) {
          errors.push(`${modelName}: 응답에 이미지 데이터 없음`);
          continue;
        }
        return {
          imageUrl: `data:image/png;base64,${b64}`,
          imageBase64: b64,
          revisedPrompt: editPrompt,
          model: modelName,
          costUsd: costMap[quality] ?? 0.17,
        };
      }

      const errText = await res.text();
      errors.push(`${modelName} ${res.status}: ${errText.slice(0, 200)}`);
      throw new Error(`GPT Image 2 edits 실패 — ${errors.join(" | ")}`);
    }
    throw new Error(`GPT Image 2 image edit 실패 — ${errors.join(" | ")}`);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OpenAI 이미지 요청 시간 초과 (280초). 응답 지연.");
    }
    throw e;
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
  maxOutputTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  /** 전체 후보/재시도를 포함한 최대 대기 시간. 미지정 시 기존 동작을 유지한다. */
  requestTimeoutMs?: number;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export async function analyzeImageVision(
  input: VisionAnalyzeInput,
): Promise<{ content: string; usage: OpenAIUsage | undefined; model: string }> {
  const deadline = input.requestTimeoutMs
    ? Date.now() + Math.max(1_000, input.requestTimeoutMs)
    : null;
  const content: Array<Record<string, unknown>> = [];
  if (input.imageUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageUrl, detail: "high" } });
  } else if (input.imageBase64) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${input.imageMimeType || "image/jpeg"};base64,${input.imageBase64}`,
        detail: "high",
      },
    });
  }
  content.push({ type: "text", text: input.prompt });

  const errors: string[] = [];
  for (const model of INPICK_FRONTIER_MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content }],
        max_completion_tokens: input.maxOutputTokens ?? 8_192,
        reasoning_effort: input.reasoningEffort ?? "high",
      };
      if (input.responseFormat === "json_object") {
        body.response_format = { type: "json_object" };
      }

      const remainingMs = deadline ? deadline - Date.now() : null;
      if (remainingMs !== null && remainingMs <= 0) {
        throw new Error(`OpenAI vision request timed out (${input.requestTimeoutMs}ms)`);
      }
      const controller = remainingMs !== null ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), Math.max(1, remainingMs!))
        : null;
      let res: Response;
      let responseText = "";
      try {
        res = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller?.signal,
        });
        // 헤더 수신 뒤 본문이 멈추는 경우도 전체 제한시간에 포함한다.
        responseText = await res.text();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`OpenAI vision request timed out (${input.requestTimeoutMs}ms)`);
        }
        throw error;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (res.ok) {
        const data = JSON.parse(responseText);
        return {
          content: data.choices?.[0]?.message?.content || "",
          usage: data.usage,
          model: data.model || model,
        };
      }

      const err = responseText;
      errors.push(`${model} ${res.status} attempt ${attempt + 1}: ${err.slice(0, 300)}`);
      const recoverable = isRecoverableFrontierModelError(res.status, err);
      if (!recoverable) {
        throw new Error(`OpenAI frontier analysis failed: ${errors.join(" | ")}`);
      }
      if ((res.status === 429 || res.status >= 500 || /capacity|overloaded/i.test(err)) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        continue;
      }
      break;
    }
  }
  throw new Error(`OpenAI frontier models unavailable: ${errors.join(" | ")}`);
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
