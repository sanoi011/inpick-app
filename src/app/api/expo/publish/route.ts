import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildCatalogEstimate,
  isExpoEstimateOverrides,
} from "@/lib/expo/estimate";
import { isExpoBoothScene } from "@/lib/expo/scene";
import { isExpoEventInfo } from "@/lib/expo/event-rules";
import { canPublishProposal } from "@/lib/expo/proposal";
import type { ExpoConfirmedDimensions } from "@/lib/expo/footprint";

/**
 * POST /api/expo/publish — 시공사 제안 발행 (명시적 인간 행위).
 * 서버가 저장된 행(씬·확정치수·전기·검토단가)에서 견적을 재계산해
 * 게이트를 검증한 뒤 스냅샷을 저장한다 — 클라이언트 금액을 믿지 않는다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { projectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return NextResponse.json({ error: "PROJECT_ID_REQUIRED" }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from("expo_projects")
    .select("id, scene, confirmed_dimensions, event, estimate_overrides")
    .eq("id", projectId)
    .maybeSingle();
  if (readError || !row) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const scene = isExpoBoothScene(row.scene) ? row.scene : null;
  const confirmed =
    (row.confirmed_dimensions as ExpoConfirmedDimensions | null) ?? null;
  const event = isExpoEventInfo(row.event) ? row.event : null;
  const overrides = isExpoEstimateOverrides(row.estimate_overrides)
    ? row.estimate_overrides
    : null;

  let estimate = null;
  try {
    estimate = confirmed
      ? buildCatalogEstimate(scene, confirmed, {
          powerKw: event?.powerKw ?? null,
          overrides,
        })
      : null;
  } catch {
    estimate = null;
  }

  const gate = canPublishProposal(estimate, Boolean(confirmed));
  if (!gate.ok) {
    return NextResponse.json(
      { error: "PUBLISH_GATE", reason: gate.reason, detail: gate.detail },
      { status: 409 },
    );
  }

  const proposal = {
    publishedAt: new Date().toISOString(),
    sceneRevision: scene?.revision ?? 0,
    estimate,
  };
  const { error: updateError } = await supabase
    .from("expo_projects")
    .update({ proposal })
    .eq("id", projectId);
  if (updateError) {
    console.error("[expo-publish] failed:", updateError.message);
    return NextResponse.json({ error: "PUBLISH_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ proposal });
}
