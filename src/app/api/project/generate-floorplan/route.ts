import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { buildSegmentationPrompt } from "@/lib/prompts/segmentation-prompt";
import { ROOM_TYPE_COLORS } from "@/lib/constants/room-segmentation";
import type { SegmentedRoom, RoomColorMap } from "@/lib/constants/room-segmentation";

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

const MODEL = "gemini-2.0-flash-exp";
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT = 30000;
// 프롬프트 버전: 변경 시 이 값을 올리면 기존 캐시 자동 무효화
const PROMPT_VERSION = 3;

// 확장형/기본형에 따라 프롬프트 동적 생성
function buildCleanPrompt(isExpanded: boolean): string {
  const balconyRule = isExpanded
    ? `【가장 중요한 규칙 - 발코니 확장형 변환】
- 원본 도면이 "기본형"(발코니가 별도 공간으로 분리된 상태)이면 반드시 "확장형"으로 변환해.
  · 거실/방과 발코니 사이의 칸막이벽(발코니 경계벽)을 제거해.
  · 발코니 공간이 거실/방에 통합되어 외벽까지 하나의 공간이 되도록 해.
  · 발코니였던 영역의 바닥도 해당 방과 동일한 마루 텍스처로 연결해.
  · 발코니 확장 후에도 외벽 창문 위치는 유지해.
- 원본 도면이 이미 "확장형"이면 그대로 유지해.
- 거실/방 내부의 구조벽(화장실, 주방, 방 사이 벽)은 절대 제거하지 마.
- 원본에 없는 새로운 벽을 추가하지 마.`
    : `【가장 중요한 규칙 - 비확장(기본형) 유지】
- 원본 도면의 발코니 칸막이벽을 그대로 유지해. 절대 제거하지 마.
- 발코니는 거실/방과 분리된 별도 공간으로 남겨둬.
- 발코니와 거실/방 사이의 문도 그대로 유지해.
- 거실/방 내부의 구조벽(화장실, 주방, 방 사이 벽)은 절대 제거하지 마.
- 원본에 없는 새로운 벽을 추가하지 마.`;

  const wallBalconyLine = isExpanded
    ? "- 발코니 칸막이벽은 제거 (확장형 변환)"
    : "- 발코니 칸막이벽은 그대로 유지 (기본형)";

  const doorBalconyLine = isExpanded
    ? "- 발코니 확장으로 칸막이벽이 제거되면 해당 문도 함께 제거"
    : "- 발코니와 거실/방 사이의 문은 그대로 유지";

  const floorBalconyLine = isExpanded
    ? `- 모든 방/거실/침실/주방: 고급 우드 마루 텍스처 (확장형이므로 마루가 외벽까지 이어짐)
- 발코니였던 영역도 동일한 우드 마루 텍스처로 통일`
    : `- 모든 방/거실/침실/주방: 고급 우드 마루 텍스처
- 발코니: 타일 또는 원본 바닥재 질감 유지 (거실/방과 구분)`;

  const titleStyle = isExpanded ? "발코니 확장형" : "기본형(비확장)";

  return `이 아파트 평면도를 최신 신축 아파트 "${titleStyle}" 단위세대 실시설계 도면 스타일로 다시 그려줘.

${balconyRule}

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
${wallBalconyLine}
- 그 외 원본에 있는 벽만 그려. 새로운 벽을 추가하지 마.

【문 - 최신 건축도면 표기법】
- 여닫이문: 90도 호(arc) + 문짝 선 (열리는 방향 표시)
- 미닫이문: 벽 안에 슬라이딩 표시 (점선 또는 화살표)
- 현관문: 다른 문보다 두꺼운 표현
${doorBalconyLine}

【창문 - 최신 건축도면 표기법 + 열림방향】
- 창문: 이중 평행선 사이에 유리선 표시
- 모든 창문에 열리는 방향 화살표 표시

【바닥 자재 질감 (고해상도 리얼 텍스처)】
${floorBalconyLine}
- 욕실/화장실: 밝은 라이트 그레이 타일 텍스처
- 현관: 밝은 그레이 타일 텍스처

【스타일】
- 고해상도, 정밀한 스케일, 선명한 벽선
- 고급 분양 카탈로그에 들어가는 단위세대 평면도 수준`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

  if (data && data.status === "completed" && (data.prompt_version || 0) >= PROMPT_VERSION) {
    return NextResponse.json({
      exists: true,
      finalUrl: data.final_url || data.clean_url,
      finalMirrorUrl: data.final_mirror_url,
      cleanUrl: data.clean_url,
      maskUrl: data.mask_url || null,
      maskMirrorUrl: data.mask_mirror_url || null,
      roomColorMap: data.room_color_map || null,
    });
  }

  // 프롬프트 버전 불일치 → 캐시 무효 (재생성 필요)
  return NextResponse.json({ exists: false });
}

// POST: SSE 3-step pipeline (다운로드 → AI 클린 → 미러)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { complexNo, pyeongNo, grandPlanUrl, complexName, pyeongName, exclusiveArea, force, isExpanded } = body;

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

  // Check if already completed (프롬프트 버전 일치 + force 아닌 경우만)
  if (!force) {
    const { data: existing } = await supabase
      .from("generated_floorplans")
      .select("*")
      .eq("complex_no", complexNo)
      .eq("pyeong_no", Number(pyeongNo))
      .single();

    if (existing?.status === "completed" && (existing.prompt_version || 0) >= PROMPT_VERSION) {
      return NextResponse.json({
        cached: true,
        finalUrl: existing.final_url || existing.clean_url,
        finalMirrorUrl: existing.final_mirror_url,
        maskUrl: existing.mask_url || null,
        maskMirrorUrl: existing.mask_mirror_url || null,
        roomColorMap: existing.room_color_map || null,
      });
    }
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
        // DB: processing 상태 (이전 캐시 덮어쓰기)
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
            prompt_version: PROMPT_VERSION,
          },
          { onConflict: "complex_no,pyeong_no" }
        );

        // ── Step 0: 원본 다운로드 ──
        send("progress", { step: 0, progress: 5, message: "원본 도면 다운로드 중..." });

        const imgRes = await fetch(grandPlanUrl);
        if (!imgRes.ok) throw new Error(`원본 다운로드 실패: ${imgRes.status}`);
        const originalBuffer = Buffer.from(await imgRes.arrayBuffer());
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

        send("progress", { step: 0, progress: 15, message: "원본 도면 다운로드 완료" });

        // ── Step 1: Gemini Pro Clean ──
        const expandedLabel = isExpanded === false ? "기본형" : "확장형";
        send("progress", { step: 1, progress: 20, message: `AI 클린 처리 중 (${expandedLabel})... (약 60초)` });

        const cleanPrompt = buildCleanPrompt(isExpanded !== false);
        const cleanBuffer = await callGeminiPro(ai, originalBuffer, mimeType, cleanPrompt);
        if (!cleanBuffer) throw new Error("클린 처리 실패 (Gemini Pro 응답 없음)");

        send("progress", { step: 1, progress: 70, message: "클린 처리 완료" });

        // ── Step 2: Mirror (sharp.flop) ──
        send("progress", { step: 2, progress: 70, message: "미러 이미지 생성 중..." });

        const cleanMirrorBuffer = await sharp(cleanBuffer).flop().png().toBuffer();

        send("progress", { step: 2, progress: 72, message: "미러 이미지 생성 완료" });

        // ── Step 3: Segmentation Mask (Gemini Pro) ──
        send("progress", { step: 3, progress: 75, message: "방 영역 마스크 생성 중... (약 60초)" });

        let maskBuffer: Buffer | null = null;
        let maskMirrorBuffer: Buffer | null = null;
        let roomColorMap: RoomColorMap | null = null;

        try {
          const segPrompt = buildSegmentationPrompt();
          const segResponse = await ai.models.generateContent({
            model: MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: "image/png", data: cleanBuffer.toString("base64") } },
                  { text: segPrompt },
                ],
              },
            ],
            config: { responseModalities: ["IMAGE", "TEXT"] },
          });

          // 응답에서 이미지 + JSON 추출
          let parsedRooms: SegmentedRoom[] = [];
          if (segResponse.candidates && segResponse.candidates[0]) {
            for (const part of segResponse.candidates[0].content?.parts || []) {
              if (part.inlineData) {
                maskBuffer = Buffer.from(part.inlineData.data!, "base64");
              }
              if (part.text) {
                const jsonMatch = part.text.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    parsedRooms = parsed.rooms || [];
                  } catch { /* ignore JSON parse error */ }
                }
              }
            }
          }

          // JSON 방 목록이 없으면 모든 알려진 방 타입으로 폴백
          if (parsedRooms.length === 0 && maskBuffer) {
            parsedRooms = Object.entries(ROOM_TYPE_COLORS).map(([type, info]) => ({
              type: type as SegmentedRoom["type"],
              color: info.hex,
              label: info.label,
            }));
          }

          if (maskBuffer) {
            // 마스크를 PNG로 강제 변환 (Gemini가 JPEG 반환 시 색상 정확도 개선)
            maskBuffer = await sharp(maskBuffer).png().toBuffer();

            // 마스크 크기를 클린 이미지와 동일하게 맞춤 (nearest neighbor - 색상 블렌딩 방지)
            const cleanMeta = await sharp(cleanBuffer).metadata();
            const maskMeta = await sharp(maskBuffer).metadata();
            if (cleanMeta.width && cleanMeta.height &&
                (maskMeta.width !== cleanMeta.width || maskMeta.height !== cleanMeta.height)) {
              maskBuffer = await sharp(maskBuffer)
                .resize(cleanMeta.width, cleanMeta.height, { kernel: "nearest" })
                .png()
                .toBuffer();
            }

            // 미러 마스크 생성
            maskMirrorBuffer = await sharp(maskBuffer).flop().png().toBuffer();

            roomColorMap = {
              rooms: parsedRooms,
              maskWidth: cleanMeta.width || 0,
              maskHeight: cleanMeta.height || 0,
            };

            send("progress", { step: 3, progress: 85, message: "방 영역 마스크 생성 완료" });
          } else {
            console.warn("[generate-floorplan] 마스크 생성 실패 - 이미지 없음 (계속 진행)");
            send("progress", { step: 3, progress: 85, message: "마스크 생성 건너뜀 (도면은 정상)" });
          }
        } catch (maskErr) {
          console.warn("[generate-floorplan] 마스크 생성 오류 (계속 진행):", (maskErr as Error).message);
          send("progress", { step: 3, progress: 85, message: "마스크 생성 건너뜀 (도면은 정상)" });
        }

        // ── Upload to Supabase Storage ──
        send("progress", { step: 4, progress: 88, message: "이미지 저장 중..." });

        const basePath = `floorplans/${complexNo}/${pyeongNo}`;
        const uploads: { path: string; buffer: Buffer }[] = [
          { path: `${basePath}/clean.png`, buffer: cleanBuffer },
          { path: `${basePath}/clean_mirror.png`, buffer: cleanMirrorBuffer },
        ];
        if (maskBuffer) {
          uploads.push({ path: `${basePath}/mask.png`, buffer: maskBuffer });
        }
        if (maskMirrorBuffer) {
          uploads.push({ path: `${basePath}/mask_mirror.png`, buffer: maskMirrorBuffer });
        }

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
            final_url: urls["clean"],
            final_mirror_url: urls["clean_mirror"],
            clean_url: urls["clean"],
            mask_url: urls["mask"] || null,
            mask_mirror_url: urls["mask_mirror"] || null,
            room_color_map: roomColorMap || {},
            prompt_version: PROMPT_VERSION,
            processing_time_ms: processingTime,
            updated_at: new Date().toISOString(),
          })
          .eq("complex_no", complexNo)
          .eq("pyeong_no", Number(pyeongNo));

        send("complete", {
          progress: 100,
          message: "도면 생성 완료!",
          finalUrl: urls["clean"],
          finalMirrorUrl: urls["clean_mirror"],
          maskUrl: urls["mask"] || null,
          maskMirrorUrl: urls["mask_mirror"] || null,
          roomColorMap: roomColorMap || null,
          processingTimeMs: processingTime,
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

// DELETE: 기존 캐시 전체 삭제 (프롬프트 변경 시 사용, 관리자 전용)
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  const supabase = createAdminClient();

  // 구버전 또는 전체 삭제
  const { data: rows } = await supabase
    .from("generated_floorplans")
    .select("complex_no, pyeong_no")
    .or(`prompt_version.is.null,prompt_version.lt.${PROMPT_VERSION}`);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ deleted: 0, message: "삭제할 구버전 캐시 없음" });
  }

  // Storage 파일 삭제
  const storagePaths: string[] = [];
  for (const row of rows) {
    storagePaths.push(
      `floorplans/${row.complex_no}/${row.pyeong_no}/clean.png`,
      `floorplans/${row.complex_no}/${row.pyeong_no}/clean_mirror.png`
    );
  }

  if (storagePaths.length > 0) {
    await supabase.storage.from("uploads").remove(storagePaths);
  }

  // DB 행 삭제
  await supabase
    .from("generated_floorplans")
    .delete()
    .or(`prompt_version.is.null,prompt_version.lt.${PROMPT_VERSION}`);

  return NextResponse.json({
    deleted: rows.length,
    message: `${rows.length}개 구버전 도면 캐시 삭제 완료`,
  });
}
