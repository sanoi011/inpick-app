/**
 * material_products → material_product_images 정규화 (Phase 2).
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md
 *        Phase 2 — 제품 이미지/embedding 인덱스 구축
 *
 * 책임:
 *   - material_products의 thumbnail_url / installed_photo_urls를 material_product_images로 정규화
 *   - 이미 존재하는 material_product_id+image_url은 skip (중복 방지)
 *   - perceptual_hash 계산 (Phase 후속 — 현재는 미실행)
 *   - clip_embedding은 별도 스크립트(embed-material-product-images.ts)에서 채움
 *
 * 사용:
 *   npx tsx scripts/build-material-product-image-index.ts
 *   npx tsx scripts/build-material-product-image-index.ts --dry true
 *   npx tsx scripts/build-material-product-image-index.ts --batchSize 500 --limit 5000
 */
import { createClient } from "@supabase/supabase-js";

interface Row {
  id: string;
  thumbnail_url?: string | null;
  installed_photo_urls?: string[] | null;
  is_verified?: boolean;
  data_source?: string | null;
}

interface ImgInsert {
  material_product_id: string;
  image_url: string;
  image_kind: "reference" | "catalog";
  source?: string | null;
  source_license?: string;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dry === "true";
  const batchSize = parseInt(args.batchSize || "1000", 10);
  const limit = parseInt(args.limit || "0", 10); // 0 = 전체

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[build-mpi] Supabase 환경변수 미설정");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[build-mpi] dryRun=${dryRun} batchSize=${batchSize} limit=${limit || "all"}`);

  // 기존 material_product_images의 (product_id, image_url) 셋 조회 — 중복 방지
  const knownPairs = new Set<string>();
  let pageOffset = 0;
  while (true) {
    const { data, error } = await admin
      .from("material_product_images")
      .select("material_product_id, image_url")
      .range(pageOffset, pageOffset + 999);
    if (error) {
      console.warn("[build-mpi] mpi 조회 에러:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data as { material_product_id: string; image_url: string }[]) {
      knownPairs.add(`${r.material_product_id}::${r.image_url}`);
    }
    if (data.length < 1000) break;
    pageOffset += 1000;
  }
  console.log(`[build-mpi] 기존 material_product_images pairs: ${knownPairs.size}`);

  // material_products 페이지네이션 + 정규화
  let totalProducts = 0;
  let totalInserts = 0;
  let totalSkipped = 0;
  let offset = 0;

  while (true) {
    const remaining = limit > 0 ? limit - totalProducts : Infinity;
    if (remaining <= 0) break;
    const take = Math.min(batchSize, remaining);

    const { data, error } = await admin
      .from("material_products")
      .select("id, thumbnail_url, installed_photo_urls, is_verified, data_source")
      .order("created_at", { ascending: true })
      .range(offset, offset + take - 1);
    if (error) {
      console.warn("[build-mpi] material_products 조회 에러:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    const inserts: ImgInsert[] = [];
    for (const r of data as Row[]) {
      const productId = r.id;
      const seen = new Set<string>();

      if (r.thumbnail_url) {
        const k = `${productId}::${r.thumbnail_url}`;
        if (!knownPairs.has(k) && !seen.has(r.thumbnail_url)) {
          inserts.push({
            material_product_id: productId,
            image_url: r.thumbnail_url,
            image_kind: "reference",
            source: r.data_source ?? null,
            source_license: r.is_verified ? "verified-source" : "crawled-unknown",
          });
          knownPairs.add(k);
          seen.add(r.thumbnail_url);
        } else {
          totalSkipped++;
        }
      }

      const photos = (r.installed_photo_urls || []).filter(Boolean);
      for (const p of photos) {
        if (!p || seen.has(p)) continue;
        const k = `${productId}::${p}`;
        if (!knownPairs.has(k)) {
          inserts.push({
            material_product_id: productId,
            image_url: p,
            image_kind: "catalog",
            source: r.data_source ?? null,
            source_license: r.is_verified ? "verified-source" : "crawled-unknown",
          });
          knownPairs.add(k);
          seen.add(p);
        } else {
          totalSkipped++;
        }
      }
    }

    if (inserts.length > 0 && !dryRun) {
      const { error: insertErr } = await admin
        .from("material_product_images")
        .insert(inserts);
      if (insertErr) {
        console.warn(
          `[build-mpi] insert error at offset=${offset}: ${insertErr.message}`,
        );
      } else {
        totalInserts += inserts.length;
      }
    } else if (dryRun) {
      totalInserts += inserts.length;
    }

    totalProducts += data.length;
    offset += data.length;
    console.log(
      `  progress: products=${totalProducts}, inserts=${totalInserts}, skipped(dup)=${totalSkipped}`,
    );

    if (data.length < take) break;
  }

  console.log(
    `[build-mpi] DONE — products=${totalProducts}, inserts=${totalInserts}${dryRun ? " (DRY)" : ""}, skipped=${totalSkipped}`,
  );
}

main().catch((e) => {
  console.error("[build-mpi] fatal:", e);
  process.exit(1);
});
