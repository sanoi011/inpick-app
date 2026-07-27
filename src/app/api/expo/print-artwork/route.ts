import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey, hasOpenAIKey } from "@/lib/inpick/openai-env";
import { createClient } from "@/lib/supabase/server";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";
import { fetchSafe } from "@/lib/expo/server/safe-fetch";
import {
  EXPO_PRINT_KIND_LABELS,
  EXPO_PRINT_SIZES,
  type ExpoPrintKind,
} from "@/lib/expo/print-items";

/**
 * POST /api/expo/print-artwork — 인쇄물 아트워크 "시안" 생성 (GPT Image 2).
 * 결과는 인쇄 발주 원본이 아닌 시안이다. 첨부 이미지가 있으면 edits로
 * 참조하고(로고·제품 등 실자산 반영), 없으면 프롬프트로만 생성한다.
 * 테스트 기간 무료, 로그인 필수.
 */

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OPENAI_BASE = "https://api.openai.com/v1";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasOpenAIKey()) {
    return NextResponse.json({ error: "EXPO_AI_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: {
    kind?: unknown;
    note?: unknown;
    boothPrompt?: unknown;
    brandColorHex?: unknown;
    refImageUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const kind = body.kind as ExpoPrintKind;
  if (!(kind in EXPO_PRINT_KIND_LABELS)) {
    return NextResponse.json({ error: "KIND_INVALID" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const boothPrompt =
    typeof body.boothPrompt === "string" ? body.boothPrompt.trim().slice(0, 300) : "";
  const brandColorHex =
    typeof body.brandColorHex === "string" && /^#[0-9a-f]{6}$/i.test(body.brandColorHex)
      ? body.brandColorHex.toLowerCase()
      : null;
  const refImageUrl =
    typeof body.refImageUrl === "string" && body.refImageUrl.startsWith("https://")
      ? body.refImageUrl
      : null;

  const KIND_EN: Record<ExpoPrintKind, string> = {
    graphic_wall: "large exhibition backwall graphic panel",
    lightbox_panel: "vertical illuminated lightbox graphic panel",
    signage_tower: "tall vertical signage tower graphic",
  };
  const prompt =
    `Flat 2D print-ready artwork design for a ${KIND_EN[kind]} at a trade-show booth. ` +
    `Full-bleed graphic composition viewed straight-on — NOT a 3D scene, NOT a booth photo, no mockup, no perspective. ` +
    (note ? `Design direction: ${note}. ` : "") +
    (boothPrompt ? `Overall booth concept: ${boothPrompt}. ` : "") +
    (brandColorHex ? `Brand primary color approximately ${brandColorHex}. ` : "") +
    (refImageUrl
      ? `Incorporate the attached reference image faithfully (logo/product) as the key visual. `
      : `Use abstract shapes and BLANK placeholder areas for logos — do NOT invent real brand logos or readable company names. `) +
    `Clean professional exhibition graphic design, high contrast, print quality.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 280_000);
  try {
    let b64: string | undefined;
    if (refImageUrl) {
      const ref = await fetchSafe(refImageUrl, "image/*", 10_000_000);
      const form = new FormData();
      form.append("model", "gpt-image-2");
      form.append(
        "image",
        new Blob([new Uint8Array(ref.buffer)], { type: "image/png" }),
        "reference.png",
      );
      form.append("prompt", prompt);
      form.append("size", EXPO_PRINT_SIZES[kind]);
      form.append("quality", "medium");
      const response = await fetch(`${OPENAI_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getOpenAIKey()}` },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`edits ${response.status}: ${(await response.text()).slice(0, 160)}`);
      }
      b64 = (await response.json()).data?.[0]?.b64_json;
    } else {
      const response = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getOpenAIKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt,
          size: EXPO_PRINT_SIZES[kind],
          quality: "medium",
          n: 1,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `generations ${response.status}: ${(await response.text()).slice(0, 160)}`,
        );
      }
      b64 = (await response.json()).data?.[0]?.b64_json;
    }
    if (!b64) throw new Error("이미지 데이터 없음");

    const dataUrl = `data:image/png;base64,${b64}`;
    let artworkUrl = dataUrl;
    try {
      artworkUrl = await ensureStorageUrl(dataUrl, {
        jobId: `expo-artwork-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
        roomName: `print-${kind}`,
        modelVersion: "gpt-image-2",
      });
    } catch {
      // 업로드 실패 시 data URL 반환 — 결과 보존
    }
    return NextResponse.json({ artworkUrl, label: "print_draft" });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? "생성 시간 초과"
        : cause instanceof Error
          ? cause.message
          : "UNKNOWN";
    console.error("[expo-print-artwork] failed:", message);
    return NextResponse.json({ error: "ARTWORK_FAILED", message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
