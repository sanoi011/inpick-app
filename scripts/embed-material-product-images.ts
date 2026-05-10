/**
 * material_product_images.clip_embedding 채우기 (Phase 2).
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md
 *        Phase 2 — 제품 이미지 embedding 인덱스 구축
 *
 * 정책: Gemini 무사용 — RunPod CLIP/OpenCLIP worker 또는 OpenAI vision endpoint 사용.
 *
 * 단계:
 *   1. clip_embedding이 NULL인 row 페이징
 *   2. RUNPOD_VISION_MATERIALS_ENDPOINT가 설정되면 worker로 image_url → 512-dim embedding 요청
 *   3. 미설정이면 deterministic mock embedding (테스트용 — production 사용 금지)
 *   4. UPDATE material_product_images SET clip_embedding = $1 WHERE id = $2
 *
 * 사용:
 *   npx tsx scripts/embed-material-product-images.ts
 *   npx tsx scripts/embed-material-product-images.ts --dry true --limit 100
 *   npx tsx scripts/embed-material-product-images.ts --batchSize 50 --provider runpod
 */
import { createClient } from "@supabase/supabase-js";

interface Row {
  id: string;
  image_url: string;
  material_product_id: string;
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

/** RunPod vision-materials worker로 이미지 → CLIP 512-dim embedding */
async function embedViaRunPod(imageUrl: string): Promise<number[] | null> {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_VISION_MATERIALS_ENDPOINT;
  if (!apiKey || !endpoint) return null;
  try {
    const res = await fetch(`${endpoint}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          mode: "embed_only",
          image_url: imageUrl,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { output?: { embedding?: number[] } };
    return data.output?.embedding || null;
  } catch {
    return null;
  }
}

/**
 * Mock embedding — image_url 해시 기반 deterministic 512-dim 벡터.
 * Production 사용 금지 — 테스트/dev 전용.
 */
function mockEmbedding(imageUrl: string): number[] {
  const hash = simpleHash(imageUrl);
  const arr = new Array(512).fill(0);
  for (let i = 0; i < 512; i++) {
    const seed = (hash + i) % 1000;
    arr[i] = (seed - 500) / 500; // -1 ~ 1 정규화
  }
  // L2 정규화
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? arr.map((v) => v / norm) : arr;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dry === "true";
  const batchSize = parseInt(args.batchSize || "20", 10);
  const limit = parseInt(args.limit || "0", 10);
  const provider = (args.provider || "auto").toLowerCase(); // auto | runpod | mock

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[embed-mpi] Supabase 환경변수 미설정");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const useRunPod =
    provider === "runpod" ||
    (provider === "auto" && process.env.RUNPOD_VISION_MATERIALS_ENDPOINT);

  console.log(
    `[embed-mpi] provider=${useRunPod ? "runpod" : "mock"} dryRun=${dryRun} batchSize=${batchSize} limit=${limit || "all"}`,
  );
  if (!useRunPod) {
    console.warn(
      "[embed-mpi] ⚠ Mock embedding 사용 — production에서는 RUNPOD_VISION_MATERIALS_ENDPOINT 설정 필수",
    );
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let offset = 0;

  while (true) {
    const remaining = limit > 0 ? limit - processed : Infinity;
    if (remaining <= 0) break;
    const take = Math.min(batchSize, remaining);

    const { data, error } = await admin
      .from("material_product_images")
      .select("id, image_url, material_product_id")
      .is("clip_embedding", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + take - 1);
    if (error) {
      console.warn("[embed-mpi] 조회 에러:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as Row[]) {
      const embedding = useRunPod
        ? await embedViaRunPod(r.image_url)
        : mockEmbedding(r.image_url);
      processed++;
      if (!embedding) {
        failed++;
        continue;
      }
      if (!dryRun) {
        const { error: updErr } = await admin
          .from("material_product_images")
          .update({ clip_embedding: embedding })
          .eq("id", r.id);
        if (updErr) {
          console.warn(`  fail ${r.id}: ${updErr.message}`);
          failed++;
        } else {
          succeeded++;
        }
      } else {
        succeeded++;
      }
    }

    offset += data.length;
    console.log(
      `  progress: processed=${processed}, succeeded=${succeeded}, failed=${failed}`,
    );

    if (data.length < take) break;
  }

  console.log(
    `[embed-mpi] DONE — processed=${processed}, succeeded=${succeeded}${dryRun ? " (DRY)" : ""}, failed=${failed}`,
  );
  console.log(
    `[embed-mpi] 다음: ivfflat index 통계 갱신 (Supabase SQL — VACUUM ANALYZE material_product_images;)`,
  );
}

main().catch((e) => {
  console.error("[embed-mpi] fatal:", e);
  process.exit(1);
});
