/**
 * /api/admin/contractors/[contractorId]
 *
 * GET    — 사업자 상세 + 자식 데이터 카운트 + auth/community 연동 상태
 * PATCH  — is_active / is_verified / is_featured / admin_notes(metadata) 부분 갱신
 * DELETE — 영구 삭제 (?force=true 시 NOT NULL FK contracts 사전 정리)
 *
 * 인증: Bearer ADMIN_PASSWORD or base64 admin_token (lib/admin-auth)
 *
 * 참고 패턴: 숨고/오늘의집/네이버 스마트스토어/배민 사장님 광장의 사업자 어드민 공통 set —
 *   상태 토글 + 검증 마크 + 메모 + 영구 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 사업자 삭제 시 사전 정리할 NO ACTION FK
const NO_ACTION_CLEANUP: Array<{ table: string; column: string; action: "delete" | "set_null" }> = [
  // contracts.contractor_id는 NOT NULL → delete로 통일
  { table: "contracts", column: "contractor_id", action: "delete" },
];

// 영향도 카운트용 자식 (CASCADE 포함 — 사용자에게 미리 표시)
const IMPACT_TABLES = [
  "bids",
  "contracts",
  "contractor_projects",
  "contractor_reviews",
  "contractor_portfolio",
  "contractor_schedules",
  "invoices",
  "payment_records",
];

export async function GET(
  req: NextRequest,
  { params }: { params: { contractorId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const { data: contractor, error } = await admin
    .from("specialty_contractors")
    .select("*")
    .eq("id", params.contractorId)
    .maybeSingle();
  if (error || !contractor) {
    return NextResponse.json({ error: "contractor_not_found" }, { status: 404 });
  }

  // 영향도
  const impact: Record<string, number> = {};
  for (const table of IMPACT_TABLES) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("contractor_id", params.contractorId);
    impact[table] = count ?? 0;
  }

  // community 연동 — email로 auth.users 찾고 community_profiles 조회
  let community: { user_id: string; is_verified_contractor: boolean } | null = null;
  if (contractor.email) {
    const { data: authUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const matched = authUser?.users?.find((u) => u.email?.toLowerCase() === contractor.email?.toLowerCase());
    if (matched) {
      const { data: cp } = await admin
        .from("community_profiles")
        .select("user_id, is_verified_contractor")
        .eq("user_id", matched.id)
        .maybeSingle();
      community = cp ? { user_id: cp.user_id, is_verified_contractor: cp.is_verified_contractor } : { user_id: matched.id, is_verified_contractor: false };
    }
  }

  return NextResponse.json({ contractor, impact, community });
}

interface PatchBody {
  is_active?: boolean;
  is_verified?: boolean;
  is_featured?: boolean;
  admin_notes?: string;
  community_verified?: boolean;  // community_profiles.is_verified_contractor 토글
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { contractorId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const update: Record<string, unknown> = {};
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.is_verified !== undefined) update.is_verified = body.is_verified;
  if (body.is_featured !== undefined) update.is_featured = body.is_featured;

  // admin_notes는 metadata.admin_notes로 저장 (스키마 변경 회피)
  if (body.admin_notes !== undefined) {
    const { data: cur } = await admin.from("specialty_contractors").select("metadata").eq("id", params.contractorId).maybeSingle();
    const meta = ((cur?.metadata as Record<string, unknown>) ?? {});
    meta.admin_notes = body.admin_notes;
    meta.admin_notes_updated_at = new Date().toISOString();
    update.metadata = meta;
  }

  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    const { error } = await admin.from("specialty_contractors").update(update).eq("id", params.contractorId);
    if (error) {
      console.error("[admin/contractors PATCH] update failed:", error.message);
      return NextResponse.json({ error: "update_failed", hint: error.message }, { status: 500 });
    }
  }

  // community_verified 토글 — community_profiles.is_verified_contractor
  let communityResult: { applied: boolean; user_id?: string; hint?: string } | null = null;
  if (body.community_verified !== undefined) {
    // 사업자 이메일로 auth.users 찾기
    const { data: contractor } = await admin
      .from("specialty_contractors")
      .select("email")
      .eq("id", params.contractorId)
      .maybeSingle();
    if (!contractor?.email) {
      communityResult = { applied: false, hint: "사업자 이메일 없음 — 커뮤니티 연동 불가" };
    } else {
      const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const matched = authData?.users?.find((u) => u.email?.toLowerCase() === contractor.email?.toLowerCase());
      if (!matched) {
        communityResult = { applied: false, hint: "이 이메일로 가입된 auth.users 없음 — 사업자가 INPICK 계정 가입 후 재시도" };
      } else {
        // community_profiles upsert
        const { error: cpErr } = await admin.from("community_profiles").upsert(
          {
            user_id: matched.id,
            display_name: (matched.user_metadata?.full_name as string) || matched.email?.split("@")[0] || "사업자",
            role_label: "사업자",
            is_contractor: true,
            is_verified_contractor: body.community_verified,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (cpErr) {
          communityResult = { applied: false, hint: cpErr.message };
        } else {
          communityResult = { applied: true, user_id: matched.id };
        }
      }
    }
  }

  return NextResponse.json({ ok: true, communityResult });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { contractorId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const contractorId = params.contractorId;
  const force = req.nextUrl.searchParams.get("force") === "true";

  // 사전 정리 — NO ACTION FK
  const cleaned: Record<string, number> = {};
  if (force) {
    for (const c of NO_ACTION_CLEANUP) {
      if (c.action === "delete") {
        const { count, error } = await admin.from(c.table).delete({ count: "exact" }).eq(c.column, contractorId);
        if (error) {
          return NextResponse.json({ error: `cleanup_failed:${c.table}.${c.column}`, hint: error.message }, { status: 500 });
        }
        cleaned[`${c.table}.${c.column}`] = count ?? 0;
      }
    }
  }

  const { error: delErr } = await admin.from("specialty_contractors").delete().eq("id", contractorId);
  if (delErr) {
    return NextResponse.json(
      {
        error: "delete_failed",
        hint: delErr.message,
        suggestion: force ? undefined : "?force=true 로 재시도 시 NOT NULL FK(contracts) 자동 정리",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, contractorId, cleanedTables: force ? cleaned : undefined });
}
