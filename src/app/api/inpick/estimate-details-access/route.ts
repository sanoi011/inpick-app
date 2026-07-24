import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  CreditError,
  enforceConsume,
} from "@/lib/inpick/credit-policy";
import {
  hasEstimateBundleAccess,
  normalizeEstimateAccessId,
} from "@/lib/inpick/estimate-bundle-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ granted: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const projectId = normalizeEstimateAccessId(req.nextUrl.searchParams.get("projectId"));
  if (!projectId) {
    return NextResponse.json({ granted: false, error: "INVALID_PROJECT_ID" }, { status: 400 });
  }
  return NextResponse.json({ granted: await hasEstimateBundleAccess(userId, projectId) });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ granted: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { projectId?: unknown };
  const projectId = normalizeEstimateAccessId(body.projectId);
  if (!projectId) {
    return NextResponse.json({ granted: false, error: "INVALID_PROJECT_ID" }, { status: 400 });
  }

  if (await hasEstimateBundleAccess(userId, projectId)) {
    return NextResponse.json({ granted: true, charged: 0, reused: true });
  }

  try {
    const charge = await enforceConsume("unlock-estimate-details", {
      projectId,
      accessKey: `estimate-details:${projectId}`,
    });
    return NextResponse.json({
      granted: true,
      charged: charge.charged,
      balance: charge.balance,
      reused: false,
    });
  } catch (error) {
    if (error instanceof CreditError) {
      return NextResponse.json(
        { granted: false, error: error.code, ...error.details },
        { status: error.status },
      );
    }
    throw error;
  }
}
