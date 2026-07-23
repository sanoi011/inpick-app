import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface LockedStorageObject {
  storage_bucket: string;
  original_storage_path: string;
}

async function captureLockedStorageObjects(
  userId: string,
  projectIds: string[],
): Promise<LockedStorageObject[]> {
  if (projectIds.length === 0) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locked_design_assets")
      .select("storage_bucket, original_storage_path")
      .eq("user_id", userId)
      .in("project_id", projectIds);
    if (error) {
      console.warn("[consumer-projects] locked storage lookup skipped:", error.message);
      return [];
    }
    return (data ?? []) as LockedStorageObject[];
  } catch (error) {
    console.warn(
      "[consumer-projects] locked storage lookup unavailable:",
      error instanceof Error ? error.message : "unknown",
    );
    return [];
  }
}

async function cleanupDeletedProjectArtifacts(
  supabase: SupabaseClient,
  userId: string,
  projectIds: string[],
  storageObjects: LockedStorageObject[],
) {
  if (projectIds.length === 0) return;

  // 신규 FK migration 적용 전에도 삭제된 프로젝트의 Step2 evidence가 남지 않게 한다.
  const { error: outputsError } = await supabase
    .from("design_outputs")
    .delete()
    .eq("user_id", userId)
    .in("project_id", projectIds);
  if (outputsError) {
    console.error("[consumer-projects] design output cleanup failed:", outputsError.message);
  }

  if (storageObjects.length === 0) return;
  try {
    const admin = createAdminClient();
    const pathsByBucket = new Map<string, string[]>();
    for (const item of storageObjects) {
      const paths = pathsByBucket.get(item.storage_bucket) ?? [];
      paths.push(item.original_storage_path);
      pathsByBucket.set(item.storage_bucket, paths);
    }
    for (const [bucket, paths] of Array.from(pathsByBucket.entries())) {
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await admin.storage
          .from(bucket)
          .remove(paths.slice(offset, offset + 100));
        if (error) {
          console.error("[consumer-projects] private image cleanup failed:", error.message);
        }
      }
    }
  } catch (error) {
    console.error(
      "[consumer-projects] private image cleanup unavailable:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

// GET: 단일 또는 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");
  const userId = request.nextUrl.searchParams.get("userId");

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  if (id) {
    const { data, error } = await supabase
      .from("consumer_projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ project: data });
  }

  if (userId) {
    // 본인 프로젝트만 조회 가능
    const { data, error } = await supabase
      .from("consumer_projects")
      .select("id, user_id, status, address, drawing_id, estimate_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: "프로젝트 목록 조회 실패" }, { status: 500 });
    }
    return NextResponse.json({ projects: data || [] });
  }

  return NextResponse.json({ error: "id 또는 userId가 필요합니다." }, { status: 400 });
}

// POST: upsert (id 기준)
export async function POST(request: NextRequest) {
  const supabase = createClient();

  // 소비자 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, address, drawingId, floorPlanImageUrl, estimateId, designState, renderingState, estimateState, rfqState } = body;
    const userId = user.id;

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    // 기존 프로젝트가 있으면 소유권 확인
    const { data: existing } = await supabase
      .from("consumer_projects")
      .select("user_id")
      .eq("id", id)
      .single();

    if (existing && existing.user_id !== userId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const record: Record<string, unknown> = {
      id,
      user_id: userId,
      status: status || "ADDRESS_SELECTION",
      updated_at: new Date().toISOString(),
    };

    if (address !== undefined) record.address = address;
    if (drawingId !== undefined) record.drawing_id = drawingId;
    if (floorPlanImageUrl !== undefined) record.floor_plan_image_url = floorPlanImageUrl;
    if (estimateId !== undefined) record.estimate_id = estimateId;
    if (designState !== undefined) record.design_state = designState;
    if (renderingState !== undefined) record.rendering_state = renderingState;
    if (estimateState !== undefined) record.estimate_state = estimateState;
    if (rfqState !== undefined) record.rfq_state = rfqState;

    const { data, error } = await supabase
      .from("consumer_projects")
      .upsert(record, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트 저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ project: data });
  } catch {
    return NextResponse.json({ error: "프로젝트 저장 중 오류" }, { status: 500 });
  }
}

// DELETE: 프로젝트 삭제
export async function DELETE(request: NextRequest) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const id = request.nextUrl.searchParams.get("id");
    const idsParam = request.nextUrl.searchParams.get("ids");

    // 배치 삭제: ?ids=a,b,c
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
      if (ids.length === 0) {
        return NextResponse.json({ error: "삭제할 id가 없습니다." }, { status: 400 });
      }
      const storageObjects = await captureLockedStorageObjects(user.id, ids);
      const { data, error } = await supabase
        .from("consumer_projects")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        console.error("Batch delete error:", error);
        return NextResponse.json({ error: "프로젝트 삭제 실패" }, { status: 500 });
      }

      const deletedIds = (data || []).map((r) => r.id as string);
      if (deletedIds.length > 0) {
        await cleanupDeletedProjectArtifacts(
          supabase,
          user.id,
          deletedIds,
          storageObjects,
        );
        await supabase
          .from("estimates")
          .update({ consumer_project_id: null })
          .in("consumer_project_id", deletedIds)
          .then(() => {});
      }

      return NextResponse.json({
        success: true,
        deletedIds,
        deletedCount: deletedIds.length,
        requestedCount: ids.length,
      });
    }

    // 단건 삭제: ?id=X (기존 호환)
    if (!id) {
      return NextResponse.json({ error: "id 또는 ids가 필요합니다." }, { status: 400 });
    }

    const storageObjects = await captureLockedStorageObjects(user.id, [id]);
    const { data, error } = await supabase
      .from("consumer_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    await cleanupDeletedProjectArtifacts(supabase, user.id, [id], storageObjects);
    await supabase
      .from("estimates")
      .update({ consumer_project_id: null })
      .eq("consumer_project_id", id)
      .then(() => {});

    return NextResponse.json({ success: true, deletedId: data.id });
  } catch (err) {
    console.error("Delete consumer project error:", err);
    return NextResponse.json({ error: "프로젝트 삭제 중 오류" }, { status: 500 });
  }
}

// PATCH: 부분 업데이트
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  // 소비자 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    // snake_case 변환
    const record: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) record.status = updates.status;
    if (updates.address !== undefined) record.address = updates.address;
    if (updates.drawingId !== undefined) record.drawing_id = updates.drawingId;
    if (updates.floorPlanImageUrl !== undefined) record.floor_plan_image_url = updates.floorPlanImageUrl;
    if (updates.estimateId !== undefined) record.estimate_id = updates.estimateId;
    if (updates.designState !== undefined) record.design_state = updates.designState;
    if (updates.renderingState !== undefined) record.rendering_state = updates.renderingState;
    if (updates.estimateState !== undefined) record.estimate_state = updates.estimateState;
    if (updates.rfqState !== undefined) record.rfq_state = updates.rfqState;

    const { data, error } = await supabase
      .from("consumer_projects")
      .update(record)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "프로젝트 업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ project: data });
  } catch {
    return NextResponse.json({ error: "프로젝트 업데이트 중 오류" }, { status: 500 });
  }
}
