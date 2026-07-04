/**
 * POST /api/community/posts/[postId]/like — 좋아요 토글.
 * community_post_likes(마이그레이션 20260704000000) + community_posts.like_count 동기화.
 * 테이블 미생성 환경에서는 503 NOT_READY (UI가 조용히 비활성화).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(
  _req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const postId = params.postId;

  // 기존 좋아요 확인 → 토글
  const { data: existing, error: selErr } = await admin
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (selErr) {
    // 테이블 미생성(42P01/PGRST205) 등 — 기능 비활성 신호
    return NextResponse.json({ error: "NOT_READY", hint: selErr.message }, { status: 503 });
  }

  let liked: boolean;
  if (existing) {
    await admin.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    liked = false;
  } else {
    const { error: insErr } = await admin
      .from("community_post_likes")
      .insert({ post_id: postId, user_id: user.id });
    if (insErr && !insErr.message.includes("duplicate")) {
      return NextResponse.json({ error: "LIKE_FAILED", hint: insErr.message }, { status: 500 });
    }
    liked = true;
  }

  // like_count 재계산 (정확성 우선 — 카운터 드리프트 방지)
  const { count } = await admin
    .from("community_post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  const likeCount = count ?? 0;
  await admin.from("community_posts").update({ like_count: likeCount }).eq("id", postId);

  return NextResponse.json({ liked, likeCount });
}
