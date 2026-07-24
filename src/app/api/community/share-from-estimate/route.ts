/**
 * POST /api/community/share-from-estimate
 *
 * Step3 견적 → 개인정보 제거 스냅샷 + 게시글 자동 생성.
 * 가이드: §8-3
 *
 * Input:
 *   {
 *     projectId, estimateContextId?, estimateId?,
 *     boardSlug, title, content,
 *     visibility: { showTotalAmount, showTradeSummary, showDetailedLines, showBrandSku, showDesignImages }
 *   }
 *
 * 처리:
 *   1. 인증 + project owner 확인
 *   2. estimate + designOutputs 로드
 *   3. redactProjectForCommunity 실행
 *   4. community_public_snapshots INSERT
 *   5. community_posts INSERT
 *   6. (선택) attachments 동기화
 *   7. analytics event 기록
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { trackServerEventAsync } from "@/lib/analytics/track";
import {
  redactProjectForCommunity,
  buildCommunityPrivacyReport,
} from "@/lib/inpick/community/redaction";
import type { CommunityShareVisibilityV2 } from "@/types/community-v2";

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

interface RequestedDesignImage {
  imageUrl?: string;
  targetId?: string;
  label?: string;
  lockedAssetId?: string;
}

interface ShareBody {
  projectId?: string;
  estimateContextId?: string;
  estimateId?: string;
  boardSlug?: string;
  title?: string;
  content?: string;
  visibility?: Partial<CommunityShareVisibilityV2>;
  snapshotType?: "estimate_share" | "design_share";
  designImages?: RequestedDesignImage[];
}

interface DesignOutputRow {
  id: string;
  image_url: string;
  target_id: string;
  target_name: string;
  status: string;
  created_at: string;
}

interface LockedAssetPublishRow {
  id: string;
  design_output_id: string;
  storage_bucket: string;
  original_storage_path: string;
  mime_type: string;
}

async function publishLockedDesignImages(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  userId: string,
  projectId: string,
  assetIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean))).slice(0, 8);
  if (uniqueIds.length === 0) return new Map();

  const [{ data: assets, error: assetsError }, { data: grants, error: grantsError }] =
    await Promise.all([
      admin
        .from("locked_design_assets")
        .select(
          "id, design_output_id, storage_bucket, original_storage_path, mime_type",
        )
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .in("id", uniqueIds),
      admin
        .from("locked_design_access_grants")
        .select("asset_id")
        .eq("user_id", userId)
        .in("asset_id", uniqueIds),
    ]);
  if (assetsError || grantsError) {
    console.error(
      "[share-from-estimate] locked image lookup failed:",
      assetsError?.message || grantsError?.message,
    );
    return new Map();
  }

  const grantedIds = new Set(
    ((grants ?? []) as Array<{ asset_id: string }>).map((grant) => grant.asset_id),
  );
  const result = new Map<string, string>();

  for (const asset of (assets ?? []) as LockedAssetPublishRow[]) {
    if (!grantedIds.has(asset.id)) continue;
    const { data: privateImage, error: downloadError } = await admin.storage
      .from(asset.storage_bucket || "private-design-renders")
      .download(asset.original_storage_path);
    if (downloadError || !privateImage) {
      console.error(
        "[share-from-estimate] private design download failed:",
        downloadError?.message,
      );
      continue;
    }

    const extension =
      asset.mime_type === "image/png"
        ? "png"
        : asset.mime_type === "image/jpeg"
          ? "jpg"
          : "webp";
    const publicPath = `community/${userId}/projects/${projectId}/${asset.id}.${extension}`;
    const bytes = new Uint8Array(await privateImage.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("uploads")
      .upload(publicPath, bytes, {
        contentType: asset.mime_type || "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) {
      console.error(
        "[share-from-estimate] public design upload failed:",
        uploadError.message,
      );
      continue;
    }
    const { data: publicData } = admin.storage
      .from("uploads")
      .getPublicUrl(publicPath);
    if (publicData.publicUrl) result.set(asset.id, publicData.publicUrl);
  }

  return result;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ShareBody;
  if (!body.projectId || !body.boardSlug || !body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "missing_fields", hint: "projectId, boardSlug, title, content 필수" },
      { status: 400 },
    );
  }

  const visibility: CommunityShareVisibilityV2 = {
    showTotalAmount: body.visibility?.showTotalAmount ?? true,
    showTradeSummary: body.visibility?.showTradeSummary ?? true,
    showDetailedLines: body.visibility?.showDetailedLines ?? false,
    showBrandSku: body.visibility?.showBrandSku ?? false,
    showDesignImages: body.visibility?.showDesignImages ?? true,
  };
  const snapshotType = body.snapshotType ?? "estimate_share";

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  // 1) project 로드 + owner 확인
  const { data: project } = await admin
    .from("consumer_projects")
    .select("*")
    .eq("id", body.projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }
  const projRow = project as Record<string, unknown>;
  if (projRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) estimate 로드 (construction_estimates 우선, 없으면 estimates)
  let estimateRow: Record<string, unknown> | null = null;
  let estimateLines: Array<Record<string, unknown>> = [];

  if (body.estimateId) {
    const { data } = await admin
      .from("construction_estimates")
      .select("id, total_amount, precision_level")
      .eq("id", body.estimateId)
      .maybeSingle();
    estimateRow = (data as Record<string, unknown>) ?? null;
  }
  if (!estimateRow) {
    // consumer_project_id로 최신
    const { data } = await admin
      .from("construction_estimates")
      .select("id, total_amount, precision_level")
      .eq("consumer_project_id", body.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    estimateRow = (data as Record<string, unknown>) ?? null;
  }

  if (estimateRow) {
    const { data: lines } = await admin
      .from("construction_estimate_lines")
      .select(
        "trade_code, trade_name_ko, material_unit_price, labor_unit_price, total_amount, material_category_code, material_category_name, brand, sku, product_name, quantity, unit, included",
      )
      .eq("estimate_id", estimateRow.id as string);
    estimateLines = ((lines ?? []) as Array<Record<string, unknown>>).filter(
      (l) => l.included !== false,
    );
  }

  // 3) design_outputs 로드 — 실제 스키마(target_name/status 4종)를 사용한다.
  const { data: designs, error: designsError } = await admin
    .from("design_outputs")
    .select("id, image_url, target_id, target_name, status, created_at")
    .eq("project_id", body.projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (designsError) {
    console.error("[share-from-estimate] design output lookup failed:", designsError.message);
    return NextResponse.json(
      { error: "design_output_lookup_failed", hint: designsError.message },
      { status: 500 },
    );
  }

  const designRows = (designs ?? []) as DesignOutputRow[];
  const requestedImages = Array.isArray(body.designImages)
    ? body.designImages
        .filter((image) => image && typeof image === "object")
        .slice(0, 8)
    : [];
  const markerAssetIds = designRows.flatMap((row) =>
    row.image_url.startsWith("locked-design:")
      ? [row.image_url.slice("locked-design:".length)]
      : [],
  );
  const requestedAssetIds = requestedImages.flatMap((image) =>
    typeof image.lockedAssetId === "string" ? [image.lockedAssetId] : [],
  );
  const publicUrlByAsset = visibility.showDesignImages
    ? await publishLockedDesignImages(
        admin,
        user.id,
        body.projectId,
        requestedAssetIds.length > 0 ? requestedAssetIds : markerAssetIds,
      )
    : new Map<string, string>();
  const outputByTargetId = new Map<string, DesignOutputRow>();
  for (const row of designRows) {
    if (!outputByTargetId.has(row.target_id)) outputByTargetId.set(row.target_id, row);
  }

  const selectedSources =
    requestedImages.length > 0
      ? requestedImages
      : designRows.map((row) => ({
          imageUrl: row.image_url,
          targetId: row.target_id,
          label: row.target_name,
          lockedAssetId: row.image_url.startsWith("locked-design:")
            ? row.image_url.slice("locked-design:".length)
            : undefined,
        }));
  const seenPublishedUrls = new Set<string>();
  const designOutputs = selectedSources.flatMap((selection, index) => {
    const matchedOutput =
      (selection.targetId && outputByTargetId.get(selection.targetId)) ||
      designRows.find((row) => row.image_url === selection.imageUrl);
    const publicLockedUrl = selection.lockedAssetId
      ? publicUrlByAsset.get(selection.lockedAssetId)
      : undefined;
    const verifiedPublicUrl =
      matchedOutput?.image_url.startsWith("http")
        ? matchedOutput.image_url
        : undefined;
    const imageUrl = publicLockedUrl || verifiedPublicUrl;
    if (!imageUrl || seenPublishedUrls.has(imageUrl)) return [];
    seenPublishedUrls.add(imageUrl);
    return [{
      id: matchedOutput?.id || `selected-design-${index}`,
      imageUrl,
      targetLabel:
        selection.label || matchedOutput?.target_name || "디자인",
      style: null,
      isPublicAllowed: true,
    }];
  });

  // 4) redaction
  const basicInfo = (projRow.basic_info as Record<string, unknown>) ?? {};
  const redacted = redactProjectForCommunity({
    project: {
      id: body.projectId,
      projectMode: (projRow.project_mode as string) ?? "apartment",
      basicInfo: basicInfo as never,
      scope: (projRow.scope as string[]) ?? [],
      rooms: (projRow.rooms as string[]) ?? [],
    },
    estimate: {
      id: (estimateRow?.id as string) ?? "",
      totalAmount: estimateRow?.total_amount as number | undefined,
      precisionLevel: estimateRow?.precision_level as string | undefined,
      lines: estimateLines.map((l) => ({
        tradeCode: l.trade_code as string,
        tradeName: (l.trade_name_ko as string) ?? "",
        materialCost: Number(l.material_unit_price ?? 0),
        laborCost: Number(l.labor_unit_price ?? 0),
        totalAmount: Number(l.total_amount ?? 0),
        materialCategoryCode: (l.material_category_code as string | null) ?? null,
        materialCategoryName: (l.material_category_name as string | null) ?? null,
        brand: (l.brand as string | null) ?? null,
        sku: (l.sku as string | null) ?? null,
        productName: (l.product_name as string | null) ?? null,
        quantity: Number(l.quantity ?? 0),
        unit: (l.unit as string) ?? "ea",
      })),
    },
    designOutputs,
    visibility,
    snapshotType,
  });

  // 5) snapshot INSERT
  const { data: snapshotRow, error: snapErr } = await admin
    .from("community_public_snapshots")
    .insert({
      owner_id: user.id,
      source_project_id: body.projectId,
      source_estimate_context_id: body.estimateContextId ?? null,
      source_estimate_id: (estimateRow?.id as string) ?? null,
      snapshot_type: snapshotType,
      project_mode: redacted.projectMode,
      redacted_project: redacted.redactedProject,
      redacted_design_outputs: redacted.redactedDesignOutputs,
      redacted_estimate_summary: redacted.redactedEstimateSummary,
      redacted_trade_groups: redacted.redactedTradeGroups,
      redacted_material_summary: redacted.redactedMaterialSummary,
      privacy_report: redacted.privacyReport,
      visibility_options: redacted.visibilityOptions,
    })
    .select("id")
    .single();
  if (snapErr || !snapshotRow) {
    console.error("[share-from-estimate] snapshot insert fail:", snapErr?.message);
    return NextResponse.json({ error: "snapshot_failed" }, { status: 500 });
  }

  // 6) board 조회
  const { data: board } = await admin
    .from("community_boards")
    .select("id, allow_user_posts, require_admin_approval")
    .eq("slug", body.boardSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!board || !(board as { allow_user_posts: boolean }).allow_user_posts) {
    return NextResponse.json({ error: "board_unavailable" }, { status: 400 });
  }

  // 7) 본문 마스킹
  const titleClean = buildCommunityPrivacyReport(body.title.trim()).cleanText;
  const contentClean = buildCommunityPrivacyReport(body.content.trim()).cleanText;

  // 8) 게시글 INSERT
  const status = (board as { require_admin_approval: boolean }).require_admin_approval
    ? "pending_review"
    : "published";
  const { data: postRow, error: postErr } = await admin
    .from("community_posts")
    .insert({
      board_id: (board as { id: string }).id,
      author_id: user.id,
      author_role: "consumer",
      title: titleClean,
      content: contentClean,
      status,
      visibility: "public",
      post_type: snapshotType,
      project_mode: redacted.projectMode,
      source_project_id: body.projectId,
      source_estimate_context_id: body.estimateContextId ?? null,
      source_estimate_id: (estimateRow?.id as string) ?? null,
      public_snapshot_id: (snapshotRow as { id: string }).id,
      region_label: redacted.redactedProject.regionLabel,
      area_label: redacted.redactedProject.areaLabel,
      building_type: redacted.redactedProject.buildingType,
      business_type: redacted.redactedProject.businessType,
      tags: buildAutoTags(redacted),
    })
    .select("id")
    .single();
  if (postErr || !postRow) {
    console.error("[share-from-estimate] post insert fail:", postErr?.message);
    return NextResponse.json({ error: "post_failed" }, { status: 500 });
  }

  // 9) 디자인 이미지 첨부
  if (redacted.redactedDesignOutputs.length > 0) {
    const rows = redacted.redactedDesignOutputs.map((d, idx) => ({
      post_id: (postRow as { id: string }).id,
      uploader_id: user.id,
      attachment_type: "design_output",
      url: d.imageUrl,
      thumbnail_url: d.imageUrl,
      sort_order: idx,
      is_public: true,
    }));
    const { error: attachmentError } = await admin
      .from("community_attachments")
      .insert(rows);
    if (attachmentError) {
      console.error(
        "[share-from-estimate] attachment insert failed:",
        attachmentError.message,
      );
    }
  }

  // 10) analytics event — 스키마는 event_name/props인데 event_type/properties로 raw insert해
  // 매번 조용히 실패하던 버그(2026-07-07) → 정식 헬퍼로 교체 (sanitize·비동기·no-throw)
  trackServerEventAsync({
    eventName: "community.post_created_from_estimate",
    actorType: "consumer",
    userId: user.id,
    props: {
      postId: (postRow as { id: string }).id,
      boardSlug: body.boardSlug,
      projectMode: redacted.projectMode,
      regionLabel: redacted.redactedProject.regionLabel,
      areaLabel: redacted.redactedProject.areaLabel,
      totalAmountRangeLabel: redacted.redactedEstimateSummary.totalAmountRangeLabel,
      hasDesignImages: redacted.redactedDesignOutputs.length > 0,
      hasTradeSummary: redacted.redactedTradeGroups.length > 0,
      hasBrandSku: visibility.showBrandSku,
      privacyAutoScanPassed: redacted.privacyReport.autoScanPassed,
    },
  });

  return NextResponse.json({
    postId: (postRow as { id: string }).id,
    snapshotId: (snapshotRow as { id: string }).id,
    status,
    privacyReport: redacted.privacyReport,
    postUrl: `/community/posts/${(postRow as { id: string }).id}`,
  });
}

function buildAutoTags(redacted: ReturnType<typeof redactProjectForCommunity>): string[] {
  const tags: string[] = [];
  if (redacted.redactedProject.areaLabel) tags.push(redacted.redactedProject.areaLabel);
  if (redacted.redactedProject.regionLabel) tags.push(redacted.redactedProject.regionLabel);
  if (redacted.redactedProject.buildingType) tags.push(redacted.redactedProject.buildingType);
  if (redacted.redactedProject.businessType) tags.push(redacted.redactedProject.businessType);
  if (redacted.redactedProject.expansionLabel) tags.push(redacted.redactedProject.expansionLabel);
  for (const room of redacted.redactedProject.rooms.slice(0, 3)) tags.push(room);
  return Array.from(new Set(tags));
}
