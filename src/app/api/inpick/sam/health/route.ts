import { NextResponse } from "next/server";
import { getSamServiceStatus } from "@/lib/inpick/sam-runpod-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSamServiceStatus();
  const activeEngine = status.sam2_1_configured ? "sam2.1" : null;
  return NextResponse.json({
    ok: status.sam2_1_configured,
    active_engine: activeEngine,
    preferred_engine: "sam2.1",
    pending_upgrade_engine: null,
    fallback_engine: null,
    ...status,
  });
}
