import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey, hasOpenAIKey } from "@/lib/inpick/openai-env";
import {
  CreditError,
  enforceConsume,
  refundCredits,
} from "@/lib/inpick/credit-policy";
import {
  ExpoConceptPromptError,
  buildBoothConceptPrompt,
} from "@/lib/expo/concept-prompt";
import { isExpoBoothScene } from "@/lib/expo/scene";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";

/**
 * POST /api/expo/concept — 부스 AI 컨셉 이미지 1장 (GPT Image 2).
 *
 * 본체 render-room과 동일한 패턴: enforceConsume로 토큰 차감(1개) →
 * OpenAI 호출 → 실패 시 즉시 환불. 결과는 컨셉 전용이며 geometry truth는
 * 항상 3D 씬에 남는다 (블루프린트 불변조건).
 */

export const runtime = "nodejs";
// gpt-image-2는 40~80초 소요
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OPENAI_BASE = "https://api.openai.com/v1";
const BOOTH_TYPES = ["inline", "corner", "peninsula", "island"] as const;

export async function POST(request: NextRequest) {
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;

  try {
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { error: "EXPO_AI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    let body: {
      widthM?: unknown;
      depthM?: unknown;
      wallHeightM?: unknown;
      boothType?: unknown;
      dimensionsConfirmed?: unknown;
      scene?: unknown;
      prompt?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const boothType = BOOTH_TYPES.includes(
      body.boothType as (typeof BOOTH_TYPES)[number],
    )
      ? (body.boothType as (typeof BOOTH_TYPES)[number])
      : null;
    if (!boothType) {
      return NextResponse.json({ error: "BOOTH_TYPE_INVALID" }, { status: 400 });
    }

    let prompt: string;
    try {
      prompt = buildBoothConceptPrompt({
        widthM: Number(body.widthM),
        depthM: Number(body.depthM),
        wallHeightM: Number(body.wallHeightM),
        boothType,
        dimensionsConfirmed: body.dimensionsConfirmed === true,
        scene: isExpoBoothScene(body.scene) ? body.scene : null,
        userPrompt: typeof body.prompt === "string" ? body.prompt : "",
      });
    } catch (cause) {
      if (cause instanceof ExpoConceptPromptError) {
        return NextResponse.json({ error: cause.code }, { status: 400 });
      }
      throw cause;
    }

    // 토큰 차감 (게스트 401 / 잔액 부족 402) — 실패 시 아래에서 환불
    charge = await enforceConsume("expo-concept", { feature: "expo_concept" });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    try {
      // 가로 사이즈 우선, 미지원 응답이면 정사각으로 폴백
      const errors: string[] = [];
      for (const size of ["1536x1024", "1024x1024"] as const) {
        const response = await fetch(`${OPENAI_BASE}/images/generations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getOpenAIKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt,
            size,
            quality: "medium",
            n: 1,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorText = await response.text();
          errors.push(`${size} ${response.status}: ${errorText.slice(0, 160)}`);
          if (response.status === 400) continue;
          break;
        }
        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json as string | undefined;
        if (!b64) {
          errors.push(`${size}: 응답에 이미지 데이터 없음`);
          continue;
        }
        // Storage 업로드 후 URL 반환 — 실패해도 생성 결과는 잃지 않는다
        const dataUrl = `data:image/png;base64,${b64}`;
        let imageUrl = dataUrl;
        try {
          imageUrl = await ensureStorageUrl(dataUrl, {
            jobId: `expo-${charge.userId.slice(0, 8)}-${Date.now().toString(36)}`,
            roomName: "booth-concept",
            modelVersion: "gpt-image-2",
          });
        } catch (storageCause) {
          console.error(
            "[expo-concept] storage upload failed, returning data URL:",
            storageCause instanceof Error ? storageCause.message : storageCause,
          );
        }
        return NextResponse.json({
          imageUrl,
          model: data.model || "gpt-image-2",
          label: "ai_concept",
          charged: charge.charged,
          balance: charge.balance,
        });
      }
      throw new Error(`GPT Image 2 실패 — ${errors.join(" | ")}`);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (cause) {
    if (charge && charge.charged > 0) {
      await refundCredits(
        charge.userId,
        charge.charged,
        "expo-concept 생성 실패 자동 환불",
      );
    }
    if (cause instanceof CreditError) {
      return NextResponse.json(
        { error: cause.code, details: cause.details },
        { status: cause.status },
      );
    }
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? "이미지 생성 시간 초과 (280초)"
        : cause instanceof Error
          ? cause.message
          : "UNKNOWN";
    console.error("[expo-concept] failed:", message);
    return NextResponse.json(
      { error: "CONCEPT_FAILED", message },
      { status: 502 },
    );
  }
}
