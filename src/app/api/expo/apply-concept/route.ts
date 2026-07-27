import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { analyzeImageVision } from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { fetchSafe } from "@/lib/expo/server/safe-fetch";
import { ImageInputError } from "@/lib/inpick/storage/image-storage";

/**
 * POST /api/expo/apply-concept — 생성된 컨셉 이미지를 3D에 반영하기 위한
 * 분석: ① 대표 팔레트 추출(sharp), ② 비전으로 이미지 속 요소를 카탈로그에
 * 매핑한 "제안" 반환. 배치 자체는 클라이언트가 일반 씬 연산으로 적용하며
 * 되돌리기 가능 — geometry truth는 항상 씬이다 (자동 확정 없음).
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const CATALOG_WHITELIST = new Set([
  "info_counter",
  "display_showcase",
  "product_table",
  "signage_tower",
  "graphic_wall",
  "lightbox_panel",
  "brochure_stand",
]);

function buildVisionPrompt(widthM: number, depthM: number): string {
  return `이 전시부스 컨셉 이미지를 정밀 분석해, 이미지 속 사물들의 "배치와 매스"를 부스 평면 좌표로 재구성하세요. 부스 바닥은 가로 ${widthM}m × 깊이 ${depthM}m이고, 카메라는 전면 통로에서 부스를 바라봅니다.
각 사물을 아래 카탈로그 id로 매핑하고, 평면 좌표와 크기를 추정하세요:
- x: 0=부스 왼쪽 끝, 1=오른쪽 끝 (이미지에서 보이는 좌우 위치)
- z: 0=뒷벽, 1=전면 통로 (이미지에서 멀수록 0에 가까움)
- widthM/depthM: 사물의 평면 크기(m) — 부스 크기와 비율로 추정
- rotation: 0(전면향) 또는 90(측면향)
카탈로그: info_counter(안내 카운터/리셉션 데스크, 높이 1m), display_showcase(키 큰 유리 쇼케이스 1.8m), product_table(제품 전시 테이블 0.75m), signage_tower(수직 사이니지/기둥 2.4m), graphic_wall(대형 백월/그래픽 벽 2.4m), lightbox_panel(라이트박스 패널 2m), brochure_stand(브로슈어 거치대 1.5m).
형식: {"components":[{"catalogId":"...","x":0.5,"z":0.05,"widthM":4,"depthM":0.1,"rotation":0}]}
규칙: 이미지에 실제로 보이는 사물만(사람·소품·조명 제외), 종류당 최대 4개, 총 12개 이하. 벽/백월은 z를 0에 가깝게. 확실하지 않은 사물은 제외. JSON 외 다른 텍스트 금지.`;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { imageUrl?: unknown; boothWidthM?: unknown; boothDepthM?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
  const boothWidthM =
    typeof body.boothWidthM === "number" && body.boothWidthM > 0 && body.boothWidthM <= 60
      ? body.boothWidthM
      : 6;
  const boothDepthM =
    typeof body.boothDepthM === "number" && body.boothDepthM > 0 && body.boothDepthM <= 60
      ? body.boothDepthM
      : 3;
  if (!imageUrl.startsWith("https://")) {
    return NextResponse.json({ error: "IMAGE_URL_REQUIRED" }, { status: 400 });
  }

  try {
    // ① 팔레트 — 4픽셀 다운샘플 후 중복 제거 (최대 3색)
    const image = await fetchSafe(imageUrl, "image/*", 10_000_000);
    if (!image.contentType.startsWith("image/")) {
      return NextResponse.json({ error: "NOT_IMAGE" }, { status: 422 });
    }
    const raw = await sharp(image.buffer)
      .resize(2, 2, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer();
    const palette: string[] = [];
    for (let i = 0; i + 2 < raw.length; i += 3) {
      const hex = `#${[raw[i], raw[i + 1], raw[i + 2]]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
      if (!palette.includes(hex)) palette.push(hex);
    }

    // ② 비전 레이아웃 — 이미지 속 사물의 위치·크기·회전을 평면 좌표로 추출
    let components: Array<{
      catalogId: string;
      x?: number;
      z?: number;
      widthM?: number;
      depthM?: number;
      rotation?: number;
    }> = [];
    if (hasOpenAIKey()) {
      try {
        const vision = await analyzeImageVision({
          imageUrl,
          prompt: buildVisionPrompt(boothWidthM, boothDepthM),
          responseFormat: "json_object",
          reasoningEffort: "medium",
          maxOutputTokens: 4_000,
          requestTimeoutMs: 120_000,
        });
        const parsed = JSON.parse(vision.content) as {
          components?: Array<Record<string, unknown>>;
        };
        const numberOrUndefined = (value: unknown, min: number, max: number) =>
          typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
            ? value
            : undefined;
        components = (parsed.components ?? [])
          .filter(
            (entry) =>
              typeof entry.catalogId === "string" &&
              CATALOG_WHITELIST.has(entry.catalogId),
          )
          .map((entry) => ({
            catalogId: entry.catalogId as string,
            x: numberOrUndefined(entry.x, 0, 1),
            z: numberOrUndefined(entry.z, 0, 1),
            widthM: numberOrUndefined(entry.widthM, 0.2, 20),
            depthM: numberOrUndefined(entry.depthM, 0.1, 20),
            rotation: numberOrUndefined(entry.rotation, 0, 270),
          }))
          .slice(0, 12);
      } catch (visionCause) {
        console.warn(
          "[expo-apply-concept] vision failed, palette-only:",
          visionCause instanceof Error ? visionCause.message : visionCause,
        );
      }
    }

    return NextResponse.json({ palette: palette.slice(0, 3), components });
  } catch (cause) {
    if (cause instanceof ImageInputError) {
      return NextResponse.json({ error: "UNSAFE_URL" }, { status: 400 });
    }
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    console.error("[expo-apply-concept] failed:", message);
    return NextResponse.json({ error: "APPLY_FAILED", message }, { status: 502 });
  }
}
