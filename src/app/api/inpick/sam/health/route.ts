import { NextResponse } from "next/server";
import { getSamServiceStatus } from "@/lib/inpick/sam-runpod-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSamServiceStatus();
  const activeEngine = status.sam3_1_configured
    ? "sam3.1"
    : status.sam2_1_configured
      ? "sam2.1"
      : null;
  return NextResponse.json({
    ok: status.sam3_1_configured || status.sam2_1_configured,
    active_engine: activeEngine,
    preferred_engine: activeEngine || "sam3.1",
    pending_upgrade_engine: activeEngine === "sam2.1" ? "sam3.1" : null,
    fallback_engine: "sam2.1",
    ...status,
  });
}
