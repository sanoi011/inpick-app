import http from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const IMAGE_MODEL = "gpt-image-2";
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
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

export function buildInteriorPrompt(payload) {
  const { scan, brief, quote } = payload;
  const notes = brief.notes?.trim() || "No additional requirements.";

  return [
    "Create one photorealistic, buildable interior design visualization.",
    "The attached image is a LiDAR-derived 3D spatial reference, not a style reference.",
    "Preserve the scanned footprint, room proportions, wall positions, doors, windows, and circulation paths.",
    `Room type: ${ROOM_TYPE_PROMPTS[brief.roomType] || brief.roomType}.`,
    `Design style: ${STYLE_PROMPTS[brief.style] || brief.style}.`,
    `Finish grade: ${FINISH_PROMPTS[brief.finishGrade] || brief.finishGrade}.`,
    `Color and material direction: ${brief.colorPalette}.`,
    `Measured floor area: ${scan.floorAreaSquareMeters.toFixed(1)} square meters.`,
    `Measured net wall area: ${scan.netWallAreaSquareMeters.toFixed(1)} square meters.`,
    `Detected geometry: ${scan.wallCount} walls, ${scan.doorCount} doors, ${scan.windowCount} windows, ${scan.objectCount} objects.`,
    `Target estimate envelope: KRW ${quote.lowerBoundKRW.toLocaleString("en-US")} to KRW ${quote.upperBoundKRW.toLocaleString("en-US")}.`,
    `Additional requirements: ${notes}`,
    "Render an eye-level wide-angle architectural visualization with realistic materials and lighting.",
    "Do not add impossible openings, change the room footprint, or show labels, measurements, watermarks, or text."
  ].join("\n");
}

export function validateGeneratePayload(payload) {
  if (!payload || typeof payload !== "object") return "요청 본문이 필요합니다.";
  if (!payload.scan || !payload.brief || !payload.quote) return "스캔, 디자인 요구, 견적 정보가 필요합니다.";
  if (!(payload.scan.floorAreaSquareMeters > 0)) return "유효한 LiDAR 바닥 면적이 필요합니다.";
  if (!payload.referenceImageBase64) return "LiDAR 참조 이미지가 필요합니다.";
  if (!String(payload.referenceImageMimeType || "").startsWith("image/")) return "참조 이미지 형식이 올바르지 않습니다.";
  return null;
}

async function callOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("서버에 OPENAI_API_KEY가 설정되지 않았습니다.");
    error.statusCode = 503;
    throw error;
  }

  const referenceBytes = Buffer.from(payload.referenceImageBase64, "base64");
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", buildInteriorPrompt(payload));
  form.append(
    "image",
    new Blob([referenceBytes], { type: payload.referenceImageMimeType }),
    "lidar-reference.png"
  );
  form.append("quality", "medium");
  form.append("size", "1536x1024");
  form.append("output_format", "jpeg");
  form.append("output_compression", "90");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error?.message || "OpenAI 이미지 생성 요청이 실패했습니다.");
    error.statusCode = response.status;
    throw error;
  }

  const generated = result?.data?.[0];
  if (!generated?.b64_json) {
    const error = new Error("OpenAI 응답에 생성 이미지가 없습니다.");
    error.statusCode = 502;
    throw error;
  }

  return {
    imageBase64: generated.b64_json,
    mimeType: "image/jpeg",
    revisedPrompt: generated.revised_prompt ?? null,
    model: IMAGE_MODEL
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

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/health") {
        sendJSON(response, 200, {
          status: "ok",
          model: IMAGE_MODEL,
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

        const result = await callOpenAI(payload);
        sendJSON(response, 200, result);
        return;
      }

      sendJSON(response, 404, { error: "요청 경로를 찾을 수 없습니다." });
    } catch (error) {
      sendJSON(response, error.statusCode || 500, {
        error: error.message || "서버 내부 오류"
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
    console.log(`OpenAI key configured: ${Boolean(process.env.OPENAI_API_KEY)}`);
  });
}
