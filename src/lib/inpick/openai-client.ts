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
  style: string;             // "modern minimal" | "korean_traditional" | "scandinavian"
  materialHints?: string[];  // ["오크 원목마루", "월넛 가구", ...]
  expansion?: boolean;       // 평면 확장 여부
  feeling?: string;          // "warm cozy" | "luxury" | ...
  size?: "1024x1024" | "1024x1792" | "1792x1024"; // dall-e-3 sizes
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

  const prompt =
    `한국 아파트 ${input.roomName} 실내 인테리어 렌더링 이미지. ` +
    `공간 치수: 가로 ${sizes.width}m × 깊이 ${sizes.depth}m × 천장고 ${sizes.height}m. ` +
    `스타일: ${input.style}. ${matStr} ${feelStr} ${expStr} ` +
    `포토리얼리스틱, 자연광, 사람 없음, 가구 배치 자연스럽게. ` +
    `한국 아파트 표준 마감 (걸레받이·천장 몰딩·창호 표현 정확히).`;

  const size = input.size || "1024x1024";
  const apiKey = getKey();

  // 1차: gpt-image-2 (사용자 명시 — 가격 저렴 + 품질 우수)
  // 2차: gpt-image-1 (gpt-image-2 access 없을 시 폴백)
  // 3차: dall-e-3 (최후 안전망)
  for (const modelName of ["gpt-image-2", "gpt-image-1"]) {
    try {
      const body: Record<string, unknown> = {
        model: modelName,
        prompt,
        size,
        n: 1,
        quality: "high",
        output_format: "png",
      };
      const res = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        const url = data.data?.[0]?.url;
        if (b64) {
          return {
            imageUrl: `data:image/png;base64,${b64}`,
            imageBase64: b64,
            revisedPrompt: prompt,
            model: modelName,
            costUsd: 0.19,
          };
        }
        if (url) {
          return {
            imageUrl: url,
            revisedPrompt: prompt,
            model: modelName,
            costUsd: 0.19,
          };
        }
      } else {
        const errText = await res.text();
        console.warn(`[render] ${modelName} ${res.status}: ${errText.slice(0, 200)}`);
      }
    } catch (e) {
      console.warn(`[render] ${modelName} throw:`, e);
    }
  }

  // 2차 fallback: dall-e-3 HD (조직 인증 불필요, 어떤 OpenAI 계정이든 작동)
  const body = {
    model: "dall-e-3",
    prompt,
    size,
    n: 1,
    quality: "hd",
    response_format: "url",
  };
  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
    costUsd: size === "1024x1024" ? 0.08 : 0.12,
  };
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
