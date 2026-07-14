import { NextResponse } from "next/server";
import { getSamServiceStatus } from "@/lib/inpick/sam-runpod-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSamServiceStatus();
  return NextResponse.json({
    ok: status.sam3_1_configured || status.sam2_1_configured,
    preferred_engine: "sam3.1",
    fallback_engine: "sam2.1",
    ...status,
  });
}
