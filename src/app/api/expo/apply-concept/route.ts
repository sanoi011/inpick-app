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

const VISION_PROMPT = `이 전시부스 AI 컨셉 이미지를 분석해, 이미지에 실제로 보이는 부스 구성 요소를 아래 카탈로그 id로만 매핑해 JSON으로 답하세요.
카탈로그: info_counter(안내 카운터/리셉션 데스크), display_showcase(키 큰 유리 쇼케이스), product_table(제품 전시 테이블), signage_tower(수직 사이니지 타워/기둥), graphic_wall(대형 백월/그래픽 벽), lightbox_panel(라이트박스 패널), brochure_stand(브로슈어 거치대).
형식: {"components":[{"catalogId":"...","count":정수}]}
규칙: 보이는 것만, 종류당 최대 4개. 확실하지 않으면 제외. 다른 텍스트 금지.`;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { imageUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
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

    // ② 비전 제안 — 실패해도 팔레트/텍스처만으로 반영 가능
    let components: Array<{ catalogId: string; count: number }> = [];
    if (hasOpenAIKey()) {
      try {
        const vision = await analyzeImageVision({
          imageUrl,
          prompt: VISION_PROMPT,
          responseFormat: "json_object",
          reasoningEffort: "low",
          maxOutputTokens: 2_000,
          requestTimeoutMs: 90_000,
        });
        const parsed = JSON.parse(vision.content) as {
          components?: Array<{ catalogId?: unknown; count?: unknown }>;
        };
        components = (parsed.components ?? [])
          .filter(
            (entry): entry is { catalogId: string; count: number } =>
              typeof entry.catalogId === "string" &&
              CATALOG_WHITELIST.has(entry.catalogId) &&
              typeof entry.count === "number" &&
              entry.count > 0,
          )
          .map((entry) => ({
            catalogId: entry.catalogId,
            count: Math.min(Math.floor(entry.count), 4),
          }))
          .slice(0, 7);
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
