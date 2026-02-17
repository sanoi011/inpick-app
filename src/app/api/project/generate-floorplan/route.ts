import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Storage 업로드용 service role client (anon key로는 업로드 불가)
function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );
  }
  // fallback: server client (RLS 적용됨)
  return createServerClient();
}

export const maxDuration = 300; // Vercel Pro 5분

const MODEL = "gemini-3-pro-image-preview";
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT = 30000;

const CLEAN_PROMPT = `이 아파트 평면도를 최신 신축 아파트 단위세대 실시설계 도면 스타일로 다시 그려줘.

【가장 중요한 규칙 - 확장형 레이아웃 유지】
- 이 도면은 "확장형" 평면도야. 발코니 벽이 이미 철거되어 거실/방과 통합된 상태야.
- 원본 도면의 공간 구조와 벽 위치를 정확히 유지해. 벽을 추가하거나 공간을 분할하지 마.
- 발코니를 새로 만들지 마. 발코니 벽을 추가하지 마. 원본에 없는 벽을 절대 추가하지 마.
- 원본 도면에 보이는 그대로의 방 배치, 벽 위치, 공간 크기를 유지해.

【완전히 제거】
- 모든 텍스트/글자 (방 이름, 면적, 치수 숫자 전부)
- 모든 설비 (변기, 세면대, 욕조, 싱크대, 가스레인지, 세탁기)
- 모든 가구 (침대, 소파, 테이블, 의자, 옷장, 신발장)
- 워터마크 (NAVER, BUSINESS PLATFORM 등)
- 기존 바닥색/패턴 전부 제거
- 공용 면적 (엘리베이터 홀, 계단실, 복도 등 세대 밖 공간)은 완전히 제거하고 해당 영역은 흰색 배경으로 처리. 단위세대(전용면적) 내부만 남겨줘.

【벽체】
- 구조벽(외벽): 두꺼운 검은 실선 (굵기 차이로 내벽과 구분)
- 내벽: 약간 얇은 검은 실선
- 벽체 내부는 검은색으로 채워서 솔리드하게 표현
- 원본에 있는 벽만 그려. 새로운 벽을 추가하지 마.

【문 - 최신 건축도면 표기법】
- 여닫이문: 90도 호(arc) + 문짝 선 (열리는 방향 표시)
- 미닫이문: 벽 안에 슬라이딩 표시 (점선 또는 화살표)
- 현관문: 다른 문보다 두꺼운 표현

【창문 - 최신 건축도면 표기법 + 열림방향】
- 창문: 이중 평행선 사이에 유리선 표시
- 모든 창문에 열리는 방향 화살표 표시

【바닥 자재 질감 (고해상도 리얼 텍스처)】
- 모든 방/거실/침실/주방: 고급 우드 마루 텍스처 (확장형이므로 마루가 외벽까지 이어짐)
- 욕실/화장실: 밝은 라이트 그레이 타일 텍스처
- 현관: 밝은 그레이 타일 텍스처

【스타일】
- 고해상도, 정밀한 스케일, 선명한 벽선
- 고급 분양 카탈로그에 들어가는 단위세대 평면도 수준`;

const DIM_PROMPT = `이 깨끗한 아파트 평면도에 내부 치수선만 추가해줘:

【벽체 두께 기준】
- 외벽(구조벽): 250mm
- 내벽(칸막이벽): 150mm
- 치수는 벽체 안쪽 면(내면) 사이의 순수 내부 거리를 측정해. 벽 두께는 포함하지 마.

【각 실 치수 표시】
- 거실, 안방, 침실, 주방, 욕실, 현관, 드레스룸 등 모든 실
- 각 방 내부에 가로/세로 치수선을 표시
- 내벽 안쪽 면 사이의 거리를 mm 단위로 표시 (예: 3,600)
- 치수선은 방 내부 벽면 가장자리에 가늘고 얇은 선으로 표시
- 양 끝에 작은 틱마크(|)
- 숫자는 얇고 세련된 폰트, 회색(#555) 또는 진한 회색

【면적 치수 정확도】
- 외벽 250mm, 내벽 150mm를 고려하여 각 실의 내부 치수를 계산해
- 예: 전용면적 84㎡ 아파트의 거실은 보통 가로 4,500~5,500mm × 세로 4,000~5,000mm 정도
- 안방은 보통 3,600~4,200mm × 3,300~3,900mm 정도
- 욕실은 보통 1,500~2,000mm × 2,000~2,500mm 정도
- 원본 도면의 비례를 참고하여 현실적인 치수를 넣어줘

【중요 규칙】
- 벽선, 문 아크, 창문 표시는 절대 변경하지 마
- 공간 이름은 표시하지 마. 치수만 표시해.
- 레이아웃을 절대 변경하지 마. 벽을 추가하거나 제거하지 마.`;

const DIM_EXTRACT_PROMPT = `이 아파트 평면도 이미지에서 치수선에 표시된 모든 치수값을 추출해줘.

각 치수선에 대해 다음 정보를 JSON 배열로 반환해:
- roomName: 이 치수가 속한 방 이름 (거실, 안방, 침실1, 침실2, 주방, 욕실1, 욕실2, 현관, 드레스룸 등)
- valueMm: 치수값 (mm 단위 정수, 예: 3600)
- direction: "width" (가로) 또는 "height" (세로)
- centerX: 치수선 중심의 이미지 X좌표 (0~1 정규화, 이미지 왼쪽=0 오른쪽=1)
- centerY: 치수선 중심의 이미지 Y좌표 (0~1 정규화, 이미지 상단=0 하단=1)
- startX, startY, endX, endY: 치수선 시작/끝점의 정규화 좌표 (0~1)

JSON 형식만 반환하고 다른 텍스트는 포함하지 마:
[
  { "roomName": "거실", "valueMm": 4500, "direction": "width", "centerX": 0.5, "centerY": 0.3, "startX": 0.3, "startY": 0.3, "endX": 0.7, "endY": 0.3 },
  ...
]`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Gemini Pro로 치수 이미지에서 치수값 추출 (JSON) - 벽 두께(외벽250/내벽150mm) 고려 필요 */
async function extractDimensionsFromImage(
  ai: GoogleGenAI,
  imageBuffer: Buffer,
  mimeType: string
): Promise<Array<{
  roomName: string;
  valueMm: number;
  direction: "width" | "height";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}>> {
  try {
    const base64Image = imageBuffer.toString("base64");
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: DIM_EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const text = response.text || "";
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((d: Record<string, unknown>) => d.roomName && d.valueMm && d.direction)
      .map((d: Record<string, unknown>) => ({
        roomName: String(d.roomName),
        valueMm: Number(d.valueMm),
        direction: d.direction === "height" ? "height" as const : "width" as const,
        startX: Number(d.startX) || 0,
        startY: Number(d.startY) || 0,
        endX: Number(d.endX) || 0,
        endY: Number(d.endY) || 0,
      }));
  } catch (err) {
    console.error("[generate-floorplan] Dimension extraction failed:", (err as Error).message);
    return [];
  }
}

async function callGeminiPro(
  ai: GoogleGenAI,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<Buffer | null> {
  const base64Image = imageBuffer.toString("base64");

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: prompt },
            ],
          },
        ],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });

      if (response.candidates && response.candidates[0]) {
        for (const part of response.candidates[0].content?.parts || []) {
          if (part.inlineData) {
            return Buffer.from(part.inlineData.data!, "base64");
          }
        }
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        console.log(`[generate-floorplan] Rate limited (retry ${retry + 1}/${MAX_RETRIES}), waiting...`);
        await sleep(RATE_LIMIT_WAIT);
        continue;
      }
      console.error(`[generate-floorplan] Gemini error: ${msg.slice(0, 200)}`);
      break;
    }
  }
  return null;
}

// GET: 기존 도면 조회
export async function GET(request: NextRequest) {
  const complexNo = request.nextUrl.searchParams.get("complexNo");
  const pyeongNo = request.nextUrl.searchParams.get("pyeongNo");

  if (!complexNo || !pyeongNo) {
    return NextResponse.json({ error: "complexNo, pyeongNo 필수" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("generated_floorplans")
    .select("*")
    .eq("complex_no", complexNo)
    .eq("pyeong_no", Number(pyeongNo))
    .single();

  if (data && data.status === "completed") {
    let extractedDimensions = [];
    try {
      if (data.extracted_dimensions) {
        extractedDimensions = typeof data.extracted_dimensions === "string"
          ? JSON.parse(data.extracted_dimensions)
          : data.extracted_dimensions;
      }
    } catch { /* ignore */ }
    return NextResponse.json({
      exists: true,
      finalUrl: data.final_url,
      finalMirrorUrl: data.final_mirror_url,
      cleanUrl: data.clean_url,
      extractedDimensions,
    });
  }

  return NextResponse.json({ exists: false });
}

// POST: SSE 4-step pipeline
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { complexNo, pyeongNo, grandPlanUrl, complexName, pyeongName, exclusiveArea } = body;

  if (!complexNo || !pyeongNo || !grandPlanUrl) {
    return NextResponse.json(
      { error: "complexNo, pyeongNo, grandPlanUrl 필수" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API 키가 설정되지 않았습니다" }, { status: 500 });
  }

  const supabase = createAdminClient();

  // Check if already completed
  const { data: existing } = await supabase
    .from("generated_floorplans")
    .select("*")
    .eq("complex_no", complexNo)
    .eq("pyeong_no", Number(pyeongNo))
    .single();

  if (existing?.status === "completed") {
    return NextResponse.json({
      cached: true,
      finalUrl: existing.final_url,
      finalMirrorUrl: existing.final_mirror_url,
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        // DB: processing 상태
        await supabase.from("generated_floorplans").upsert(
          {
            complex_no: complexNo,
            pyeong_no: Number(pyeongNo),
            complex_name: complexName,
            pyeong_name: pyeongName,
            exclusive_area: exclusiveArea,
            original_url: grandPlanUrl,
            status: "processing",
            progress: 0,
          },
          { onConflict: "complex_no,pyeong_no" }
        );

        // ── Step 0: 원본 다운로드 ──
        send("progress", { step: 0, progress: 5, message: "원본 도면 다운로드 중..." });

        const imgRes = await fetch(grandPlanUrl);
        if (!imgRes.ok) throw new Error(`원본 다운로드 실패: ${imgRes.status}`);
        const originalBuffer = Buffer.from(await imgRes.arrayBuffer());
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

        send("progress", { step: 0, progress: 10, message: "원본 도면 다운로드 완료" });

        // ── Step 1: Gemini Pro Clean ──
        send("progress", { step: 1, progress: 15, message: "AI 클린 처리 중... (약 60초)" });

        const cleanBuffer = await callGeminiPro(ai, originalBuffer, mimeType, CLEAN_PROMPT);
        if (!cleanBuffer) throw new Error("클린 처리 실패 (Gemini Pro 응답 없음)");

        send("progress", { step: 1, progress: 35, message: "클린 처리 완료" });

        // ── Step 2: Mirror (sharp.flop) ──
        send("progress", { step: 2, progress: 40, message: "미러 이미지 생성 중..." });

        const cleanMirrorBuffer = await sharp(cleanBuffer).flop().png().toBuffer();

        send("progress", { step: 2, progress: 45, message: "미러 이미지 생성 완료" });

        // Wait between Gemini calls
        await sleep(5000);

        // ── Step 3: Gemini Pro Dim on clean ──
        send("progress", { step: 3, progress: 50, message: "치수선 추가 중... (약 60초)" });

        const finalBuffer = await callGeminiPro(ai, cleanBuffer, "image/png", DIM_PROMPT);
        if (!finalBuffer) throw new Error("치수선 추가 실패 (기본형)");

        send("progress", { step: 3, progress: 70, message: "기본형 치수선 완료" });

        // ── Step 3b: 치수값 추출 (Gemini Flash, 병렬 가능) ──
        send("progress", { step: 3, progress: 72, message: "치수 데이터 추출 중..." });
        const extractedDimensions = await extractDimensionsFromImage(ai, finalBuffer, "image/png");
        send("progress", { step: 3, progress: 74, message: `치수 ${extractedDimensions.length}개 추출 완료` });

        // Wait between Gemini calls
        await sleep(5000);

        // ── Step 4: Gemini Pro Dim on clean_mirror ──
        send("progress", { step: 4, progress: 75, message: "미러형 치수선 추가 중... (약 60초)" });

        const finalMirrorBuffer = await callGeminiPro(ai, cleanMirrorBuffer, "image/png", DIM_PROMPT);
        if (!finalMirrorBuffer) throw new Error("치수선 추가 실패 (미러형)");

        send("progress", { step: 4, progress: 95, message: "미러형 치수선 완료" });

        // ── Upload to Supabase Storage ──
        send("progress", { step: 4, progress: 96, message: "이미지 저장 중..." });

        const basePath = `floorplans/${complexNo}/${pyeongNo}`;
        const uploads = [
          { path: `${basePath}/clean.png`, buffer: cleanBuffer },
          { path: `${basePath}/final.png`, buffer: finalBuffer },
          { path: `${basePath}/final_mirror.png`, buffer: finalMirrorBuffer },
        ];

        const urls: Record<string, string> = {};
        for (const u of uploads) {
          const { error: uploadError } = await supabase.storage
            .from("uploads")
            .upload(u.path, u.buffer, { contentType: "image/png", upsert: true });

          if (uploadError) {
            throw new Error(`이미지 업로드 실패 (${u.path}): ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(u.path);
          const key = u.path.split("/").pop()!.replace(".png", "");
          urls[key] = urlData.publicUrl;
        }

        // ── DB: completed ──
        const processingTime = Date.now() - startTime;
        await supabase
          .from("generated_floorplans")
          .update({
            status: "completed",
            progress: 100,
            final_url: urls["final"],
            final_mirror_url: urls["final_mirror"],
            clean_url: urls["clean"],
            processing_time_ms: processingTime,
            extracted_dimensions: extractedDimensions.length > 0 ? JSON.stringify(extractedDimensions) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("complex_no", complexNo)
          .eq("pyeong_no", Number(pyeongNo));

        send("complete", {
          progress: 100,
          message: "도면 생성 완료!",
          finalUrl: urls["final"],
          finalMirrorUrl: urls["final_mirror"],
          processingTimeMs: processingTime,
          extractedDimensions,
        });
      } catch (err: unknown) {
        const msg = (err as Error).message || "알 수 없는 오류";
        console.error("[generate-floorplan] Pipeline error:", msg);

        // DB: failed
        await supabase
          .from("generated_floorplans")
          .update({
            status: "failed",
            error_message: msg,
            processing_time_ms: Date.now() - startTime,
            updated_at: new Date().toISOString(),
          })
          .eq("complex_no", complexNo)
          .eq("pyeong_no", Number(pyeongNo));

        send("error", { message: msg });
      } finally {
        if (!closed) {
          try { controller.close(); } catch { /* already closed */ }
        }
        closed = true;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
