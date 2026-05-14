/**
 * /api/admin/entitlements
 *
 * GET   ?userId=xxx — 해당 사용자 entitlement 목록
 * POST  { userId, type: "pdf_unlimited", expiresAt? } — 부여
 * DELETE { entitlementId, reason } — 해제 (revoke)
 *
 * 가이드: 2026-05-14 pricing v2 — 관리자가 사용자별 무제한 권한 부여 (추후 구독시스템 기반)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  grantPdfUnlimitedByAdmin,
  revokeEntitlement,
  listUserEntitlements,
} from "@/lib/inpick/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest): { ok: boolean; adminId?: string } {
  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (!auth || !expected) return { ok: false };
  if (auth !== `Bearer ${expected}`) return { ok: false };
  // adminId: 헤더로도 받을 수 있게
  return { ok: true, adminId: req.headers.get("x-admin-id") || "admin" };
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req).ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const list = await listUserEntitlements(userId);
  return NextResponse.json({ entitlements: list });
}

export async function POST(req: NextRequest) {
  const { ok, adminId } = checkAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    type?: string;
    expiresAt?: string | null;
    reason?: string;
  };
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (body.type !== "pdf_unlimited") {
    // 현재는 pdf_unlimited만 지원. 추후 subscription_pro 등 확장.
    return NextResponse.json(
      { error: "unsupported_type", hint: "현재는 pdf_unlimited만 지원" },
      { status: 400 },
    );
  }
  try {
    const result = await grantPdfUnlimitedByAdmin({
      userId: body.userId,
      adminId: adminId || "admin",
      expiresAt: body.expiresAt ?? null,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[admin/entitlements POST] grant failed:", e);
    return NextResponse.json(
      { error: "grant_failed", hint: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req).ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entitlementId =
    req.nextUrl.searchParams.get("entitlementId") || (await req.json().catch(() => ({}))).entitlementId;
  const reason = req.nextUrl.searchParams.get("reason") || "admin revoke";
  if (!entitlementId) {
    return NextResponse.json({ error: "entitlementId required" }, { status: 400 });
  }
  const ok = await revokeEntitlement(entitlementId, reason);
  return NextResponse.json({ ok });
}
