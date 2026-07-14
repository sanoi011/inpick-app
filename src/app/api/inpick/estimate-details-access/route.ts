import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreditError,
  enforceConsume,
} from "@/lib/inpick/credit-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeProjectId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return id;
}

async function getUserId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

async function hasAccess(userId: string, projectId: string): Promise<boolean> {
  const marker = `estimate-details:${projectId}`;
  const admin = createAdminClient();
  const { data } = await admin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "USE")
    .like("description", `%${marker}%`)
    .limit(1);
  return (data?.length || 0) > 0;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ granted: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const projectId = normalizeProjectId(req.nextUrl.searchParams.get("projectId"));
  if (!projectId) {
    return NextResponse.json({ granted: false, error: "INVALID_PROJECT_ID" }, { status: 400 });
  }
  return NextResponse.json({ granted: await hasAccess(userId, projectId) });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ granted: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { projectId?: unknown };
  const projectId = normalizeProjectId(body.projectId);
  if (!projectId) {
    return NextResponse.json({ granted: false, error: "INVALID_PROJECT_ID" }, { status: 400 });
  }

  if (await hasAccess(userId, projectId)) {
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
