/**
 * POST /api/inpick/render-commercial-zone
 *
 * 상가·사무실 zone별 이미지 생성 — propertyId/floorplan 요구 X.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §5-3
 *
 * 핵심 차이 (render-photo-style 대비):
 *  - businessType + zone 필수
 *  - requiredSystems(급배수/후드/소방 등)를 prompt에 HARD FACTS로 반영
 *  - zone 유형별(홀/카운터/주방/화장실/창고/파사드) 프롬프트 템플릿 분기
 */
import { NextRequest, NextResponse } from "next/server";
import { hasOpenAIKey, getOpenAIKey } from "@/lib/inpick/openai-env";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";
import {
  enforceConsume,
  refundCredits,
  CreditError,
} from "@/lib/inpick/credit-policy";
import { enforceRateLimit, RateLimitError } from "@/lib/inpick/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type BusinessType =
  | "cafe"
  | "restaurant"
  | "retail"
  | "beauty_salon"
  | "clinic"
  | "academy"
  | "office"
  | "gym"
  | "bakery"
  | "bar"
  | "studio"
  | "other_commercial";

type ZoneType =
  | "main_hall"
  | "counter"
  | "kitchen"
  | "storage"
  | "restroom"
  | "treatment_room"
  | "fitting_room"
  | "office_room"
  | "front_facade"
  | "signage"
  | "corridor"
  | "other";

interface RenderCommercialZoneBody {
  businessType: BusinessType;
  totalAreaM2: number;
  zone: {
    id?: string;
    nameKo: string;
    type?: ZoneType;
    areaM2?: number;
    requiredSystems?: string[];
  };
  stylePrompt: string;
  negativePrompt?: string;
  budgetTier?: "basic" | "standard" | "premium";
  quality?: "low" | "medium" | "high";
}

const OPENAI_BASE = "https://api.openai.com/v1";

const BUSINESS_LABEL_EN: Record<BusinessType, string> = {
  cafe: "specialty cafe",
  restaurant: "casual restaurant",
  retail: "retail store",
  beauty_salon: "beauty salon / hair studio",
  clinic: "medical clinic",
  academy: "education academy / hagwon",
  office: "small office",
  gym: "fitness studio / gym",
  bakery: "bakery",
  bar: "wine bar / pub",
  studio: "photo / yoga studio",
  other_commercial: "small commercial space",
};

const ZONE_GUIDANCE_EN: Record<ZoneType, string> = {
  main_hall:
    "Customer-facing main hall: clear circulation, suitable seating density, focal point near entrance.",
  counter:
    "Counter / POS area: ergonomic working height, customer-facing display, backbar storage.",
  kitchen:
    "Working kitchen: stainless work surfaces, exhaust hood, water/drain access, hygienic finishes.",
  storage: "Back-of-house storage: shelving, durable flooring, minimal decor.",
  restroom: "Restroom: waterproofing, ventilation, accessible fixtures, anti-slip floor.",
  treatment_room:
    "Treatment / consultation room: privacy, soft lighting, professional yet calm atmosphere.",
  fitting_room: "Fitting room: mirror placement, soft lighting, privacy curtain or door.",
  office_room:
    "Office work area: desk layout, daylight, network/power access, sound absorption.",
  front_facade: "Exterior facade: signage, glazing, branded entrance, sidewalk continuity.",
  signage:
    "Signage / branding focal: brand-forward typography, illumination, exterior visibility at night.",
  corridor: "Corridor / connection: comfortable width, lighting continuity, way-finding clarity.",
  other: "Multi-purpose zone matching the business identity.",
};

function buildPrompt(b: RenderCommercialZoneBody): string {
  const lines: string[] = [];
  const businessEn = BUSINESS_LABEL_EN[b.businessType] || "small commercial space";
  const zoneType = b.zone.type || "other";
  const zoneGuide = ZONE_GUIDANCE_EN[zoneType] || ZONE_GUIDANCE_EN.other;

  lines.push("Photorealistic Korean commercial interior concept image, 8K, editorial quality.");
  lines.push("");
  lines.push("BUSINESS FACTS:");
  lines.push(`- Business type: ${businessEn}`);
  lines.push(`- Total area: ${b.totalAreaM2} m² (${(b.totalAreaM2 / 3.305785).toFixed(1)} pyung)`);
  lines.push(`- Target zone: ${b.zone.nameKo}${b.zone.type ? ` (${b.zone.type})` : ""}`);
  if (b.zone.areaM2) {
    lines.push(`- Zone area: ${b.zone.areaM2} m² (${(b.zone.areaM2 / 3.305785).toFixed(1)} pyung)`);
  }
  if (b.zone.requiredSystems && b.zone.requiredSystems.length > 0) {
    lines.push(`- Required systems: ${b.zone.requiredSystems.join(", ")}`);
  }

  lines.push("");
  lines.push("ZONE GUIDANCE:");
  lines.push(zoneGuide);

  if (b.budgetTier) {
    const tier = {
      basic: "Budget-friendly finishes (vinyl flooring, painted walls, basic LED panels).",
      standard:
        "Mid-range finishes (engineered wood or LVT, accent wall, track lighting, branded touches).",
      premium:
        "Premium finishes (natural stone or wide-plank wood, designer fixtures, indirect lighting, custom millwork).",
    }[b.budgetTier];
    if (tier) {
      lines.push("");
      lines.push("BUDGET TIER:");
      lines.push(tier);
    }
  }

  lines.push("");
  lines.push("STYLE DIRECTION:");
  lines.push(b.stylePrompt);

  if (b.negativePrompt) {
    lines.push("");
    lines.push("AVOID: " + b.negativePrompt);
  }

  lines.push("");
  lines.push("MUST NOT SHOW:");
  lines.push("- Apartment bedroom or residential closet layout");
  lines.push("- Oversized kitchen occupying a customer hall");
  lines.push("- Unrealistic structural elements (floating walls, impossible columns)");
  lines.push("- Watermarks, text overlays, brand logos");

  lines.push("");
  lines.push("COMPOSITION:");
  lines.push(
    "- Realistic eye-level perspective. Soft mixed lighting (natural daylight + warm interior).",
  );
  lines.push(
    "- Show usable furniture, signage hints, and finishes appropriate for the business type.",
  );

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;
  try {
    const body = (await req.json()) as RenderCommercialZoneBody;

    // ─── validation (토큰 차감 전) ───────────────────────────
    if (!body.businessType) {
      return NextResponse.json(
        { error: "missing_business_type", hint: "businessType이 필요합니다." },
        { status: 400 },
      );
    }
    if (!body.zone || !body.zone.nameKo) {
      return NextResponse.json(
        { error: "missing_zone", hint: "zone.nameKo가 필요합니다." },
        { status: 400 },
      );
    }
    if (!body.totalAreaM2 || body.totalAreaM2 <= 0) {
      return NextResponse.json(
        { error: "missing_total_area", hint: "totalAreaM2(>0)가 필요합니다." },
        { status: 400 },
      );
    }
    if (!body.stylePrompt || body.stylePrompt.trim().length < 5) {
      return NextResponse.json(
        {
          error: "missing_style_prompt",
          hint: "stylePrompt가 5자 이상 필요합니다.",
        },
        { status: 400 },
      );
    }
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { error: "openai_not_configured", hint: "OPENAI_API_KEY 미설정" },
        { status: 500 },
      );
    }

    // ─── 토큰 차감 ───────────────────────────────────────
    try {
      charge = await enforceConsume("render-room", {
        feature: "render-commercial-zone",
        businessType: body.businessType,
        zoneType: body.zone.type,
        zoneName: body.zone.nameKo,
        quality: body.quality ?? "low",
      });
    } catch (e) {
      if (e instanceof CreditError) {
        return NextResponse.json(
          {
            error: e.code,
            hint:
              e.code === "UNAUTHENTICATED"
                ? "로그인이 필요합니다"
                : e.code === "INSUFFICIENT_CREDITS"
                  ? "토큰이 부족합니다 — 충전 후 다시 시도해주세요"
                  : "요청을 처리할 수 없습니다",
            ...e.details,
          },
          { status: e.status },
        );
      }
      throw e;
    }

    try {
      await enforceRateLimit(charge.userId, "render-room");
    } catch (e) {
      if (e instanceof RateLimitError) {
        await refundCredits(
          charge.userId,
          charge.charged,
          "rate-limited:render-commercial-zone",
        ).catch(() => {});
        return NextResponse.json(
          {
            error: "RATE_LIMIT_EXCEEDED",
            hint: `요청이 너무 많습니다 — ${Math.ceil(e.retryAfterSec / 60)}분 후 다시 시도해주세요`,
            retryAfterSec: e.retryAfterSec,
          },
          { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } },
        );
      }
      throw e;
    }

    // ─── OpenAI generations ────────────────────────────
    const compiledPrompt = buildPrompt(body);
    const apiKey = getOpenAIKey()!;
    const size = "1024x1024";
    const quality = body.quality || "low";
    const costMap: Record<string, number> = { low: 0.01, medium: 0.04, high: 0.17 };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    let imageBase64: string | null = null;
    let usedModel = "";
    const errors: string[] = [];
    try {
      for (const modelName of ["gpt-image-2", "gpt-image-1"]) {
        const res = await fetch(`${OPENAI_BASE}/images/generations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            prompt: compiledPrompt,
            size,
            quality,
            n: 1,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) {
            imageBase64 = b64;
            usedModel = modelName;
            break;
          }
          errors.push(`${modelName}: no image data`);
          continue;
        }
        const errText = await res.text();
        const lower = errText.toLowerCase();
        const recoverable =
          res.status === 404 ||
          lower.includes("model_not_found") ||
          lower.includes("does not have access") ||
          lower.includes("invalid_value");
        errors.push(`${modelName} ${res.status}: ${errText.slice(0, 200)}`);
        if (!recoverable) {
          throw new Error(
            `OpenAI generations 실패 (non-recoverable) — ${errors.join(" | ")}`,
          );
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!imageBase64) {
      if (charge) {
        await refundCredits(
          charge.userId,
          charge.charged,
          "openai-failed:render-commercial-zone",
        ).catch(() => {});
      }
      return NextResponse.json(
        {
          error: "provider_error",
          hint: "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
          details: errors.join(" | "),
        },
        { status: 502 },
      );
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`;
    let storedUrl = dataUrl;
    try {
      storedUrl = await ensureStorageUrl(dataUrl, {
        roomName: `commercial-${body.businessType}-${(body.zone.type || body.zone.nameKo || "zone")
          .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
          .slice(0, 24)}`,
      });
    } catch (err) {
      console.warn("[render-commercial-zone] storage upload failed, returning base64:", err);
    }

    return NextResponse.json({
      imageUrl: storedUrl,
      prompt: compiledPrompt,
      model: usedModel,
      backend: "openai",
      costUsd: costMap[quality] ?? 0.01,
      mode: "commercial",
      zone: { id: body.zone.id, nameKo: body.zone.nameKo, type: body.zone.type },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[render-commercial-zone] error:", msg);
    if (charge) {
      await refundCredits(
        charge.userId,
        charge.charged,
        `internal:render-commercial-zone:${msg.slice(0, 80)}`,
      ).catch(() => {});
    }
    return NextResponse.json({ error: "internal_error", hint: msg }, { status: 500 });
  }
}
