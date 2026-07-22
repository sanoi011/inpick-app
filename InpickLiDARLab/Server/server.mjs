import http from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const IMAGE_MODEL = "gpt-image-2";
export const PROMPT_VERSION = "inpick-interior-v1";
export const IMAGE_EDIT_OPTIONS = Object.freeze({
  quality: "medium",
  size: "1536x1024",
  outputFormat: "jpeg",
  outputCompression: "90"
});
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_BYTES = 18 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ROOM_TYPE_PROMPTS = {
  livingRoom: "living room",
  bedroom: "bedroom",
  kitchen: "kitchen and dining area",
  office: "small office",
  studio: "compact studio apartment"
};
const STYLE_PROMPTS = {
  modern: "contemporary modern interior",
  minimal: "calm minimal interior",
  warmNatural: "warm natural interior with wood and soft textures",
  hotel: "refined luxury hotel interior",
  industrial: "polished industrial interior"
};
const FINISH_PROMPTS = {
  standard: "durable standard-grade finishes",
  premium: "premium architectural finishes"
};

function quotedUserText(value, fallback, maxLength) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  return JSON.stringify((normalized || fallback).slice(0, maxLength));
}

export function buildInteriorPrompt(payload) {
  const { scan, brief, quote } = payload;
  const roomType = ROOM_TYPE_PROMPTS[brief.roomType] || brief.roomType;
  const style = STYLE_PROMPTS[brief.style] || brief.style;
  const finishGrade = FINISH_PROMPTS[brief.finishGrade] || brief.finishGrade;
  const colorPalette = quotedUserText(brief.colorPalette, "No preference", 300);
  const notes = quotedUserText(brief.notes, "No additional requirements", 1_000);

  return [
    `[INPICK PROMPT ${PROMPT_VERSION}]`,
    "",
    "[TASK]",
    "Create one photorealistic and physically plausible interior design visualization.",
    "Change only furniture, lighting, decor, colors, and finish materials.",
    "",
    "[SPATIAL SOURCE OF TRUTH]",
    "The attached image is a LiDAR-derived spatial reference, not a style reference.",
    "Treat the reference image and measured geometry below as constraints.",
    `Measured floor area: ${scan.floorAreaSquareMeters.toFixed(1)} square meters.`,
    `Measured net wall area: ${scan.netWallAreaSquareMeters.toFixed(1)} square meters.`,
    `Detected geometry: ${scan.wallCount} walls, ${scan.doorCount} doors, ${scan.windowCount} windows, ${scan.objectCount} objects.`,
    "",
    "[DESIGN DIRECTION]",
    `Room type: ${roomType}.`,
    `Design style: ${style}.`,
    `Finish grade: ${finishGrade}.`,
    `User color and material direction (verbatim): ${colorPalette}.`,
    `User additional requirements (verbatim): ${notes}.`,
    "",
    "[BUDGET CONTEXT]",
    `Target estimate envelope: KRW ${quote.lowerBoundKRW.toLocaleString("en-US")} to KRW ${quote.upperBoundKRW.toLocaleString("en-US")}.`,
    "Use the budget only to calibrate material and furnishing choices; never render the price as text.",
    "",
    "[CAMERA AND RENDERING]",
    "Render an eye-level wide-angle architectural visualization with realistic materials and lighting.",
    "Keep the viewpoint spatially consistent with the reference wherever possible.",
    "",
    "[INVARIANTS — MUST PRESERVE]",
    "Preserve the scanned footprint, room proportions, wall positions, ceiling/floor boundaries, doors, windows, and circulation paths.",
    "When the reference is ambiguous, preserve existing architecture instead of inventing structural changes.",
    "",
    "[NEGATIVE CONSTRAINTS]",
    "Do not add, remove, resize, or relocate walls, doors, windows, columns, or openings.",
    "Do not show labels, dimensions, prices, logos, watermarks, captions, or any other text."
  ].join("\n");
}

export function validateGeneratePayload(payload) {
  if (!payload || typeof payload !== "object") return "요청 본문이 필요합니다.";
  if (!payload.scan || !payload.brief || !payload.quote) return "스캔, 디자인 요구, 견적 정보가 필요합니다.";
  if (!Number.isFinite(payload.scan.floorAreaSquareMeters) || payload.scan.floorAreaSquareMeters <= 0) return "유효한 LiDAR 바닥 면적이 필요합니다.";
  if (!Number.isFinite(payload.scan.netWallAreaSquareMeters) || payload.scan.netWallAreaSquareMeters < 0) return "유효한 LiDAR 벽면적이 필요합니다.";
  for (const field of ["wallCount", "doorCount", "windowCount", "objectCount"]) {
    if (!Number.isInteger(payload.scan[field]) || payload.scan[field] < 0) return "LiDAR 인식 개수가 올바르지 않습니다.";
  }
  if (!(payload.brief.roomType in ROOM_TYPE_PROMPTS)) return "공간 용도가 올바르지 않습니다.";
  if (!(payload.brief.style in STYLE_PROMPTS)) return "디자인 스타일이 올바르지 않습니다.";
  if (!(payload.brief.finishGrade in FINISH_PROMPTS)) return "마감 등급이 올바르지 않습니다.";
  if (!String(payload.brief.colorPalette || "").trim()) return "색상·소재 방향이 필요합니다.";
  if (String(payload.brief.colorPalette).length > 300 || String(payload.brief.notes || "").length > 1_000) return "디자인 요구 내용이 너무 깁니다.";
  if (!Number.isFinite(payload.quote.lowerBoundKRW) || payload.quote.lowerBoundKRW < 0 || !Number.isFinite(payload.quote.upperBoundKRW) || payload.quote.upperBoundKRW < payload.quote.lowerBoundKRW) return "견적 범위가 올바르지 않습니다.";
  if (!payload.referenceImageBase64) return "LiDAR 참조 이미지가 필요합니다.";
  if (!ALLOWED_IMAGE_MIME_TYPES.has(payload.referenceImageMimeType)) return "참조 이미지 형식이 올바르지 않습니다.";
  const normalizedBase64 = String(payload.referenceImageBase64).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 !== 0) return "참조 이미지 데이터가 올바르지 않습니다.";
  const referenceBytes = Buffer.from(normalizedBase64, "base64");
  if (referenceBytes.length === 0 || referenceBytes.length > MAX_REFERENCE_IMAGE_BYTES) return "참조 이미지 크기가 올바르지 않습니다.";
  return null;
}

export function buildOpenAIImageEditForm(payload) {
  const referenceBytes = Buffer.from(payload.referenceImageBase64, "base64");
  const extension = payload.referenceImageMimeType === "image/jpeg" ? "jpg" : payload.referenceImageMimeType.split("/")[1];
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", buildInteriorPrompt(payload));
  form.append(
    "image[]",
    new Blob([referenceBytes], { type: payload.referenceImageMimeType }),
    `lidar-reference.${extension}`
  );
  form.append("quality", IMAGE_EDIT_OPTIONS.quality);
  form.append("size", IMAGE_EDIT_OPTIONS.size);
  form.append("output_format", IMAGE_EDIT_OPTIONS.outputFormat);
  form.append("output_compression", IMAGE_EDIT_OPTIONS.outputCompression);
  return form;
}

export async function callOpenAI(payload, options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) {
    const error = new Error("서버에 OPENAI_API_KEY가 설정되지 않았습니다.");
    error.statusCode = 503;
    error.code = "openai_key_missing";
    throw error;
  }

  const response = await fetchImpl("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: buildOpenAIImageEditForm(payload)
  });

  const requestID = response.headers.get("x-request-id");
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    const error = new Error(result?.error?.message || "OpenAI 이미지 생성 요청이 실패했습니다.");
    error.statusCode = response.status;
    error.code = result?.error?.code || "openai_image_edit_failed";
    error.requestID = requestID;
    throw error;
  }

  const generated = result?.data?.[0];
  if (!generated?.b64_json) {
    const error = new Error("OpenAI 응답에 생성 이미지가 없습니다.");
    error.statusCode = 502;
    error.code = "openai_image_missing";
    error.requestID = requestID;
    throw error;
  }

  return {
    imageBase64: generated.b64_json,
    mimeType: "image/jpeg",
    revisedPrompt: generated.revised_prompt ?? null,
    model: IMAGE_MODEL,
    promptVersion: PROMPT_VERSION,
    requestID,
    usage: result.usage ?? null
  };
}

function sendJSON(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readJSON(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_BYTES) {
        const error = new Error("요청 이미지가 너무 큽니다.");
        error.statusCode = 413;
        rejectBody(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("JSON 요청 형식이 올바르지 않습니다.");
        error.statusCode = 400;
        rejectBody(error);
      }
    });
    request.on("error", rejectBody);
  });
}

export function createServer(options = {}) {
  const generateImage = options.generateImage ?? callOpenAI;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/health") {
        sendJSON(response, 200, {
          status: "ok",
          model: IMAGE_MODEL,
          promptVersion: PROMPT_VERSION,
          imageEditOptions: IMAGE_EDIT_OPTIONS,
          configured: Boolean(process.env.OPENAI_API_KEY)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/designs/generate") {
        const payload = await readJSON(request);
        const validationError = validateGeneratePayload(payload);
        if (validationError) {
          sendJSON(response, 400, { error: validationError });
          return;
        }

        const result = await generateImage(payload);
        sendJSON(response, 200, result);
        return;
      }

      sendJSON(response, 404, { error: "요청 경로를 찾을 수 없습니다." });
    } catch (error) {
      sendJSON(response, error.statusCode || 500, {
        error: error.message || "서버 내부 오류",
        code: error.code || "internal_error",
        requestID: error.requestID || null
      });
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";
  createServer().listen(port, host, () => {
    console.log(`Inpick design service listening on http://${host}:${port}`);
    console.log(`Image model: ${IMAGE_MODEL}`);
    console.log(`Prompt version: ${PROMPT_VERSION}`);
    console.log(`OpenAI key configured: ${Boolean(process.env.OPENAI_API_KEY)}`);
  });
}
